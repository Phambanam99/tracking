// src/ais/ais-signalr.service.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  HubConnection,
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
} from '@microsoft/signalr';
import { Subject, share } from 'rxjs';
import axios from 'axios';
import aisConfig from '../config/ais.config';
import { AisModel, QueryResultState } from './ais.types';

@Injectable()
export class AisSignalrService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AisSignalrService.name);
  private connection: HubConnection | null = null;

  // Subjects với share() để tránh memory leak khi không có subscribers
  private start$ = new Subject<{ state: QueryResultState.Start; count: number }>();
  private data$ = new Subject<{ state: QueryResultState.Query; data: AisModel[] }>();
  private end$ = new Subject<{ state: QueryResultState.End }>();

  // public observables với share để auto-cleanup khi không có subscribers
  startStream$ = this.start$.asObservable().pipe(share());
  dataStream$ = this.data$.asObservable().pipe(share());
  endStream$ = this.end$.asObservable().pipe(share());

  // cache cấu hình
  private cfg = aisConfig();
  private autoTimer: NodeJS.Timeout | null = null;
  private triggering = false;
  private autoStarted = false;
  private lastLowerBound: Date | null = null; // incremental lower bound for dynamic query
  // Metrics instrumentation
  private metrics = {
    queryApiPosts: 0,
    queryCountEvents: 0,
    queryDataBatches: 0,
    queryDataRows: 0,
    lastEventAt: 0,
    lastQueryPostAt: 0,
    lastTsRange: '',
  };
  private pendingNoEventTimer: NodeJS.Timeout | null = null;

  /** Public status snapshot for diagnostics */
  getStatus() {
    return {
      connected: !!this.connection && this.connection.state === 'Connected',
      connectionId: this.connection?.connectionId || null,
      metrics: { ...this.metrics },
      lastLowerBound: this.lastLowerBound?.toISOString() || null,
      autoTrigger: {
        enabled: !!(this.cfg as any).AIS_AUTO_TRIGGER,
        intervalMs: (this.cfg as any).AIS_AUTO_TRIGGER_INTERVAL_MS || 15000,
        usingLastUpdateTime: (this.cfg as any).AIS_USING_LAST_UPDATE_TIME,
      },
      config: {
        AIS_ACTION_TYPE: (this.cfg as any).AIS_ACTION_TYPE,
        AIS_QUERY_MINUTES: (this.cfg as any).AIS_QUERY_MINUTES,
        AIS_QUERY_INCREMENTAL: (this.cfg as any).AIS_QUERY_INCREMENTAL,
      },
    };
  }

  /**
   * Build a dynamic time window query. If incremental mode is enabled and we have previously
   * advanced the lower bound, reuse it; otherwise look back AIS_QUERY_MINUTES minutes from now.
   * We preserve any tail filter (e.g. [***]) from the static query.
   */
  private buildDynamicQuery(): string {
    const minutes = this.cfg.AIS_QUERY_MINUTES || 10;
    let lower: Date;
    if (this.cfg.AIS_QUERY_INCREMENTAL && this.lastLowerBound) {
      lower = this.lastLowerBound;
    } else {
      lower = new Date(Date.now() - minutes * 60 * 1000);
      this.lastLowerBound = lower;
    }
    lower.setSeconds(0, 0); // normalize seconds for stable query strings
    const yyyy = lower.getUTCFullYear();
    const mm = lower.getUTCMonth() + 1;
    const dd = lower.getUTCDate();
    const HH = lower.getUTCHours();
    const MM = lower.getUTCMinutes();
    const staticQ = (this.cfg as any).AIS_QUERY;
    const bracketIdx = staticQ.indexOf('[');
    const tail = bracketIdx !== -1 ? staticQ.substring(bracketIdx) : '';
    return `(updatetime >= DateTime(${yyyy}, ${mm}, ${dd}, ${HH}, ${MM}, 0))${tail}`;
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    // Clear all timers first
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
    if (this.pendingNoEventTimer) {
      clearTimeout(this.pendingNoEventTimer);
      this.pendingNoEventTimer = null;
    }
    
    // Complete all subjects to release memory
    this.start$.complete();
    this.data$.complete();
    this.end$.complete();
    
    // Disconnect SignalR
    await this.disconnect();
    
    this.logger.log('AisSignalrService destroyed, all resources cleaned up');
  }

  /** Kết nối tới Hub SignalR */
  async connect() {
    if (this.connection) {
      // If already connected, still ensure auto trigger is initialized (in case config changed)
      this.setupAutoTrigger();
      return;
    }
    const hubUrl =
      `${this.cfg.AIS_HOST}/api/signalR?` +
      new URLSearchParams({
        Device: this.cfg.AIS_DEVICE,
        ConnectionId: '',
        ActionTypeValue: this.cfg.AIS_ACTION_TYPE,
        Query: this.cfg.AIS_QUERY,
        UserId: String(this.cfg.AIS_USER_ID),
        IsQueryLastestDataBeforeStream: this.cfg.AIS_QUERY_LATEST_BEFORE_STREAM,
      }).toString();

    this.logger.log(`Connecting SignalR: ${hubUrl}`);

    this.connection = new HubConnectionBuilder()
      .withUrl(hubUrl, { transport: HttpTransportType.WebSockets })
      .withAutomaticReconnect([1000, 2000, 5000, 10000])
      .configureLogging(LogLevel.Information)
      .build();

    // Catch-all instrumentation: wrap .on to log registrations & incoming events (debug only)
    if (process.env.AIS_DEBUG && process.env.AIS_DEBUG.match(/^(1|true|yes|on)$/i)) {
      const origOn = this.connection.on.bind(this.connection);
      (this.connection as any).on = (event: string, handler: (...args: any[]) => any) => {
        this.logger.debug(`[SignalR:on-register] ${event}`);
        return origOn(event, (...args: any[]) => {
          try {
            const summary = args
              .map((a) => {
                if (a == null) return 'null';
                if (Array.isArray(a)) return `Array(len=${a.length})`;
                if (typeof a === 'object') return `Object(keys=${Object.keys(a).length})`;
                return typeof a + ':' + String(a).slice(0, 40);
              })
              .join(', ');
            // this.logger.debug(`[SignalR:event] ${event} args=${summary}`);
          } catch (e: any) {
            // this.logger.debug(`[SignalR:event] ${event} (error summarizing args: ${e.message})`);
          }
          return handler(...args);
        });
      };
    }

    this.connection.on('QueryCount', (count: number) => {
      this.logger.log(`QueryCount: ${count}`);
      this.start$.next({ state: QueryResultState.Start, count });
      this.metrics.queryCountEvents++;
      this.metrics.lastEventAt = Date.now();
    });

    this.connection.on('QueryData', (data: AisModel[]) => {
      const len = Array.isArray(data) ? data.length : 0;
      // Validate data structure
      if (!data) {
        this.logger.warn('QueryData received null/undefined data');
        data = [];
      } else if (!Array.isArray(data)) {
        this.logger.warn(`QueryData received non-array data: ${typeof data}`);
        data = [];
      } else if (len > 0) {
        // Check first item to verify structure
        const sample = data[0];
        const hasExpectedStructure =
          sample &&
          typeof sample === 'object' &&
          (sample.mmsi !== undefined ||
            (sample.lat !== undefined && sample.lon !== undefined) ||
            sample.updatetime !== undefined);

        if (!hasExpectedStructure) {
          // this.logger.warn('QueryData may have unexpected structure - missing key AIS properties');
          // this.logger.debug(`First item sample: ${JSON.stringify(sample)}`);
        }
      }
      
      // Memory protection: limit batch size to prevent memory overflow
      const MAX_BATCH_SIZE = 10000;
      if (len > MAX_BATCH_SIZE) {
        this.logger.warn(`QueryData batch too large (${len}), truncating to ${MAX_BATCH_SIZE}`);
        data = data.slice(0, MAX_BATCH_SIZE);
      }
      
      // this.logger.log(`QueryData batch: ${len}`);
      this.data$.next({ state: QueryResultState.Query, data: data ?? [] });
      this.metrics.queryDataBatches++;
      this.metrics.queryDataRows += len;
      this.metrics.lastEventAt = Date.now();
      // Extra debug logging for raw data visibility (enable with AIS_DEBUG=1)
      if (process.env.AIS_DEBUG && process.env.AIS_DEBUG.toString().match(/^(1|true|yes|on)$/i)) {
        if (len === 0) {
          this.logger.debug('QueryData empty batch (no rows).');
        } else {
          const first: any = data[0];
          // this.logger.debug(`QueryData sample[0]: ${JSON.stringify(data[0], null, 2)}`);
          // Detect timestamp field variants
          const tsRaw: any =
            first.updatetime || first.updateTime || first.UpdateTime || first.timestamp;
          let minTs: number | null = null;
          let maxTs: number | null = null;
          for (const r of data as any[]) {
            const tRaw = (r.updatetime || r.updateTime || r.UpdateTime || r.timestamp) as any;
            if (tRaw) {
              const t = Date.parse(tRaw);
              if (!Number.isNaN(t)) {
                if (minTs == null || t < minTs) minTs = t;
                if (maxTs == null || t > maxTs) maxTs = t;
              }
            }
          }
          let rangeMsg = '';
          if (minTs && maxTs) {
            const ageMaxSec = (Date.now() - maxTs) / 1000;
            rangeMsg = ` tsRange=[${new Date(minTs).toISOString()} .. ${new Date(maxTs).toISOString()}] newestAgeSec=${ageMaxSec.toFixed(1)}`;
            this.metrics.lastTsRange = rangeMsg;
          }
          const keys = Object.keys(first).slice(0, 15).join(',');
          // this.logger.debug(
          //   `QueryData sample[0]: mmsi=${(first.mmsi || first.MMSI || '-') as any} ts=${tsRaw} keys=${keys}${rangeMsg}`,
          // );
        }
      }
      // Incremental advancement: push lower bound forward based on max timestamp in batch
      if ((this.cfg as any).AIS_QUERY_INCREMENTAL && len > 0) {
        let maxTs: number | null = null;
        for (const r of data) {
          const tsIso: any =
            (r as any).updatetime || (r as any).updateTime || (r as any).UpdateTime;
          if (tsIso) {
            const t = Date.parse(tsIso);
            if (!Number.isNaN(t) && (maxTs == null || t > maxTs)) maxTs = t;
          }
        }
        if (maxTs) {
          const next = new Date(maxTs + 60 * 1000); // advance +1 minute to reduce duplicates
          this.lastLowerBound = next;
          // this.logger.debug(
          //   `Incremental query advanced lower bound -> ${next.toISOString()} (maxTs=${new Date(maxTs).toISOString()})`,
          // );
        }
      }
    });

    this.connection.on('QueryEnd', () => {
      this.logger.log('QueryEnd');
      this.end$.next({ state: QueryResultState.End });
    });

    this.connection.onclose((err) =>
      this.logger.warn(`SignalR closed: ${err?.message ?? '(no reason)'}`),
    );
    this.connection.onreconnecting((err) =>
      this.logger.warn(`SignalR reconnecting: ${err?.message ?? '(no reason)'}`),
    );
    this.connection.onreconnected((id) => this.logger.log(`SignalR reconnected id=${id}`));

    await this.connection.start();
    this.logger.log(`SignalR connected, connectionId=${this.connection.connectionId}`);

    this.setupAutoTrigger();
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.stop().catch(() => null);
      this.connection = null;
      this.logger.log('SignalR disconnected');
    }
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
    this.autoStarted = false;
  }

  /** Gọi REST /api/query để bắt đầu truy vấn (sau khi đã connect) */
  async triggerQuery(opts?: {
    query?: string;
    usingLastUpdateTime?: boolean;
    userId?: number;
    forceStatic?: boolean;
  }) {
    if (!this.connection || !this.connection.connectionId) {
      throw new Error('SignalR is not connected yet.');
    }

    // Determine query precedence: explicit override > dynamic > static
    let query = opts?.query;
    if (!query) {
      if (!opts?.forceStatic) {
        try {
          query = this.buildDynamicQuery();
        } catch (e: any) {
          this.logger.warn('Dynamic query build failed, fallback to static: ' + e.message);
        }
      }
      if (!query) query = (this.cfg as any).AIS_QUERY;
    }

    const body = {
      ConnectionId: this.connection.connectionId,
      UserId: opts?.userId ?? (this.cfg as any).AIS_USER_ID,
      Query: query,
      UsingLastUpdateTime:
        opts?.usingLastUpdateTime ?? (this.cfg as any).AIS_USING_LAST_UPDATE_TIME,
    };

    const url = `${this.cfg.AIS_HOST}/api/query`;
    this.logger.log(`POST ${url} body=${JSON.stringify(body)}`);

    const res = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    this.logger.log(`Query API: ${res.status} ${res.statusText}`);
    // Metrics & no-event watchdog setup
    this.metrics.queryApiPosts++;
    this.metrics.lastQueryPostAt = Date.now();
    const timeoutMs = Number(process.env.AIS_QUERY_EVENT_TIMEOUT_MS || 10000);
    if (this.pendingNoEventTimer) clearTimeout(this.pendingNoEventTimer);
    this.pendingNoEventTimer = setTimeout(() => {
      // If no event has arrived since this POST, log diagnostic
      if (this.metrics.lastEventAt < this.metrics.lastQueryPostAt) {
        const ageSec = ((Date.now() - this.metrics.lastQueryPostAt) / 1000).toFixed(1);
        this.logger.warn(
          `No SignalR events (QueryCount/Data) received ${ageSec}s after query POST. posts=${this.metrics.queryApiPosts} countEvents=${this.metrics.queryCountEvents} dataBatches=${this.metrics.queryDataBatches} rows=${this.metrics.queryDataRows} lastTsRange='${this.metrics.lastTsRange}'`,
        );
      }
    }, timeoutMs);
    return res.data ?? true;
  }

  private setupAutoTrigger() {
    if (!(this.cfg as any).AIS_AUTO_TRIGGER) {
      if (this.autoStarted) {
        this.logger.log('AIS auto trigger disabled by config; clearing interval.');
      }
      if (this.autoTimer) clearInterval(this.autoTimer);
      this.autoTimer = null;
      this.autoStarted = false;
      return;
    }
    const interval = (this.cfg as any).AIS_AUTO_TRIGGER_INTERVAL_MS || 15000;
    if (this.autoTimer) clearInterval(this.autoTimer);
    this.logger.log(`AIS auto trigger (re)initialized every ${interval}ms`);
    const usingLastUpdateTime = (this.cfg as any).AIS_USING_LAST_UPDATE_TIME;
    if (!this.triggering && this.connection?.connectionId) {
      this.triggering = true;
      this.triggerQuery({ usingLastUpdateTime })
        .catch((e) => this.logger.warn('Initial auto trigger failed: ' + e.message))
        .finally(() => (this.triggering = false));
    }
    this.autoTimer = setInterval(async () => {
      if (this.triggering) return;
      if (!this.connection || !this.connection.connectionId) return;
      try {
        this.triggering = true;
        await this.triggerQuery({ usingLastUpdateTime });
      } catch (e: any) {
        this.logger.warn('Auto trigger failed: ' + e.message);
      } finally {
        this.triggering = false;
      }
    }, interval);
    this.autoStarted = true;
  }
}
