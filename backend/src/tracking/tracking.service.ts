import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
    aircraftIdOrFlightId: string | number,
    alias?: string,
    notes?: string,
  ) {
    // Try to find by ID first, then by flightId
    const numericId =
      typeof aircraftIdOrFlightId === 'number'
        ? aircraftIdOrFlightId
        : parseInt(aircraftIdOrFlightId, 10);
    let aircraft = !isNaN(numericId)
      ? await this.prisma.aircraft.findUnique({ where: { id: numericId } })
      : null;

    if (!aircraft) {
      // Try finding by flightId
      aircraft = await this.prisma.aircraft.findFirst({
        where: { flightId: String(aircraftIdOrFlightId) },
      });
    }

    if (!aircraft) {
      throw new NotFoundException(`Aircraft with ID/FlightID ${aircraftIdOrFlightId} not found`);
    }

    // Check if already tracking (use actual database ID)
    const existingTracking = await this.prisma.userTrackedAircraft.findFirst({
      where: {
        userId,
        aircraftId: aircraft.id,
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

    // If already tracking, return existing record (idempotent)
    if (existingTracking) {
      return existingTracking;
    }

    try {
      return await this.prisma.userTrackedAircraft.create({
        data: {
          userId,
          aircraftId: aircraft.id,
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
        // Race condition - fetch and return existing
        const existing = await this.prisma.userTrackedAircraft.findFirst({
          where: { userId, aircraftId: aircraft.id },
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
        if (existing) return existing;
      }
      throw error;
    }
  }

  async untrackAircraft(userId: number, aircraftIdOrFlightId: string | number) {
    // Find aircraft first
    const numericId =
      typeof aircraftIdOrFlightId === 'number'
        ? aircraftIdOrFlightId
        : parseInt(aircraftIdOrFlightId, 10);
    let aircraft = !isNaN(numericId)
      ? await this.prisma.aircraft.findUnique({ where: { id: numericId } })
      : null;

    if (!aircraft) {
      aircraft = await this.prisma.aircraft.findFirst({
        where: { flightId: String(aircraftIdOrFlightId) },
      });
    }

    if (!aircraft) {
      throw new NotFoundException(`Aircraft with ID/FlightID ${aircraftIdOrFlightId} not found`);
    }

    return this.prisma.userTrackedAircraft.deleteMany({
      where: {
        userId,
        aircraftId: aircraft.id,
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
    vesselIdOrMmsi: string | number,
    alias?: string,
    notes?: string,
  ) {
    // Try to find by ID first, then by MMSI
    const numericId =
      typeof vesselIdOrMmsi === 'number' ? vesselIdOrMmsi : parseInt(vesselIdOrMmsi, 10);
    let vessel = !isNaN(numericId)
      ? await this.prisma.vessel.findUnique({ where: { id: numericId } })
      : null;

    if (!vessel) {
      // Try finding by MMSI
      vessel = await this.prisma.vessel.findFirst({ where: { mmsi: String(vesselIdOrMmsi) } });
    }

    if (!vessel) {
      throw new NotFoundException(`Vessel with ID/MMSI ${vesselIdOrMmsi} not found`);
    }

    // Check if already tracking (use actual database ID)
    const existing = await this.prisma.userTrackedVessel.findFirst({
      where: { userId, vesselId: vessel.id },
      include: {
        vessel: {
          include: {
            positions: { orderBy: { timestamp: 'desc' }, take: 1 },
          },
        },
      },
    });

    // If already tracking, return existing record (idempotent)
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.userTrackedVessel.create({
        data: { userId, vesselId: vessel.id, alias, notes },
        include: {
          vessel: {
            include: {
              positions: { orderBy: { timestamp: 'desc' }, take: 1 },
            },
          },
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Race condition - fetch and return existing
        const existing = await this.prisma.userTrackedVessel.findFirst({
          where: { userId, vesselId: vessel.id },
          include: {
            vessel: {
              include: {
                positions: { orderBy: { timestamp: 'desc' }, take: 1 },
              },
            },
          },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async untrackVessel(userId: number, vesselIdOrMmsi: string | number) {
    // Find vessel first
    const numericId =
      typeof vesselIdOrMmsi === 'number' ? vesselIdOrMmsi : parseInt(vesselIdOrMmsi, 10);
    let vessel = !isNaN(numericId)
      ? await this.prisma.vessel.findUnique({ where: { id: numericId } })
      : null;

    if (!vessel) {
      vessel = await this.prisma.vessel.findFirst({ where: { mmsi: String(vesselIdOrMmsi) } });
    }

    if (!vessel) {
      throw new NotFoundException(`Vessel with ID/MMSI ${vesselIdOrMmsi} not found`);
    }

    return this.prisma.userTrackedVessel.deleteMany({
      where: {
        userId,
        vesselId: vessel.id,
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

    return [...aircrafts, ...vessels].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async isTracking(userId: number, type: 'aircraft' | 'vessel', itemId: number): Promise<boolean> {
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
  async processAircraftPositionUpdate(aircraftId: number, latitude: number, longitude: number) {
    await this.regionService.processPositionUpdate(
      ObjectType.AIRCRAFT,
      aircraftId,
      latitude,
      longitude,
    );
  }

  async processVesselPositionUpdate(vesselId: number, latitude: number, longitude: number) {
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
