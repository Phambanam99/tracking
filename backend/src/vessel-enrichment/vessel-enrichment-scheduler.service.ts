import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VesselEnrichmentQueueService } from './vessel-enrichment-queue.service';

/**
 * Scheduled tasks for vessel enrichment
 * Runs 24/7 to continuously enrich vessel data
 */
@Injectable()
export class VesselEnrichmentSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(VesselEnrichmentSchedulerService.name);
  private isEnabled = true;

  constructor(private queueService: VesselEnrichmentQueueService) {}

  async onModuleInit() {
    // Check if enrichment is enabled via environment variable
    this.isEnabled = process.env.VESSEL_ENRICHMENT_ENABLED !== 'false';

    if (this.isEnabled) {
      this.logger.log('Vessel enrichment scheduler initialized and enabled');
      // Queue initial batch on startup
      setTimeout(() => this.queueUnenrichedVessels(), 10000); // 10 seconds after startup
    } else {
      this.logger.warn('Vessel enrichment scheduler is DISABLED');
    }
  }

  /**
   * Process queue every 10 minutes
   * This is the main worker that continuously enriches vessels
   * Using conservative timing due to VesselFinder rate limits (2 req/min = 20 req per 10 min)
   */
  @Cron('*/1 * * * *', {
    name: 'process-enrichment-queue',
  })
  async processQueue() {
    if (!this.isEnabled) return;

    this.logger.debug('Starting scheduled queue processing');

    try {
      // Process up to 2 items per 10 minutes = 12 per hour = 288 per day (conservative!)
      const processed = await this.queueService.processQueue(2);
      if (processed > 0) {
        this.logger.log(`Scheduled processing completed: ${processed} vessels enriched`);
      }
    } catch (error: any) {
      this.logger.error(`Scheduled processing error: ${error.message}`, error.stack);
    }
  }

  /**
   * Queue unenriched vessels every 6 hours
   * Ensures new vessels get queued automatically (less frequent due to conservative approach)
   */
  @Cron('0 */6 * * *', {
    name: 'queue-unenriched-vessels',
  })
  async queueUnenrichedVessels() {
    if (!this.isEnabled) return;

    this.logger.debug('Checking for unenriched vessels');

    try {
      const queued = await this.queueService.queueUnenrichedVessels(50); // Queue up to 50 every 6 hours
      if (queued > 0) {
        this.logger.log(`Queued ${queued} unenriched vessels`);
      }
    } catch (error: any) {
      this.logger.error(`Error queuing vessels: ${error.message}`, error.stack);
    }
  }

  /**
   * Cleanup old queue items every day at 3 AM
   */
  @Cron('0 3 * * *', {
    name: 'cleanup-enrichment-queue',
  })
  async cleanupQueue() {
    if (!this.isEnabled) return;

    this.logger.debug('Starting queue cleanup');

    try {
      const cleaned = await this.queueService.cleanupQueue(7); // Remove items older than 7 days
      if (cleaned > 0) {
        this.logger.log(`Cleaned up ${cleaned} old queue items`);
      }
    } catch (error: any) {
      this.logger.error(`Cleanup error: ${error.message}`, error.stack);
    }
  }

  /**
   * Retry failed items every 6 hours
   */
  @Cron('0 */6 * * *', {
    name: 'retry-failed-enrichments',
  })
  async retryFailed() {
    if (!this.isEnabled) return;

    this.logger.debug('Retrying failed enrichments');

    try {
      const retried = await this.queueService.retryFailed();
      if (retried > 0) {
        this.logger.log(`Reset ${retried} failed items for retry`);
      }
    } catch (error: any) {
      this.logger.error(`Retry error: ${error.message}`, error.stack);
    }
  }

  /**
   * Log statistics every hour
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'log-enrichment-stats',
  })
  async logStatistics() {
    if (!this.isEnabled) return;

    try {
      const queueStats = await this.queueService.getQueueStats();
      this.logger.log(
        `Queue Stats - Pending: ${queueStats.pending}, Processing: ${queueStats.processing}, Completed: ${queueStats.completed}, Failed: ${queueStats.failed}`,
      );
    } catch (error: any) {
      this.logger.error(`Stats error: ${error.message}`);
    }
  }

  /**
   * Enable/disable the scheduler
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    this.logger.log(`Enrichment scheduler ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      uptime: process.uptime(),
    };
  }
}
