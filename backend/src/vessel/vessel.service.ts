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
    // Vessel: show if signal within last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const positionWhere = bbox
      ? {
          longitude: { gte: bbox[0], lte: bbox[2] },
          latitude: { gte: bbox[1], lte: bbox[3] },
          timestamp: { gte: oneDayAgo }, // Last 24 hours
        }
      : {
          timestamp: { gte: oneDayAgo }, // Last 24 hours
        };
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
                timestamp: { gte: oneDayAgo }, // Last 24 hours
              },
            },
          }
        : {
            positions: {
              some: {
                timestamp: { gte: oneDayAgo }, // Last 24 hours
              },
            },
          },
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
    const position = await this.prisma.vesselPosition.create({
      data: {
        ...createPositionDto,
        source: createPositionDto.source || 'api', // Default to 'api' if not provided
      },
    });

    // Trigger region alert processing
    this.trackingService
      .processVesselPositionUpdate(
        createPositionDto.vesselId,
        createPositionDto.latitude,
        createPositionDto.longitude,
      )
      .catch((err) => {
        console.error('❌ Error processing region alerts for vessel:', err);
      });

    return position;
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
  async findHistory(
    id: number,
    fromDate: Date | null,
    toDate: Date | null,
    limit: number,
    offset = 0,
  ) {
    // Build where clause - only add time filter if dates provided
    const whereClause: any = {};
    if (fromDate || toDate) {
      whereClause.timestamp = {};
      if (fromDate) whereClause.timestamp.gte = fromDate;
      if (toDate) whereClause.timestamp.lte = toDate;
    }

    const vessel = await this.prisma.vessel.findUnique({
      where: { id },
      include: {
        positions: {
          where: whereClause,
          orderBy: { timestamp: 'desc' }, // Changed to desc (newest first)
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
   * Find vessel by MMSI with its complete history
   */
  async findHistoryByMmsi(
    mmsi: string,
    fromDate: Date | null,
    toDate: Date | null,
    limit: number,
    offset = 0,
  ) {
    // Build where clause - only add time filter if dates provided
    const whereClause: any = {};
    if (fromDate || toDate) {
      whereClause.timestamp = {};
      if (fromDate) whereClause.timestamp.gte = fromDate;
      if (toDate) whereClause.timestamp.lte = toDate;
    }

    const vessel = await this.prisma.vessel.findFirst({
      where: { mmsi },
      include: {
        positions: {
          where: whereClause,
          orderBy: { timestamp: 'desc' }, // Changed to desc (newest first)
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
   * Count total positions for a vessel within a date range
   */
  async countPositions(
    vesselId: number,
    fromDate: Date | null,
    toDate: Date | null,
  ): Promise<number> {
    // Build where clause - only add time filter if dates provided
    const where: any = { vesselId };
    if (fromDate || toDate) {
      where.timestamp = {};
      if (fromDate) where.timestamp.gte = fromDate;
      if (toDate) where.timestamp.lte = toDate;
    }

    return this.prisma.vesselPosition.count({ where });
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
    options?: {
      skipRegionProcessing?: boolean; // Skip region alert processing for bulk operations
    },
  ) {
    let positionRecord;
    try {
      const timestamp = position.timestamp || new Date();

      // Try to find existing position first
      const existingPosition = await this.prisma.vesselPosition.findFirst({
        where: {
          vesselId,
          timestamp,
        },
      });

      if (existingPosition) {
        // Update existing position
        positionRecord = await this.prisma.vesselPosition.update({
          where: {
            id: existingPosition.id,
          },
          data: {
            latitude: position.latitude,
            longitude: position.longitude,
            speed: position.speed,
            course: position.course,
            heading: position.heading,
            status: position.status,
            source: position.source || 'unknown',
            score: position.score,
          },
        });
      } else {
        // Create new position
        positionRecord = await this.prisma.vesselPosition.create({
          data: {
            vesselId,
            latitude: position.latitude,
            longitude: position.longitude,
            speed: position.speed,
            course: position.course,
            heading: position.heading,
            status: position.status,
            timestamp,
            source: position.source || 'unknown',
            score: position.score,
          },
        });
      }
    } catch (e) {
      if (e.code === 'P2002') {
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

    // Trigger region alert processing (skip for bulk operations)
    if (!options?.skipRegionProcessing) {
      // Run region processing asynchronously without blocking
      this.trackingService
        .processVesselPositionUpdate(vesselId, position.latitude, position.longitude)
        .catch((err) => {
          // Log error but don't fail the position update
          console.error('Error processing region alerts:', err);
        });
    }

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

  /**
   * Bulk delete vessels by IDs
   */
  async bulkDelete(ids: number[]) {
    return this.prisma.vessel.deleteMany({
      where: { id: { in: ids } },
    });
  }

  /**
   * Bulk create vessels
   */
  async bulkCreate(vessels: CreateVesselDto[]) {
    return this.prisma.$transaction(vessels.map((data) => this.prisma.vessel.create({ data })));
  }

  /**
   * Record vessel edit in history
   */
  async recordEdit(vesselId: number, userId: number, changes: Record<string, any>) {
    return this.prisma.vesselEditHistory.create({
      data: {
        vesselId,
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
   * Get edit history for a vessel
   */
  async getEditHistory(vesselId: number, limit = 50, offset = 0) {
    const [history, total] = await Promise.all([
      this.prisma.vesselEditHistory.findMany({
        where: { vesselId },
        include: {
          user: {
            select: { id: true, username: true },
          },
        },
        orderBy: { editedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.vesselEditHistory.count({
        where: { vesselId },
      }),
    ]);

    return {
      data: history.map((h) => ({
        id: h.id,
        vesselId: h.vesselId,
        userId: h.userId,
        userName: h.user.username,
        changes: JSON.parse(h.changes),
        editedAt: h.editedAt,
      })),
      total,
    };
  }
}
