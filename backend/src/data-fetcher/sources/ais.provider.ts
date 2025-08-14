import { Injectable, Logger } from '@nestjs/common';
import { AisSignalrService } from '../../ais/ais-signalr.service';
import { AisModel } from '../../ais/ais.types';
import { RawVessel } from '../../fusion/types';

@Injectable()
export class AisProvider {
  private readonly logger = new Logger(AisProvider.name);
  private lastFetchTime = 0;
  private readonly FETCH_INTERVAL = 30000; // 30 seconds between fetches

  // Buffer to store incoming AIS data
  private vesselBuffer: RawVessel[] = [];
  private isCollecting = false;

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
    const now = Date.now();

    // Rate limiting: only fetch every 30 seconds
    if (now - this.lastFetchTime < this.FETCH_INTERVAL) {
      this.logger.debug('Skipping fetch - too soon since last fetch');
      return [];
    }

    try {
      this.logger.log('Starting AIS vessel fetch...');
      this.lastFetchTime = now;

      // Calculate time 30 seconds ago in UTC (server expects UTC DateTime)
      const thirtySecondsAgo = new Date(now - 30000);
      const queryTime = `DateTime(${thirtySecondsAgo.getUTCFullYear()}, ${thirtySecondsAgo.getUTCMonth() + 1}, ${thirtySecondsAgo.getUTCDate()}, ${thirtySecondsAgo.getUTCHours()}, ${thirtySecondsAgo.getUTCMinutes()}, ${thirtySecondsAgo.getUTCSeconds()})`;

      // Don't clear buffer before query - let data accumulate
      this.logger.log(
        `Starting new query: ${queryTime}. Current buffer size: ${this.vesselBuffer.length}`,
      );

      // Trigger query to get fresh data from last 30 seconds
      const ok = await this.aisService.triggerQuery({
        query: `(updatetime >= ${queryTime})[***]`,
        usingLastUpdateTime: false, // Use our calculated time instead
        userId: 3,
      });
      if (ok === false) {
        this.logger.warn('AIS query skipped because SignalR is not connected. Will retry later.');
        return [];
      }

      // Wait for data to be collected into buffer
      this.logger.log('Waiting for data to be collected...');
      await new Promise((resolve) => setTimeout(resolve, 8000)); // Increased wait time

      // Get vessels from buffer
      let vessels = [...this.vesselBuffer];
      this.logger.log(`Buffer contains ${vessels.length} vessels after collection`);

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
        this.logger.warn('No vessels received from AIS stream after timeout');
      } else {
        this.logger.log(`Successfully fetched ${vessels.length} vessels from AIS source`);
        // Clear buffer only after successful processing
        this.vesselBuffer = [];
        this.logger.log('Buffer cleared after successful processing');
      }

      return vessels;
    } catch (error: any) {
      this.logger.error(`Error fetching vessels from AIS: ${error?.message ?? error}`);
      return [];
    }
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
