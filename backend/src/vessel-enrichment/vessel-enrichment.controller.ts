import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { VesselEnrichmentService } from './vessel-enrichment.service';
import { VesselEnrichmentQueueService } from './vessel-enrichment-queue.service';
import { VesselEnrichmentSchedulerService } from './vessel-enrichment-scheduler.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, UserRole } from '../auth/decorators/roles.decorator';

@Controller('vessel-enrichment')
@UseGuards(AuthGuard, RolesGuard)
export class VesselEnrichmentController {
  constructor(
    private enrichmentService: VesselEnrichmentService,
    private queueService: VesselEnrichmentQueueService,
    private schedulerService: VesselEnrichmentSchedulerService,
  ) {}

  /**
   * Get enrichment statistics
   */
  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  async getStatistics() {
    const [enrichmentStats, queueStats, schedulerStatus] = await Promise.all([
      this.enrichmentService.getStatistics(),
      this.queueService.getQueueStats(),
      Promise.resolve(this.schedulerService.getStatus()),
    ]);

    return {
      enrichment: enrichmentStats,
      queue: queueStats,
      scheduler: schedulerStatus,
    };
  }

  /**
   * Enrich a single vessel immediately
   */
  @Post('enrich/:mmsi')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async enrichVessel(@Param('mmsi') mmsi: string) {
    const result = await this.enrichmentService.enrichVessel(mmsi);
    return {
      success: result.success,
      mmsi,
      source: result.source,
      fieldsUpdated: result.fieldsUpdated,
      duration: result.duration,
      error: result.error,
    };
  }

  /**
   * Add vessel(s) to enrichment queue
   */
  @Post('queue')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @HttpCode(HttpStatus.CREATED)
  async addToQueue(@Body() body: { mmsi?: string; mmsiList?: string[]; priority?: number }) {
    const { mmsi, mmsiList, priority = 0 } = body;

    if (mmsi) {
      await this.queueService.addToQueue(mmsi, priority);
      return { message: `Added ${mmsi} to queue`, count: 1 };
    } else if (mmsiList && mmsiList.length > 0) {
      await this.queueService.addManyToQueue(mmsiList, priority);
      return { message: `Added ${mmsiList.length} vessels to queue`, count: mmsiList.length };
    } else {
      return { message: 'No MMSI provided', count: 0 };
    }
  }

  /**
   * Queue all unenriched vessels
   */
  @Post('queue/unenriched')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async queueUnenriched(@Query('limit') limit?: string) {
    const count = await this.queueService.queueUnenrichedVessels(
      limit ? parseInt(limit) : undefined,
    );
    return { message: `Queued ${count} unenriched vessels`, count };
  }

  /**
   * Process queue manually
   */
  @Post('queue/process')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async processQueue(@Query('maxItems') maxItems?: string) {
    const count = await this.queueService.processQueue(maxItems ? parseInt(maxItems) : 10);
    return { message: `Processed ${count} items from queue`, count };
  }

  /**
   * Retry failed enrichments
   */
  @Post('queue/retry-failed')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async retryFailed() {
    const count = await this.queueService.retryFailed();
    return { message: `Reset ${count} failed items for retry`, count };
  }

  /**
   * Cleanup old queue items
   */
  @Post('queue/cleanup')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async cleanupQueue(@Query('days') days?: string) {
    const count = await this.queueService.cleanupQueue(days ? parseInt(days) : 7);
    return { message: `Cleaned up ${count} old queue items`, count };
  }

  /**
   * Get queue statistics
   */
  @Get('queue/stats')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  async getQueueStats() {
    return this.queueService.getQueueStats();
  }

  /**
   * Get enrichment history for a vessel
   */
  @Get('history/:mmsi')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  async getHistory(@Param('mmsi') mmsi: string, @Query('limit') limit?: string) {
    const history = await this.enrichmentService.getEnrichmentHistory(
      mmsi,
      limit ? parseInt(limit) : 20,
    );
    return { mmsi, history };
  }

  /**
   * Enable/disable scheduler
   */
  @Post('scheduler/:action')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async controlScheduler(@Param('action') action: 'enable' | 'disable') {
    const enabled = action === 'enable';
    this.schedulerService.setEnabled(enabled);
    return { message: `Scheduler ${enabled ? 'enabled' : 'disabled'}`, enabled };
  }

  /**
   * Get scheduler status
   */
  @Get('scheduler/status')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  async getSchedulerStatus() {
    return this.schedulerService.getStatus();
  }
}
