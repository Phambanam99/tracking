// src/ais/ais-signalr.service.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  HubConnection,
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
} from '@microsoft/signalr';
import { Subject } from 'rxjs';
import axios from 'axios';
import aisConfig from '../config/ais.config';
import { AisModel, QueryResultState } from './ais.types';

@Injectable()
export class AisSignalrService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AisSignalrService.name);
  private connection: HubConnection | null = null;
  private isConnecting = false;

  // Subjects để phát sự kiện ra cho SSE/WebSocket
  private start$ = new Subject<{ state: QueryResultState.Start; count: number }>();
  private data$ = new Subject<{ state: QueryResultState.Query; data: AisModel[] }>();
  private end$ = new Subject<{ state: QueryResultState.End }>();

  // public observables
  startStream$ = this.start$.asObservable();
  dataStream$ = this.data$.asObservable();
  endStream$ = this.end$.asObservable();

  // cache cấu hình
  private cfg = aisConfig();

  async onModuleInit() {
    try {
      await this.connect();
    } catch (e: any) {
      // Never throw on init; schedule reconnect and continue
      this.logger.error(`SignalR initial connect error: ${e?.message ?? e}`);
      setTimeout(() => {
        this.connect().catch((err) =>
          this.logger.error(`Delayed reconnect failed: ${err?.message ?? err}`),
        );
      }, 15000);
    }
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /** Kết nối tới Hub SignalR */
  async connect() {
    if (this.connection) return;
    if (this.isConnecting) return;
    this.isConnecting = true;
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

    const tryStart = async (
      transport?: HttpTransportType,
      skipNegotiation?: boolean,
    ): Promise<boolean> => {
      try {
        const level =
          this.cfg.AIS_SIGNALR_LOG_LEVEL === 'none'
            ? LogLevel.None
            : this.cfg.AIS_SIGNALR_LOG_LEVEL === 'critical'
              ? LogLevel.Critical
              : this.cfg.AIS_SIGNALR_LOG_LEVEL === 'error'
                ? LogLevel.Error
                : this.cfg.AIS_SIGNALR_LOG_LEVEL === 'warning'
                  ? LogLevel.Warning
                  : this.cfg.AIS_SIGNALR_LOG_LEVEL === 'debug'
                    ? LogLevel.Debug
                    : this.cfg.AIS_SIGNALR_LOG_LEVEL === 'trace'
                      ? LogLevel.Trace
                      : LogLevel.Information;
        this.connection = new HubConnectionBuilder()
          .withUrl(hubUrl, { transport, skipNegotiation })
          .withAutomaticReconnect([1000, 2000, 5000, 10000])
          .configureLogging(level)
          .build();

        this.connection.on('QueryCount', (count: number) => {
          this.logger.debug?.(`QueryCount: ${count}`);
          this.start$.next({ state: QueryResultState.Start, count });
        });

        this.connection.on('QueryData', (data: AisModel[]) => {
          const len = Array.isArray(data) ? data.length : 0;
          this.logger.debug?.(`QueryData batch: ${len}`);
          const firstData = data[0];
          if (firstData) this.logger.debug?.(`First data of batch: ${JSON.stringify(firstData)}`);
          this.data$.next({ state: QueryResultState.Query, data: data ?? [] });
        });

        this.connection.on('QueryEnd', () => {
          this.logger.debug?.('QueryEnd');
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
        const tp = transport != null ? HttpTransportType[transport] : 'Auto';
        this.logger.log(`SignalR connected (transport=${tp}) id=${this.connection.connectionId}`);
        return true;
      } catch (err: any) {
        const tp = transport != null ? HttpTransportType[transport] : 'Auto';
        this.logger.error(
          `Failed to start SignalR (transport=${tp}, skipNegotiation=${!!skipNegotiation}): ${
            err?.message ?? err
          }`,
        );
        try {
          await this.disconnect();
        } catch (e) {
          // ignore
        }
        return false;
      }
    };

    const started =
      (await tryStart(HttpTransportType.WebSockets, true)) ||
      (await tryStart(undefined, false)) ||
      (await tryStart(HttpTransportType.ServerSentEvents, false)) ||
      (await tryStart(HttpTransportType.LongPolling, false));

    if (!started) {
      setTimeout(() => {
        this.connect().catch((e) =>
          this.logger.error(`Reconnect attempt failed: ${e?.message ?? e}`),
        );
      }, 15000);
      this.isConnecting = false;
      return;
    }
    this.isConnecting = false;
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.stop().catch(() => null);
      this.connection = null;
      this.logger.log('SignalR disconnected');
    }
  }

  /** Gọi REST /api/query để bắt đầu truy vấn (sau khi đã connect) */
  async triggerQuery(opts?: { query?: string; usingLastUpdateTime?: boolean; userId?: number }) {
    if (!this.connection || !this.connection.connectionId) {
      this.logger.warn('triggerQuery called but SignalR is not connected. Skipping.');
      // Try to connect in the background
      this.connect().catch((e) =>
        this.logger.error(`Background connect failed: ${e?.message ?? e}`),
      );
      return false as const;
    }

    const body = {
      ConnectionId: this.connection.connectionId,
      UserId: opts?.userId ?? this.cfg.AIS_USER_ID,
      Query: opts?.query ?? this.cfg.AIS_QUERY,
      UsingLastUpdateTime: opts?.usingLastUpdateTime ?? this.cfg.AIS_USING_LAST_UPDATE_TIME,
    };

    const url = `${this.cfg.AIS_HOST}/api/query`;
    this.logger.log(`POST ${url} body=${JSON.stringify(body)}`);

    try {
      const res = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      });
      this.logger.log(`Query API: ${res.status} ${res.statusText}`);
      return res.data ?? true;
    } catch (err: any) {
      this.logger.error(`Query API failed: ${err?.message ?? err}`);
      return false as const;
    }
  }
}
