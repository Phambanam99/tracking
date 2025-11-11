import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiVersionHeader } from './common/decorators/api-version-header.decorator';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('root')
@ApiVersionHeader()
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getStats() {
    // Get total counts
    const [totalAircrafts, totalVessels] = await Promise.all([
      this.prisma.aircraft.count(),
      this.prisma.vessel.count(),
    ]);

    // Get active counts (vehicles with recent position updates)
    // Consider "active" as having a position within last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const [activeAircrafts, activeVessels] = await Promise.all([
      this.prisma.aircraft.count({
        where: {
          positions: {
            some: {
              timestamp: {
                gte: thirtyMinutesAgo,
              },
            },
          },
        },
      }),
      this.prisma.vessel.count({
        where: {
          positions: {
            some: {
              timestamp: {
                gte: thirtyMinutesAgo,
              },
            },
          },
        },
      }),
    ]);

    return {
      totalAircrafts,
      totalVessels,
      activeAircrafts,
      activeVessels,
    };
  }
}
