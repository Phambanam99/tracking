import { Injectable, Logger } from '@nestjs/common';
import { NormVesselMsg, VesselSource } from './types';

export interface ConflictEvent {
  field: string;
  mmsi?: string;
  sources: string[];
  values: number[];
  timestamps: string[];
  maxDiff: number;
  percentageDiff: number;
  detectedAt: Date;
}

export interface ConflictMetrics {
  totalConflicts: number;
  conflictsByField: Record<string, number>;
  conflictsBySource: Record<string, number>;
  averageSpeedDiff: number;
  maxSpeedDiff: number;
  lastConflictAt?: Date;
}

@Injectable()
export class ConflictMonitorService {
  private readonly logger = new Logger(ConflictMonitorService.name);
  private readonly metrics: ConflictMetrics = {
    totalConflicts: 0,
    conflictsByField: {},
    conflictsBySource: {},
    averageSpeedDiff: 0,
    maxSpeedDiff: 0,
  };

  private readonly recentConflicts: ConflictEvent[] = [];
  private readonly MAX_RECENT_CONFLICTS = 100;

  /**
   * Record a conflict event
   */
  recordConflict(
    field: string,
    candidates: Array<{ source: string; value: any; timestamp: number }>,
    mmsi?: string,
  ): void {
    if (candidates.length < 2) return;

    // Extract numeric values for calculation
    const numericCandidates = candidates
      .filter((c) => typeof c.value === 'number' && c.value > 0)
      .map((c) => ({ ...c, value: c.value as number }));

    if (numericCandidates.length < 2) return;

    const values = numericCandidates.map((c) => c.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const maxDiff = max - min;
    const percentageDiff = max > 0 ? (maxDiff / max) * 100 : 0;

    // Only record significant conflicts (> 30% difference)
    if (percentageDiff < 30) return;

    const conflict: ConflictEvent = {
      field,
      mmsi,
      sources: numericCandidates.map((c) => c.source),
      values,
      timestamps: numericCandidates.map((c) => new Date(c.timestamp).toISOString()),
      maxDiff,
      percentageDiff,
      detectedAt: new Date(),
    };

    // Update metrics
    this.updateMetrics(conflict);

    // Store recent conflict
    this.recentConflicts.push(conflict);
    if (this.recentConflicts.length > this.MAX_RECENT_CONFLICTS) {
      this.recentConflicts.shift();
    }

    // Log with detailed information
    this.logConflict(conflict);

    // Check for alerting conditions
    this.checkAlertConditions(conflict);
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(conflict: ConflictEvent): void {
    this.metrics.totalConflicts++;
    this.metrics.lastConflictAt = conflict.detectedAt;

    // Update by field
    this.metrics.conflictsByField[conflict.field] =
      (this.metrics.conflictsByField[conflict.field] || 0) + 1;

    // Update by source
    conflict.sources.forEach((source) => {
      this.metrics.conflictsBySource[source] = (this.metrics.conflictsBySource[source] || 0) + 1;
    });

    // Update speed-specific metrics
    if (conflict.field === 'speed') {
      this.metrics.maxSpeedDiff = Math.max(this.metrics.maxSpeedDiff, conflict.maxDiff);

      // Calculate running average
      const totalSpeedConflicts = Object.entries(this.metrics.conflictsByField).reduce(
        (sum, [field, count]) => (field === 'speed' ? sum + count : sum),
        0,
      );

      if (totalSpeedConflicts === 1) {
        this.metrics.averageSpeedDiff = conflict.maxDiff;
      } else {
        this.metrics.averageSpeedDiff =
          (this.metrics.averageSpeedDiff * (totalSpeedConflicts - 1) + conflict.maxDiff) /
          totalSpeedConflicts;
      }
    }
  }

  /**
   * Log conflict with detailed information
   */
  private logConflict(conflict: ConflictEvent): void {
    const vesselInfo = conflict.mmsi ? `MMSI ${conflict.mmsi}` : 'Unknown vessel';

    this.logger.warn(
      `🔥 DATA CONFLICT DETECTED\n` +
        `   Field: ${conflict.field}\n` +
        `   Vessel: ${vesselInfo}\n` +
        `   Sources: ${conflict.sources.join(', ')}\n` +
        `   Values: ${conflict.values.map((v) => v.toFixed(2)).join(', ')}\n` +
        `   Max Difference: ${conflict.maxDiff.toFixed(2)} (${conflict.percentageDiff.toFixed(1)}%)\n` +
        `   Timestamps: ${conflict.timestamps.map((t) => new Date(t).toLocaleTimeString()).join(', ')}\n` +
        `   Detected: ${conflict.detectedAt.toISOString()}`,
    );

    // Special handling for speed conflicts
    if (conflict.field === 'speed') {
      this.analyzeSpeedConflict(conflict);
    }
  }

  /**
   * Special analysis for speed conflicts
   */
  private analyzeSpeedConflict(conflict: ConflictEvent): void {
    const signalrValues = conflict.sources
      .map((source, index) => (source === 'signalr' ? conflict.values[index] : null))
      .filter((v) => v !== null) as number[];

    const aisstreamValues = conflict.sources
      .map((source, index) => (source === 'aisstream.io' ? conflict.values[index] : null))
      .filter((v) => v !== null) as number[];

    if (signalrValues.length > 0 && aisstreamValues.length > 0) {
      const avgSignalr = signalrValues.reduce((a, b) => a + b, 0) / signalrValues.length;
      const avgAisstream = aisstreamValues.reduce((a, b) => a + b, 0) / aisstreamValues.length;

      // Check if this looks like a unit conversion issue
      const ratio = avgAisstream / avgSignalr;

      if (ratio > 1.8 && ratio < 2.2) {
        this.logger.warn(
          `⚠️  SPEED CONFLICT LIKELY UNIT MISMATCH\n` +
            `   SignalR avg: ${avgSignalr.toFixed(2)} (likely m/s)\n` +
            `   AISStream avg: ${avgAisstream.toFixed(2)} (likely knots)\n` +
            `   Ratio: ${ratio.toFixed(2)} (expected ~1.94 for m/s→knots)\n` +
            `   RECOMMENDATION: Verify SignalR speed units`,
        );
      }
    }
  }

  /**
   * Check for alerting conditions
   */
  private checkAlertConditions(conflict: ConflictEvent): void {
    // Alert on high frequency conflicts for same vessel
    if (conflict.mmsi) {
      const recentVesselConflicts = this.recentConflicts
        .filter((c) => c.mmsi === conflict.mmsi)
        .filter(
          (c) => conflict.detectedAt.getTime() - c.detectedAt.getTime() < 5 * 60 * 1000, // 5 minutes
        );

      if (recentVesselConflicts.length >= 3) {
        this.logger.error(
          `🚨 HIGH FREQUENCY CONFLICT ALERT\n` +
            `   Vessel ${conflict.mmsi} has ${recentVesselConflicts.length} conflicts in 5 minutes\n` +
            `   RECOMMENDATION: Investigate data source quality for this vessel`,
        );
      }
    }

    // Alert on extreme speed differences
    if (conflict.field === 'speed' && conflict.percentageDiff > 200) {
      this.logger.error(
        `🚨 EXTREME SPEED DIFFERENCE ALERT\n` +
          `   Speed difference: ${conflict.percentageDiff.toFixed(1)}%\n` +
          `   Values: ${conflict.values.map((v) => v.toFixed(2)).join(' vs ')}\n` +
          `   RECOMMENDATION: Immediate investigation required`,
      );
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): ConflictMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent conflicts
   */
  getRecentConflicts(limit: number = 20): ConflictEvent[] {
    return this.recentConflicts.slice(-limit);
  }

  /**
   * Get conflicts by time range
   */
  getConflictsByTimeRange(startTime: Date, endTime: Date): ConflictEvent[] {
    return this.recentConflicts.filter(
      (conflict) => conflict.detectedAt >= startTime && conflict.detectedAt <= endTime,
    );
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics.totalConflicts = 0;
    this.metrics.conflictsByField = {};
    this.metrics.conflictsBySource = {};
    this.metrics.averageSpeedDiff = 0;
    this.metrics.maxSpeedDiff = 0;
    this.metrics.lastConflictAt = undefined;
    this.recentConflicts.length = 0;

    this.logger.log('📊 Conflict metrics reset');
  }

  /**
   * Generate summary report
   */
  generateSummaryReport(): string {
    const topFields = Object.entries(this.metrics.conflictsByField)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const topSources = Object.entries(this.metrics.conflictsBySource)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return `
📊 CONFLICT MONITORING REPORT
============================
Total Conflicts: ${this.metrics.totalConflicts}
Last Conflict: ${this.metrics.lastConflictAt?.toISOString() || 'None'}

Top Conflict Fields:
${topFields.map(([field, count]) => `  ${field}: ${count}`).join('\n')}

Top Conflict Sources:
${topSources.map(([source, count]) => `  ${source}: ${count}`).join('\n')}

Speed Conflicts:
  Average Difference: ${this.metrics.averageSpeedDiff.toFixed(2)} knots
  Max Difference: ${this.metrics.maxSpeedDiff.toFixed(2)} knots

Recent Conflicts (Last 10):
${this.getRecentConflicts(10)
  .map((c) => `  ${c.detectedAt.toISOString()} - ${c.field}: ${c.percentageDiff.toFixed(1)}%`)
  .join('\n')}
    `.trim();
  }
}
