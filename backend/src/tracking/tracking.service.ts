import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegionService } from '../region/region.service';
import { ObjectType } from '@prisma/client';
import { RedisService } from '../redis/redis.service';

export interface TrackingItem {
  id: number;
  type: 'aircraft' | 'vessel';
  alias?: string | null;
  notes?: string | null;
  createdAt: Date;
  data: any; // Aircraft or Vessel data
}

@Injectable()
export class TrackingService {
  constructor(
    private prisma: PrismaService,
    private regionService: RegionService,
    private redisService: RedisService,
  ) {}

  // Aircraft tracking methods
  async trackAircraft(
    userId: number,
    aircraftId: number,
    alias?: string,
    notes?: string,
  ) {
    // First check if aircraft exists
    const aircraft = await this.prisma.aircraft.findUnique({
      where: { id: aircraftId },
    });

    if (!aircraft) {
      throw new Error(`Aircraft with ID ${aircraftId} not found`);
    }

    // Check if already tracking
    const existingTracking = await this.prisma.userTrackedAircraft.findFirst({
      where: {
        userId,
        aircraftId,
      },
    });

    if (existingTracking) {
      throw new Error(`Aircraft ${aircraftId} is already being tracked`);
    }

    try {
      return await this.prisma.userTrackedAircraft.create({
        data: {
          userId,
          aircraftId,
          alias,
          notes,
        },
        include: {
          aircraft: {
            include: {
              positions: {
                orderBy: { timestamp: 'desc' },
                take: 1,
              },
            },
          },
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new Error(`Aircraft ${aircraftId} is already being tracked`);
      }
      throw error;
    }
  }

  async untrackAircraft(userId: number, aircraftId: number) {
    return this.prisma.userTrackedAircraft.deleteMany({
      where: {
        userId,
        aircraftId,
      },
    });
  }

  async getTrackedAircrafts(userId: number): Promise<TrackingItem[]> {
    const tracked = await this.prisma.userTrackedAircraft.findMany({
      where: { userId },
      include: {
        aircraft: {
          include: {
            positions: {
              orderBy: { timestamp: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tracked.map((item) => ({
      id: item.id,
      type: 'aircraft' as const,
      alias: item.alias,
      notes: item.notes,
      createdAt: item.createdAt,
      data: {
        ...item.aircraft,
        lastPosition: item.aircraft.positions[0] || null,
      },
    }));
  }

  // Vessel tracking methods
  async trackVessel(
    userId: number,
    vesselId: number,
    alias?: string,
    notes?: string,
  ) {
    return this.prisma.userTrackedVessel.create({
      data: {
        userId,
        vesselId,
        alias,
        notes,
      },
      include: {
        vessel: {
          include: {
            positions: {
              orderBy: { timestamp: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
  }

  async untrackVessel(userId: number, vesselId: number) {
    return this.prisma.userTrackedVessel.deleteMany({
      where: {
        userId,
        vesselId,
      },
    });
  }

  async getTrackedVessels(userId: number): Promise<TrackingItem[]> {
    const tracked = await this.prisma.userTrackedVessel.findMany({
      where: { userId },
      include: {
        vessel: {
          include: {
            positions: {
              orderBy: { timestamp: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tracked.map((item) => ({
      id: item.id,
      type: 'vessel' as const,
      alias: item.alias,
      notes: item.notes,
      createdAt: item.createdAt,
      data: {
        ...item.vessel,
        lastPosition: item.vessel.positions[0] || null,
      },
    }));
  }

  // Combined methods
  async getAllTracked(userId: number): Promise<TrackingItem[]> {
    const [aircrafts, vessels] = await Promise.all([
      this.getTrackedAircrafts(userId),
      this.getTrackedVessels(userId),
    ]);

    return [...aircrafts, ...vessels].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async isTracking(
    userId: number,
    type: 'aircraft' | 'vessel',
    itemId: number,
  ): Promise<boolean> {
    if (type === 'aircraft') {
      const tracked = await this.prisma.userTrackedAircraft.findFirst({
        where: { userId, aircraftId: itemId },
      });
      return !!tracked;
    } else {
      const tracked = await this.prisma.userTrackedVessel.findFirst({
        where: { userId, vesselId: itemId },
      });
      return !!tracked;
    }
  }

  async getTrackingStats(userId: number) {
    const [aircraftCount, vesselCount] = await Promise.all([
      this.prisma.userTrackedAircraft.count({ where: { userId } }),
      this.prisma.userTrackedVessel.count({ where: { userId } }),
    ]);

    return {
      totalTracked: aircraftCount + vesselCount,
      aircraftCount,
      vesselCount,
    };
  }

  // Method to process position updates and trigger region alerts
  async processAircraftPositionUpdate(
    aircraftId: number,
    latitude: number,
    longitude: number,
  ) {
    await this.regionService.processPositionUpdate(
      ObjectType.AIRCRAFT,
      aircraftId,
      latitude,
      longitude,
    );
  }

  async processVesselPositionUpdate(
    vesselId: number,
    latitude: number,
    longitude: number,
  ) {
    await this.regionService.processPositionUpdate(
      ObjectType.VESSEL,
      vesselId,
      latitude,
      longitude,
    );
  }

  // Broadcast region alert via Redis
  async broadcastRegionAlert(alertData: any) {
    await this.redisService.publish('region:alert', JSON.stringify(alertData));
  }
}
