import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAircraftDto,
  UpdateAircraftDto,
  CreateAircraftPositionDto,
} from './dto/aircraft.dto';

@Injectable()
export class AircraftService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find all aircraft with their last known position
   */
  async findAllWithLastPosition() {
    const aircrafts = await this.prisma.aircraft.findMany({
      include: {
        positions: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
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
  async findHistory(id: number, fromDate: Date) {
    const aircraft = await this.prisma.aircraft.findUnique({
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
    return this.prisma.aircraftPosition.create({
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
  }
}
