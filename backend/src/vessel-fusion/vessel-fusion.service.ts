import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  ALLOWED_LATENESS_MS,
  NormVesselMsg,
  RawVesselMsg,
  WINDOW_MS,
  normalize,
  selectBest,
  score,
} from './vessel-fusion.helpers';

@Injectable()
export class VesselFusionService {
  private readonly logger = new Logger(VesselFusionService.name);
  private windows = new Map<string, NormVesselMsg[]>();
  private lastPublishedEventTs = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // Adapters should be injected later; for now accept raw batches as input
  async ingestBatch(raws: RawVesselMsg[]): Promise<void> {
    const norms = raws.map(normalize).filter((n) => n.sane);
    const now = Date.now();

    for (const n of norms) {
      const arr = this.windows.get(n.key) ?? [];
      arr.push(n);
      this.windows.set(
        n.key,
        arr.filter((x) => now - Date.parse(x.ts) <= WINDOW_MS),
      );
    }

    for (const [key, arr] of this.windows) {
      if (!arr.length) continue;
      const lastTs = this.lastPublishedEventTs.get(key);
      const newer = arr.filter(
        (m) =>
          (!lastTs || Date.parse(m.ts) > Date.parse(lastTs)) &&
          now - Date.parse(m.ts) <= ALLOWED_LATENESS_MS &&
          m.sane,
      );

      let best: NormVesselMsg | null = null;
      if (newer.length) {
        newer.sort(
          (a, b) =>
            Date.parse(b.ts) - Date.parse(a.ts) || score(b) - score(a),
        );
        best = newer[0];
      } else {
        best = selectBest(arr);
      }
      if (!best) continue;

      if (lastTs && Date.parse(best.ts) <= Date.parse(lastTs)) {
        await this.saveHistory(best);
        continue;
      }

      await this.upsertVessel(best);
      await this.addPosition(best);
      await this.redis.publish(
        'vessel:position:update',
        JSON.stringify({
          key,
          ts: best.ts,
          source: best.source,
          score: score(best),
          lat: best.lat,
          lon: best.lon,
          speed: best.speed,
          course: best.course,
          heading: best.heading,
        }),
      );
      this.lastPublishedEventTs.set(key, best.ts);
    }
  }

  private async upsertVessel(n: NormVesselMsg) {
    const where = n.mmsi
      ? { mmsi: n.mmsi }
      : n.imo
      ? { imo: n.imo }
      : { mmsi: `UNKNOWN-${n.key}` };
    await this.prisma.vessel.upsert({
      where,
      update: {
        vesselName: n.name ?? undefined,
        operator: undefined,
      },
      create: {
        mmsi: n.mmsi ?? null,
        imo: n.imo ?? null,
        vesselName: n.name ?? 'UNKNOWN',
      },
    });
  }

  private async addPosition(n: NormVesselMsg) {
    const v = await this.findVesselByKey(n);
    if (!v) return;
    await this.prisma.vesselPosition.create({
      data: {
        vesselId: v.id,
        source: n.source,
        latitude: n.lat,
        longitude: n.lon,
        speed: n.speed ?? null,
        course: n.course ?? null,
        heading: n.heading ?? null,
        timestamp: new Date(n.ts),
      },
    });
  }

  private async saveHistory(n: NormVesselMsg) {
    await this.addPosition(n);
  }

  private async findVesselByKey(n: NormVesselMsg) {
    if (n.mmsi)
      return this.prisma.vessel.findUnique({ where: { mmsi: n.mmsi } });
    if (n.imo)
      return this.prisma.vessel.findUnique({ where: { imo: n.imo } });
    return this.prisma.vessel.findFirst({ where: { vesselName: n.name ?? 'UNKNOWN' } });
  }
}


