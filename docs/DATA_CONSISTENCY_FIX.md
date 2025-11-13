# Implement giải pháp khắc phục biến động số lượng tàu thuyền

## File 1: Backend Fix - Standardize Stats API

Tạo file `backend/src/app.controller.consistent.ts`:

```typescript
import { Controller, Get, UseGuards } from "@nestjs/common";
import { AppService } from "./app.service";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiVersionHeader } from "./common/decorators/api-version-header.decorator";
import { PrismaService } from "./prisma/prisma.service";
import { RedisService } from "./redis/redis.service";
import { Logger } from "@nestjs/common";

@ApiTags("root")
@ApiVersionHeader()
@Controller()
export class AppControllerConsistent {
  private readonly logger = new Logger(AppControllerConsistent.name);

  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  @Get("stats/consistent")
  @ApiOperation({ summary: "Get consistent dashboard statistics" })
  async getConsistentStats() {
    try {
      // Primary: Use Redis for active vessel count
      const redisActiveCount = await this.getRedisActiveVessels();

      // Fallback: Use database if Redis returns 0
      const activeVessels =
        redisActiveCount > 0
          ? redisActiveCount
          : await this.getDatabaseActiveVessels();

      // Get total counts from database (these are stable)
      const [totalAircrafts, totalVessels] = await Promise.all([
        this.prisma.aircraft.count(),
        this.prisma.vessel.count(),
      ]);

      // Get active aircraft count (similar logic)
      const activeAircrafts = await this.getRedisActiveAircrafts();

      this.logger.log(
        `Stats: Active vessels=${activeVessels}, Total vessels=${totalVessels}, Source=${
          redisActiveCount > 0 ? "Redis" : "Database"
        }`
      );

      return {
        totalAircrafts,
        totalVessels,
        activeAircrafts,
        activeVessels,
        dataSource: redisActiveCount > 0 ? "redis" : "database",
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("Failed to get consistent stats", error);
      // Fallback to original method
      return this.getFallbackStats();
    }
  }

  @Get("health/data-consistency")
  @ApiOperation({
    summary: "Check data consistency between Redis and Database",
  })
  async checkDataConsistency() {
    try {
      const [redisCount, dbCount] = await Promise.all([
        this.getRedisActiveVessels(),
        this.getDatabaseActiveVessels(),
      ]);

      const discrepancy = Math.abs(redisCount - dbCount);
      const maxCount = Math.max(redisCount, dbCount);
      const discrepancyPercent =
        maxCount > 0 ? (discrepancy / maxCount) * 100 : 0;
      const threshold = 10; // 10% threshold

      const isConsistent = discrepancyPercent < threshold;

      if (!isConsistent) {
        this.logger.warn(
          `Data inconsistency detected: Redis=${redisCount}, DB=${dbCount}, Discrepancy=${discrepancyPercent.toFixed(
            2
          )}%`
        );
      }

      return {
        consistent: isConsistent,
        redisCount,
        dbCount,
        discrepancy,
        discrepancyPercent: Math.round(discrepancyPercent * 100) / 100,
        threshold,
        status: isConsistent ? "healthy" : "inconsistent",
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("Failed to check data consistency", error);
      return {
        consistent: false,
        error: error.message,
        status: "error",
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private async getRedisActiveVessels(): Promise<number> {
    try {
      const client = this.redis.getClient();
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

      const activeCount = await client.zcount(
        "ais:vessels:active",
        thirtyMinutesAgo,
        "+inf"
      );

      return activeCount;
    } catch (error) {
      this.logger.error("Failed to get Redis active vessels", error);
      return 0;
    }
  }

  private async getRedisActiveAircrafts(): Promise<number> {
    try {
      const client = this.redis.getClient();
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

      const activeCount = await client.zcount(
        "aircraft:active",
        thirtyMinutesAgo,
        "+inf"
      );

      return activeCount;
    } catch (error) {
      this.logger.error("Failed to get Redis active aircraft", error);
      return 0;
    }
  }

  private async getDatabaseActiveVessels(): Promise<number> {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

      const activeVessels = await this.prisma.vessel.count({
        where: {
          positions: {
            some: {
              timestamp: {
                gte: thirtyMinutesAgo,
              },
            },
          },
        },
      });

      return activeVessels;
    } catch (error) {
      this.logger.error("Failed to get database active vessels", error);
      return 0;
    }
  }

  private async getFallbackStats() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const [totalAircrafts, totalVessels, activeAircrafts, activeVessels] =
      await Promise.all([
        this.prisma.aircraft.count(),
        this.prisma.vessel.count(),
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
      dataSource: "database_fallback",
      lastUpdated: new Date().toISOString(),
    };
  }
}
```

