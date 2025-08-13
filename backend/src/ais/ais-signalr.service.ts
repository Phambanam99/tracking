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
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /** Kết nối tới Hub SignalR */
  async connect() {
    if (this.connection) return;
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

    this.connection.on('QueryCount', (count: number) => {
      this.logger.log(`QueryCount: ${count}`);
      this.start$.next({ state: QueryResultState.Start, count });
    });

    this.connection.on('QueryData', (data: AisModel[]) => {
      const len = Array.isArray(data) ? data.length : 0;
      this.logger.log(`QueryData batch: ${len}`);
      this.data$.next({ state: QueryResultState.Query, data: data ?? [] });
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
      throw new Error('SignalR is not connected yet.');
    }

    const body = {
      ConnectionId: this.connection.connectionId,
      UserId: opts?.userId ?? this.cfg.AIS_USER_ID,
      Query: opts?.query ?? this.cfg.AIS_QUERY,
      UsingLastUpdateTime: opts?.usingLastUpdateTime ?? this.cfg.AIS_USING_LAST_UPDATE_TIME,
    };

    const url = `${this.cfg.AIS_HOST}/api/query`;
    this.logger.log(`POST ${url} body=${JSON.stringify(body)}`);

    const res = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    this.logger.log(`Query API: ${res.status} ${res.statusText}`);
    return res.data ?? true;
  }
}
