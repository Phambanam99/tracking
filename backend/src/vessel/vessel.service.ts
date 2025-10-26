import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import { CreateVesselDto, UpdateVesselDto, CreateVesselPositionDto } from './dto/vessel.dto';
import { CreateVesselImageDto, UpdateVesselImageDto } from './dto/vessel.dto';

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
    const derivedLimitBase =
      typeof limit === 'number' && limit > 0
        ? limit
        : zoom == null
          ? 20000
          : zoom <= 4
            ? 15000
            : zoom <= 6
              ? 10000
              : 8000;
    const derivedLimit = Math.min(20000, Math.max(1000, derivedLimitBase));

    const vessels = await this.prisma.vessel.findMany({
      where: bbox
        ? {
            positions: {
              some: {
                longitude: { gte: bbox[0], lte: bbox[2] },
                latitude: { gte: bbox[1], lte: bbox[3] },
              },
            },
          }
        : {},
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
      lastPosition: (vessel as any).positions?.[0] || null,
      images: (vessel as any).images || [],
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
    hasSignal?: boolean,
    adv?: {
      operator?: string;
      vesselType?: string;
      flag?: string;
      minSpeed?: number;
      maxSpeed?: number;
    },
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

    // Filter by signal presence
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
      if (adv.vesselType) where.vesselType = { contains: adv.vesselType, mode: 'insensitive' };
      if (adv.flag) where.flag = { contains: adv.flag, mode: 'insensitive' };
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
        images: {
          orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }, { id: 'asc' }],
        },
      } as any,
      orderBy: { id: 'asc' }, // Consistent ordering for pagination
      skip,
      take: effectivePageSize,
    });

    const data = vessels
      .map((vessel) => ({
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
        lastPosition: (vessel as any).positions?.[0] || null,
        images: (vessel as any).images || [],
      }))
      .filter((v) => {
        if (!adv || !v.lastPosition) return true;
        const sp = v.lastPosition.speed as number | undefined;
        if (adv.minSpeed != null && !(sp != null && sp >= adv.minSpeed)) return false;
        if (adv.maxSpeed != null && !(sp != null && sp <= adv.maxSpeed)) return false;
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
   * Find a single vessel by ID with its last known position
   */
  async findByIdWithLastPosition(id: number) {
    const vessel = await this.prisma.vessel.findUnique({
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
    if (!vessel) return null;
    return {
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
      lastPosition: (vessel as any).positions?.[0] || null,
      images: (vessel as any).images || [],
    };
  }
  async findByMmsiWithLastPosition(mmsi: string) {
    const vessel = await this.prisma.vessel.findFirst({
      where: { mmsi },
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
    if (!vessel) return null;
    return {
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
      lastPosition: (vessel as any).positions?.[0] || null,
      images: (vessel as any).images || [],
    };
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
      source?: string;
      score?: number;
    },
  ) {
    let positionRecord;
    try {
      const timestamp = position.timestamp || new Date();
      positionRecord = await this.prisma.vesselPosition.upsert({
        where: {
          vesselId_timestamp_source: {
            vesselId,
            timestamp,
            source: position.source,
          },
        },
        create: {
          vesselId,
          latitude: position.latitude,
          longitude: position.longitude,
          speed: position.speed,
          course: position.course,
          heading: position.heading,
          status: position.status,
          timestamp,
          source: position.source,
          score: position.score,
        },
        update: {
          latitude: position.latitude,
          longitude: position.longitude,
          speed: position.speed,
          course: position.course,
          heading: position.heading,
          status: position.status,
          score: position.score,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // Duplicate by (vesselId, timestamp, source) → return existing
        positionRecord = await this.prisma.vesselPosition.findFirst({
          where: {
            vesselId,
            timestamp: position.timestamp || undefined,
            source: position.source,
          },
        });
      } else {
        throw e;
      }
    }

    // Trigger region alert processing
    await this.trackingService.processVesselPositionUpdate(
      vesselId,
      position.latitude,
      position.longitude,
    );

    return positionRecord;
  }

  /**
   * Vessel Images CRUD
   */
  async listImages(vesselId: number) {
    return (this.prisma as any).vesselImage.findMany({
      where: { vesselId },
      orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }, { id: 'asc' }],
    });
  }

  async addImage(vesselId: number, dto: CreateVesselImageDto) {
    if (dto.isPrimary) {
      // unset other primaries
      await (this.prisma as any).vesselImage.updateMany({
        where: { vesselId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    return (this.prisma as any).vesselImage.create({
      data: {
        vesselId,
        url: dto.url,
        caption: dto.caption,
        source: dto.source,
        isPrimary: dto.isPrimary ?? false,
        order: dto.order ?? 0,
      },
    });
  }

  async updateImage(imageId: number, dto: UpdateVesselImageDto) {
    if (dto.isPrimary) {
      const existing = await (this.prisma as any).vesselImage.findUnique({
        where: { id: imageId },
      });
      if (existing) {
        await (this.prisma as any).vesselImage.updateMany({
          where: { vesselId: existing.vesselId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
    }
    return (this.prisma as any).vesselImage.update({
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
    return (this.prisma as any).vesselImage.delete({ where: { id: imageId } });
  }
}
