import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

/**
 * Memory Monitor Service
 * Monitors and logs memory usage to detect potential memory leaks
 */
@Injectable()
export class MemoryMonitorService {
  private readonly logger = new Logger(MemoryMonitorService.name);
  private memoryHistory: Array<{ timestamp: Date; usage: NodeJS.MemoryUsage }> = [];
  private readonly MAX_HISTORY = 100;

  /**
   * Monitor memory every 5 minutes
   */
  @Cron('*/5 * * * *')
  monitorMemory() {
    const usage = process.memoryUsage();

    this.memoryHistory.push({
      timestamp: new Date(),
      usage,
    });

    // Keep only last MAX_HISTORY entries
    if (this.memoryHistory.length > this.MAX_HISTORY) {
      this.memoryHistory.shift();
    }

    const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);

    // Warn if memory usage is high (>80% of heap)
    const heapUsagePercent = (usage.heapUsed / usage.heapTotal) * 100;

    if (heapUsagePercent > 80) {
      this.logger.warn(
        `High memory usage: ${usedMB}MB / ${totalMB}MB (${heapUsagePercent.toFixed(1)}%) | RSS: ${rssMB}MB`,
      );
    } else {
      this.logger.debug(
        `Memory usage: ${usedMB}MB / ${totalMB}MB (${heapUsagePercent.toFixed(1)}%) | RSS: ${rssMB}MB`,
      );
    }

    // Suggest GC if available and memory is high
    if (global.gc && heapUsagePercent > 85) {
      this.logger.warn('Triggering manual garbage collection...');
      global.gc();
    }
  }

  /**
   * Get current memory usage
   */
  getCurrentMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024),
      heapUsagePercent: ((usage.heapUsed / usage.heapTotal) * 100).toFixed(2),
      unit: 'MB',
    };
  }

  /**
   * Get memory usage history
   */
  getMemoryHistory() {
    return this.memoryHistory.map((entry) => ({
      timestamp: entry.timestamp,
      heapUsed: Math.round(entry.usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(entry.usage.heapTotal / 1024 / 1024),
      rss: Math.round(entry.usage.rss / 1024 / 1024),
    }));
  }

  /**
   * Check if there's a memory leak trend
   */
  checkMemoryLeakTrend(): { hasLeak: boolean; message: string } {
    if (this.memoryHistory.length < 10) {
      return {
        hasLeak: false,
        message: 'Not enough data to determine trend',
      };
    }

    // Compare first 5 and last 5 entries
    const firstFive = this.memoryHistory.slice(0, 5);
    const lastFive = this.memoryHistory.slice(-5);

    const avgFirst = firstFive.reduce((sum, entry) => sum + entry.usage.heapUsed, 0) / 5;
    const avgLast = lastFive.reduce((sum, entry) => sum + entry.usage.heapUsed, 0) / 5;

    const increasePercent = ((avgLast - avgFirst) / avgFirst) * 100;

    if (increasePercent > 20) {
      return {
        hasLeak: true,
        message: `Memory increased by ${increasePercent.toFixed(1)}% - potential memory leak detected`,
      };
    }

    return {
      hasLeak: false,
      message: `Memory usage is stable (${increasePercent.toFixed(1)}% change)`,
    };
  }
}
