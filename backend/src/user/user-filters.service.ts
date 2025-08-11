import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SaveUserFiltersDto,
  UserFiltersResponseDto,
} from './dto/user-filters.dto';

@Injectable()
export class UserFiltersService {
  constructor(private readonly prisma: PrismaService) {}

  async saveUserFilters(
    userId: number,
    dto: SaveUserFiltersDto,
  ): Promise<UserFiltersResponseDto> {
    try {
      const userFilters = await this.prisma.userFilters.upsert({
        where: {
          userId_name: {
            userId,
            name: dto.name,
          },
        },
        update: {
          activeFilterTab: dto.activeFilterTab,
          aircraftViewMode: dto.aircraftViewMode,
          vesselViewMode: dto.vesselViewMode,
          aircraft: JSON.stringify(dto.aircraft),
          vessel: JSON.stringify(dto.vessel),
        },
        create: {
          userId,
          name: dto.name,
          activeFilterTab: dto.activeFilterTab,
          aircraftViewMode: dto.aircraftViewMode,
          vesselViewMode: dto.vesselViewMode,
          aircraft: JSON.stringify(dto.aircraft),
          vessel: JSON.stringify(dto.vessel),
        },
      });

      return this.mapToResponseDto(userFilters);
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Filter name already exists for this user');
      }
      throw error;
    }
  }

  async getUserFilters(userId: number): Promise<UserFiltersResponseDto[]> {
    const userFilters = await this.prisma.userFilters.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return userFilters.map(this.mapToResponseDto);
  }

  async getUserFilterById(
    userId: number,
    filterId: number,
  ): Promise<UserFiltersResponseDto> {
    const userFilters = await this.prisma.userFilters.findFirst({
      where: {
        id: filterId,
        userId,
      },
    });

    if (!userFilters) {
      throw new NotFoundException('Filter not found');
    }

    return this.mapToResponseDto(userFilters);
  }

  async deleteUserFilter(userId: number, filterId: number): Promise<void> {
    const userFilters = await this.prisma.userFilters.findFirst({
      where: {
        id: filterId,
        userId,
      },
    });

    if (!userFilters) {
      throw new NotFoundException('Filter not found');
    }

    await this.prisma.userFilters.delete({
      where: { id: filterId },
    });
  }

  async getDefaultFilters(
    userId: number,
  ): Promise<UserFiltersResponseDto | null> {
    const defaultFilters = await this.prisma.userFilters.findFirst({
      where: {
        userId,
        name: 'default',
      },
    });

    return defaultFilters ? this.mapToResponseDto(defaultFilters) : null;
  }

  async saveDefaultFilters(
    userId: number,
    dto: Omit<SaveUserFiltersDto, 'name'>,
  ): Promise<UserFiltersResponseDto> {
    const userFilters = await this.prisma.userFilters.upsert({
      where: {
        userId_name: {
          userId,
          name: 'default',
        },
      },
      update: {
        activeFilterTab: dto.activeFilterTab,
        aircraftViewMode: dto.aircraftViewMode,
        vesselViewMode: dto.vesselViewMode,
        aircraft: JSON.stringify(dto.aircraft),
        vessel: JSON.stringify(dto.vessel),
      },
      create: {
        userId,
        name: 'default',
        activeFilterTab: dto.activeFilterTab,
        aircraftViewMode: dto.aircraftViewMode,
        vesselViewMode: dto.vesselViewMode,
        aircraft: JSON.stringify(dto.aircraft),
        vessel: JSON.stringify(dto.vessel),
      },
    });

    return this.mapToResponseDto(userFilters);
  }

  private mapToResponseDto(userFilters: any): UserFiltersResponseDto {
    return {
      id: userFilters.id,
      name: userFilters.name,
      userId: userFilters.userId,
      activeFilterTab: userFilters.activeFilterTab,
      aircraftViewMode: userFilters.aircraftViewMode,
      vesselViewMode: userFilters.vesselViewMode,
      aircraft: userFilters.aircraft,
      vessel: userFilters.vessel,
      createdAt: userFilters.createdAt,
      updatedAt: userFilters.updatedAt,
    };
  }
}
