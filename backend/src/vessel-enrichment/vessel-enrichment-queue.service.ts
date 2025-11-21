import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VesselEnrichmentService } from './vessel-enrichment.service';

@Injectable()
export class VesselEnrichmentQueueService {
  private readonly logger = new Logger(VesselEnrichmentQueueService.name);
  private isProcessing = false;
  private readonly MAX_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 60000; // 1 minute

  constructor(
    private prisma: PrismaService,
    private enrichmentService: VesselEnrichmentService,
  ) {}

  /**
   * Add a vessel to the enrichment queue
   */
  async addToQueue(mmsi: string, priority = 0): Promise<void> {
    try {
      // Check if already in queue
      const existing = await this.prisma.vesselEnrichmentQueue.findFirst({
        where: {
          mmsi,
          status: { in: ['pending', 'processing'] },
        },
      });

      if (existing) {
        // this.logger.debug(`MMSI ${mmsi} already in queue`);
        return;
      }

      // Add to queue
      await this.prisma.vesselEnrichmentQueue.create({
        data: {
          mmsi,
          priority,
          status: 'pending',
        },
      });

      this.logger.debug(`Added MMSI ${mmsi} to enrichment queue with priority ${priority}`);
    } catch (error: any) {
      this.logger.error(`Failed to add ${mmsi} to queue: ${error.message}`);
    }
  }

  /**
   * Add multiple vessels to queue
   */
  async addManyToQueue(mmsiList: string[], priority = 0): Promise<void> {
    this.logger.log(`Adding ${mmsiList.length} vessels to queue`);

    // Process in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < mmsiList.length; i += batchSize) {
      const batch = mmsiList.slice(i, i + batchSize);
      await Promise.all(batch.map((mmsi) => this.addToQueue(mmsi, priority)));
    }

    this.logger.log(`Successfully queued ${mmsiList.length} vessels`);
  }

  /**
   * Queue all vessels that need enrichment
   */
  async queueUnenrichedVessels(limit?: number): Promise<number> {
    this.logger.log('Queuing unenriched vessels...');

    // Find vessels that:
    // 1. Have never been enriched (enrichedAt is null)
    // 2. Or haven't been enriched in 30 days
    // 3. Or had failed attempts but under max attempts
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const vessels = await this.prisma.vessel.findMany({
      where: {
        OR: [
          { enrichedAt: null },
          { enrichedAt: { lt: thirtyDaysAgo } },
          {
            enrichmentAttempts: { lt: this.MAX_ATTEMPTS },
            enrichmentError: { not: null },
          },
        ],
      },
      select: { mmsi: true },
      take: limit,
    });

    const mmsiList = vessels.map((v) => v.mmsi);
    await this.addManyToQueue(mmsiList, 0);

    return mmsiList.length;
  }

  /**
   * Process next item in queue
   */
  async processNext(): Promise<boolean> {
    if (this.isProcessing) {
      return false;
    }

    this.isProcessing = true;

    try {
      // Get next pending item with highest priority
      const queueItem = await this.prisma.vesselEnrichmentQueue.findFirst({
        where: {
          status: 'pending',
          attempts: { lt: this.MAX_ATTEMPTS },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      });

      if (!queueItem) {
        return false;
      }

      // Mark as processing
      await this.prisma.vesselEnrichmentQueue.update({
        where: { id: queueItem.id },
        data: {
          status: 'processing',
          lastAttemptAt: new Date(),
        },
      });

      this.logger.debug(`Processing MMSI ${queueItem.mmsi} from queue`);

      // Attempt enrichment
      const result = await this.enrichmentService.enrichVessel(queueItem.mmsi);

      if (result.success) {
        // Success - mark as completed and remove from queue
        await this.prisma.vesselEnrichmentQueue.update({
          where: { id: queueItem.id },
          data: {
            status: 'completed',
            error: null,
          },
        });

        this.logger.log(`Successfully enriched ${queueItem.mmsi} from queue`);
      } else {
        // Failed - increment attempts
        const newAttempts = queueItem.attempts + 1;

        if (newAttempts >= this.MAX_ATTEMPTS) {
          // Max attempts reached
          await this.prisma.vesselEnrichmentQueue.update({
            where: { id: queueItem.id },
            data: {
              status: 'failed',
              attempts: newAttempts,
              error: result.error,
            },
          });

          this.logger.warn(`Failed to enrich ${queueItem.mmsi} after ${newAttempts} attempts`);
        } else {
          // Retry later
          await this.prisma.vesselEnrichmentQueue.update({
            where: { id: queueItem.id },
            data: {
              status: 'pending',
              attempts: newAttempts,
              error: result.error,
            },
          });

          this.logger.debug(
            `Will retry ${queueItem.mmsi} (attempt ${newAttempts}/${this.MAX_ATTEMPTS})`,
          );
        }
      }

      return true;
    } catch (error: any) {
      this.logger.error(`Error processing queue: ${error.message}`);
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process queue continuously (non-blocking version)
   * Rate limiting is now handled by the scheduler (1 item per minute)
   */
  async processQueue(maxItems = 100): Promise<number> {
    this.logger.log(`Starting queue processing (max ${maxItems} items)`);

    let processedCount = 0;

    // Process only one item at a time to respect rate limits
    // The scheduler calls this method every 1 minute, providing natural rate limiting
    const processed = await this.processNext();
    if (processed) {
      processedCount = 1;
      this.logger.log(`Processed 1 item from queue`);
    }

    return processedCount;
  }

  /**
   * Process a single item from the queue (for manual processing)
   * Use this method when you need to process one item immediately
   */
  async processSingleItem(): Promise<boolean> {
    return await this.processNext();
  }

  /**
   * Clear completed items from queue (cleanup)
   */
  async cleanupQueue(olderThanDays = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await this.prisma.vesselEnrichmentQueue.deleteMany({
      where: {
        status: { in: ['completed', 'failed'] },
        updatedAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old queue items`);
    return result.count;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [pending, processing, completed, failed, total] = await Promise.all([
      this.prisma.vesselEnrichmentQueue.count({ where: { status: 'pending' } }),
      this.prisma.vesselEnrichmentQueue.count({ where: { status: 'processing' } }),
      this.prisma.vesselEnrichmentQueue.count({ where: { status: 'completed' } }),
      this.prisma.vesselEnrichmentQueue.count({ where: { status: 'failed' } }),
      this.prisma.vesselEnrichmentQueue.count(),
    ]);

    return {
      pending,
      processing,
      completed,
      failed,
      total,
    };
  }

  /**
   * Retry failed items
   */
  async retryFailed(): Promise<number> {
    const result = await this.prisma.vesselEnrichmentQueue.updateMany({
      where: {
        status: 'failed',
        attempts: { lt: this.MAX_ATTEMPTS },
      },
      data: {
        status: 'pending',
        error: null,
      },
    });

    this.logger.log(`Reset ${result.count} failed items for retry`);
    return result.count;
  }
}
