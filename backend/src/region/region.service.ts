import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateRegionDto, UpdateRegionDto } from './dto/region.dto';
import { RegionType, ObjectType, AlertType } from '@prisma/client';

@Injectable()
export class RegionService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async createRegion(userId: number, createRegionDto: CreateRegionDto) {
  
    try {
      // Prepare the data for creation
      const regionData = { ...createRegionDto, userId };

      // For circle regions, extract center coordinates and radius from boundary
      if (createRegionDto.regionType === 'CIRCLE' && createRegionDto.boundary) {
        const boundary = createRegionDto.boundary as {
          type?: string;
          center?: number[];
          radius?: number;
        };
        if (boundary.type === 'Circle' && boundary.center && boundary.radius) {
          regionData.centerLng = boundary.center[0]; // longitude
          regionData.centerLat = boundary.center[1]; // latitude
          regionData.radius = boundary.radius;
         
        }
      }

      const region = await this.prisma.region.create({
        data: regionData,
      });

      return region;
    } catch (error) {
      console.error('❌ Error in RegionService.createRegion:', error);
      throw error;
    }
  }

  async findUserRegions(userId: number) {
    return this.prisma.region.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRegionById(id: number, userId: number) {
    return this.prisma.region.findFirst({
      where: { id, userId },
    });
  }

  async updateRegion(id: number, userId: number, updateRegionDto: UpdateRegionDto) {
    return this.prisma.region.update({
      where: { id },
      data: {
        ...updateRegionDto,
        updatedAt: new Date(),
      },
    });
  }

  async deleteRegion(id: number, userId: number) {
    return this.prisma.region.delete({
      where: { id },
    });
  }

  async getUserAlerts(userId: number, unreadOnly = false) {
    return this.prisma.regionAlert.findMany({
      where: {
        userId,
        ...(unreadOnly && { isRead: false }),
      },
      include: {
        region: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAlertAsRead(alertId: number, userId: number) {
    return this.prisma.regionAlert.update({
      where: { id: alertId },
      data: { isRead: true },
    });
  }

  async markAllAlertsAsRead(userId: number) {
    return this.prisma.regionAlert.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  // Check if a point is inside a circular region
  private isPointInCircle(
    pointLat: number,
    pointLng: number,
    centerLat: number,
    centerLng: number,
    radiusMeters: number,
  ): boolean {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(pointLat - centerLat);
    const dLng = this.toRadians(pointLng - centerLng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(centerLat)) *
        Math.cos(this.toRadians(pointLat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance <= radiusMeters;
  }

  // Check if a point is inside a polygon using ray casting algorithm
  private isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];

      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }

    return inside;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Check if object is inside region
  async checkObjectInRegion(
    regionId: number,
    objectType: ObjectType,
    objectId: number,
    latitude: number,
    longitude: number,
  ): Promise<boolean> {
    const region = await this.prisma.region.findUnique({
      where: { id: regionId },
    });

    if (!region || !region.isActive) {
      return false;
    }

    if (region.regionType === RegionType.CIRCLE) {
      return this.isPointInCircle(
        latitude,
        longitude,
        region.centerLat!,
        region.centerLng!,
        region.radius!,
      );
    } else if (region.regionType === RegionType.POLYGON) {
      // Assume boundary is GeoJSON polygon coordinates
      if (
        region.boundary &&
        typeof region.boundary === 'object' &&
        'coordinates' in region.boundary
      ) {
        const coordinates = (region.boundary as any).coordinates[0]; // First ring of polygon
        return this.isPointInPolygon([longitude, latitude], coordinates);
      }
    }

    return false;
  }

  // Process position update and create alerts if needed
  async processPositionUpdate(
    objectType: ObjectType,
    objectId: number,
    latitude: number,
    longitude: number,
  ) {
    // Get all active regions
    const regions = await this.prisma.region.findMany({
      where: { isActive: true },
    });

    for (const region of regions) {
      const isInside = await this.checkObjectInRegion(
        region.id,
        objectType,
        objectId,
        latitude,
        longitude,
      );

      // Check if object was previously inside/outside
      const history = await this.prisma.regionObjectHistory.findUnique({
        where: {
          regionId_objectType_objectId: {
            regionId: region.id,
            objectType,
            objectId,
          },
        },
      });

      let shouldCreateAlert = false;
      let alertType: AlertType | null = null;

      if (!history) {
        // First time tracking this object in this region
        await this.prisma.regionObjectHistory.create({
          data: {
            regionId: region.id,
            objectType,
            objectId,
            isInside,
            enteredAt: isInside ? new Date() : null,
          },
        });

        if (isInside && region.alertOnEntry) {
          shouldCreateAlert = true;
          alertType = AlertType.ENTRY;
        }
      } else {
        // Object was previously tracked
        if (history.isInside && !isInside) {
          // Object exited the region
          if (region.alertOnExit) {
            shouldCreateAlert = true;
            alertType = AlertType.EXIT;
          }

          await this.prisma.regionObjectHistory.update({
            where: { id: history.id },
            data: {
              isInside: false,
              exitedAt: new Date(),
            },
          });
        } else if (!history.isInside && isInside) {
          // Object entered the region
          if (region.alertOnEntry) {
            shouldCreateAlert = true;
            alertType = AlertType.ENTRY;
          }

          await this.prisma.regionObjectHistory.update({
            where: { id: history.id },
            data: {
              isInside: true,
              enteredAt: new Date(),
              exitedAt: null,
            },
          });
        }
      }

      // Create alert if needed
      if (shouldCreateAlert && alertType) {
        const alertData = await this.prisma.regionAlert.create({
          data: {
            regionId: region.id,
            userId: region.userId,
            objectType,
            objectId,
            alertType,
            latitude,
            longitude,
          },
          include: {
            region: {
              select: { name: true },
            },
          },
        });

        // Broadcast alert via Redis/WebSocket
        await this.redisService.publish('region:alert', JSON.stringify(alertData));

      }
    }
  }
}
