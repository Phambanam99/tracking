import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PerformanceMetrics {
  throughput: {
    messagesPerSecond: number;
    vesselsPerSecond: number;
    positionsPerSecond: number;
  };
  latency: {
    fusionAvg: number; // milliseconds
    dbAvg: number;
    redisAvg: number;
  };
  database: {
    deadlockCount: number; // Last hour
    slowQueries: number; // > 100ms
    connectionPoolUsage: number; // percentage
  };
  redis: {
    vesselKeysCount: number;
    memoryUsage: string;
    commandLatencyAvg: number;
  };
  cache: {
    lruHitRate: number; // percentage
    lruSize: number;
    lruEvictions: number;
  };
}

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);

  // Performance tracking
  private metrics = {
    messagesReceived: 0,
    vesselsProcessed: 0,
    positionsStored: 0,
    fusionLatencies: [] as number[],
    dbLatencies: [] as number[],
    redisLatencies: [] as number[],
    deadlocks: 0,
    slowQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheEvictions: 0,
    startTime: Date.now(),
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record fusion processing time
   */
  recordFusionLatency(ms: number): void {
    this.metrics.fusionLatencies.push(ms);
    // Keep only last 1000 samples to avoid memory issues
    if (this.metrics.fusionLatencies.length > 1000) {
      this.metrics.fusionLatencies.shift();
    }
  }

  /**
   * Record database operation time
   */
  recordDbLatency(ms: number, slow: boolean = false): void {
    this.metrics.dbLatencies.push(ms);
    if (slow) {
      this.metrics.slowQueries++;
    }
    // Keep only last 1000 samples
    if (this.metrics.dbLatencies.length > 1000) {
      this.metrics.dbLatencies.shift();
    }
  }

  /**
   * Record Redis operation time
   */
  recordRedisLatency(ms: number): void {
    this.metrics.redisLatencies.push(ms);
    // Keep only last 1000 samples
    if (this.metrics.redisLatencies.length > 1000) {
      this.metrics.redisLatencies.shift();
    }
  }

  /**
   * Record message processing
   */
  recordMessageProcessed(count: number = 1): void {
    this.metrics.messagesReceived += count;
  }

  /**
   * Record vessel processing
   */
  recordVesselProcessed(count: number = 1): void {
    this.metrics.vesselsProcessed += count;
  }

  /**
   * Record position storage
   */
  recordPositionStored(count: number = 1): void {
    this.metrics.positionsStored += count;
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  /**
   * Record cache eviction
   */
  recordCacheEviction(): void {
    this.metrics.cacheEvictions++;
  }

  /**
   * Record deadlock
   */
  recordDeadlock(): void {
    this.metrics.deadlocks++;
    this.logger.warn('🔴 DEADLOCK DETECTED - Check PostgreSQL logs');
  }

  /**
   * Calculate average latency
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get current performance metrics
   */
  async getMetrics(): Promise<PerformanceMetrics> {
    const uptime = (Date.now() - this.metrics.startTime) / 1000; // seconds

    // Calculate throughput
    const messagesPerSecond = this.metrics.messagesReceived / Math.max(1, uptime);
    const vesselsPerSecond = this.metrics.vesselsProcessed / Math.max(1, uptime);
    const positionsPerSecond = this.metrics.positionsStored / Math.max(1, uptime);

    // Calculate latencies (average and p99)
    const fusionAvg = this.calculateAverage(this.metrics.fusionLatencies);
    const dbAvg = this.calculateAverage(this.metrics.dbLatencies);
    const redisAvg = this.calculateAverage(this.metrics.redisLatencies);

    // Cache hit rate
    const totalCacheOps = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate = totalCacheOps > 0 ? (this.metrics.cacheHits / totalCacheOps) * 100 : 0;

    // Try to get database stats
    let slowQueries = this.metrics.slowQueries;
    let deadlockCount = this.metrics.deadlocks;

    try {
      // Check for slow queries in PostgreSQL logs (requires pg_stat_statements extension)
      const slowQueryResult = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count FROM pg_stat_statements 
        WHERE mean_exec_time > 100 AND query LIKE '%vessel%'
        LIMIT 1
      `;
      if (Array.isArray(slowQueryResult) && slowQueryResult.length > 0) {
        slowQueries = Number((slowQueryResult[0] as any).count) || slowQueries;
      }
    } catch (e) {
      // Ignore errors from missing extension
    }

    return {
      throughput: {
        messagesPerSecond: Math.round(messagesPerSecond * 100) / 100,
        vesselsPerSecond: Math.round(vesselsPerSecond * 100) / 100,
        positionsPerSecond: Math.round(positionsPerSecond * 100) / 100,
      },
      latency: {
        fusionAvg: Math.round(fusionAvg * 100) / 100,
        dbAvg: Math.round(dbAvg * 100) / 100,
        redisAvg: Math.round(redisAvg * 100) / 100,
      },
      database: {
        deadlockCount,
        slowQueries,
        connectionPoolUsage: 0, // Would need connection monitoring
      },
      redis: {
        vesselKeysCount: 0, // Would query Redis
        memoryUsage: 'unknown',
        commandLatencyAvg: Math.round(redisAvg * 100) / 100,
      },
      cache: {
        lruHitRate: Math.round(cacheHitRate * 100) / 100,
        lruSize: 0, // Injected from AisOrchestratorService
        lruEvictions: this.metrics.cacheEvictions,
      },
    };
  }

  /**
   * Get percentile latencies
   */
  async getLatencyPercentiles() {
    return {
      fusion: {
        p50: this.calculatePercentile(this.metrics.fusionLatencies, 50),
        p95: this.calculatePercentile(this.metrics.fusionLatencies, 95),
        p99: this.calculatePercentile(this.metrics.fusionLatencies, 99),
      },
      database: {
        p50: this.calculatePercentile(this.metrics.dbLatencies, 50),
        p95: this.calculatePercentile(this.metrics.dbLatencies, 95),
        p99: this.calculatePercentile(this.metrics.dbLatencies, 99),
      },
      redis: {
        p50: this.calculatePercentile(this.metrics.redisLatencies, 50),
        p95: this.calculatePercentile(this.metrics.redisLatencies, 95),
        p99: this.calculatePercentile(this.metrics.redisLatencies, 99),
      },
    };
  }

  /**
   * Reset metrics (for testing)
   */
  reset(): void {
    this.metrics = {
      messagesReceived: 0,
      vesselsProcessed: 0,
      positionsStored: 0,
      fusionLatencies: [],
      dbLatencies: [],
      redisLatencies: [],
      deadlocks: 0,
      slowQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheEvictions: 0,
      startTime: Date.now(),
    };
  }
}
