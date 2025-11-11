import { Injectable, Logger } from '@nestjs/common';

/**
 * Prometheus Metrics Service
 *
 * Exports metrics in Prometheus format for monitoring:
 * - Throughput (messages/sec)
 * - Latency (p50, p95, p99)
 * - Error rates
 * - Circuit breaker states
 * - DLQ sizes
 *
 * Performance Impact:
 * - Real-time observability
 * - Proactive alerting
 * - Performance trend analysis
 */

export interface PrometheusMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  value: number | Record<string, number>;
  labels?: Record<string, string>;
}

@Injectable()
export class PrometheusService {
  private readonly logger = new Logger(PrometheusService.name);

  // Counters
  private messagesProcessed = 0;
  private messagesFailedRedis = 0;
  private messagesFailedDB = 0;
  private circuitBreakerTrips = 0;

  // Gauges
  private activeConnections = 0;
  private dlqSize = 0;
  private circuitBreakerStates: Record<string, string> = {};

  // Histograms (latency buckets)
  private latencyBuckets: number[] = [];
  private readonly maxBucketSize = 1000;

  /**
   * Increment messages processed counter
   */
  incrementMessagesProcessed(count: number = 1): void {
    this.messagesProcessed += count;
  }

  /**
   * Increment Redis failure counter
   */
  incrementRedisFailures(count: number = 1): void {
    this.messagesFailedRedis += count;
  }

  /**
   * Increment DB failure counter
   */
  incrementDBFailures(count: number = 1): void {
    this.messagesFailedDB += count;
  }

  /**
   * Increment circuit breaker trip counter
   */
  incrementCircuitBreakerTrips(name: string): void {
    this.circuitBreakerTrips++;
    this.logger.warn(`Circuit breaker tripped: ${name}`);
  }

  /**
   * Record latency measurement
   */
  recordLatency(latencyMs: number): void {
    this.latencyBuckets.push(latencyMs);

    // Keep only recent measurements
    if (this.latencyBuckets.length > this.maxBucketSize) {
      this.latencyBuckets.shift();
    }
  }

  /**
   * Set active connections gauge
   */
  setActiveConnections(count: number): void {
    this.activeConnections = count;
  }

  /**
   * Set DLQ size gauge
   */
  setDLQSize(size: number): void {
    this.dlqSize = size;
  }

  /**
   * Set circuit breaker state
   */
  setCircuitBreakerState(name: string, state: string): void {
    this.circuitBreakerStates[name] = state;
  }

  /**
   * Calculate latency percentiles
   */
  private calculatePercentile(percentile: number): number {
    if (this.latencyBuckets.length === 0) return 0;

    const sorted = [...this.latencyBuckets].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Get all metrics
   */
  getMetrics(): PrometheusMetric[] {
    const metrics: PrometheusMetric[] = [
      // Counters
      {
        name: 'ais_messages_processed_total',
        type: 'counter',
        help: 'Total number of AIS messages processed',
        value: this.messagesProcessed,
      },
      {
        name: 'ais_messages_failed_redis_total',
        type: 'counter',
        help: 'Total number of Redis persistence failures',
        value: this.messagesFailedRedis,
      },
      {
        name: 'ais_messages_failed_db_total',
        type: 'counter',
        help: 'Total number of database persistence failures',
        value: this.messagesFailedDB,
      },
      {
        name: 'circuit_breaker_trips_total',
        type: 'counter',
        help: 'Total number of circuit breaker trips',
        value: this.circuitBreakerTrips,
      },

      // Gauges
      {
        name: 'ais_active_connections',
        type: 'gauge',
        help: 'Current number of active connections',
        value: this.activeConnections,
      },
      {
        name: 'ais_dlq_size',
        type: 'gauge',
        help: 'Current size of dead letter queue',
        value: this.dlqSize,
      },

      // Latency percentiles
      {
        name: 'ais_latency_p50_ms',
        type: 'gauge',
        help: 'Latency 50th percentile in milliseconds',
        value: this.calculatePercentile(50),
      },
      {
        name: 'ais_latency_p95_ms',
        type: 'gauge',
        help: 'Latency 95th percentile in milliseconds',
        value: this.calculatePercentile(95),
      },
      {
        name: 'ais_latency_p99_ms',
        type: 'gauge',
        help: 'Latency 99th percentile in milliseconds',
        value: this.calculatePercentile(99),
      },
    ];

    // Add circuit breaker state metrics
    for (const [name, state] of Object.entries(this.circuitBreakerStates)) {
      metrics.push({
        name: 'circuit_breaker_state',
        type: 'gauge',
        help: 'Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
        value: state === 'CLOSED' ? 0 : state === 'HALF_OPEN' ? 1 : 2,
        labels: { name },
      });
    }

    return metrics;
  }

  /**
   * Export metrics in Prometheus text format
   */
  exportPrometheusFormat(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];

    for (const metric of metrics) {
      // Add HELP line
      lines.push(`# HELP ${metric.name} ${metric.help}`);

      // Add TYPE line
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      // Add metric value(s)
      if (typeof metric.value === 'number') {
        const labels = metric.labels
          ? `{${Object.entries(metric.labels)
              .map(([k, v]) => `${k}="${v}"`)
              .join(',')}}`
          : '';
        lines.push(`${metric.name}${labels} ${metric.value}`);
      } else {
        // Handle multiple values (e.g., histogram buckets)
        for (const [label, value] of Object.entries(metric.value)) {
          lines.push(`${metric.name}{${label}} ${value}`);
        }
      }

      lines.push(''); // Empty line between metrics
    }

    return lines.join('\n');
  }

  /**
   * Get metrics summary
   */
  getSummary() {
    return {
      processed: this.messagesProcessed,
      failures: {
        redis: this.messagesFailedRedis,
        db: this.messagesFailedDB,
        total: this.messagesFailedRedis + this.messagesFailedDB,
      },
      latency: {
        p50: this.calculatePercentile(50),
        p95: this.calculatePercentile(95),
        p99: this.calculatePercentile(99),
      },
      circuitBreakers: {
        trips: this.circuitBreakerTrips,
        states: this.circuitBreakerStates,
      },
      dlq: {
        size: this.dlqSize,
      },
      connections: {
        active: this.activeConnections,
      },
    };
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.messagesProcessed = 0;
    this.messagesFailedRedis = 0;
    this.messagesFailedDB = 0;
    this.circuitBreakerTrips = 0;
    this.activeConnections = 0;
    this.dlqSize = 0;
    this.circuitBreakerStates = {};
    this.latencyBuckets = [];
    this.logger.log('Metrics reset');
  }
}