## File 2: Database Optimization Script

Tạo file `backend/scripts/optimize-vessel-stats.sql`:

```sql
-- Optimize vessel statistics queries
-- Run this script to improve performance of active vessel counting

-- Create indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vessel_positions_timestamp
ON vessel_positions (timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vessel_positions_vessel_timestamp
ON vessel_positions (vessel_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aircraft_positions_timestamp
ON aircraft_positions (timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aircraft_positions_vessel_timestamp
ON aircraft_positions (aircraft_id, timestamp DESC);

-- Create materialized view for vessel statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS vessel_active_stats AS
SELECT
  v.id,
  v.mmsi,
  v.vessel_name,
  v.vessel_type,
  MAX(vp.timestamp) as last_position_time,
  CASE
    WHEN MAX(vp.timestamp) > NOW() - INTERVAL '30 minutes' THEN true
    ELSE false
  END as is_active,
  COUNT(vp.id) as total_positions
FROM vessels v
LEFT JOIN vessel_positions vp ON v.id = vp.vessel_id
GROUP BY v.id, v.mmsi, v.vessel_name, v.vessel_type;

-- Create materialized view for aircraft statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS aircraft_active_stats AS
SELECT
  a.id,
  a.flight_id,
  a.call_sign,
  MAX(ap.timestamp) as last_position_time,
  CASE
    WHEN MAX(ap.timestamp) > NOW() - INTERVAL '30 minutes' THEN true
    ELSE false
  END as is_active,
  COUNT(ap.id) as total_positions
FROM aircraft a
LEFT JOIN aircraft_positions ap ON a.id = ap.aircraft_id
GROUP BY a.id, a.flight_id, a.call_sign;

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_vessel_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY vessel_active_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY aircraft_active_stats;
END;
$$ LANGUAGE plpgsql;

-- Create optimized function to get active vessel count
CREATE OR REPLACE FUNCTION get_active_vessel_count(minutes_interval INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  active_count INTEGER;
BEGIN
  -- Try materialized view first
  SELECT COUNT(*) INTO active_count
  FROM vessel_active_stats
  WHERE is_active = true;

  -- If materialized view is empty, fall back to direct query
  IF active_count IS NULL THEN
    SELECT COUNT(DISTINCT v.id) INTO active_count
    FROM vessels v
    INNER JOIN vessel_positions vp ON v.id = vp.vessel_id
    WHERE vp.timestamp > NOW() - INTERVAL '1 minutes';
  END IF;

  RETURN COALESCE(active_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Create optimized function to get active aircraft count
CREATE OR REPLACE FUNCTION get_active_aircraft_count(minutes_interval INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  active_count INTEGER;
BEGIN
  -- Try materialized view first
  SELECT COUNT(*) INTO active_count
  FROM aircraft_active_stats
  WHERE is_active = true;

  -- If materialized view is empty, fall back to direct query
  IF active_count IS NULL THEN
    SELECT COUNT(DISTINCT a.id) INTO active_count
    FROM aircraft a
    INNER JOIN aircraft_positions ap ON a.id = ap.aircraft_id
    WHERE ap.timestamp > NOW() - INTERVAL '1 minutes';
  END IF;

  RETURN COALESCE(active_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION refresh_vessel_stats() TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_active_vessel_count(INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_active_aircraft_count(INTEGER) TO PUBLIC;
```

## File 3: Monitoring Service

