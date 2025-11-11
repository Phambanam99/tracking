import { Injectable } from '@nestjs/common';
import { FUSION_CONFIG } from './config';
import { NormAircraftMsg } from './types';
import { EventTimeWindowStore } from './window-store';
import { saneAircraft, keyOfAircraft } from './utils';
import { LastPublishedService } from './last-published.service';
import { mergeAircraftMessages } from './merger';

export interface FusionDecision<T> {
  best?: T;
  publish: boolean; // publish realtime or not
  backfillOnly: boolean; // only insert to history
}

@Injectable()
export class AircraftFusionService {
  private readonly windows = new EventTimeWindowStore<NormAircraftMsg>();
  constructor(private readonly lastPublishedStore: LastPublishedService) {}
  private readonly lastPoint = new Map<string, { lat: number; lon: number; ts: number }>();

  ingest(messages: NormAircraftMsg[], now = Date.now()): void {
    for (const m of messages) {
      if (!saneAircraft(m, now)) continue;
      const key = keyOfAircraft(m);
      if (!key) continue;
      this.windows.push(key, m, now);
    }
  }

  async decide(key: string, now = Date.now()): Promise<FusionDecision<NormAircraftMsg>> {
    const win = this.windows.getWindow(key).filter((m) => saneAircraft(m, now));
    if (win.length === 0) return { publish: false, backfillOnly: false };

    const last =
      (await this.lastPublishedStore.get('aircraft', key)) ?? this.windows.getLastPublished(key);

    const newer = win.filter(
      (m) =>
        (!last || Date.parse(m.ts) > Date.parse(last)) &&
        now - Date.parse(m.ts) <= FUSION_CONFIG.ALLOWED_LATENESS_MS,
    );

    let best: NormAircraftMsg | undefined;

    if (newer.length > 0) {
      // ✅ FIELD-LEVEL FUSION: Merge multiple messages into best composite
      // Instead of picking one message, combine best fields from all sources
      best = mergeAircraftMessages(newer, now);
      return { best, publish: true, backfillOnly: false };
    }

    // For backfill, also merge if multiple messages available
    if (win.length > 0) {
      best = mergeAircraftMessages(win, now);
    }

    if (best && last && Date.parse(best.ts) <= Date.parse(last)) {
      return { best, publish: false, backfillOnly: true };
    }

    return { best, publish: !!best, backfillOnly: false };
  }

  async markPublished(key: string, tsIso: string) {
    this.windows.setLastPublished(key, tsIso);
    await this.lastPublishedStore.set('aircraft', key, tsIso);
    const t = Date.parse(tsIso);
    const win = this.windows.getWindow(key);
    const m = win.find((x) => Date.parse(x.ts) === t);
    if (m) this.lastPoint.set(key, { lat: m.lat, lon: m.lon, ts: t });
  }
}
