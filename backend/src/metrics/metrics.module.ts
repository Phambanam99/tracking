import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { PerformanceService } from './performance.service';
import { PrometheusService } from './prometheus.service';
import { MetricsController } from './metrics.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [MetricsController],
  providers: [MetricsService, PerformanceService, PrometheusService],
  exports: [MetricsService, PerformanceService, PrometheusService],
})
export class MetricsModule {}
