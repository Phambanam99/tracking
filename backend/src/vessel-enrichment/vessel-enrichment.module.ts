import { Module } from '@nestjs/common';
import { VesselEnrichmentService } from './vessel-enrichment.service';
import { VesselEnrichmentQueueService } from './vessel-enrichment-queue.service';
import { VesselEnrichmentSchedulerService } from './vessel-enrichment-scheduler.service';
import { VesselEnrichmentController } from './vessel-enrichment.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MetricsModule } from '../metrics/metrics.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, MetricsModule, AuthModule],
  controllers: [VesselEnrichmentController],
  providers: [
    VesselEnrichmentService,
    VesselEnrichmentQueueService,
    VesselEnrichmentSchedulerService,
  ],
  exports: [VesselEnrichmentService, VesselEnrichmentQueueService],
})
export class VesselEnrichmentModule {}
