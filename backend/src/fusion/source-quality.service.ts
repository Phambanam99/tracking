import { Injectable, Logger } from '@nestjs/common';
import { VesselSource, AircraftSource } from './types';

/**
 * Source Quality Tracking Service
 *
 * Tracks quality metrics for each data source and demotes low-quality sources
 *
 * Quality Metrics:
 * - Error rate (invalid data)
 * - Latency (message age)
 * - Completeness (missing fields)
 * - Accuracy (compared to other sources)
 */

interface SourceMetrics {
  totalMessages: number;
  errorCount: number;
  avgLatency: number;
  completenessScore: number;
  lastUpdate: number;
  demoted: boolean;
}

@Injectable()
export class SourceQualityService {
  private readonly logger = new Logger(SourceQualityService.name);

  private vesselSourceMetrics = new Map<VesselSource, SourceMetrics>();
  private aircraftSourceMetrics = new Map<AircraftSource, SourceMetrics>();

  // Thresholds for demotion
  private readonly ERROR_RATE_THRESHOLD = 0.3; // 30% error rate
  private readonly MIN_COMPLETENESS_SCORE = 0.5; // 50% completeness
  private readonly DEMOTION_DURATION = 30 * 60 * 1000; // 30 minutes

  /**
   * Record message from source
   */
  recordVesselMessage(
    source: VesselSource,
    isValid: boolean,
    completeness: number,
    latency: number,
  ) {
    const metrics = this.getOrCreateVesselMetrics(source);

    metrics.totalMessages++;
    if (!isValid) metrics.errorCount++;

    // Update rolling average latency
    metrics.avgLatency = metrics.avgLatency * 0.9 + latency * 0.1;

    // Update completeness score
    metrics.completenessScore = metrics.completenessScore * 0.9 + completeness * 0.1;

    metrics.lastUpdate = Date.now();

    // Check if should demote
    this.checkDemotion(source, metrics);
  }

  /**
   * Check if source should be demoted
   */
  private checkDemotion(source: VesselSource | AircraftSource, metrics: SourceMetrics) {
    const errorRate = metrics.errorCount / metrics.totalMessages;

    if (
      errorRate > this.ERROR_RATE_THRESHOLD ||
      metrics.completenessScore < this.MIN_COMPLETENESS_SCORE
    ) {
      if (!metrics.demoted) {
        metrics.demoted = true;
        this.logger.warn(
          `Source ${source} demoted: errorRate=${(errorRate * 100).toFixed(1)}%, completeness=${(metrics.completenessScore * 100).toFixed(1)}%`,
        );
      }
    } else if (metrics.demoted && errorRate < this.ERROR_RATE_THRESHOLD * 0.5) {
      // Promote back if error rate drops significantly
      metrics.demoted = false;
      this.logger.log(`Source ${source} promoted back to normal`);
    }
  }

  /**
   * Get source weight (0-1, lower for demoted sources)
   */
  getVesselSourceWeight(source: VesselSource): number {
    const metrics = this.vesselSourceMetrics.get(source);
    if (!metrics) return 1.0; // Default weight

    if (metrics.demoted) {
      // Check if demotion period expired
      if (Date.now() - metrics.lastUpdate > this.DEMOTION_DURATION) {
        metrics.demoted = false;
        this.logger.log(`Source ${source} demotion period expired, restoring weight`);
        return 1.0;
      }
      return 0.3; // Reduced weight for demoted sources
    }

    return 1.0;
  }

  /**
   * Check if source is demoted
   */
  isSourceDemoted(source: VesselSource | AircraftSource): boolean {
    const metrics =
      this.vesselSourceMetrics.get(source as VesselSource) ||
      this.aircraftSourceMetrics.get(source as AircraftSource);
    return metrics?.demoted || false;
  }

  /**
   * Get metrics for a source
   */
  getSourceMetrics(source: VesselSource | AircraftSource) {
    return (
      this.vesselSourceMetrics.get(source as VesselSource) ||
      this.aircraftSourceMetrics.get(source as AircraftSource)
    );
  }

  /**
   * Get all source metrics
   */
  getAllMetrics() {
    return {
      vessel: Array.from(this.vesselSourceMetrics.entries()).map(([source, metrics]) => ({
        source,
        ...metrics,
        errorRate: metrics.totalMessages > 0 ? metrics.errorCount / metrics.totalMessages : 0,
      })),
      aircraft: Array.from(this.aircraftSourceMetrics.entries()).map(([source, metrics]) => ({
        source,
        ...metrics,
        errorRate: metrics.totalMessages > 0 ? metrics.errorCount / metrics.totalMessages : 0,
      })),
    };
  }

  /**
   * Reset metrics for a source
   */
  resetSource(source: VesselSource | AircraftSource) {
    this.vesselSourceMetrics.delete(source as VesselSource);
    this.aircraftSourceMetrics.delete(source as AircraftSource);
    this.logger.log(`Reset metrics for source ${source}`);
  }

  private getOrCreateVesselMetrics(source: VesselSource): SourceMetrics {
    if (!this.vesselSourceMetrics.has(source)) {
      this.vesselSourceMetrics.set(source, {
        totalMessages: 0,
        errorCount: 0,
        avgLatency: 0,
        completenessScore: 1.0,
        lastUpdate: Date.now(),
        demoted: false,
      });
    }
    return this.vesselSourceMetrics.get(source)!;
  }
}
