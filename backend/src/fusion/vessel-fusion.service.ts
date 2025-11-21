import { Injectable } from '@nestjs/common';
import { FUSION_CONFIG } from './config';
import { NormVesselMsg } from './types';
import { EventTimeWindowStore } from './window-store';
import { saneVessel, keyOfVessel } from './utils';
import { LastPublishedService } from './last-published.service';
import { mergeVesselMessages } from './merger';
import { FilterManager, type PredictedPosition } from './smoothing';
import { isValidTimestamp, isWithinLatenessWindow } from '../utils/timestamp-validator';
import { DataValidationService } from './data-validation.service';
import { ConflictMonitorService } from './conflict-monitor.service';

export interface FusionDecision<T> {
  best?: T;
  publish: boolean; // publish realtime or not
  backfillOnly: boolean; // only insert to history
}

@Injectable()
export class VesselFusionService {
  private readonly windows = new EventTimeWindowStore<NormVesselMsg>();
  private readonly lastPoint = new Map<string, { lat: number; lon: number; ts: number }>();
  private readonly filterManager = new FilterManager();

  constructor(
    private readonly lastPublishedStore: LastPublishedService,
    private readonly dataValidationService: DataValidationService,
    private readonly conflictMonitor: ConflictMonitorService,
  ) {}

  ingest(messages: NormVesselMsg[], now = Date.now()): void {
    for (const m of messages) {
      // Validate và normalize message trước khi xử lý
      const validatedMsg = this.dataValidationService.validateAndNormalize(m);
      if (!saneVessel(validatedMsg, now)) continue;
      const key = keyOfVessel(validatedMsg);
      if (!key) continue;
      this.windows.push(key, validatedMsg, now);
    }
  }

  async decide(key: string, now = Date.now()): Promise<FusionDecision<NormVesselMsg>> {
    const win = this.windows.getWindow(key).filter((m) => saneVessel(m, now));
    if (win.length === 0) return { publish: false, backfillOnly: false };

    const last =
      (await this.lastPublishedStore.get('vessel', key)) ?? this.windows.getLastPublished(key);

    // ✅ VALIDATE TIMESTAMPS
    const newer = win.filter((m) => {
      // Check if timestamp is valid
      if (!isValidTimestamp(m.ts)) {
        return false; // Skip invalid timestamps
      }

      // Check if within lateness window
      if (!isWithinLatenessWindow(m.ts, now, FUSION_CONFIG.ALLOWED_LATENESS_MS)) {
        return false;
      }

      // Check if newer than last published
      if (last && Date.parse(m.ts) <= Date.parse(last)) {
        return false;
      }

      return true;
    });

    let best: NormVesselMsg | undefined;

    if (newer.length > 0) {
      // ✅ FIELD-LEVEL FUSION: Merge multiple messages into best composite
      // Instead of picking one message, combine best fields from all sources
      best = mergeVesselMessages(newer, now, this.conflictMonitor);
      return { best, publish: true, backfillOnly: false };
    }

    // For backfill, also merge if multiple messages available
    if (win.length > 0) {
      best = mergeVesselMessages(win, now, this.conflictMonitor);
    }

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

    if (m) {
      this.lastPoint.set(key, { lat: m.lat, lon: m.lon, ts: t });

      // ✅ Update α-β filter for smoothing and prediction
      this.filterManager.update(key, {
        lat: m.lat,
        lon: m.lon,
        timestamp: t,
        speed: m.speed,
        course: m.course,
      });
    }
  }

  /**
   * Get predicted position for vessel (dead reckoning)
   * Used when no recent measurements available
   */
  predictPosition(key: string, now = Date.now()): PredictedPosition | null {
    return this.filterManager.predict(key, now);
  }

  /**
   * Get filter statistics
   */
  getFilterStats() {
    return this.filterManager.getStats();
  }

  /**
   * Cleanup old filters
   */
  cleanupFilters(now = Date.now()) {
    this.filterManager.cleanup(now);
  }
}
