import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import { CreateVesselDto, UpdateVesselDto, CreateVesselPositionDto } from './dto/vessel.dto';

@Injectable()
export class VesselService {
  constructor(
    private prisma: PrismaService,
    private trackingService: TrackingService,
  ) {}

  /**
   * Find all vessels with their last known position (legacy method)
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
    const derivedLimit =
      typeof limit === 'number' && limit > 0
        ? limit
        : zoom == null
          ? 500000 // Increased from 5000 to 50000
          : zoom <= 4
            ? 100000 // Increased from 1500 to 10000 for low zoom
            : zoom <= 6
              ? 250000 // Increased from 3000 to 25000 for medium zoom
              : 500000; // Increased from 6000 to 50000 for high zoom

    const vessels = await this.prisma.vessel.findMany({
      include: {
        positions: {
          where: positionWhere,
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      take: derivedLimit,
    });

    return vessels.map((vessel) => ({
      id: vessel.id,
      mmsi: vessel.mmsi,
      vesselName: vessel.vesselName,
      vesselType: vessel.vesselType,
      flag: vessel.flag,
      operator: vessel.operator,
      length: vessel.length,
      width: vessel.width,
      createdAt: vessel.createdAt,
      updatedAt: vessel.updatedAt,
      lastPosition: vessel.positions[0] || null,
    }));
  }

  /**
   * Find all vessels with their last known position (paginated)
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

    // First, count total matching vessels
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
        { mmsi: { contains: term, mode: 'insensitive' } },
        { vesselName: { contains: term, mode: 'insensitive' } },
        { vesselType: { contains: term, mode: 'insensitive' } },
        { flag: { contains: term, mode: 'insensitive' } },
        { operator: { contains: term, mode: 'insensitive' } },
      ];
    }

    const total = await this.prisma.vessel.count({ where });

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

    const vessels = await this.prisma.vessel.findMany({
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

    const data = vessels.map((vessel) => ({
      id: vessel.id,
      mmsi: vessel.mmsi,
      vesselName: vessel.vesselName,
      vesselType: vessel.vesselType,
      flag: vessel.flag,
      operator: vessel.operator,
      length: vessel.length,
      width: vessel.width,
      createdAt: vessel.createdAt,
      updatedAt: vessel.updatedAt,
      lastPosition: vessel.positions[0] || null,
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
   * Create a new vessel
   */
  async create(createVesselDto: CreateVesselDto) {
    return this.prisma.vessel.create({
      data: createVesselDto,
    });
  }

  /**
   * Update a vessel
   */
  async update(id: number, updateVesselDto: UpdateVesselDto) {
    return this.prisma.vessel.update({
      where: { id },
      data: updateVesselDto,
    });
  }

  /**
   * Delete a vessel
   */
  async delete(id: number) {
    return this.prisma.vessel.delete({
      where: { id },
    });
  }

  /**
   * Add position using DTO
   */
  async addPositionWithDto(createPositionDto: CreateVesselPositionDto) {
    return await this.prisma.vesselPosition.create({
      data: createPositionDto,
    });
  }

  /**
   * Find vessel by ID with its complete history
   */
  async findHistory(id: number, fromDate: Date, toDate: Date, limit: number, offset = 0) {
    const vessel = await this.prisma.vessel.findUnique({
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

    if (!vessel) {
      return null;
    }

    return {
      id: vessel.id,
      mmsi: vessel.mmsi,
      vesselName: vessel.vesselName,
      vesselType: vessel.vesselType,
      flag: vessel.flag,
      operator: vessel.operator,
      length: vessel.length,
      width: vessel.width,
      positions: vessel.positions,
    };
  }

  /**
   * Create or update vessel data
   */
  async upsertVessel(data: {
    mmsi: string;
    vesselName?: string;
    vesselType?: string;
    flag?: string;
    operator?: string;
    length?: number;
    width?: number;
  }) {
    return this.prisma.vessel.upsert({
      where: { mmsi: data.mmsi },
      update: {
        vesselName: data.vesselName,
        vesselType: data.vesselType,
        flag: data.flag,
        operator: data.operator,
        length: data.length,
        width: data.width,
        updatedAt: new Date(),
      },
      create: {
        mmsi: data.mmsi,
        vesselName: data.vesselName,
        vesselType: data.vesselType,
        flag: data.flag,
        operator: data.operator,
        length: data.length,
        width: data.width,
      },
    });
  }

  /**
   * Add new position for a vessel
   */
  async addPosition(
    vesselId: number,
    position: {
      latitude: number;
      longitude: number;
      speed?: number;
      course?: number;
      heading?: number;
      status?: string;
      timestamp?: Date;
    },
  ) {
    const positionRecord = await this.prisma.vesselPosition.create({
      data: {
        vesselId,
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        course: position.course,
        heading: position.heading,
        status: position.status,
        timestamp: position.timestamp || new Date(),
      },
    });

    // Trigger region alert processing
    await this.trackingService.processVesselPositionUpdate(
      vesselId,
      position.latitude,
      position.longitude,
    );

    return positionRecord;
  }
}