Tạo file `backend/src/monitoring/data-consistency.monitor.ts`:

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class DataConsistencyMonitor {
  private readonly logger = new Logger(DataConsistencyMonitor.name);
  private lastCheckTime: Date | null = null;
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkDataConsistency() {
    try {
      const [redisCount, dbCount] = await Promise.all([
        this.getRedisActiveVessels(),
        this.getDatabaseActiveVessels(),
      ]);

      const discrepancy = Math.abs(redisCount - dbCount);
      const maxCount = Math.max(redisCount, dbCount);
      const discrepancyPercent =
        maxCount > 0 ? (discrepancy / maxCount) * 100 : 0;
      const threshold = 5; // 5% threshold for monitoring

      const isConsistent = discrepancyPercent < threshold;

      this.logger.log(
        `Data consistency check: Redis=${redisCount}, DB=${dbCount}, Discrepancy=${discrepancyPercent.toFixed(
          2
        )}%`
      );

      if (!isConsistent) {
        this.consecutiveFailures++;
        this.logger.warn(
          `Data inconsistency detected: Redis=${redisCount}, DB=${dbCount}, Discrepancy=${discrepancyPercent.toFixed(
            2
          )}%, Consecutive failures=${this.consecutiveFailures}`
        );

        // Trigger alert if too many consecutive failures
        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          await this.triggerAlert({
            type: "DATA_INCONSISTENCY_CRITICAL",
            redisCount,
            dbCount,
            discrepancyPercent,
            consecutiveFailures: this.consecutiveFailures,
          });
        }
      } else {
        this.consecutiveFailures = 0;
        this.logger.log("Data consistency check passed");
      }

      this.lastCheckTime = new Date();

      // Update metrics
      await this.updateMetrics(
        redisCount,
        dbCount,
        discrepancyPercent,
        isConsistent
      );
    } catch (error) {
      this.logger.error("Data consistency check failed", error);
      this.consecutiveFailures++;
    }
  }

  private async getRedisActiveVessels(): Promise<number> {
    try {
      const client = this.redis.getClient();
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

      const activeCount = await client.zcount(
        "ais:vessels:active",
        thirtyMinutesAgo,
        "+inf"
      );

      return activeCount;
    } catch (error) {
      this.logger.error("Failed to get Redis active vessels", error);
      return 0;
    }
  }

  private async getDatabaseActiveVessels(): Promise<number> {
    try {
      // Use optimized function if available
      const result = await this.prisma.$queryRaw`
        SELECT get_active_vessel_count(30) as count
      `;

      return result[0]?.count || 0;
    } catch (error) {
      // Fallback to regular query
      this.logger.warn(
        "Optimized function not available, using fallback query",
        error
      );

      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const activeVessels = await this.prisma.vessel.count({
        where: {
          positions: {
            some: {
              timestamp: {
                gte: thirtyMinutesAgo,
              },
            },
          },
        },
      });

      return activeVessels;
    }
  }

  private async triggerAlert(alertData: any) {
    this.logger.error("CRITICAL: Data consistency alert", alertData);

    // Here you can integrate with your alerting system
    // Examples: Slack, email, PagerDuty, etc.

    // For now, just log the critical alert
    console.error("ALERT:", JSON.stringify(alertData, null, 2));
  }

  private async updateMetrics(
    redisCount: number,
    dbCount: number,
    discrepancyPercent: number,
    isConsistent: boolean
  ) {
    // Update Prometheus metrics or other monitoring systems
    // This would integrate with your existing metrics service

    this.logger.debug(
      `Metrics updated: redis=${redisCount}, db=${dbCount}, discrepancy=${discrepancyPercent.toFixed(
        2
      )}%, consistent=${isConsistent}`
    );
  }

  async getConsistencyStatus() {
    return {
      lastCheck: this.lastCheckTime,
      consecutiveFailures: this.consecutiveFailures,
      status:
        this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES
          ? "critical"
          : "healthy",
    };
  }
}
```

## File 4: Frontend Fix

Tạo file `frontend/src/hooks/useConsistentStats.ts`:

```typescript
import { useState, useEffect } from "react";
import api from "../services/apiClient";

interface Stats {
  totalAircrafts: number;
  totalVessels: number;
  activeAircrafts: number;
  activeVessels: number;
  dataSource: "redis" | "database" | "database_fallback";
  lastUpdated: string;
}

interface DataConsistency {
  consistent: boolean;
  redisCount: number;
  dbCount: number;
  discrepancy: number;
  discrepancyPercent: number;
  threshold: number;
  status: "healthy" | "inconsistent" | "error";
  lastChecked: string;
}

