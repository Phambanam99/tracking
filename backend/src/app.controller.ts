import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiVersionHeader } from './common/decorators/api-version-header.decorator';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

@ApiTags('root')
@ApiVersionHeader()
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  async health() {
    try {
      // Check database connection
      await this.prisma.$queryRaw`SELECT 1`;

      // Get memory usage
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const rssMB = Math.round(memUsage.rss / 1024 / 1024);

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
        memory: {
          heapUsed: `${heapUsedMB} MB`,
          heapTotal: `${heapTotalMB} MB`,
          rss: `${rssMB} MB`,
          heapUsagePercent: `${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1)}%`,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'disconnected',
        error: error.message,
      };
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getStats() {
    // Get total counts from database
    const [totalAircraftsDB, totalVessels] = await Promise.all([
      this.prisma.aircraft.count(),
      this.prisma.vessel.count(),
    ]);

    // Get active counts (vehicles with recent position updates)
    // Consider "active" as having a position within last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const [activeAircraftsDB, activeVessels] = await Promise.all([
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

    // Get real-time aircraft count from Redis (ADSB data)
    let activeAircrafts = activeAircraftsDB;
    let totalAircrafts = totalAircraftsDB;
    try {
      const client = this.redis.getClientWithoutPrefix();
      const redisCount = await client.hlen('adsb:current_flights');

      // Use Redis count for active aircraft (real-time data)
      activeAircrafts = Math.max(activeAircraftsDB, redisCount);
      totalAircrafts = Math.max(totalAircraftsDB, redisCount);
    } catch (error) {
      // Fallback to database count if Redis fails
      console.error('Failed to get Redis aircraft count:', error.message);
    }

    return {
      totalAircrafts,
      totalVessels,
      activeAircrafts,
      activeVessels,
    };
  }

  @Get('socket-io-status')
  @ApiOperation({ summary: 'Check Socket.IO server status' })
  async socketioStatus() {
    return {
      status: 'Socket.IO gateway is available',
      message: 'WebSocket endpoint available at /socket.io/',
      namespace: '/tracking',
      timestamp: new Date().toISOString(),
    };
  }
}
