import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface MetricsSnapshot {
  timestamp: Date;
  vessels: {
    totalInDb: number;
    withPositions: number;
    positionsInDb: number;
    inRedis: number;
    recentUpdates: number; // Last 60 seconds
  };
  aircraft: {
    totalInDb: number;
    withPositions: number;
    positionsInDb: number;
    inRedis: number;
    recentUpdates: number; // Last 60 seconds
  };
  redis: {
    vesselKeys: number;
    aircraftKeys: number;
    memory: string;
  };
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private lastSnapshot: MetricsSnapshot | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Collect and log metrics every 60 seconds
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async logMetrics() {
    try {
      const snapshot = await this.collectMetrics();
      this.logSnapshot(snapshot);
      this.lastSnapshot = snapshot;
    } catch (error) {
      this.logger.error(`Failed to collect metrics: ${error.message}`);
    }
  }

  /**
   * Collect all metrics
   */
  private async collectMetrics(): Promise<MetricsSnapshot> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    const [
      // Vessel metrics
      totalVessels,
      vesselsWithPositions,
      vesselPositionsCount,
      recentVesselUpdates,
      // Aircraft metrics
      totalAircraft,
      aircraftWithPositions,
      aircraftPositionsCount,
      recentAircraftUpdates,
      // Redis metrics
      redisVesselKeys,
      redisAircraftKeys,
      redisMemory,
    ] = await Promise.all([
      // Vessels
      this.prisma.vessel.count(),
      this.prisma.vessel.count({
        where: { positions: { some: {} } },
      }),
      this.prisma.vesselPosition.count(),
      this.prisma.vesselPosition.count({
        where: { timestamp: { gte: oneMinuteAgo } },
      }),
      // Aircraft
      this.prisma.aircraft.count(),
      this.prisma.aircraft.count({
        where: { positions: { some: {} } },
      }),
      this.prisma.aircraftPosition.count(),
      this.prisma.aircraftPosition.count({
        where: { timestamp: { gte: oneMinuteAgo } },
      }),
      // Redis
      this.countRedisKeys('ais:vessel:*'),
      this.countRedisAircraft(), // Changed from pattern to hash count
      this.getRedisMemory(),
    ]);

    return {
      timestamp: now,
      vessels: {
        totalInDb: totalVessels,
        withPositions: vesselsWithPositions,
        positionsInDb: vesselPositionsCount,
        inRedis: redisVesselKeys,
        recentUpdates: recentVesselUpdates,
      },
      aircraft: {
        totalInDb: totalAircraft,
        withPositions: aircraftWithPositions,
        positionsInDb: aircraftPositionsCount,
        inRedis: redisAircraftKeys,
        recentUpdates: recentAircraftUpdates,
      },
      redis: {
        vesselKeys: redisVesselKeys,
        aircraftKeys: redisAircraftKeys,
        memory: redisMemory,
      },
    };
  }

  /**
   * Count Redis keys matching pattern
   */
  private async countRedisKeys(pattern: string): Promise<number> {
    try {
      // Use client without prefix for key counting
      const client = this.redis.getClientWithoutPrefix();
      const keys = await client.keys(pattern);
      return keys.length;
    } catch (error) {
      this.logger.warn(`Failed to count Redis keys for ${pattern}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Count aircraft in Redis Hash (adsb:current_flights)
   */
  private async countRedisAircraft(): Promise<number> {
    try {
      const client = this.redis.getClientWithoutPrefix();
      const count = await client.hlen('adsb:current_flights');
      return count;
    } catch (error) {
      this.logger.warn(`Failed to count aircraft in Redis: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get Redis memory usage
   */
  private async getRedisMemory(): Promise<string> {
    try {
      // Use client without prefix for Redis info
      const client = this.redis.getClientWithoutPrefix();
      const info = await client.info('memory');
      const match = info.match(/used_memory_human:([^\r\n]+)/);
      return match ? match[1] : 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Log metrics snapshot
   */
  private logSnapshot(snapshot: MetricsSnapshot) {
    const { vessels, aircraft, redis } = snapshot;

    // Calculate deltas if we have previous snapshot
    const vesselDelta = this.lastSnapshot
      ? vessels.positionsInDb - this.lastSnapshot.vessels.positionsInDb
      : 0;
    const aircraftDelta = this.lastSnapshot
      ? aircraft.positionsInDb - this.lastSnapshot.aircraft.positionsInDb
      : 0;

    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('📊 SYSTEM METRICS');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Vessels
    this.logger.log(
      `🚢 VESSELS: ${vessels.totalInDb} total | ${vessels.withPositions} tracked | ${vessels.positionsInDb} positions`,
    );
    this.logger.log(
      `   └─ Redis: ${redis.vesselKeys} keys | Recent: ${vessels.recentUpdates} updates/min${vesselDelta > 0 ? ` (+${vesselDelta})` : ''}`,
    );

    // Aircraft
    this.logger.log(
      `✈️  AIRCRAFT: ${aircraft.totalInDb} total | ${aircraft.withPositions} tracked | ${aircraft.positionsInDb} positions`,
    );
    this.logger.log(
      `   └─ Redis: ${redis.aircraftKeys} keys | Recent: ${aircraft.recentUpdates} updates/min${aircraftDelta > 0 ? ` (+${aircraftDelta})` : ''}`,
    );

    // Redis
    this.logger.log(
      `💾 REDIS: Memory ${redis.memory} | Total keys: ${redis.vesselKeys + redis.aircraftKeys}`,
    );

    // Performance indicators
    if (vessels.recentUpdates === 0 && aircraft.recentUpdates === 0) {
      this.logger.warn('⚠️  WARNING: No recent updates in last 60 seconds');
    }

    if (vessels.totalInDb > 0 && vessels.inRedis === 0) {
      this.logger.warn('⚠️  WARNING: Vessels in DB but not in Redis');
    }

    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * Get current metrics (for API endpoint)
   */
  async getCurrentMetrics(): Promise<MetricsSnapshot> {
    if (!this.lastSnapshot) {
      return this.collectMetrics();
    }
    return this.lastSnapshot;
  }

  /**
   * Get detailed breakdown
   */
  async getDetailedMetrics() {
    const snapshot = await this.collectMetrics();

    // Get top vessels by position count
    const topVessels = await this.prisma.vessel.findMany({
      select: {
        id: true,
        mmsi: true,
        vesselName: true,
        _count: {
          select: { positions: true },
        },
      },
      orderBy: {
        positions: {
          _count: 'desc',
        },
      },
      take: 5,
    });

    // Get top aircraft by position count
    const topAircraft = await this.prisma.aircraft.findMany({
      select: {
        id: true,
        flightId: true,
        callSign: true,
        _count: {
          select: { positions: true },
        },
      },
      orderBy: {
        positions: {
          _count: 'desc',
        },
      },
      take: 5,
    });

    return {
      ...snapshot,
      topVessels: topVessels.map((v) => ({
        id: v.id,
        mmsi: v.mmsi,
        name: v.vesselName,
        positionCount: v._count.positions,
      })),
      topAircraft: topAircraft.map((a) => ({
        id: a.id,
        flightId: a.flightId,
        callSign: a.callSign,
        positionCount: a._count.positions,
      })),
    };
  }
}
