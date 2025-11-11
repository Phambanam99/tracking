// ais-orchestrator.service.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Subject } from 'rxjs';
import { bufferCount, mergeMap } from 'rxjs/operators'; // Thêm operator
import { AisSignalrService } from './ais-signalr.service';
import { AisAistreamService } from './ais-aistream.service';
import { VesselFusionService } from '../fusion/vessel-fusion.service';
import { normalizeAis } from '../fusion/normalizers';
import { keyOfVessel, scoreVessel } from '../fusion/utils';
import { NormVesselMsg, VesselSource } from '../fusion/types';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { BatchInsertService } from './batch-insert.service';
import { AisModel } from './ais.types';
import { vesselConfig, calculateDistance } from '../config/vessel.config';

// Config constants
const BATCH_SIZE = 100; // Process 100 vessels per batch
const MAX_PARALLEL_FUSION = 10; // Limit concurrency
const REDIS_TTL_SECONDS = 30 * 60; // 30 minutes TTL
const REDIS_KEY_VESSELS_GEO = 'ais:vessels:geo';
const REDIS_KEY_VESSEL_PREFIX = 'ais:vessel:';
const REDIS_KEY_ACTIVE = 'ais:vessels:active';

export interface FusedAisRecord {
  mmsi?: string;
  imo?: string;
  callsign?: string;
  name?: string;
  lat: number;
  lon: number;
  ts: string;
  speed?: number;
  course?: number;
  heading?: number;
  status?: string;
  source: VesselSource; // Fix type
}

interface OrchestratorStats {
  batches: number;
  rawRows: number;
  normalized: number;
  published: number;
  signalrRows: number;
  aistreamRows: number;
  errors: number;
}

/**
 * AIS Orchestrator Service - Coordinates AIS data flow through fusion pipeline
 */
