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
    // DB is the source of truth
    const db = await this.prisma.systemSettings.findUnique({ where: { id: 1 } });
    const fromDb: Partial<SystemSettings> = db
      ? {
          clusterEnabled: db.clusterEnabled,
          minZoom: db.minZoom,
          maxZoom: db.maxZoom,
          signalStaleMinutes: db.signalStaleMinutes,
          vesselFlagColors: (db.vesselFlagColors as any) || {},
          aircraftOperatorColors: (db.aircraftOperatorColors as any) || {},
          mapProvider: (db as any).mapProvider || 'osm',
          maptilerApiKey: (db as any).maptilerApiKey || undefined,
          maptilerStyle: (db as any).maptilerStyle || 'streets',
        }
      : {};
    const merged = { ...DEFAULT_SETTINGS, ...fromDb } as SystemSettings;
    // Keep Redis cache updated (optional)
    await this.redis.set(SETTINGS_KEY, JSON.stringify(merged));
    return merged;
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
}
