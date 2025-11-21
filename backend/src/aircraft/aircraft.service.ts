import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import {
  CreateAircraftDto,
  UpdateAircraftDto,
  CreateAircraftPositionDto,
} from './dto/aircraft.dto';
import { CreateAircraftImageDto, UpdateAircraftImageDto } from './dto/aircraft.dto';

@Injectable()
export class AircraftService {
  constructor(
    private prisma: PrismaService,
    private trackingService: TrackingService,
  ) {}

  /**
   * Find all aircraft with their last known position (legacy method)
   * IMPORTANT: Only returns aircraft with ADSB signal in last 10 minutes
   */
  async findAllWithLastPosition(
    bbox?: [number, number, number, number],
    zoom?: number,
    limit?: number,
  ) {
    // Aircraft: show if signal within last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const positionWhere = bbox
      ? {
          longitude: { gte: bbox[0], lte: bbox[2] },
          latitude: { gte: bbox[1], lte: bbox[3] },
          timestamp: { gte: twoHoursAgo }, // Last 2 hours
        }
      : {
          timestamp: { gte: twoHoursAgo }, // Last 2 hours
        };
    // Derive default limit based on zoom (more coarse at low zoom)
    const derivedLimit =
      typeof limit === 'number' && limit > 0
        ? limit
        : zoom == null
          ? 50000 // Increased from 5000 to 50000
          : zoom <= 4
            ? 10000 // Increased from 1500 to 10000 for low zoom
            : zoom <= 6
              ? 25000 // Increased from 3000 to 25000 for medium zoom
              : 50000; // Increased from 6000 to 50000 for high zoom

    const aircrafts = await this.prisma.aircraft.findMany({
      where: {
        positions: {
          some: positionWhere, // Must have at least one recent position
        },
      },
      include: {
        positions: {
          where: positionWhere,
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      take: derivedLimit,
    });

    return aircrafts.map((aircraft) => ({
      id: aircraft.id,
      flightId: aircraft.flightId,
      callSign: aircraft.callSign,
      registration: aircraft.registration,
      aircraftType: aircraft.aircraftType,
      operator: aircraft.operator,
      createdAt: aircraft.createdAt,
      updatedAt: aircraft.updatedAt,
      lastPosition: aircraft.positions[0] || null,
    }));
  }

  /**
   * Find a single aircraft by ID with its last known position
   */
  async findByIdWithLastPosition(id: number) {
    const aircraft = await this.prisma.aircraft.findUnique({
      where: { id },
      include: {
        positions: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }, { id: 'asc' }],
        },
      } as any,
    });

    if (!aircraft) return null;

