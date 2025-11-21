import { Processor, Process, OnQueueActive, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import pLimit from 'p-limit';
import { RedisService } from '../redis/redis.service';
import { AircraftService } from './aircraft.service';
import { AdsbAircraftBatch, AdsbAircraftDto } from './dto/adsb-batch.dto';

@Processor('adsb-processing')
export class AdsbProcessingProcessor {
  private readonly logger = new Logger(AdsbProcessingProcessor.name);
  private readonly dbConcurrency = 5;
  private readonly chunkSize = 10;

  constructor(
    private readonly redisService: RedisService,
    private readonly aircraftService: AircraftService,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing job ${job.id}...`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`✓ Job ${job.id} completed: ${result.processed} aircraft`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`✗ Job ${job.id} failed: ${error.message}`);
  }

  @Process('process-batch')
  async handleProcessBatch(job: Job<AdsbAircraftBatch>): Promise<{ processed: number }> {
    const batch = job.data;

    // First normalize casing, THEN filter
    const normalizedBatch = batch
      .map((a) => this.normalizeCasing(a))
      .filter((a) => a && a.hexident);

    if (normalizedBatch.length === 0) {
      this.logger.warn(`Batch ${job.id}: All ${batch.length} aircraft filtered out (missing hexident)`);
      return { processed: 0 };
    }

    this.logger.debug(`Starting batch: ${normalizedBatch.length} aircraft (filtered from ${batch.length})`);

    const limit = pLimit(this.dbConcurrency);
    const chunks = this.chunkArray(normalizedBatch, this.chunkSize);

    await Promise.all(
      chunks.map((chunk) =>
        limit(async () => {
          await Promise.all([this.storeToRedis(chunk), this.persistToPostgres(chunk)]);
        }),
      ),
    );

    return { processed: normalizedBatch.length };
  }

  private normalizeCasing(obj: any): AdsbAircraftDto {
    // If already normalized (has lowercase hexident), return as is
    if (obj.hexident !== undefined) return obj;

    // Convert PascalCase to camelCase for all keys
    const normalized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
      normalized[camelKey] = value;
    }
    return normalized;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async storeToRedis(aircrafts: AdsbAircraftDto[]): Promise<void> {
    const client = this.redisService.getClientWithoutPrefix();
    const hashKey = 'adsb:current_flights';
    const ttl = 300;

    const pipeline = client.pipeline();

    for (const aircraft of aircrafts) {
      pipeline.hset(hashKey, aircraft.hexident, JSON.stringify(aircraft));
    }

    pipeline.expire(hashKey, ttl);
    await pipeline.exec();
  }

  private async persistToPostgres(adsbData: AdsbAircraftDto[]): Promise<void> {
    await Promise.all(
      adsbData.map(async (adsb) => {
        try {
          const aircraft = await this.aircraftService.upsertAircraft({
            flightId: adsb.hexident,
            callSign: adsb.callsign || adsb.callSign || undefined,
            registration: adsb.register || undefined,
            aircraftType: adsb.type || undefined,
            operator: adsb.operator || undefined,
          });

          if (adsb.latitude != null && adsb.longitude != null) {
            await this.aircraftService.addPosition(
              aircraft.id,
              {
                latitude: adsb.latitude,
                longitude: adsb.longitude,
                altitude: adsb.altitude,
                speed: adsb.speed,
                heading: adsb.heading || adsb.bearing,
                timestamp: adsb.unixtime ? new Date(adsb.unixtime * 1000) : new Date(),
                source: adsb.source || 'adsb_stream',
              },
              { skipRegionProcessing: true },
            );

            // Publish to Redis for WebSocket broadcast
            await this.redisService.publish(
              'aircraft:position:update',
              JSON.stringify({
                id: aircraft.id,
                aircraftId: aircraft.id,
                flightId: adsb.hexident,
                callSign: adsb.callsign || adsb.callSign,
                registration: adsb.register,
                aircraftType: adsb.type,
                operator: adsb.operator,
                // Top-level coordinates for TrackingService
                latitude: adsb.latitude,
                longitude: adsb.longitude,
                altitude: adsb.altitude,
                speed: adsb.speed,
                heading: adsb.heading || adsb.bearing,
                // Also include in lastPosition for backward compatibility
                lastPosition: {
                  latitude: adsb.latitude,
                  longitude: adsb.longitude,
                  altitude: adsb.altitude,
                  speed: adsb.speed,
                  heading: adsb.heading || adsb.bearing,
                  timestamp: adsb.unixtime ? new Date(adsb.unixtime * 1000) : new Date(),
                },
                timestamp: adsb.unixtime ? new Date(adsb.unixtime * 1000) : new Date(),
              }),
            );
          }
        } catch (error) {
          this.logger.error(`Failed to persist ${adsb.hexident}: ${error.message}`);
        }
      }),
    );
  }
}
