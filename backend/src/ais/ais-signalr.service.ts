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
  private lastConnectAttempt: number | null = null;
  private lastMessageTime: number | null = null;

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
    this.lastConnectAttempt = Date.now();

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
          this.lastMessageTime = Date.now();
          this.data$.next({ state: QueryResultState.Query, data: data ?? [] });
        });

        this.connection.on('QueryEnd', () => {
          this.logger.debug?.('QueryEnd');
          this.lastMessageTime = Date.now();
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
        const cid = this.connection.connectionId;
        if (!cid) {
          this.logger.warn(
            `SignalR start succeeded but connectionId null (transport=${tp}, skipNegotiation=${!!skipNegotiation}) – treating as failure to allow fallback`,
          );
          try {
            await this.connection.stop().catch(() => null);
          } catch (_) {
            /* ignore */
          }
          this.connection = null;
          return false;
        }
        this.logger.log(`SignalR connected (transport=${tp}) id=${cid}`);
        this.lastMessageTime = Date.now();
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
      (await tryStart(undefined, false)) ||
      (await tryStart(HttpTransportType.WebSockets, false)) ||
      (await tryStart(HttpTransportType.WebSockets, true)) ||
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

  /** Trạng thái kết nối hiện tại */
  getStatus() {
    return {
      isConnected: !!this.connection && !!this.connection.connectionId,
      connectionId: this.connection?.connectionId ?? null,
      isConnecting: this.isConnecting,
      lastConnectAttempt: this.lastConnectAttempt,
      lastMessageTime: this.lastMessageTime,
      configHost: this.cfg.AIS_HOST,
    };
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.stop().catch(() => null);
      this.connection = null;
      this.logger.log('SignalR disconnected');
    }
  }

  /** Chờ cho đến khi kết nối sẵn sàng (có connectionId) hoặc hết timeout */
  async waitForConnection(timeoutMs = 15000): Promise<boolean> {
    const start = Date.now();
    let lastLog = 0;
    while (Date.now() - start < timeoutMs) {
      const isConnected = !!this.connection && !!this.connection.connectionId;
      if (isConnected) return true;
      // Nếu chưa có connection object và không ở trạng thái connecting thì thử connect
      if (!this.connection && !this.isConnecting) {
        try {
          // Fire and forget
          this.connect().catch((e) =>
            this.logger.error(`waitForConnection connect error: ${e?.message ?? e}`),
          );
        } catch (e: any) {
          this.logger.error(`waitForConnection immediate connect exception: ${e?.message ?? e}`);
        }
      }
      // Log trạng thái mỗi 2s để debug
      const now = Date.now();
      if (now - lastLog >= 2000) {
        lastLog = now;
        const state = this.connection ? 'HAS_CONN' : 'NO_CONN';
        const cid = (this.connection as any)?.connectionId;
        this.logger.debug?.(
          `waitForConnection progress state=${state} cid=${cid ?? 'null'} connecting=${this.isConnecting}`,
        );
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    this.logger.warn(`waitForConnection timeout after ${timeoutMs}ms`);
    return false;
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
    this.logger.log(
      `QueryDispatch connectionId=${body.ConnectionId} userId=${body.UserId} usingLastUpdateTime=${body.UsingLastUpdateTime} query="${body.Query}"`,
    );
    this.logger.log(`POST ${url} body=${JSON.stringify(body)}`);

    try {
      const res = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      });
      this.logger.log(`Query API: ${res.status} ${res.statusText}`);
      try {
        const raw = res.data;
        let preview: string;
        if (raw == null) preview = 'null';
        else if (typeof raw === 'string') preview = raw.slice(0, 300);
        else preview = JSON.stringify(raw).slice(0, 300);
        this.logger.debug?.(
          `Query API raw response preview: ${preview}${preview.length === 300 ? '…' : ''}`,
        );
      } catch (e) {
        this.logger.debug?.(`Query API raw response preview failed: ${(e as any)?.message}`);
      }
      return res.data ?? true;
    } catch (err: any) {
      this.logger.error(`Query API failed: ${err?.message ?? err}`);
      return false as const;
    }
  }
}
