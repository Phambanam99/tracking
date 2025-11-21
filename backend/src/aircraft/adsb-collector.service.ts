import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { AdsbAircraftBatch } from './dto/adsb-batch.dto';

@Injectable()
export class AdsbCollectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdsbCollectorService.name);
  private readonly enabled: boolean;
  private readonly maxConcurrentBatches: number;
  private isStreamActive = false;
  private streamAbortController: AbortController | null = null;
  private processingSemaphore = { count: 0 };

  // Circuit breaker configuration
  private reconnectionAttempts = 0;
  private readonly MAX_RECONNECTION_ATTEMPTS = 10;
  private readonly BASE_RECONNECT_DELAY = 5000; // Start with 5 seconds
  private readonly MAX_RECONNECT_DELAY = 300000; // Max 5 minutes

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('adsb-processing') private processingQueue: Queue,
  ) {
    this.enabled = this.configService.get<boolean>('ADSB_COLLECTOR_ENABLED', false);
    this.maxConcurrentBatches = this.configService.get<number>('ADSB_MAX_CONCURRENT_BATCHES', 5);

   

    if (this.enabled) {
      this.logger.log(
        `✓ ADSB Collector enabled (max ${this.maxConcurrentBatches} concurrent batches)`,
      );
    } else {
      this.logger.warn('ADSB Collector is disabled');
    }
  }

  async onModuleInit() {
   

    if (this.enabled && !this.isStreamActive) {
      this.logger.log('🚀 Starting ADSB stream listener...');
      this.startStreamListener().catch((err) => {
        this.logger.error(`Collector init failed: ${err.message}`);
      });
    }
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down ADSB collector...');
    this.streamAbortController?.abort();
    this.isStreamActive = false;
  }

  private async startStreamListener(): Promise<void> {
    if (this.isStreamActive) return;

    this.isStreamActive = true;
    const url = `${this.configService.get<string>('ADSB_EXTERNAL_API_URL', 'http://10.75.20.5:6001/api/osint')}/adsb/stream`;

    while (this.isStreamActive && this.reconnectionAttempts < this.MAX_RECONNECTION_ATTEMPTS) {
      try {
        await this.runStreamCycle(url);
        // Reset attempts on successful connection
        this.reconnectionAttempts = 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.reconnectionAttempts++;

        // Calculate exponential backoff delay
        const delay = Math.min(
          this.BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectionAttempts - 1),
          this.MAX_RECONNECT_DELAY,
        );

        this.logger.error(
          `Stream cycle error (attempt ${this.reconnectionAttempts}/${this.MAX_RECONNECTION_ATTEMPTS}): ${message}, ` +
            `reconnecting in ${delay / 1000}s...`,
        );

        if (this.reconnectionAttempts >= this.MAX_RECONNECTION_ATTEMPTS) {
          this.logger.error('Max reconnection attempts reached. Stopping ADSB collector.');
          this.isStreamActive = false;
          break;
        }

        await this.sleep(delay);
      }
    }

    if (!this.isStreamActive) {
      this.logger.warn('ADSB stream listener stopped');
    }
  }

  private async runStreamCycle(url: string): Promise<void> {
    this.streamAbortController = new AbortController();
    this.logger.log(`Connecting to ADSB stream: ${url}`);

    // Add connection timeout
    const timeoutId = setTimeout(() => {
      this.logger.error('⏱️ Connection timeout after 30s, aborting...');
      this.streamAbortController?.abort();
    }, 30000);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ FieldFilter: '', PositionFilter: '' }),
        signal: this.streamAbortController.signal,
      });
      clearTimeout(timeoutId);

      this.logger.log(`✅ Response status: ${response.status} ${response.statusText}`);
      this.logger.log(
        `📋 Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`,
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      this.logger.error(`❌ Fetch failed: ${errorMsg}`);
      throw fetchError;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body not readable');

    const decoder = new TextDecoder();
    let buffer = '';

    this.logger.log('✓ Connected to ADSB stream');

    let chunkCount = 0;
    while (this.isStreamActive) {
      const { done, value } = await reader.read();

      if (done) {
        this.logger.warn('Stream ended by server, reconnecting in 5s...');
        await this.sleep(5000);
        return;
      }

      chunkCount++;
      const decoded = decoder.decode(value, { stream: true });
      if (chunkCount <= 3) {
        this.logger.debug(
          `📦 Chunk #${chunkCount}: ${decoded.length} bytes, first 200 chars: ${decoded.substring(0, 200)}`,
        );
      }

      buffer += decoded;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      if (lines.length > 0 && chunkCount <= 3) {
        this.logger.debug(`📝 Processing ${lines.length} lines from chunk #${chunkCount}`);
      }

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const batch = JSON.parse(line);
          if (Array.isArray(batch) && batch.length > 0) {
            this.logger.log(`✈️ Received batch with ${batch.length} aircraft`);
            await this.queueBatchWithBackpressure(batch);
          } else {
            this.logger.warn(`Received non-array or empty batch: ${typeof batch}`);
          }
        } catch (error) {
          this.logger.error(`Parse error: ${error.message}, line: ${line.substring(0, 100)}`);
        }
      }
    }
  }

  private async queueBatchWithBackpressure(batch: any[]): Promise<void> {
    while (this.processingSemaphore.count >= this.maxConcurrentBatches) {
      await this.sleep(100);
    }

    this.processingSemaphore.count++;

    try {
      const job = await this.processingQueue.add('process-batch', batch as AdsbAircraftBatch, {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });

      this.logger.debug(
        `Queued batch: ${batch.length} aircraft (active: ${this.processingSemaphore.count})`,
      );

      // Track job completion to decrement semaphore
      job.finished().finally(() => {
        this.processingSemaphore.count = Math.max(0, this.processingSemaphore.count - 1);
      });
    } catch (error) {
      this.logger.error(`Failed to queue batch: ${error.message}`);
      this.processingSemaphore.count--;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get health status of ADSB collector
   */
  getHealthStatus() {
    return {
      enabled: this.enabled,
      isStreamActive: this.isStreamActive,
      reconnectionAttempts: this.reconnectionAttempts,
      maxReconnectionAttempts: this.MAX_RECONNECTION_ATTEMPTS,
      activeJobs: this.processingSemaphore.count,
      maxConcurrentBatches: this.maxConcurrentBatches,
      externalApiUrl: this.configService.get<string>(
        'ADSB_EXTERNAL_API_URL',
        'http://10.75.20.5:6001/api/osint',
      ),
      timestamp: new Date().toISOString(),
    };
  }
}