    return {
      id: aircraft.id,
      flightId: aircraft.flightId,
      callSign: aircraft.callSign,
      registration: aircraft.registration,
      aircraftType: aircraft.aircraftType,
      operator: aircraft.operator,
      createdAt: aircraft.createdAt,
      updatedAt: aircraft.updatedAt,
      lastPosition: (aircraft as any).positions?.[0] || null,
      images: (aircraft as any).images || [],
    };
  }

  /**
   * Find all aircraft with their last known position (paginated)
   */
  async findAllWithLastPositionPaginated(
    bbox?: [number, number, number, number],
    zoom?: number,
    limit?: number,
    page: number = 1,
    pageSize: number = 1000,
    q?: string,
    hasSignal?: boolean,
    adv?: {
      operator?: string;
      aircraftType?: string;
      registration?: string;
      callSign?: string;
      minSpeed?: number;
      maxSpeed?: number;
      minAltitude?: number;
      maxAltitude?: number;
    },
  ) {
    const skip = (page - 1) * pageSize;

    // First, count total matching aircraft
    const where: any = bbox
      ? {
          positions: {
            some: {
              longitude: { gte: bbox[0], lte: bbox[2] },
              latitude: { gte: bbox[1], lte: bbox[3] },
            },
          },
        }
      : {};
    if (q && q.trim()) {
      const term = q.trim();
      where.OR = [
        { flightId: { contains: term, mode: 'insensitive' } },
        { callSign: { contains: term, mode: 'insensitive' } },
        { registration: { contains: term, mode: 'insensitive' } },
        { aircraftType: { contains: term, mode: 'insensitive' } },
        { operator: { contains: term, mode: 'insensitive' } },
      ];
    }

    // Filter by having at least one position (active) or no positions (inactive)
    if (typeof hasSignal === 'boolean') {
      if (hasSignal) {
        where.positions = {
          some: bbox
            ? {
                longitude: { gte: bbox[0], lte: bbox[2] },
                latitude: { gte: bbox[1], lte: bbox[3] },
              }
            : {},
        };
      } else {
        where.positions = { none: {} };
      }
    }

    // Advanced filters
    if (adv) {
      if (adv.operator) where.operator = { contains: adv.operator, mode: 'insensitive' };
      if (adv.aircraftType)
        where.aircraftType = { contains: adv.aircraftType, mode: 'insensitive' };
      if (adv.registration)
        where.registration = { contains: adv.registration, mode: 'insensitive' };
      if (adv.callSign) where.callSign = { contains: adv.callSign, mode: 'insensitive' };
    }

    const total = await this.prisma.aircraft.count({ where });

    // Apply limit if specified
    const finalLimit = limit ? Math.min(limit, total) : total;
    const effectivePageSize = Math.min(pageSize, finalLimit - skip);

    if (effectivePageSize <= 0) {
      return {
        data: [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }

    const positionWhere = bbox
      ? {
          longitude: { gte: bbox[0], lte: bbox[2] },
          latitude: { gte: bbox[1], lte: bbox[3] },
        }
      : {};

    const aircrafts = await this.prisma.aircraft.findMany({
      where,
      include: {
        positions: {
          where: positionWhere,
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }, { id: 'asc' }],
        },
      } as any,
      orderBy: { id: 'asc' }, // Consistent ordering for pagination
      skip,
      take: effectivePageSize,
    });

    // Apply per-position numeric constraints (speed/altitude) server-side on the lastPosition selection
    const data = aircrafts
      .map((aircraft) => ({
        id: aircraft.id,
        flightId: aircraft.flightId,
        callSign: aircraft.callSign,
        registration: aircraft.registration,
        aircraftType: aircraft.aircraftType,
        operator: aircraft.operator,
        createdAt: aircraft.createdAt,
        updatedAt: aircraft.updatedAt,
        lastPosition: (aircraft as any).positions?.[0] || null,
        images: (aircraft as any).images || [],
      }))
      .filter((a) => {
        if (!adv || !a.lastPosition) return true;
        const sp = a.lastPosition.speed as number | undefined;
        const alt = a.lastPosition.altitude as number | undefined;
        if (adv.minSpeed != null && !(sp != null && sp >= adv.minSpeed)) return false;
        if (adv.maxSpeed != null && !(sp != null && sp <= adv.maxSpeed)) return false;
        if (adv.minAltitude != null && !(alt != null && alt >= adv.minAltitude)) return false;
        if (adv.maxAltitude != null && !(alt != null && alt <= adv.maxAltitude)) return false;
        return true;
      });

    return {
      data,
      total: finalLimit,
      page,
      pageSize,
      totalPages: Math.ceil(finalLimit / pageSize),
    };
  }

  /**
   * Create a new aircraft
   */
  async create(createAircraftDto: CreateAircraftDto) {
    return this.prisma.aircraft.create({
      data: createAircraftDto,
    });
  }

  /**
   * Update an aircraft
   */
  async update(id: number, updateAircraftDto: UpdateAircraftDto) {
    return this.prisma.aircraft.update({
      where: { id },
      data: updateAircraftDto,
    });
  }

  /**
   * Delete an aircraft
   */
  async delete(id: number) {
    return this.prisma.aircraft.delete({
      where: { id },
    });
  }

  /**
   * Add position using DTO
   */
  async addPositionWithDto(createPositionDto: CreateAircraftPositionDto) {
    const position = await this.prisma.aircraftPosition.create({
      data: {
        ...createPositionDto,
        source: createPositionDto.source || 'api', // Default to 'api' if not provided
      },
    });

    // Trigger region alert processing
    this.trackingService
      .processAircraftPositionUpdate(
        createPositionDto.aircraftId,
        createPositionDto.latitude,
        createPositionDto.longitude,
      )
      .catch((err) => {
        console.error('❌ Error processing region alerts for aircraft:', err);
      });

    return position;
  }

  /**
   * Find aircraft by ID with its complete history
   */
  async findHistory(id: number, fromDate: Date, toDate: Date, limit: number, offset = 0) {
    const aircraft = await this.prisma.aircraft.findUnique({
      where: { id },
      include: {
        positions: {
          where: {
            timestamp: {
              gte: fromDate,
              lte: toDate,
            },
          },
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset,
        },
      },
    });

    if (!aircraft) {
      return null;
    }

    return {
      id: aircraft.id,
      flightId: aircraft.flightId,
      callSign: aircraft.callSign,
      registration: aircraft.registration,
      aircraftType: aircraft.aircraftType,
      operator: aircraft.operator,
      positions: aircraft.positions,
    };
  }

  /**
   * Find aircraft by flightId with its complete history
   */
  async findHistoryByFlightId(
    flightId: string,
    fromDate: Date,
    toDate: Date,
    limit: number,
    offset = 0,
  ) {
    const aircraft = await this.prisma.aircraft.findFirst({
      where: { flightId },
      include: {
        positions: {
          where: {
            timestamp: {
              gte: fromDate,
              lte: toDate,
            },
          },
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset,
        },
      },
    });

    if (!aircraft) {
      return null;
    }

    return {
      id: aircraft.id,
      flightId: aircraft.flightId,
      callSign: aircraft.callSign,
      registration: aircraft.registration,
      aircraftType: aircraft.aircraftType,
      operator: aircraft.operator,
      positions: aircraft.positions,
    };
  }

  /**
   * Create or update aircraft data
   */
  async upsertAircraft(data: {
    flightId: string;
    callSign?: string;
    registration?: string;
    aircraftType?: string;
    operator?: string;
  }) {
    return this.prisma.aircraft.upsert({
      where: { flightId: data.flightId },
      update: {
        callSign: data.callSign,
        registration: data.registration,
        aircraftType: data.aircraftType,
        operator: data.operator,
        updatedAt: new Date(),
      },
      create: {
        flightId: data.flightId,
        callSign: data.callSign,
        registration: data.registration,
        aircraftType: data.aircraftType,
        operator: data.operator,
      },
    });
  }

  /**
   * Add new position for an aircraft
   */
  async addPosition(
    aircraftId: number,
    position: {
      latitude: number;
      longitude: number;
      altitude?: number;
      speed?: number;
      heading?: number;
      timestamp?: Date;
      source?: string;
      score?: number;
    },
    options?: {
      skipRegionProcessing?: boolean; // Skip region alert processing for bulk operations
    },
  ) {
    let positionRecord;
    try {
      const timestamp = position.timestamp || new Date();
      positionRecord = await this.prisma.aircraftPosition.upsert({
        where: {
          aircraftId_timestamp_source: {
            aircraftId,
            timestamp,
            source: position.source || 'unknown',
          },
        },
        create: {
          aircraftId,
          latitude: position.latitude,
          longitude: position.longitude,
          altitude: position.altitude,
          speed: position.speed,
          heading: position.heading,
          timestamp,
          source: position.source || 'unknown',
          score: position.score,
        },
        update: {
          latitude: position.latitude,
          longitude: position.longitude,
          altitude: position.altitude,
          speed: position.speed,
          heading: position.heading,
          score: position.score,
        },
      });
    } catch (e) {
      if (e.code === 'P2002') {
        positionRecord = await this.prisma.aircraftPosition.findFirst({
          where: {
            aircraftId,
            timestamp: position.timestamp || undefined,
            source: position.source,
          },
        });
      } else {
        throw e;
      }
    }

    // Trigger region alert processing (skip for bulk operations)
    if (!options?.skipRegionProcessing) {
      // Run region processing asynchronously without blocking
      this.trackingService
        .processAircraftPositionUpdate(aircraftId, position.latitude, position.longitude)
        .catch((err) => {
          // Log error but don't fail the position update
          console.error('Error processing region alerts:', err);
        });
    }

    return positionRecord;
  }

  /**
   * Aircraft Images CRUD (mirrors vessel images)
   */
  async listImages(aircraftId: number) {
    return (this.prisma as any).aircraftImage.findMany({
      where: { aircraftId },
      orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }, { id: 'asc' }],
    });
  }

  async addImage(aircraftId: number, dto: CreateAircraftImageDto) {
    if (dto.isPrimary) {
      await (this.prisma as any).aircraftImage.updateMany({
        where: { aircraftId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    return (this.prisma as any).aircraftImage.create({
      data: {
        aircraftId,
        url: dto.url,
        caption: dto.caption,
        source: dto.source,
        isPrimary: dto.isPrimary ?? false,
        order: dto.order ?? 0,
      },
    });
  }

  async updateImage(imageId: number, dto: UpdateAircraftImageDto) {
    if (dto.isPrimary) {
      const existing = await (this.prisma as any).aircraftImage.findUnique({
        where: { id: imageId },
      });
      if (existing) {
        await (this.prisma as any).aircraftImage.updateMany({
          where: { aircraftId: existing.aircraftId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
    }
    return (this.prisma as any).aircraftImage.update({
      where: { id: imageId },
      data: {
        url: dto.url,
        caption: dto.caption,
        source: dto.source,
        isPrimary: dto.isPrimary,
        order: dto.order,
      },
    });
  }

  async deleteImage(imageId: number) {
    return (this.prisma as any).aircraftImage.delete({ where: { id: imageId } });
  }

  /**
   * Bulk delete aircraft by IDs
   */
  async bulkDelete(ids: number[]) {
    return this.prisma.aircraft.deleteMany({
      where: { id: { in: ids } },
    });
  }

  /**
   * Bulk create aircraft
   */
  async bulkCreate(aircrafts: CreateAircraftDto[]) {
    return this.prisma.$transaction(aircrafts.map((data) => this.prisma.aircraft.create({ data })));
  }

  /**
   * Record aircraft edit in history
   */
  async recordEdit(aircraftId: number, userId: number, changes: Record<string, any>) {
    return this.prisma.aircraftEditHistory.create({
      data: {
        aircraftId,
        userId,
        changes: JSON.stringify(changes),
      },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    });
  }

  /**
   * Get edit history for an aircraft
   */
  async getEditHistory(aircraftId: number, limit = 50, offset = 0) {
    const [history, total] = await Promise.all([
      this.prisma.aircraftEditHistory.findMany({
        where: { aircraftId },
        include: {
          user: {
            select: { id: true, username: true },
          },
        },
        orderBy: { editedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.aircraftEditHistory.count({
        where: { aircraftId },
      }),
    ]);

    return {
      data: history.map((h) => ({
        id: h.id,
        aircraftId: h.aircraftId,
        userId: h.userId,
        userName: h.user.username,
        changes: JSON.parse(h.changes),
        editedAt: h.editedAt,
      })),
      total,
    };
  }
}
