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
    // If backend not connected, return success=false but don't crash
    if (data === false) {
      return { success: false, error: 'SignalR is not connected' };
    }
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

  /** Test endpoint to manually trigger AIS data fetch */
  @Post('test-fetch')
  async testFetch() {
    try {
      // Calculate time 30 seconds ago (matching cron interval)
      const now = Date.now();
      const thirtySecondsAgo = new Date(now - 30000);
      const queryTime = `DateTime(${thirtySecondsAgo.getFullYear()}, ${thirtySecondsAgo.getMonth() + 1}, ${thirtySecondsAgo.getDate()}, ${thirtySecondsAgo.getHours()}, ${thirtySecondsAgo.getMinutes()}, ${thirtySecondsAgo.getSeconds()})`;

      // Simple test - just trigger a query and return status
      await this.ais.triggerQuery({
        query: `(updatetime >= ${queryTime})[***]`,
        usingLastUpdateTime: false,
        userId: 3,
      });

      return {
        success: true,
        message: 'AIS query triggered successfully. Check server logs for data processing.',
        timestamp: new Date().toISOString(),
        query: `(updatetime >= ${queryTime})[***]`,
      };
    } catch (error) {
      this.logger.error('Error testing AIS fetch:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
