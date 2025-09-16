import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AircraftService } from '../aircraft/aircraft.service';
import { VesselService } from '../vessel/vessel.service';
import { RedisService } from '../redis/redis.service';
import { VesselFusionService } from '../fusion/vessel-fusion.service';
import { AircraftFusionService } from '../fusion/aircraft-fusion.service';
import { normalizeVessel, normalizeAircraft } from '../fusion/normalizers';
import { FUSION_CONFIG } from '../fusion/config';
import { scoreAircraft, scoreVessel, keyOfVessel } from '../fusion/utils';
import { AisProvider } from './sources/ais.provider';

@Injectable()
export class DataFetcherService {
  private readonly logger = new Logger(DataFetcherService.name);

  constructor(
    private prisma: PrismaService,
    private aircraftService: AircraftService,
    private vesselService: VesselService,
    private redisService: RedisService,
    private vesselFusion: VesselFusionService,
    private aircraftFusion: AircraftFusionService,
    private aisProvider: AisProvider,
  ) {}

  /**
   * Scheduled task to fetch AIS vessel data every 30 seconds for real-time updates
   * Aircraft data still simulated for now
   */
  @Cron('*/30 * * * * *') // Every 30 seconds
  async handleCron() {
    this.logger.debug('Running scheduled data fetch...');

    try {
      // Fetch real AIS vessel data
      await this.fetchAndUpdateVesselDataFromAis();

      // Simulate fetching aircraft data (keep for now)
      // await this.fetchAndUpdateAircraftData();

      this.logger.debug('Scheduled data fetch completed successfully');
    } catch (error) {
      this.logger.error('Error during scheduled data fetch:', error);
    }
  }

 

  /**
   * Fetch real vessel data from AIS provider
   */
  private async fetchAndUpdateVesselDataFromAis() {
    try {
      const now = Date.now();
      this.logger.log('🔄 Starting AIS vessel data fetch...');

      // Fetch vessels from AIS source
      const rawVessels = await this.aisProvider.fetchVessels();
      this.logger.log(`📊 Raw vessels received from AIS: ${rawVessels.length}`);

      if (rawVessels.length === 0) {
        this.logger.debug('No vessels received from AIS source');
        return;
      }

      this.logger.log(`Processing ${rawVessels.length} vessels from AIS source`);

      // Log first few vessels for debugging
      rawVessels.slice(0, 3).forEach((vessel, index) => {
        this.logger.debug(
          `Vessel ${index + 1}: ${vessel.name} (${vessel.mmsi}) at ${vessel.lat}, ${vessel.lon}`,
        );
      });

      // Normalize AIS data to fusion format
      const normalized = rawVessels
        .map((vessel) =>
          normalizeVessel(
            {
              ts: new Date(vessel.timestamp).toISOString(),
              lat: vessel.lat,
              lon: vessel.lon,
              mmsi: vessel.mmsi,
              name: vessel.name,
              speed: vessel.speed,
              course: vessel.course,
              heading: vessel.heading,
              status: vessel.status,
            },
            vessel.source,
          ),
        )
        .filter((m): m is NonNullable<typeof m> => !!m);

      this.logger.log(`📝 Normalized vessels: ${normalized.length}`);

      // Ingest into fusion
      this.vesselFusion.ingest(normalized, now);
      this.logger.log('🔀 Vessels ingested into fusion');

      // Process each vessel (align normalized and raw by index)
      let processedCount = 0;
      for (let i = 0; i < rawVessels.length; i++) {
        const vesselData = rawVessels[i];
        const norm = normalized[i];
        try {
          // Upsert vessel
          const vessel = await this.vesselService.upsertVessel({
            mmsi: vesselData.mmsi,
            vesselName: vesselData.name,
            vesselType: undefined, // AIS data doesn't always include type
            flag: undefined, // AIS data doesn't always include flag
            operator: undefined, // AIS data doesn't always include operator
            length: undefined, // AIS data doesn't always include dimensions
            width: undefined,
          });

          // Decide by fusion using fusion key derivation
          const key = (keyOfVessel(norm as any) ?? vesselData.mmsi) as string;
          const decision = await this.vesselFusion.decide(key, now);

          const chosen = decision.best ?? (norm as any);
          if (chosen) {
            await this.vesselService.addPosition(vessel.id, {
              latitude: chosen.lat,
              longitude: chosen.lon,
              speed: chosen.speed,
              course: chosen.course,
              heading: chosen.heading,
              status: chosen.status,
              timestamp: new Date(chosen.ts),
              source: chosen.source,
              score: scoreVessel(chosen, now),
            });

            if (
              decision.publish &&
              chosen?.ts &&
              Date.now() - Date.parse(chosen.ts) <= FUSION_CONFIG.ALLOWED_LATENESS_MS
            ) {
              await this.redisService.publish(
                'vessel:position:update',
                JSON.stringify({
                  vesselId: vessel.id,
                  vesselName: vesselData.name,
                  latitude: chosen.lat,
                  longitude: chosen.lon,
                  speed: chosen.speed,
                  course: chosen.course,
                  heading: chosen.heading,
                  status: chosen.status,
                  source: chosen.source,
                  score: scoreVessel(chosen, now),
                  predicted: false,
                  timestamp: chosen.ts,
                }),
              );
              // Cache latest vessel state with TTL 10 minutes
              await this.redisService.set(
                `vessel:last:${vessel.id}`,
                JSON.stringify({
                  vesselId: vessel.id,
                  vesselName: vesselData.name,
                  latitude: chosen.lat,
                  longitude: chosen.lon,
                  speed: chosen.speed,
                  course: chosen.course,
                  heading: chosen.heading,
                  status: chosen.status,
                  source: chosen.source,
                  score: scoreVessel(chosen, now),
                  predicted: false,
                  timestamp: chosen.ts,
                }),
                600,
              );
              await this.vesselFusion.markPublished(key, chosen.ts);
            }
            processedCount++;
          }

          // this.logger.debug(
          //   `✅ Updated vessel ${vesselData.name} (${vesselData.mmsi}) from AIS source`,
          // );
        } catch (error) {
          this.logger.error(`Error updating vessel ${vesselData.mmsi}:`, error);
        }
      }

      this.logger.log(
        `🎯 Successfully processed ${processedCount}/${rawVessels.length} vessels from AIS source`,
      );
    } catch (error) {
      this.logger.error('Error fetching vessel data from AIS:', error);
    }
  }
}
