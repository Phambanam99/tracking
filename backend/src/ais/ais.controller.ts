// src/ais/ais.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Sse,
  MessageEvent,
  Logger,
  Query,
  HttpException,
} from '@nestjs/common';
import { map, merge, Observable, interval, startWith } from 'rxjs';
import { AisSignalrService } from './ais-signalr.service';
import { AisAistreamService } from './ais-aistream.service';
import { AisOrchestratorService } from './ais-orchestrator.service';
import type { QueryRequestDto } from './ais.types';

@Controller('ais')
export class AisController {
  private readonly logger = new Logger(AisController.name);
  constructor(
    private readonly ais: AisSignalrService,
    private readonly aisAistream: AisAistreamService,
    private readonly orchestrator: AisOrchestratorService,
  ) {}

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
  stream(
    @Query('trigger') trigger?: string,
    @Query('mode') mode?: string,
  ): Observable<MessageEvent> {
    this.logger.log(`stream subscribe trigger=${trigger ?? 'none'} mode=${mode ?? 'raw'}`);
    if (trigger && ['1', 'true', 'yes'].includes(trigger.toLowerCase())) {
      // Thử tự động gọi query ngay khi client kết nối SSE
      this.ais
        .triggerQuery()
        .then(() => this.logger.log('Auto trigger query OK'))
        .catch((err) => this.logger.error(`Auto trigger query failed: ${err.message}`));
    }
    const heartbeat$ = interval(15000).pipe(
      map(() => ({ type: 'keepalive', data: null })),
      startWith({ type: 'keepalive', data: null }),
    );

    if (mode === 'fused') {
      const fused$ = this.orchestrator.fusedStream$.pipe(
        map((rec) => ({ type: 'Fused', data: rec })),
      );
      return merge(heartbeat$, fused$) as unknown as Observable<MessageEvent>;
    }

    const start$ = this.ais.startStream$.pipe(
      map(({ state, count }) => ({ type: state, data: { count } })),
    );
    const data$ = this.ais.dataStream$.pipe(map(({ state, data }) => ({ type: state, data })));
    const end$ = this.ais.endStream$.pipe(map(({ state }) => ({ type: state, data: null })));

    return merge(heartbeat$, start$, data$, end$) as unknown as Observable<MessageEvent>;
  }

  /** Endpoint đơn giản để trigger thủ công (khác với /ais/query để không nhầm lẫn) */
  @Post('trigger')
  async trigger(@Body() dto: QueryRequestDto) {
    try {
      const data = await this.ais.triggerQuery({
        query: dto?.query,
        usingLastUpdateTime: dto?.usingLastUpdateTime,
        userId: dto?.userId,
      });
      return { success: true, data };
    } catch (err: any) {
      throw new HttpException(`Trigger failed: ${err.message}`, 500);
    }
  }

  /** (tuỳ chọn) endpoint test connect lại */
  @Get('health')
  async health() {
    return { ok: true };
  }

  /** Diagnostic status (metrics & fusion stats) */
  @Get('status')
  async status() {
    const signalr = this.ais.getStatus();
    const aisstream = this.aisAistream.getStatus();
    const orchestratorStats = this.orchestrator.getStats();
    return {
      signalr,
      aisstream,
      orchestrator: orchestratorStats,
      now: new Date().toISOString(),
    };
  }
}
