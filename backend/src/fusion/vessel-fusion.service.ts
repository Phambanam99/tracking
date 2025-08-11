import { Injectable } from '@nestjs/common';
import { FUSION_CONFIG } from './config';
import { NormVesselMsg } from './types';
import { EventTimeWindowStore } from './window-store';
import { saneVessel, scoreVessel, keyOfVessel } from './utils';
import { LastPublishedService } from './last-published.service';

export interface FusionDecision<T> {
  best?: T;
  publish: boolean; // publish realtime or not
  backfillOnly: boolean; // only insert to history
}

@Injectable()
export class VesselFusionService {
  private readonly windows = new EventTimeWindowStore<NormVesselMsg>();
  private readonly lastPoint = new Map<string, { lat: number; lon: number; ts: number }>();
  constructor(private readonly lastPublishedStore: LastPublishedService) {}

  ingest(messages: NormVesselMsg[], now = Date.now()): void {
    for (const m of messages) {
      if (!saneVessel(m, now)) continue;
      const key = keyOfVessel(m);
      if (!key) continue;
      this.windows.push(key, m, now);
    }
  }

  async decide(key: string, now = Date.now()): Promise<FusionDecision<NormVesselMsg>> {
    const win = this.windows.getWindow(key).filter((m) => saneVessel(m, now));
    if (win.length === 0) return { publish: false, backfillOnly: false };
    const last =
      (await this.lastPublishedStore.get('vessel', key)) ?? this.windows.getLastPublished(key);
    const newer = win.filter(
      (m) =>
        (!last || Date.parse(m.ts) > Date.parse(last)) &&
        now - Date.parse(m.ts) <= FUSION_CONFIG.ALLOWED_LATENESS_MS,
    );
    let best: NormVesselMsg | undefined;
    if (newer.length > 0) {
      best = newer.sort(
        (a, b) => Date.parse(b.ts) - Date.parse(a.ts) || scoreVessel(b, now) - scoreVessel(a, now),
      )[0];
      return { best, publish: true, backfillOnly: false };
    }
    best = win.sort((a, b) => scoreVessel(b, now) - scoreVessel(a, now))[0];
    if (best && last && Date.parse(best.ts) <= Date.parse(last)) {
      return { best, publish: false, backfillOnly: true };
    }
    return { best, publish: !!best, backfillOnly: false };
  }

  async markPublished(key: string, tsIso: string) {
    this.windows.setLastPublished(key, tsIso);
    await this.lastPublishedStore.set('vessel', key, tsIso);
    const t = Date.parse(tsIso);
    const win = this.windows.getWindow(key);
    const m = win.find((x) => Date.parse(x.ts) === t);
    if (m) this.lastPoint.set(key, { lat: m.lat, lon: m.lon, ts: t });
  }
}
