import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import {
  CreateAircraftDto,
  UpdateAircraftDto,
  CreateAircraftPositionDto,
} from './dto/aircraft.dto';

@Injectable()
export class AircraftService {
  constructor(
    private prisma: PrismaService,
    private trackingService: TrackingService,
  ) {}

  /**
   * Find all aircraft with their last known position (legacy method)
   */
  async findAllWithLastPosition(
    bbox?: [number, number, number, number],
    zoom?: number,
    limit?: number,
  ) {
    const positionWhere = bbox
      ? {
          longitude: { gte: bbox[0], lte: bbox[2] },
          latitude: { gte: bbox[1], lte: bbox[3] },
        }
      : {};
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
   * Find all aircraft with their last known position (paginated)
   */
  async findAllWithLastPositionPaginated(
    bbox?: [number, number, number, number],
    zoom?: number,
    limit?: number,
    page: number = 1,
    pageSize: number = 1000,
    q?: string,
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
      },
      orderBy: { id: 'asc' }, // Consistent ordering for pagination
      skip,
      take: effectivePageSize,
    });

    const data = aircrafts.map((aircraft) => ({
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
    return await this.prisma.aircraftPosition.create({
      data: createPositionDto,
    });
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
          orderBy: { timestamp: 'asc' },
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
    },
  ) {
    const positionRecord = await this.prisma.aircraftPosition.create({
      data: {
        aircraftId,
        latitude: position.latitude,
        longitude: position.longitude,
        altitude: position.altitude,
        speed: position.speed,
        heading: position.heading,
        timestamp: position.timestamp || new Date(),
      },
    });

    // Trigger region alert processing
    await this.trackingService.processAircraftPositionUpdate(
      aircraftId,
      position.latitude,
      position.longitude,
    );

    return positionRecord;
  }
}
