import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subject } from 'rxjs';
import { AisSignalrService } from './ais-signalr.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { AisModel } from './ais.types';

interface FusedAisRecord {
  mmsi: string;
  lat: number;
  lon: number;
  ts: number; // epoch ms
  speed?: number;
  course?: number;
  sourceId?: string;
  score: number;
}

// Values sourced from configuration (see fusion.config.ts)

interface FusionRuntimeConfig {
  windowMs: number;
  allowedLatenessMs: number;
  minMoveMeters: number; // minimum movement to publish update
  recencyWeight: number;
  speedBonus: number;
  publishMinIntervalMs: number; // per MMSI min interval
  maxAgeMs: number | null; // optional max age for record acceptance
  acceptAll: boolean; // bypass age filtering & window trimming (historical backfill mode)
  redisRetentionMs: number; // prune Redis entries older than this (active ZSET score = ts)
}

@Injectable()
export class AisFusionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AisFusionService.name);
  private disposed = false;

  // window buffers per mmsi
  private buffers = new Map<string, FusedAisRecord[]>();
  private lastPublished = new Map<string, number>();
  private firstDebugLogged = false;
  // simple stats
  private stats = { batches: 0, rows: 0, normalized: 0 };

  private fused$ = new Subject<FusedAisRecord>();
  fusedStream$ = this.fused$.asObservable();

  private sub: any;

  private cfg: FusionRuntimeConfig;

  constructor(
    private readonly ais: AisSignalrService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {
    this.cfg = {
      windowMs: this.configService.get<number>('fusion.windowMs', 60_000),
      allowedLatenessMs: this.configService.get<number>('fusion.allowedLatenessMs', 30_000),
      minMoveMeters: this.configService.get<number>('fusion.minMoveMeters', 5),
      recencyWeight: this.configService.get<number>('fusion.recencyWeight', 0.8),
      speedBonus: this.configService.get<number>('fusion.speedBonus', 0.1),
      publishMinIntervalMs: this.configService.get<number>('fusion.publishMinIntervalMs', 5000),
      maxAgeMs: this.configService.get<number>('fusion.maxAgeMs') ?? null,
      acceptAll: process.env.FUSION_ACCEPT_ALL === '1' || process.env.FUSION_ACCEPT_ALL === 'true',
      redisRetentionMs: this.configService.get<number>('fusion.redisRetentionMs', 9 * 3600 * 1000),
    };
    this.logger.log(
      `Fusion config windowMs=${this.cfg.windowMs} allowedLatenessMs=${this.cfg.allowedLatenessMs} minMoveMeters=${this.cfg.minMoveMeters} recencyWeight=${this.cfg.recencyWeight} speedBonus=${this.cfg.speedBonus} publishMinIntervalMs=${this.cfg.publishMinIntervalMs} maxAgeMs=${this.cfg.maxAgeMs} acceptAll=${this.cfg.acceptAll}`,
    );
  }

  onModuleInit() {
    // subscribe raw data
    this.sub = this.ais.dataStream$.subscribe({
      next: ({ data }) => this.ingestBatch(data),
      error: (e) => this.logger.error('AIS raw stream error ' + e.message),
    });
  }

  onModuleDestroy() {
    this.disposed = true;
    if (this.sub) this.sub.unsubscribe();
  }

  private ingestBatch(rows: AisModel[]) {
    const now = Date.now();
    try {
      this.stats.batches++;
      this.stats.rows += rows.length;
      let batchNormalized = 0;
      for (const r of rows) {
        const rec = this.normalize(r, now);
        if (!rec) continue;
        batchNormalized++;
        const buf = this.buffers.get(rec.mmsi) ?? [];
        buf.push(rec);
        // trim old
        const cutoff = this.cfg.acceptAll ? Number.NEGATIVE_INFINITY : now - this.cfg.windowMs;
        while (buf.length && buf[0].ts < cutoff) buf.shift();
        this.buffers.set(rec.mmsi, buf);
      }
      this.stats.normalized += batchNormalized;

      // If nothing normalized in this batch log sample keys once regardless of env for troubleshooting
      if (batchNormalized === 0 && !this.firstDebugLogged && rows.length) {
        this.firstDebugLogged = true;
        const sample = rows[0] as any;
        const keys = Object.keys(sample);
        this.logger.warn(`FUSION sample keys(no-normalized)=${keys.join(',')}`);
        const preview: Record<string, any> = {};
        for (const k of keys.slice(0, 25)) preview[k] = sample[k];
        this.logger.warn('FUSION sample preview=' + JSON.stringify(preview));
      } else if (process.env.FUSION_DEBUG === '1' && !this.firstDebugLogged && rows.length) {
        // debug path if we actually normalized (so earlier branch not taken)
        this.firstDebugLogged = true;
        const sample = rows[0] as any;
        const keys = Object.keys(sample);
        this.logger.warn(`FUSION_DEBUG sample keys=${keys.join(',')}`);
        const preview: Record<string, any> = {};
        for (const k of keys.slice(0, 25)) preview[k] = sample[k];
        this.logger.warn('FUSION_DEBUG sample preview=' + JSON.stringify(preview));
      }

      // periodic stats every 10 batches
      if (this.stats.batches % 10 === 0) {
        this.logger.log(
          `Fusion stats batches=${this.stats.batches} rows=${this.stats.rows} normalized=${this.stats.normalized} ratio=${(this.stats.normalized / (this.stats.rows || 1)).toFixed(3)}`,
        );
      }
      this.decideAndPublish(now);
    } catch (e: any) {
      this.logger.error('ingestBatch failed: ' + e.message);
    }
  }

  private normalize(r: AisModel, now: number): FusedAisRecord | null {
    // MMSI may arrive as number or string or in alternative fields
    let rawMmsi: any =
      (r as any).mmsi ??
      (r as any).MMSI ??
      (r as any).Mmsi ??
      (r as any).shipMMSI ??
      (r as any).ShipMMSI;
    if (rawMmsi == null) return null;
    if (typeof rawMmsi === 'number') rawMmsi = String(rawMmsi);
    if (typeof rawMmsi !== 'string') return null;
    const mmsi = rawMmsi.trim();
    if (!/^[0-9]{5,10}$/.test(mmsi)) return null; // basic sanity
    let lat: any =
      (r as any).lat ||
      (r as any).Lat ||
      (r as any).LAT ||
      (r as any).latitude ||
      (r as any).Latitude ||
      (r as any).LATITUDE;
    let lon: any =
      (r as any).lon ||
      (r as any).Lon ||
      (r as any).LON ||
      (r as any).longitude ||
      (r as any).Longitude ||
      (r as any).LONGITUDE ||
      (r as any).long ||
      (r as any).Long;
    // fallback parse if strings
    if (typeof lat === 'string') {
      const p = parseFloat(lat);
      if (!Number.isNaN(p)) lat = p;
    }
    if (typeof lon === 'string') {
      const p = parseFloat(lon);
      if (!Number.isNaN(p)) lon = p;
    }
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    const tsIso = ((r as any).updatetime ||
      (r as any).updateTime ||
      (r as any).UpdateTime ||
      (r as any).update_time ||
      (r as any).Update_Time) as string | undefined;
    const ts = tsIso ? Date.parse(tsIso) : now;
    if (Number.isNaN(ts)) return null;
    if (!this.cfg.acceptAll) {
      if (this.cfg.maxAgeMs != null) {
        if (now - ts > this.cfg.maxAgeMs) return null;
      } else {
        if (now - ts > this.cfg.windowMs + this.cfg.allowedLatenessMs) return null;
      }
    }
    const speed = (r as any).speed ?? (r as any).SOG ?? (r as any).Speed ?? (r as any).SPEED;
    const course = (r as any).course ?? (r as any).COG ?? (r as any).Course ?? (r as any).COURSE;
    return {
      mmsi,
      lat,
      lon,
      ts,
      speed: typeof speed === 'number' ? speed : undefined,
      course: typeof course === 'number' ? course : undefined,
      sourceId: r.sourceId,
      score: 0,
    };
  }

  private score(rec: FusedAisRecord, now: number): number {
    const ageSec = (now - rec.ts) / 1000;
    const recency = 1 / (1 + ageSec); // (0,1]
    const speedWeight = rec.speed ? this.cfg.speedBonus : 0;
    return recency * this.cfg.recencyWeight + speedWeight;
  }

  private decideAndPublish(now: number) {
    for (const [mmsi, buf] of this.buffers) {
      if (buf.length === 0) continue;
      // compute scores
      for (const r of buf) r.score = this.score(r, now);
      // choose best (latest first then score)
      const best = [...buf].sort((a, b) => b.ts - a.ts || b.score - a.score)[0];
      const lastTs = this.lastPublished.get(mmsi);
      if (lastTs) {
        // rate limiting
        if (best.ts - lastTs < this.cfg.publishMinIntervalMs) continue;
        const last = buf.find((x) => x.ts === lastTs);
        if (last) {
          const movedMeters = this.haversine(last.lat, last.lon, best.lat, best.lon);
          if (movedMeters < this.cfg.minMoveMeters) continue;
        }
      }
      this.lastPublished.set(mmsi, best.ts);
      this.fused$.next(best);
      // fire-and-forget persistence
      this.persist(best).catch((e) => this.logger.error('Persist error: ' + e.message));
    }
  }

  private async persist(rec: FusedAisRecord) {
    // Redis GEO + hash + active set
    try {
      const client = this.redis.getClient();
      await client.geoadd('ais:vessels:geo', rec.lon, rec.lat, rec.mmsi);
      await client.hset(`ais:vessel:${rec.mmsi}`, {
        lat: rec.lat.toString(),
        lon: rec.lon.toString(),
        ts: rec.ts.toString(),
        speed: rec.speed != null ? rec.speed.toString() : '',
        course: rec.course != null ? rec.course.toString() : '',
        sourceId: rec.sourceId || '',
        score: rec.score.toFixed(3),
      });
      await client.zadd('ais:vessels:active', rec.ts, rec.mmsi);
      if (process.env.FUSION_DEBUG === '1') {
        const zcard = await client.zcard('ais:vessels:active');
        this.logger.debug(
          `Persisted mmsi=${rec.mmsi} ts=${rec.ts} (ageMs=${Date.now() - rec.ts}) activeSize=${zcard}`,
        );
      }
      // Lightweight retention pruning (fire-and-forget, sampled)
      if (rec.ts % 25 === 0) {
        const cutoff = Date.now() - this.cfg.redisRetentionMs;
        // remove old members by score
        const removed = await client.zremrangebyscore('ais:vessels:active', 0, cutoff);
        if (removed > 0 && process.env.FUSION_DEBUG === '1') {
          this.logger.debug(`Pruned ${removed} stale active entries (cutoff=${cutoff})`);
        }
        // Optionally could also delete individual hashes, but only if we enumerate removed members first.
        // For now, hashes will expire lazily if we add TTL later.
      }
    } catch (e: any) {
      this.logger.warn('Redis persist failed: ' + e.message);
    }

    // Postgres unified persistence (Option C): Always write into Vessel / VesselPosition.
    // Optional dual-write to legacy AIS tables if AIS_KEEP_AIS_TABLES=1.
    try {
      const keepLegacy =
        process.env.AIS_KEEP_AIS_TABLES === '1' || process.env.AIS_KEEP_AIS_TABLES === 'true';
      await this.prisma.$transaction(async (tx) => {
        const vessel = await tx.vessel.upsert({
          where: { mmsi: rec.mmsi },
          create: { mmsi: rec.mmsi },
          update: {},
        });
        await tx.vesselPosition.create({
          data: {
            vesselId: vessel.id,
            latitude: rec.lat,
            longitude: rec.lon,
            speed: rec.speed ?? null,
            course: rec.course ?? null,
            heading: rec.course ?? null,
            status: null,
            timestamp: new Date(rec.ts),
            source: rec.sourceId ?? null,
            score: rec.score,
          },
        });
        if (keepLegacy) {
          // Write into legacy AIS tables only if the generated client exposes them.
          const anyTx: any = tx as any;
          if (anyTx.aisVesselHistory) {
            try {
              await anyTx.aisVesselHistory.create({
                data: {
                  mmsi: rec.mmsi,
                  latitude: rec.lat,
                  longitude: rec.lon,
                  speed: rec.speed ?? null,
                  course: rec.course ?? null,
                  sourceId: rec.sourceId ?? null,
                  score: rec.score,
                  timestamp: new Date(rec.ts),
                },
              });
            } catch (legacyErr: any) {
              this.logger.warn('Legacy AIS history write failed: ' + legacyErr.message);
            }
          }
          if (anyTx.aisVesselLatest) {
            try {
              await anyTx.aisVesselLatest.upsert({
                where: { mmsi: rec.mmsi },
                create: {
                  mmsi: rec.mmsi,
                  latitude: rec.lat,
                  longitude: rec.lon,
                  speed: rec.speed ?? null,
                  course: rec.course ?? null,
                  sourceId: rec.sourceId ?? null,
                  score: rec.score,
                  timestamp: new Date(rec.ts),
                },
                update: {
                  latitude: rec.lat,
                  longitude: rec.lon,
                  speed: rec.speed ?? null,
                  course: rec.course ?? null,
                  sourceId: rec.sourceId ?? null,
                  score: rec.score,
                  timestamp: new Date(rec.ts),
                },
              });
            } catch (legacyErr: any) {
              this.logger.warn('Legacy AIS latest upsert failed: ' + legacyErr.message);
            }
          }
        }
      });
    } catch (e: any) {
      this.logger.error('DB persist failed (unified): ' + e.message);
    }
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
