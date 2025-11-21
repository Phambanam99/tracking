import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

export type SystemSettings = {
  clusterEnabled: boolean;
  minZoom: number;
  maxZoom: number;
  signalStaleMinutes: number;
  vesselFlagColors: Record<string, string>; // e.g., { VN: '#06b6d4' }
  aircraftOperatorColors: Record<string, string>;
  mapProvider: 'osm' | 'maptiler';
  maptilerApiKey?: string;
  maptilerStyle: string; // e.g., 'streets'
};

const DEFAULT_SETTINGS: SystemSettings = {
  clusterEnabled: true,
  minZoom: 4,
  maxZoom: 16,
  signalStaleMinutes: 10,
  vesselFlagColors: {},
  aircraftOperatorColors: {},
  mapProvider: 'osm',
  maptilerStyle: 'streets',
};

const SETTINGS_KEY = 'system:settings';

@Injectable()
export class AdminService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async getSettings(): Promise<SystemSettings> {
    try {
      // Try Redis cache first for faster response
      const cached = await this.redis.get(SETTINGS_KEY);
      if (cached) {
        // console.log('[AdminService] ✓ Settings from Redis cache');
        return JSON.parse(cached) as SystemSettings;
      }

      // DB is the source of truth
      const db = await this.prisma.systemSettings.findUnique({ where: { id: 1 } });

      // If no settings record exists, create one with defaults
      if (!db) {
        // console.log('[AdminService] No settings found, creating default...');
        const created = await this.prisma.systemSettings.create({
          data: {
            id: 1,
            clusterEnabled: DEFAULT_SETTINGS.clusterEnabled,
            minZoom: DEFAULT_SETTINGS.minZoom,
            maxZoom: DEFAULT_SETTINGS.maxZoom,
            signalStaleMinutes: DEFAULT_SETTINGS.signalStaleMinutes,
            vesselFlagColors: DEFAULT_SETTINGS.vesselFlagColors,
            aircraftOperatorColors: DEFAULT_SETTINGS.aircraftOperatorColors,
            updatedAt: new Date(),
          },
        });
        // console.log('[AdminService] ✓ Default settings created');

        const merged = { ...DEFAULT_SETTINGS, ...(created as any) } as SystemSettings;
        await this.redis.set(SETTINGS_KEY, JSON.stringify(merged));
        return merged;
      }

      const fromDb: Partial<SystemSettings> = {
        clusterEnabled: db.clusterEnabled,
        minZoom: db.minZoom,
        maxZoom: db.maxZoom,
        signalStaleMinutes: db.signalStaleMinutes,
        vesselFlagColors: (db.vesselFlagColors as any) || {},
        aircraftOperatorColors: (db.aircraftOperatorColors as any) || {},
        mapProvider: (db as any).mapProvider || 'osm',
        maptilerApiKey: (db as any).maptilerApiKey || undefined,
        maptilerStyle: (db as any).maptilerStyle || 'streets',
      };

      const merged = { ...DEFAULT_SETTINGS, ...fromDb } as SystemSettings;
      // Keep Redis cache updated
      await this.redis.set(SETTINGS_KEY, JSON.stringify(merged));
      // console.log('[AdminService] ✓ Settings from DB (cached to Redis)');
      return merged;
    } catch (error) {
      console.error('[AdminService] Error fetching settings:', error);
      // Return defaults if database error
      return DEFAULT_SETTINGS;
    }
  }

  async updateSettings(partial: Partial<SystemSettings>): Promise<SystemSettings> {
    const current = await this.getSettings();
    const merged: SystemSettings = { ...current, ...partial };
    // Persist to DB (upsert singleton row with id=1)
    await this.prisma.systemSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        clusterEnabled: merged.clusterEnabled,
        minZoom: merged.minZoom,
        maxZoom: merged.maxZoom,
        signalStaleMinutes: merged.signalStaleMinutes,
        vesselFlagColors: merged.vesselFlagColors as any,
        aircraftOperatorColors: merged.aircraftOperatorColors as any,
        mapProvider: merged.mapProvider,
        maptilerApiKey: merged.maptilerApiKey,
        maptilerStyle: merged.maptilerStyle,
      },
      update: {
        clusterEnabled: merged.clusterEnabled,
        minZoom: merged.minZoom,
        maxZoom: merged.maxZoom,
        signalStaleMinutes: merged.signalStaleMinutes,
        vesselFlagColors: merged.vesselFlagColors as any,
        aircraftOperatorColors: merged.aircraftOperatorColors as any,
        mapProvider: merged.mapProvider,
        maptilerApiKey: merged.maptilerApiKey,
        maptilerStyle: merged.maptilerStyle,
      },
    });
    // Update Redis + broadcast
    await this.redis.set(SETTINGS_KEY, JSON.stringify(merged));
    await this.redis.publish('config:update', JSON.stringify(merged));
    return merged;
  }

  async getStats() {
    const [
      totalUsers,
      activeUsers,
      usersByRole,
      totalAircraft,
      aircraftWithPositions,
      recentAircraftUpdates,
      totalVessels,
      vesselsWithPositions,
      activeSessions,
      expiredSessions,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
      this.prisma.aircraft.count(),
      this.prisma.aircraft.count({
        where: { positions: { some: {} } },
      }),
      this.prisma.aircraft.count({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.vessel.count(),
      this.prisma.vessel.count({
        where: { positions: { some: {} } },
      }),
      this.prisma.userSession.count({
        where: { expiresAt: { gt: new Date() } },
      }),
      this.prisma.userSession.count({
        where: { expiresAt: { lte: new Date() } },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        byRole: usersByRole.reduce(
          (acc, item) => {
            acc[item.role] = item._count.id;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
      aircraft: {
        total: totalAircraft,
        withPositions: aircraftWithPositions,
        recentUpdates: recentAircraftUpdates,
      },
      vessels: {
        total: totalVessels,
        withPositions: vesselsWithPositions,
      },
      sessions: {
        active: activeSessions,
        expired: expiredSessions,
      },
    };
  }
}
