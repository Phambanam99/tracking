import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  ALLOWED_LATENESS_MS,
  NormAircraftMsg,
  RawAircraftMsg,
  WINDOW_MS,
  normalize,
  selectBest,
  score,
} from './aircraft-fusion.helpers';

@Injectable()
export class AircraftFusionService {
  private readonly logger = new Logger(AircraftFusionService.name);
  private windows = new Map<string, NormAircraftMsg[]>();
  private lastPublishedEventTs = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async ingestBatch(raws: RawAircraftMsg[]): Promise<void> {
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

      let best: NormAircraftMsg | null = null;
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

      await this.upsertAircraft(best);
      await this.addPosition(best);
      await this.redis.publish(
        'aircraft:position:update',
        JSON.stringify({
          key,
          ts: best.ts,
          source: best.source,
          score: score(best),
          lat: best.lat,
          lon: best.lon,
          speed: best.speed,
          heading: best.heading,
          altitude: best.altitude,
        }),
      );
      this.lastPublishedEventTs.set(key, best.ts);
    }
  }

  private async upsertAircraft(n: NormAircraftMsg) {
    const where = n.flightId
      ? { flightId: n.flightId }
      : n.registration
      ? { registration: n.registration }
      : { flightId: `UNKNOWN-${n.key}` };
    await this.prisma.aircraft.upsert({
      where,
      update: {
        callSign: n.callSign ?? undefined,
      },
      create: {
        flightId: n.flightId ?? `UNKNOWN-${n.key}`,
        registration: n.registration ?? null,
        callSign: n.callSign ?? null,
      },
    });
  }

  private async addPosition(n: NormAircraftMsg) {
    const a = await this.findAircraftByKey(n);
    if (!a) return;
    await this.prisma.aircraftPosition.create({
      data: {
        aircraftId: a.id,
        source: n.source,
        latitude: n.lat,
        longitude: n.lon,
        speed: n.speed ?? null,
        heading: n.heading ?? null,
        altitude: n.altitude ?? null,
        timestamp: new Date(n.ts),
      },
    });
  }

  private async saveHistory(n: NormAircraftMsg) {
    await this.addPosition(n);
  }

  private async findAircraftByKey(n: NormAircraftMsg) {
    if (n.flightId)
      return this.prisma.aircraft.findUnique({ where: { flightId: n.flightId } });
    if (n.registration)
      return this.prisma.aircraft.findFirst({ where: { registration: n.registration } });
    return this.prisma.aircraft.findFirst({ where: { callSign: n.callSign ?? undefined } });
  }
}