@Injectable()
export class AisOrchestratorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AisOrchestratorService.name);
  private disposed = false;
  private signalrSub: any;
  private aistreamSub: any;

  // Fused output stream
  private fused$ = new Subject<FusedAisRecord>();
  fusedStream$ = this.fused$.asObservable();

  // Stats
  private stats: OrchestratorStats = {
    batches: 0,
    rawRows: 0,
    normalized: 0,
    published: 0,
    signalrRows: 0,
    aistreamRows: 0,
    errors: 0,
  };

  // Batch buffer for DB inserts (P2.2 optimization)
  private dbBatchBuffer: Array<{
    vesselId: number;
    latitude: number;
    longitude: number;
    speed?: number;
    course?: number;
    heading?: number;
    status?: string;
    timestamp: Date;
    source: string;
    score: number;
  }> = [];
  private dbBatchTimer: NodeJS.Timeout | null = null;
  private readonly DB_BATCH_SIZE = 50; // Flush every 50 positions
  private readonly DB_BATCH_TIMEOUT = 2000; // Or every 2 seconds

  constructor(
    private readonly aisSignalr: AisSignalrService,
    private readonly aisAistream: AisAistreamService,
    private readonly vesselFusion: VesselFusionService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly batchInsert: BatchInsertService,
  ) {
    // Override logger methods to disable logging
    this.logger.log = () => {};
    this.logger.debug = () => {};
    this.logger.warn = () => {};
    // Keep error logging
    // this.logger.error = () => {};
  }

  onModuleInit() {
    this.logger.log('AIS Orchestrator starting...');

    // Subscribe to SignalR AIS data stream
    // Process each QueryData event immediately (don't wait for 100 events)
    this.signalrSub = this.aisSignalr.dataStream$.subscribe({
      next: ({ data }) => {
        if (data && data.length > 0) {
          this.logger.log(`[SignalR] Received ${data.length} vessels`);
          this.stats.signalrRows += data.length;
          this.ingestBatch(data, 'signalr');
        }
      },
      error: (e) => {
        this.logger.error('SignalR stream error: ' + e.message);
        this.stats.errors++;
      },
      complete: () => this.logger.warn('SignalR stream completed'),
    });

    // Subscribe to AISStream.io data stream
    this.aistreamSub = this.aisAistream.dataStream$
      .pipe(
        // Flatten arrays and buffer individual items
        mergeMap((items) => items),
        bufferCount(BATCH_SIZE),
      )
      .subscribe({
        next: (data) => {
          if (data.length > 0) {
            this.stats.aistreamRows += data.length;
            this.ingestBatch(data, 'aisstream.io');
          }
        },
        error: (e) => {
          this.logger.error('AISStream.io stream error: ' + e.message);
          this.stats.errors++;
        },
        complete: () => this.logger.warn('AISStream.io stream completed'),
      });
  }

  onModuleDestroy() {
    this.disposed = true;
    if (this.signalrSub) this.signalrSub.unsubscribe();
    if (this.aistreamSub) this.aistreamSub.unsubscribe();
  }

  /**
   * Process incoming batch of raw AIS messages
   */
  private async ingestBatch(rows: AisModel[], source?: string) {
    if (this.disposed) return;
    const now = Date.now();

    try {
      this.stats.batches++;
      this.stats.rawRows += rows.length;
      this.logger.log(`[${source}] Processing batch: ${rows.length} rows`);

      // Early return nếu batch quá lớn
      if (rows.length > 10000) {
        this.logger.warn(`Large batch: ${rows.length} rows`);
      }

      // Normalize in parallel chunks
      const normalized = await this.normalizeBatch(rows, source);
      this.stats.normalized += normalized.length;
      this.logger.log(`[${source}] Normalized: ${normalized.length}/${rows.length} vessels`);

      if (normalized.length === 0) {
        this.logEmptyBatch(rows, source);
        return;
      }

      // Ingest into fusion service (non-blocking)
      this.vesselFusion.ingest(normalized, now);

      // Get unique keys
      const keys = this.extractKeys(normalized);
      this.logger.log(`[${source}] Processing fusion for ${keys.size} unique vessels`);

      // Process fusion in parallel with limit
      await this.processFusionParallel(keys, now);
      this.logger.log(`[${source}] Fusion complete for batch`);
    } catch (e: any) {
      this.logger.error(`ingestBatch failed: ${e.message}`, e.stack);
      this.stats.errors++;
    }
  }

  private async normalizeBatch(rows: AisModel[], source?: string): Promise<NormVesselMsg[]> {
    const normalized: NormVesselMsg[] = [];

    // Process in chunks để không block event loop
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const chunkNormalized = chunk
        .map((raw) => {
          const msg = normalizeAis(raw);
          if (msg && source) {
            // Fix source nếu cần
            msg.source = this.normalizeSource(source);
          }
          return msg;
        })
        .filter((msg): msg is NormVesselMsg => msg !== undefined);

      normalized.push(...chunkNormalized);

      // Yield control every chunk
      await new Promise((resolve) => setImmediate(resolve));
    }

    return normalized;
  }

  private normalizeSource(source: string): VesselSource {
    // Map source strings to proper VesselSource type
    const sourceMap: Record<string, VesselSource> = {
      signalr: 'signalr' as any, // Add to VesselSource type
      'aisstream.io': 'aisstream.io' as any,
    };
    return sourceMap[source] || (source as VesselSource);
  }

  private logEmptyBatch(rows: AisModel[], source?: string) {
    if (this.stats.batches === 1 && rows.length > 0) {
      const sample = rows.find((r) => r && typeof r === 'object');
      if (sample) {
        const keys = Object.keys(sample).slice(0, 20).join(', ');
        this.logger.warn(
          `No normalized records in first batch from ${source || 'unknown'}. Sample keys: ${keys}`,
        );
        // Log sample values for debugging
        if (process.env.AIS_DEBUG?.match(/^(1|true|yes|on)$/i)) {
          this.logger.debug(`Sample data: ${JSON.stringify(sample)}`);
        }
      } else {
        this.logger.warn(
          `No normalized records in first batch from ${source || 'unknown'}. All rows are invalid/empty.`,
        );
      }
    }
  }

  private extractKeys(normalized: NormVesselMsg[]): Set<string> {
    const keys = new Set<string>();
    for (const msg of normalized) {
      const key = keyOfVessel(msg);
      if (key) keys.add(key);
    }
    return keys;
  }

  private async processFusionParallel(keys: Set<string>, now: number) {
    const keyArray = [...keys];
    const chunks = this.chunkArray(keyArray, MAX_PARALLEL_FUSION);
    let successCount = 0;
    let errorCount = 0;

    for (const chunk of chunks) {
      const results = await Promise.allSettled(chunk.map((key) => this.processFusion(key, now)));

      // Log errors and count successes
      results.forEach((result, idx) => {
        if (result.status === 'rejected') {
          this.logger.error(`Fusion failed for ${chunk[idx]}: ${result.reason}`);
          this.stats.errors++;
          errorCount++;
        } else {
          successCount++;
        }
      });
    }

    if (errorCount > 0) {
      this.logger.warn(`⚠ Batch summary: ${successCount} succeeded, ${errorCount} failed`);
    } else {
      this.logger.log(`✓ Batch summary: ${successCount} vessels processed successfully`);
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Make fusion decision for a vessel and publish if needed
   */
  private async processFusion(key: string, now: number) {
    try {
      const decision = await this.vesselFusion.decide(key, now);
      if (!decision.best) return;

      if (decision.publish) {
        const fused = this.toFusedRecord(decision.best);
        this.fused$.next(fused);
        this.stats.published++;

        // Mark published trong cùng transaction
        await this.persistAndMark(decision.best, key);
      }
    } catch (e: any) {
      this.logger.error(`processFusion failed for key ${key}: ${e.message}`, e.stack);
      this.stats.errors++;
    }
  }

  private async persistAndMark(msg: NormVesselMsg, key: string) {
    const markPromise = this.vesselFusion.markPublished(key, msg.ts);
    const persistPromise = this.persist(msg);

    // Chạy song song, nhưng nếu persist fail thì vẫn mark
    // (markPublished idempotent nên an toàn)
    await Promise.all([markPromise, persistPromise]);
  }

  private toFusedRecord(msg: NormVesselMsg): FusedAisRecord {
    return {
      mmsi: msg.mmsi,
      imo: msg.imo,
      callsign: msg.callsign,
      name: msg.name,
      lat: msg.lat,
      lon: msg.lon,
      ts: msg.ts,
      speed: msg.speed,
      course: msg.course,
      heading: msg.heading,
      status: msg.status,
      source: msg.source,
    };
  }

  /**
   * Persist vessel position to Redis & Postgres
   */
  private async persist(msg: NormVesselMsg) {
    const mmsi = msg.mmsi;
    if (!mmsi) {
      this.logger.warn('Skipping persist: no MMSI');
      return;
    }

    const ts = Date.parse(msg.ts);
    if (!Number.isFinite(ts)) {
      this.logger.warn(`Skipping persist: invalid timestamp ${msg.ts}`);
      return;
    }

    const score = scoreVessel(msg, Date.now());

    // Redis persistence with pipeline
    try {
      await this.persistToRedis(msg, mmsi, ts, score);
    } catch (e: any) {
      this.logger.warn(`Redis persist failed for ${mmsi}: ${e.message}`);
      this.stats.errors++;
    }

    // Postgres persistence
    try {
      await this.persistToPostgres(msg, mmsi, ts, score);
    } catch (e: any) {
      this.logger.error(`DB persist failed for ${mmsi}: ${e.message}`, e.stack);
      this.stats.errors++;
    }
  }

  private async persistToRedis(msg: NormVesselMsg, mmsi: string, ts: number, score: number) {
    try {
      // Use standard Redis commands (geoadd, hset, zadd)
      const vesselKey = `${REDIS_KEY_VESSEL_PREFIX}${mmsi}`;

      // 1. Add to geo index for spatial queries
      await this.redis.getClient().geoadd(REDIS_KEY_VESSELS_GEO, msg.lon, msg.lat, mmsi);

      // 2. Store vessel details
      const vesselData = {
        mmsi,
        lat: msg.lat.toString(),
        lon: msg.lon.toString(),
        ts: ts.toString(),
        speed: msg.speed?.toString() || '',
        course: msg.course?.toString() || '',
        heading: msg.heading?.toString() || '',
        status: msg.status || '',
        source: msg.source || 'unknown',
        score: score.toString(),
        name: msg.name || '',
      };

      await this.redis.getClient().hmset(vesselKey, vesselData);
      await this.redis.getClient().expire(vesselKey, REDIS_TTL_SECONDS);

      // 3. Add to active vessels sorted set
      await this.redis.getClient().zadd(REDIS_KEY_ACTIVE, ts, mmsi);

      this.logger.debug(`✓ Redis updated: ${mmsi}`);
    } catch (e: any) {
      this.logger.warn(`✗ Redis persist failed for ${mmsi}: ${e.message}`);
    }
  }

  private async persistToPostgres(msg: NormVesselMsg, mmsi: string, ts: number, score: number) {
    // Batch operation: upsert vessel first, then positions
    const timestampValue = new Date(ts);
    const sourceValue = msg.source || 'unknown';

    try {
      // Use raw query để tránh deadlock
      const now = new Date();
      await this.prisma.$executeRaw`
        INSERT INTO "vessels" (mmsi, "vesselName", "createdAt", "updatedAt")
        VALUES (${mmsi}, ${msg.name ?? null}, ${now}, ${now})
        ON CONFLICT (mmsi) DO UPDATE
        SET "vesselName" = COALESCE(EXCLUDED."vesselName", "vessels"."vesselName"),
            "updatedAt" = ${now};
      `;
      this.logger.debug(`✓ Vessel upserted: ${mmsi} (${msg.name || 'N/A'})`);
    } catch (e: any) {
      this.logger.error(`✗ Vessel upsert failed for ${mmsi}: ${e.message}`);
      throw e;
    }

    // Get vessel ID từ cache hoặc query
    // (Đơn giản: query lại, có thể optimize với LRU cache)
    const vessel = await this.prisma.vessel.findUnique({
      where: { mmsi },
      select: { id: true },
    });

    if (!vessel) {
      this.logger.error(`✗ Vessel ${mmsi} not found after upsert`);
      return;
    }

    // Check distance from last position (if filtering enabled)
    if (vesselConfig.enablePositionFiltering) {
      const shouldSkip = await this.shouldSkipPosition(vessel.id, msg.lat, msg.lon, timestampValue);

      if (shouldSkip) {
        // Skip this position - too close to previous one
        this.logger.debug(`⊘ Position skipped for ${mmsi}: too close to last position`);
        return;
      }
    }

    // Insert position với ON CONFLICT DO NOTHING để tránh deadlock
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "vessel_positions" 
        ("vesselId", latitude, longitude, speed, course, heading, status, timestamp, source, score)
        VALUES 
        (${vessel.id}, ${msg.lat}, ${msg.lon}, ${msg.speed ?? null}, ${msg.course ?? null}, 
         ${msg.heading ?? null}, ${msg.status ?? null}, ${timestampValue}, ${sourceValue}, ${score})
        ON CONFLICT ("vesselId", timestamp) DO UPDATE
        SET 
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          speed = EXCLUDED.speed,
          course = EXCLUDED.course,
          heading = EXCLUDED.heading,
          status = EXCLUDED.status,
          source = EXCLUDED.source,
          score = EXCLUDED.score;
      `;
      this.logger.log(
        `✓ Position saved: ${mmsi} at (${msg.lat.toFixed(4)}, ${msg.lon.toFixed(4)}) | ` +
          `speed: ${msg.speed ?? 'N/A'} kn | source: ${sourceValue}`,
      );
    } catch (e: any) {
      this.logger.error(`✗ Position insert failed for ${mmsi}: ${e.message}`);
      throw e;
    }
  }

  /**
   * Check if position should be skipped based on distance from last position
   *
   * @param vesselId Vessel ID
   * @param newLat New latitude
   * @param newLon New longitude
   * @param newTimestamp New timestamp
   * @returns true if position should be skipped, false otherwise
   */
  private async shouldSkipPosition(
    vesselId: number,
    newLat: number,
    newLon: number,
    newTimestamp: Date,
  ): Promise<boolean> {
    try {
      // Get last position for this vessel
      const lastPosition = await this.prisma.vesselPosition.findFirst({
        where: { vesselId },
        orderBy: { timestamp: 'desc' },
        select: {
          latitude: true,
          longitude: true,
          timestamp: true,
        },
      });

      if (!lastPosition) {
        // No previous position, don't skip
        return false;
      }

      // Calculate time difference
      const timeDiffSeconds = (newTimestamp.getTime() - lastPosition.timestamp.getTime()) / 1000;

      // If enough time has passed, don't skip (even if distance is small)
      if (timeDiffSeconds >= vesselConfig.maxPositionAgeSeconds) {
        return false;
      }

      // Calculate distance
      const distance = calculateDistance(
        lastPosition.latitude,
        lastPosition.longitude,
        newLat,
        newLon,
      );

      // Skip if distance is less than minimum
      if (distance < vesselConfig.minPositionDistanceMeters) {
        this.logger.debug(
          `Skipping position for vessel ${vesselId}: distance ${distance.toFixed(0)}m < ${vesselConfig.minPositionDistanceMeters}m`,
        );
        return true;
      }

      return false;
    } catch (e: any) {
      // If check fails, don't skip (fail open)
      this.logger.warn(`Distance check failed for vessel ${vesselId}: ${e.message}`);
      return false;
    }
  }

  /**
   * Get current stats (frozen object)
   */
  getStats() {
    return JSON.parse(JSON.stringify(this.stats));
  }
}
