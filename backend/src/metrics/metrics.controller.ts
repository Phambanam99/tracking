import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MetricsService, MetricsSnapshot } from './metrics.service';
import { PerformanceService } from './performance.service';
import { PrometheusService } from './prometheus.service';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly performanceService: PerformanceService,
    private readonly prometheusService: PrometheusService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current system metrics' })
  async getMetrics(): Promise<MetricsSnapshot> {
    return this.metricsService.getCurrentMetrics();
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Get detailed metrics with top entities' })
  async getDetailedMetrics() {
    return this.metricsService.getDetailedMetrics();
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get performance metrics (throughput, latency, etc)' })
  async getPerformanceMetrics() {
    return this.performanceService.getMetrics();
  }

  @Get('performance/latencies')
  @ApiOperation({ summary: 'Get latency percentiles (p50, p95, p99)' })
  async getLatencyPercentiles() {
    return this.performanceService.getLatencyPercentiles();
  }

  @Get('prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOperation({ summary: 'Get metrics in Prometheus format' })
  async getPrometheusMetrics(): Promise<string> {
    return this.prometheusService.exportPrometheusFormat();
  }

  @Get('prometheus/summary')
  @ApiOperation({ summary: 'Get Prometheus metrics summary (JSON)' })
  async getPrometheusSummary() {
    return this.prometheusService.getSummary();
  }
}
