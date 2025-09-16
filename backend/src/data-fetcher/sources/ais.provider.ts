import { Injectable, Logger } from '@nestjs/common';
import { AisSignalrService } from '../../ais/ais-signalr.service';
import { AisModel } from '../../ais/ais.types';
import { RawVessel } from '../../fusion/types';

@Injectable()
export class AisProvider {
  private readonly logger = new Logger(AisProvider.name);
  private lastFetchTime = 0;
  private readonly FETCH_INTERVAL = 30000; // 30 seconds between fetches
  // Escalation schedule (seconds) if we keep receiving zero vessels
  private readonly LOOKBACK_SCHEDULE = [30, 120, 300, 900]; // 30s, 2m, 5m, 15m
  private readonly MIN_BUFFER_WARM_THRESHOLD = 5; // If below this, treat as cold start / warm-up

  // Buffer to store incoming AIS data
  private vesselBuffer: RawVessel[] = [];
  private isCollecting = false;
  private fetchInProgress = false;
  private diagLogged = false;
  private zeroResultCycles = 0; // consecutive escalation cycles yielding zero data
  private readonly DIAGNOSTIC_PROBE_LOOKBACKS = [3600, 86400]; // 1h, 24h in seconds
  private readonly DIAGNOSTIC_PROBE_MAX_SEGMENT = 500; // cap vessels collected in diagnostic

