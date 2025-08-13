// src/ais/ais.controller.ts
import { Controller, Get, Post, Body, Sse, MessageEvent, Logger } from '@nestjs/common';
import { map, merge, Observable, interval, startWith } from 'rxjs';
import { AisSignalrService } from './ais-signalr.service';
import type { QueryRequestDto } from './ais.types';
import { QueryResultState } from './ais.types';

@Controller('ais')
export class AisController {
  private readonly logger = new Logger(AisController.name);
  constructor(private readonly ais: AisSignalrService) {}

  /** Gọi REST để bắt đầu query (server sẽ stream dữ liệu qua SignalR về cho Nest) */
  @Post('query')
  async postQuery(@Body() dto: QueryRequestDto) {
    const data = await this.ais.triggerQuery({
      query: dto?.query,
      usingLastUpdateTime: dto?.usingLastUpdateTime,
      userId: dto?.userId,
    });
    return { success: true, data };
  }

  /** SSE: client subscribe để nhận Start / Data / End */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    this.logger.log('stream');
    const start$ = this.ais.startStream$.pipe(
      map(({ state, count }) => ({ type: state, data: { count } })),
    );

    const data$ = this.ais.dataStream$.pipe(map(({ state, data }) => ({ type: state, data })));

    const end$ = this.ais.endStream$.pipe(map(({ state }) => ({ type: state, data: null })));

    // Heartbeat để giữ kết nối tránh bị proxy/reset khi chưa có dữ liệu
    const heartbeat$ = interval(15000).pipe(
      map(() => ({ type: 'keepalive', data: null })),
      startWith({ type: 'keepalive', data: null }),
    );

    // Gộp 3 luồng thành 1 để SSE đẩy ra
    return merge(heartbeat$, start$, data$, end$) as unknown as Observable<MessageEvent>;
  }

  /** (tuỳ chọn) endpoint test connect lại */
  @Get('health')
  async health() {
    return { ok: true };
  }
}
