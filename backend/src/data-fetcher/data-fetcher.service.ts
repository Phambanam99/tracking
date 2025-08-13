import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AircraftService } from '../aircraft/aircraft.service';
import { VesselService } from '../vessel/vessel.service';
import { RedisService } from '../redis/redis.service';
import { VesselFusionService } from '../fusion/vessel-fusion.service';
import { AircraftFusionService } from '../fusion/aircraft-fusion.service';
import { normalizeVessel, normalizeAircraft } from '../fusion/normalizers';
import { FUSION_CONFIG } from '../fusion/config';
import { scoreAircraft, scoreVessel } from '../fusion/utils';

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
  ) {}

  /**
   * Scheduled task to fetch aircraft and vessel data every 10 seconds
   * Currently simulates API calls - can be replaced with real API integration later
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    this.logger.debug('Running scheduled data fetch...');

    try {
      // Simulate fetching aircraft data
      await this.fetchAndUpdateAircraftData();

      // Simulate fetching vessel data
      await this.fetchAndUpdateVesselData();

      this.logger.debug('Scheduled data fetch completed successfully');
    } catch (error) {
      this.logger.error('Error during scheduled data fetch:', error);
    }
  }

  /**
   * Simulate fetching aircraft data from external APIs like Flightradar24
   */
  private async fetchAndUpdateAircraftData() {
    // Simulate some aircraft data - replace with real API calls later
    const simulatedAircraftData = [
      {
        flightId: 'UAL123',
        callSign: 'UAL123',
        registration: 'N12345',
        aircraftType: 'Boeing 737',
        operator: 'United Airlines',
        position: {
          latitude: 37.7749 + (Math.random() - 0.5) * 0.01, // San Francisco area
          longitude: -122.4194 + (Math.random() - 0.5) * 0.01,
          altitude: 35000 + Math.floor(Math.random() * 5000),
          speed: 450 + Math.floor(Math.random() * 100),
          heading: Math.floor(Math.random() * 360),
        },
      },
      {
        flightId: 'DAL456',
        callSign: 'DAL456',
        registration: 'N67890',
        aircraftType: 'Airbus A320',
        operator: 'Delta Airlines',
        position: {
          latitude: 40.7128 + (Math.random() - 0.5) * 0.01, // New York area
          longitude: -74.006 + (Math.random() - 0.5) * 0.01,
          altitude: 30000 + Math.floor(Math.random() * 5000),
          speed: 420 + Math.floor(Math.random() * 100),
          heading: Math.floor(Math.random() * 360),
        },
      },
    ];

    const now = Date.now();
    // Normalize and ingest as if coming from a single source for demo
    const normalized = simulatedAircraftData
      .map((a) =>
        normalizeAircraft(
          {
            ...a,
            ts: new Date().toISOString(),
            lat: a.position.latitude,
            lon: a.position.longitude,
            altitude: a.position.altitude,
            speed: a.position.speed,
            heading: a.position.heading,
          },
          'custom',
        ),
      )
      .filter((m): m is NonNullable<typeof m> => !!m);

    this.aircraftFusion.ingest(normalized, now);

    for (const aircraftData of simulatedAircraftData) {
      try {
        // Upsert aircraft
        const aircraft = await this.aircraftService.upsertAircraft({
          flightId: aircraftData.flightId,
          callSign: aircraftData.callSign,
          registration: aircraftData.registration,
          aircraftType: aircraftData.aircraftType,
          operator: aircraftData.operator,
        });

        // Decide by fusion for this aircraft key
        const key = aircraftData.flightId; // demo key
        const decision = await this.aircraftFusion.decide(key, now);
        if (decision.best) {
          // Persist position (idempotent via timestamp granularity in demo)
          await this.aircraftService.addPosition(aircraft.id, {
            latitude: decision.best.lat,
            longitude: decision.best.lon,
            altitude: decision.best.altitude,
            speed: decision.best.groundSpeed,
            heading: decision.best.heading,
            timestamp: new Date(decision.best.ts),
            source: decision.best.source,
            score: scoreAircraft(decision.best, now),
          });

          if (
            decision.publish &&
            Date.now() - Date.parse(decision.best.ts) <= FUSION_CONFIG.ALLOWED_LATENESS_MS
          ) {
            await this.redisService.publish(
              'aircraft:position:update',
              JSON.stringify({
                aircraftId: aircraft.id,
                flightId: aircraftData.flightId,
                latitude: decision.best.lat,
                longitude: decision.best.lon,
                altitude: decision.best.altitude,
                speed: decision.best.groundSpeed,
                heading: decision.best.heading,
                source: decision.best.source,
                score: scoreAircraft(decision.best, now),
                predicted: false,
                timestamp: decision.best.ts,
              }),
            );
            await this.aircraftFusion.markPublished(key, decision.best.ts);
          }
        }

        this.logger.debug(`✅ Updated aircraft ${aircraftData.flightId} and published to Redis`);
      } catch (error) {
        this.logger.error(`Error updating aircraft ${aircraftData.flightId}:`, error);
      }
    }
  }

  /**
   * Simulate fetching vessel data from external APIs like Vesselfinder
   */
  private async fetchAndUpdateVesselData() {
    // Simulate some vessel data - replace with real API calls later
    const simulatedVesselData = [
      {
        mmsi: '123456789',
        vesselName: 'CARGO SHIP 1',
        vesselType: 'Cargo',
        flag: 'US',
        operator: 'Shipping Company A',
        length: 200,
        width: 30,
        position: {
          latitude: 34.0522 + (Math.random() - 0.5) * 0.01, // Los Angeles area
          longitude: -118.2437 + (Math.random() - 0.5) * 0.01,
          speed: 12 + Math.random() * 8,
          course: Math.floor(Math.random() * 360),
          heading: Math.floor(Math.random() * 360),
          status: 'Under way using engine',
        },
      },
      {
        mmsi: '987654321',
        vesselName: 'TANKER VESSEL 2',
        vesselType: 'Tanker',
        flag: 'GB',
        operator: 'Maritime Corp B',
        length: 250,
        width: 35,
        position: {
          latitude: 25.7617 + (Math.random() - 0.5) * 0.01, // Miami area
          longitude: -80.1918 + (Math.random() - 0.5) * 0.01,
          speed: 8 + Math.random() * 6,
          course: Math.floor(Math.random() * 360),
          heading: Math.floor(Math.random() * 360),
          status: 'At anchor',
        },
      },
    ];

    const now = Date.now();
    const normalized = simulatedVesselData
      .map((v) =>
        normalizeVessel(
          {
            ...v,
            ts: new Date().toISOString(),
            lat: v.position.latitude,
            lon: v.position.longitude,
            sog: v.position.speed,
            cog: v.position.course,
            heading: v.position.heading,
            status: v.position.status,
          },
          'custom',
        ),
      )
      .filter((m): m is NonNullable<typeof m> => !!m);

    this.vesselFusion.ingest(normalized, now);

    for (const vesselData of simulatedVesselData) {
      try {
        // Upsert vessel
        const vessel = await this.vesselService.upsertVessel({
          mmsi: vesselData.mmsi,
          vesselName: vesselData.vesselName,
          vesselType: vesselData.vesselType,
          flag: vesselData.flag,
          operator: vesselData.operator,
          length: vesselData.length,
          width: vesselData.width,
        });

        // Decide by fusion using mmsi as key
        const key = vesselData.mmsi;
        const decision = await this.vesselFusion.decide(key, now);
        if (decision.best) {
          await this.vesselService.addPosition(vessel.id, {
            latitude: decision.best.lat,
            longitude: decision.best.lon,
            speed: decision.best.speed,
            course: decision.best.course,
            heading: decision.best.heading,
            status: decision.best.status,
            timestamp: new Date(decision.best.ts),
            source: decision.best.source,
            score: scoreVessel(decision.best, now),
          });

          if (
            decision.publish &&
            Date.now() - Date.parse(decision.best.ts) <= FUSION_CONFIG.ALLOWED_LATENESS_MS
          ) {
            await this.redisService.publish(
              'vessel:position:update',
              JSON.stringify({
                vesselId: vessel.id,
                vesselName: vesselData.vesselName,
                latitude: decision.best.lat,
                longitude: decision.best.lon,
                speed: decision.best.speed,
                course: decision.best.course,
                heading: decision.best.heading,
                status: decision.best.status,
                source: decision.best.source,
                score: scoreVessel(decision.best, now),
                predicted: false,
                timestamp: decision.best.ts,
              }),
            );
            await this.vesselFusion.markPublished(key, decision.best.ts);
          }
        }

        this.logger.debug(`✅ Updated vessel ${vesselData.vesselName} and published to Redis`);
      } catch (error) {
        this.logger.error(`Error updating vessel ${vesselData.vesselName}:`, error);
      }
    }
  }
}
