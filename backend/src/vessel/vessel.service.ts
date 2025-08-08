import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import {
  CreateVesselDto,
  UpdateVesselDto,
  CreateVesselPositionDto,
} from './dto/vessel.dto';

@Injectable()
export class VesselService {
  constructor(
    private prisma: PrismaService,
    private trackingService: TrackingService,
  ) {}

  /**
   * Find all vessels with their last known position
   */
  async findAllWithLastPosition() {
    const vessels = await this.prisma.vessel.findMany({
      include: {
        positions: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
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
  async findHistory(id: number, fromDate: Date) {
    const vessel = await this.prisma.vessel.findUnique({
      where: { id },
      include: {
        positions: {
          where: {
            timestamp: {
              gte: fromDate,
            },
          },
          orderBy: { timestamp: 'asc' },
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