  /** Fallback chờ kết nối nếu phiên bản service chưa có waitForConnection */
  private async waitForConnectionCompat(timeoutMs = 15000): Promise<boolean> {
    const svc: any = this.aisService as any;
    if (typeof svc.waitForConnection === 'function') {
      try {
        return await svc.waitForConnection(timeoutMs);
      } catch (e: any) {
        this.logger.warn(`waitForConnection (service) threw: ${e?.message ?? e}`);
      }
    }
    if (!this.diagLogged) {
      this.diagLogged = true;
      try {
        const keys = Object.getOwnPropertyNames(Object.getPrototypeOf(svc));
        this.logger.warn(`AisSignalrService prototype keys (compat mode): ${keys.join(', ')}`);
      } catch (_) {
        /* ignore */
      }
    }
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      // Try direct fields
      if (svc.connection && svc.connection.connectionId) return true;
      // If not connecting and no connection object, attempt connect
      if (!svc.connection && !svc.isConnecting && typeof svc.connect === 'function') {
        try {
          svc.connect();
        } catch (_) {
          /* ignore */
        }
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  }

  constructor(private readonly aisService: AisSignalrService) {
    this.logger.log(
      `AisProvider constructor called. Initial buffer size: ${this.vesselBuffer.length}`,
    );
    // Start collecting data from the stream immediately
    this.startDataCollection();
  }

  /**
   * Start continuous data collection from AIS stream
   */
  private startDataCollection() {
    this.logger.log(`startDataCollection called. Current buffer size: ${this.vesselBuffer.length}`);
    this.isCollecting = true;

    // Subscribe to data stream to continuously collect vessels
    this.aisService.dataStream$.subscribe(({ data }) => {
      this.logger.debug?.(
        `Data stream received ${data.length} vessels. Buffer before: ${this.vesselBuffer.length}`,
      );
      if (Array.isArray(data) && data.length > 0) {
        let pushed = 0;
        data.forEach((aisData, idx) => {
          const vessel = this.normalizeAisToRawVessel(aisData);
          if (vessel) {
            this.vesselBuffer.push(vessel);
            pushed++;
            if (idx === 0) {
              this.logger.debug?.(
                `First normalized vessel: ${vessel.name} (${vessel.mmsi}) at ${vessel.lat}, ${vessel.lon}`,
              );
            }
          }
        });
        this.logger.debug?.(
          `Pushed ${pushed}/${data.length}. Total in buffer: ${this.vesselBuffer.length}`,
        );
      }
    });

    // Subscribe to start stream to know when new query begins
    this.aisService.startStream$.subscribe(({ count }) => {
      this.logger.log(
        `AIS query started, expecting ${count} vessels. Buffer size: ${this.vesselBuffer.length}`,
      );
      // Don't clear buffer - let data accumulate
    });

    // Subscribe to end stream to know when query completes
    this.aisService.endStream$.subscribe(() => {
      this.logger.log(`AIS query ended, buffer contains ${this.vesselBuffer.length} vessels`);
    });
  }

  /**
   * Fetch vessels from AIS source
   * @param bbox Optional bounding box [minLon, minLat, maxLon, maxLat]
   * @returns Promise<RawVessel[]>
   */
  async fetchVessels(bbox?: [number, number, number, number]): Promise<RawVessel[]> {
    if (this.fetchInProgress) {
      this.logger.warn('fetchVessels skipped: previous fetch still in progress');
      return [];
    }
    this.fetchInProgress = true;
    const now = Date.now();

    // Rate limiting: only fetch every 30 seconds
    // if (now - this.lastFetchTime < this.FETCH_INTERVAL) {
    //   this.logger.debug(
    //     `Skipping fetch - too soon since last fetch ${now - this.lastFetchTime} ms`
    //   );
    //   return [];
    // }

    try {
      this.logger.log('[fetch] Starting AIS vessel fetch (phase=start)');
      this.lastFetchTime = now;

      // Ensure connection ready
      this.logger.debug?.('[fetch] Waiting for SignalR connection (phase=waitForConnection)');
      const ready = await this.waitForConnectionCompat(15000);
      if (!ready) {
        this.logger.warn('Cannot fetch: SignalR connection not ready after wait');
        return [];
      }

      // Helper to build DateTime(...) in server format
      const buildDateTimeLiteral = (d: Date) =>
        `DateTime(${d.getUTCFullYear()}, ${d.getUTCMonth() + 1}, ${d.getUTCDate()}, ${d.getUTCHours()}, ${d.getUTCMinutes()}, ${d.getUTCSeconds()})`;

      interface AttemptResult {
        vessels: RawVessel[];
        lookback: number; // seconds
        expectedCount: number;
        timedOut: boolean;
        variantIndex?: number;
        variantQuery?: string;
      }

      const attemptQuery = async (
        lookbackSeconds: number,
        attemptIndex: number,
      ): Promise<AttemptResult> => {
        const since = new Date(now - lookbackSeconds * 1000);
        const dtLiteral = buildDateTimeLiteral(since);
        const usingLastUpdateTime = lookbackSeconds <= 30; // only for narrow most-recent window
        this.logger.log(
          `[fetch] Attempt #${attemptIndex + 1} lookback=${lookbackSeconds}s usingLastUpdateTime=${usingLastUpdateTime} windowStart=${dtLiteral} (phase=prepareQuery)`,
        );

        const segment: RawVessel[] = [];
        const startBufferLength = this.vesselBuffer.length;
        let expectedCount = -1;
        let ended = false;

        const dataSub = this.aisService.dataStream$.subscribe(({ data }) => {
          for (const item of data) {
            const v = this.normalizeAisToRawVessel(item);
            if (v) {
              this.vesselBuffer.push(v);
              segment.push(v);
            }
          }
        });
        const startSub = this.aisService.startStream$.subscribe(({ count }) => {
          expectedCount = count;
        });
        const endSub = this.aisService.endStream$.subscribe(() => {
          ended = true;
        });

        const variantsEnabled = process.env.AIS_QUERY_VARIANTS_ENABLED !== 'false';
        const queryVariants = variantsEnabled
          ? [
              `(updatetime >= ${dtLiteral})[***]`, // original
              `(updatetime >= ${dtLiteral})`, // remove postfix
              `updatetime >= ${dtLiteral}`, // no parentheses
              `updateTime >= ${dtLiteral}`, // camelCase field
              `(updateTime >= ${dtLiteral})`,
              `(updatetime>=${dtLiteral})`,
            ]
          : [`(updatetime >= ${dtLiteral})[***]`];

        let variantIndexUsed = -1;
        let variantQueryUsed = '';
        let timedOut = false;
        for (let vIdx = 0; vIdx < queryVariants.length; vIdx++) {
          const queryString = queryVariants[vIdx];
          this.logger.log(
            `[fetch] Attempt #${attemptIndex + 1} variant #${vIdx + 1}/${queryVariants.length} dispatching query="${queryString}" usingLastUpdateTime=${usingLastUpdateTime}`,
          );
          const ok = await this.aisService.triggerQuery({
            query: queryString,
            usingLastUpdateTime,
            userId: 1,
          });
          this.logger.log(
            `Query triggered: ${ok} (attempt #${attemptIndex + 1} variant #${vIdx + 1})`,
          );
          if (ok === false) {
            this.logger.warn(
              `[fetch] Variant #${vIdx + 1} skipped (disconnected). Aborting attempt.`,
            );
            break; // no connection; abort attempt entirely
          }

          const WAIT_TIMEOUT_MS = 6000; // shorter per variant
          const waitStart = Date.now();
          this.logger.log(
            `[fetch] Waiting stream events (attempt=#${attemptIndex + 1} variant=#${vIdx + 1}) timeoutMs=${WAIT_TIMEOUT_MS}`,
          );
          while (!ended && Date.now() - waitStart < WAIT_TIMEOUT_MS) {
            await new Promise((r) => setTimeout(r, 250));
            // Early break: if we already have data in segment or expectedCount > 0
            if (segment.length > 0 || expectedCount > 0) break;
          }
          timedOut = !ended && segment.length === 0 && expectedCount <= 0;
          if (timedOut) {
            this.logger.warn(
              `[fetch] Variant #${vIdx + 1} timeout/no data (segment=0 expectedCount=${expectedCount})`,
            );
          }
          if (segment.length > 0 || expectedCount > 0 || ended) {
            variantIndexUsed = vIdx;
            variantQueryUsed = queryString;
            // If ended or we got first data, stop trying further variants
            break;
          }
        }

        dataSub.unsubscribe();
        startSub.unsubscribe();
        endSub.unsubscribe();

        this.logger.log(
          `[fetch] Attempt #${attemptIndex + 1} collected segment size=${segment.length} bufferDelta=${
            this.vesselBuffer.length - startBufferLength
          } expectedCount=${expectedCount} timedOut=${timedOut} variantUsed=${
            variantIndexUsed >= 0 ? variantIndexUsed + 1 : 'none'
          } (phase=collectedRaw)`,
        );
        return {
          vessels: segment,
          lookback: lookbackSeconds,
          expectedCount,
          timedOut,
          variantIndex: variantIndexUsed >= 0 ? variantIndexUsed : undefined,
          variantQuery: variantQueryUsed || undefined,
        };
      };

      // Decide escalation strategy
      const shouldEscalate = this.vesselBuffer.length < this.MIN_BUFFER_WARM_THRESHOLD;
      if (shouldEscalate) {
        this.logger.warn(
          `[fetch] Buffer below warm threshold (${this.vesselBuffer.length} < ${this.MIN_BUFFER_WARM_THRESHOLD}) — using escalating lookbacks`,
        );
      }

      const attemptsToRun = shouldEscalate ? this.LOOKBACK_SCHEDULE : [this.LOOKBACK_SCHEDULE[0]]; // only 30s if warm
      const allResults: AttemptResult[] = [];
      for (let i = 0; i < attemptsToRun.length; i++) {
        const lookback = attemptsToRun[i];
        const result = await attemptQuery(lookback, i);
        allResults.push(result);
        if (result.vessels.length > 0) {
          this.logger.log(
            `[fetch] Stopping escalation after attempt #${i + 1} (lookback=${lookback}s) received ${result.vessels.length} vessels`,
          );
          break;
        }
        if (i < attemptsToRun.length - 1) {
          this.logger.log(
            `[fetch] No data for lookback=${lookback}s (segment=0). Escalating to next lookback=${attemptsToRun[i + 1]}s`,
          );
        }
      }

      // Pick first non-empty result, else last result
      const chosen =
        allResults.find((r) => r.vessels.length > 0) || allResults[allResults.length - 1];
      let vessels = [...chosen.vessels];
      this.logger.log(
        `[fetch] Chosen result lookback=${chosen.lookback}s segmentSize=${vessels.length} totalBuffer=${this.vesselBuffer.length} (phase=chooseResult)`,
      );
      const escalationExhaustedAndEmpty = vessels.length === 0 && shouldEscalate;
      if (escalationExhaustedAndEmpty) {
        this.logger.warn(
          '[fetch] Escalation exhausted (30s/2m/5m/15m) but still zero vessels. Source may be idle or query filter too strict.',
        );
        this.zeroResultCycles++;
        if (this.zeroResultCycles >= 2) {
          await this.runDiagnosticProbes(now);
        } else {
          this.logger.log(
            `[fetch] zeroResultCycles=${this.zeroResultCycles} (<2) — will attempt probes if persists next cycle`,
          );
        }
        // Baseline broad query (no time filter) to test if any data returns
        this.logger.warn('[fetch] Executing baseline broad query without time filter');
        const baseline = await this.runBaselineQuery();
        if (baseline.length > 0) {
          this.logger.warn(
            `[fetch] Baseline broad query returned ${baseline.length} vessels while time-filtered queries returned 0 – time filter may be too restrictive or updatetime field mismatch`,
          );
          vessels = baseline;
        } else {
          this.logger.warn('[fetch] Baseline broad query also returned 0 vessels');
        }
      } else if (vessels.length > 0) {
        if (this.zeroResultCycles > 0) {
          this.logger.log(
            `[fetch] Resetting zeroResultCycles from ${this.zeroResultCycles} due to successful data retrieval`,
          );
        }
        this.zeroResultCycles = 0;
      }

      // Deduplicate by mmsi+timestamp
      const dedupMap = new Map<string, RawVessel>();
      for (const v of vessels) {
        const key = `${v.mmsi}|${v.timestamp}`;
        // If duplicate key appears keep the latest inserted (they're effectively same moment)
        dedupMap.set(key, v);
      }
      if (dedupMap.size !== vessels.length) {
        this.logger.log(
          `[fetch] Deduplicated segment ${vessels.length} -> ${dedupMap.size} unique (phase=dedup)`,
        );
      }
      vessels = Array.from(dedupMap.values());

      // Apply bbox filter if provided
      if (bbox) {
        const [minLon, minLat, maxLon, maxLat] = bbox;
        vessels = vessels.filter(
          (vessel) =>
            vessel.lon >= minLon &&
            vessel.lon <= maxLon &&
            vessel.lat >= minLat &&
            vessel.lat <= maxLat,
        );
        this.logger.log(`After bbox filter: ${vessels.length} vessels`);
      }

      if (vessels.length === 0) {
        this.logger.warn('No vessels received for this fetch segment');
      } else {
        this.logger.log(`Successfully fetched ${vessels.length} vessels from AIS source (segment)`);
        this.logger.debug?.(
          `Global buffer size now: ${this.vesselBuffer.length} (segment retained, not cleared)`,
        );
      }

      return vessels;
    } catch (error: any) {
      this.logger.error(`Error fetching vessels from AIS: ${error?.message ?? error}`);
      return [];
    } finally {
      this.fetchInProgress = false;
    }
  }

  /**
   * Baseline query without time filter: sends raw configured query or a simplified fallback if empty.
   * Collects a small capped segment to avoid overload.
   */
  private async runBaselineQuery(): Promise<RawVessel[]> {
    const segment: RawVessel[] = [];
    let ended = false;
    const CAP = 300;
    const dataSub = this.aisService.dataStream$.subscribe(({ data }) => {
      for (const item of data) {
        if (segment.length >= CAP) return;
        const v = this.normalizeAisToRawVessel(item);
        if (v) segment.push(v);
      }
    });
    const endSub = this.aisService.endStream$.subscribe(() => (ended = true));
    const startSub = this.aisService.startStream$.subscribe(() => {});

    // Provide empty query meaning: use server default (configured). If server requires something, fallback to tautology.
    const broadQuery = '(updatetime >= DateTime(2000, 1, 1, 0, 0, 0))[***]';
    this.logger.warn(`[baseline] Dispatching broad query="${broadQuery}" (no recent window)`);
    const ok = await this.aisService.triggerQuery({
      query: broadQuery,
      usingLastUpdateTime: false,
      userId: 1,
    });
    if (ok === false) {
      this.logger.warn('[baseline] Skipped: connection not ready');
      dataSub.unsubscribe();
      endSub.unsubscribe();
      startSub.unsubscribe();
      return [];
    }
    const WAIT_TIMEOUT_MS = 9000;
    const start = Date.now();
    while (!ended && Date.now() - start < WAIT_TIMEOUT_MS && segment.length < CAP) {
      await new Promise((r) => setTimeout(r, 300));
    }
    dataSub.unsubscribe();
    endSub.unsubscribe();
    startSub.unsubscribe();
    this.logger.warn(
      `[baseline] Completed broad query collected=${segment.length} cappedAt=${CAP} ended=${ended}`,
    );
    return segment;
  }

  /**
   * Run broad diagnostic probes with large lookback windows to determine if ANY data is available.
   * Does NOT merge results into normal return path; logs findings and first few sample MMSIs.
   */
  private async runDiagnosticProbes(nowMs: number) {
    this.logger.warn(
      `[diag] Starting diagnostic probes after ${this.zeroResultCycles} consecutive zero-result cycles`,
    );
    const buildDateTimeLiteral = (d: Date) =>
      `DateTime(${d.getUTCFullYear()}, ${d.getUTCMonth() + 1}, ${d.getUTCDate()}, ${d.getUTCHours()}, ${d.getUTCMinutes()}, ${d.getUTCSeconds()})`;

    for (let i = 0; i < this.DIAGNOSTIC_PROBE_LOOKBACKS.length; i++) {
      const lb = this.DIAGNOSTIC_PROBE_LOOKBACKS[i];
      const since = new Date(nowMs - lb * 1000);
      const dtLiteral = buildDateTimeLiteral(since);
      this.logger.warn(`[diag] Probe #${i + 1}: lookback=${lb}s windowStart=${dtLiteral}`);

      // Scoped segment
      const segment: RawVessel[] = [];
      let ended = false;
      const dataSub = this.aisService.dataStream$.subscribe(({ data }) => {
        for (const item of data) {
          if (segment.length >= this.DIAGNOSTIC_PROBE_MAX_SEGMENT) return; // cap
          const v = this.normalizeAisToRawVessel(item);
          if (v) segment.push(v);
        }
      });
      const endSub = this.aisService.endStream$.subscribe(() => {
        ended = true;
      });
      const startSub = this.aisService.startStream$.subscribe(() => {});

      const ok = await this.aisService.triggerQuery({
        query: `(updatetime >= ${dtLiteral})[***]`,
        usingLastUpdateTime: false,
        userId: 1,
      });
      if (ok === false) {
        this.logger.warn('[diag] Probe aborted: connection not ready');
        dataSub.unsubscribe();
        endSub.unsubscribe();
        startSub.unsubscribe();
        return;
      }
      const WAIT_TIMEOUT_MS = 7000;
      const start = Date.now();
      while (
        !ended &&
        Date.now() - start < WAIT_TIMEOUT_MS &&
        segment.length < this.DIAGNOSTIC_PROBE_MAX_SEGMENT
      ) {
        await new Promise((r) => setTimeout(r, 250));
      }
      dataSub.unsubscribe();
      endSub.unsubscribe();
      startSub.unsubscribe();

      if (segment.length === 0) {
        this.logger.warn(`[diag] Probe #${i + 1} found zero vessels`);
        continue;
      }
      const sample = segment
        .slice(0, 5)
        .map((v) => v.mmsi)
        .join(', ');
      this.logger.warn(
        `[diag] Probe #${i + 1} collected ${segment.length} (capped at ${this.DIAGNOSTIC_PROBE_MAX_SEGMENT}). Sample MMSIs: ${sample}`,
      );
      // Stop after first positive probe
      break;
    }
    this.logger.warn('[diag] Diagnostic probes completed');
  }

  /**
   * Normalize AIS data to RawVessel format
   */
  private normalizeAisToRawVessel(aisData: AisModel): RawVessel | null {
    // Robust field extraction with correct property names
    const mmsiValue = aisData?.mmsi;
    const latitude = aisData?.latitude;
    const longitude = aisData?.longitude;
    const tsString = aisData?.updatetime;

    // Validate essentials (allow 0 for lat/lon)
    if (mmsiValue == null || latitude == null || longitude == null || !tsString) {
      return null;
    }

    const name = aisData?.name ?? `Vessel_${String(mmsiValue)}`;
    const speed = aisData?.speed ?? 0;
    const course = aisData?.course ?? 0;
    const heading = aisData?.heading ?? course;
    const ts = new Date(tsString).getTime();
    if (Number.isNaN(ts)) {
      return null;
    }

    return {
      mmsi: String(mmsiValue),
      name,
      lat: Number(latitude),
      lon: Number(longitude),
      speed: Number(speed),
      course: Number(course),
      heading: Number(heading),
      status: 'active',
      timestamp: ts,
      source: 'china_port',
      raw: aisData,
    };
  }

  /**
   * Get current buffer size for debugging
   */
  getBufferSize(): number {
    return this.vesselBuffer.length;
  }

  /**
   * Get vessel count for monitoring
   */
  async getVesselCount(): Promise<number> {
    try {
      const ready = await this.waitForConnectionCompat(10000);
      if (!ready) {
        this.logger.warn('getVesselCount aborted: connection not ready');
        return 0;
      }
      await this.aisService.triggerQuery({
        usingLastUpdateTime: true,
        userId: 3,
      });

      // Wait for count
      await new Promise((resolve) => setTimeout(resolve, 1000));

      let count = 0;
      const subscription = this.aisService.startStream$.subscribe(({ count: vesselCount }) => {
        count = vesselCount;
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));
      subscription.unsubscribe();

      return count;
    } catch (error) {
      this.logger.error(`Error getting vessel count: ${error.message}`);
      return 0;
    }
  }
}