export const useConsistentStats = (refreshInterval = 30000) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [consistency, setConsistency] = useState<DataConsistency | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, consistencyData] = await Promise.all([
        api.get("/stats/consistent"),
        api.get("/health/data-consistency"),
      ]);

      setStats(statsData);
      setConsistency(consistencyData);

      // Log data source for debugging
      console.log(
        `Stats updated: Source=${statsData.dataSource}, Active vessels=${statsData.activeVessels}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stats");
      console.error("Failed to fetch consistent stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    const interval = setInterval(fetchStats, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return {
    stats,
    consistency,
    loading,
    error,
    refetch: fetchStats,
  };
};
```

## File 5: Dashboard Component Update

Cập nhật file `frontend/src/app/dashboard/page.tsx`:

```typescript
// Thêm import
import { useConsistentStats } from "@/hooks/useConsistentStats";

// Trong component:
export default function DashboardPage() {
  const { stats, consistency, loading, error } = useConsistentStats(30000);
  const { aircrafts, fetchAircrafts } = useAircraftStore();
  const { vessels, fetchVessels } = useVesselStore();

  // ... existing code ...

  // Thêm hiển thị data consistency status
  const ConsistencyIndicator = () => {
    if (!consistency) return null;

    if (consistency.consistent) {
      return (
        <div className="text-sm text-green-600">
          ✓ Data consistent ({consistency.redisCount} vessels)
        </div>
      );
    }

    return (
      <div className="text-sm text-red-600">
        ⚠ Data inconsistency detected: Redis={consistency.redisCount}, DB=
        {consistency.dbCount}
      </div>
    );
  };

  // Cập nhật stat cards để hiển thị data source
  const statCards = [
    // ... existing cards ...
    {
      name: "Tàu thuyền đang hoạt động",
      value: stats?.activeVessels || 0,
      icon: "🚢",
      color: "bg-emerald-100 text-emerald-800",
      subtitle:
        stats?.dataSource === "redis" ? "Dữ liệu real-time" : "Dữ liệu cached",
    },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen">
        <Header />
        <main className="section">
          <div className="">
            <div className="mb-8">
              <h1 className="page-title">Dashboard</h1>
              <p className="page-subtitle">
                Tổng quan hệ thống theo dõi máy bay và tàu thuyền
              </p>

              {/* Data consistency indicator */}
              <div className="mt-4">
                <ConsistencyIndicator />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              {statCards.map((stat) => (
                <div key={stat.name} className="card">
                  <div className="card-body">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div
                          className={`inline-flex items-center justify-center h-12 w-12 rounded-md ${stat.color}`}
                        >
                          <span className="text-xl">{stat.icon}</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            {stat.name}
                          </dt>
                          <dd className="text-3xl font-semibold text-gray-900">
                            {stat.value}
                          </dd>
                          {stat.subtitle && (
                            <dd className="text-xs text-gray-500">
                              {stat.subtitle}
                            </dd>
                          )}
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ... rest of the component ... */}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
```

## Hướng dẫn triển khai

### Bước 1: Database Optimization

```bash
# Chạy script optimization
psql -d your_database -f backend/scripts/optimize-vessel-stats.sql

# Tạo cron job để refresh materialized views
# Thêm vào crontab:
*/5 * * * * psql -d your_database -c "SELECT refresh_vessel_stats();"
```

### Bước 2: Backend Implementation

```bash
# Thêm controller mới vào module
# Update app.module.ts để include AppControllerConsistent
# Thêm DataConsistencyMonitor vào module
```

### Bước 3: Frontend Update

```bash
# Copy các file hooks mới
# Update dashboard component
# Test với data consistency indicator
```

### Bước 4: Monitoring Setup

```bash
# Kiểm tra log để đảm bảo monitoring hoạt động
# Test alert mechanism
# Verify metrics collection
```

## Kết quả mong đợi

Sau khi triển khai giải pháp này:

1. **Dashboard sẽ hiển thị số lượng tàu thuyền nhất quán**
2. **Có fallback mechanism khi Redis gặp vấn đề**
3. **Monitoring và alerting cho data inconsistency**
4. **Performance improvement với database optimization**
5. **Transparency về data source đang được sử dụng**

Giải pháp này đảm bảo tính reliability và consistency cho dashboard metrics.
