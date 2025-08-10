import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AircraftService } from '../aircraft/aircraft.service';
import { VesselService } from '../vessel/vessel.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class DataFetcherService {
  private readonly logger = new Logger(DataFetcherService.name);

  constructor(
    private prisma: PrismaService,
    private aircraftService: AircraftService,
    private vesselService: VesselService,
    private redisService: RedisService,
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

        // Add new position
        await this.aircraftService.addPosition(aircraft.id, aircraftData.position);

        // Publish real-time update to Redis
        await this.redisService.publish(
          'aircraft:position:update',
          JSON.stringify({
            aircraftId: aircraft.id,
            flightId: aircraftData.flightId,
            position: aircraftData.position,
            timestamp: new Date().toISOString(),
          }),
        );

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

        // Add new position
        await this.vesselService.addPosition(vessel.id, vesselData.position);

        // Publish real-time update to Redis
        await this.redisService.publish(
          'vessel:position:update',
          JSON.stringify({
            vesselId: vessel.id,
            vesselName: vesselData.vesselName,
            position: vesselData.position,
            timestamp: new Date().toISOString(),
          }),
        );

        this.logger.debug(`✅ Updated vessel ${vesselData.vesselName} and published to Redis`);
      } catch (error) {
        this.logger.error(`Error updating vessel ${vesselData.vesselName}:`, error);
      }
    }
  }
}
