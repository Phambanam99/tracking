// src/ais/ais.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { FusionModule } from '../fusion/fusion.module';
import { AisSignalrService } from './ais-signalr.service';
import { AisAistreamService } from './ais-aistream.service';
import { AisController } from './ais.controller';
import { AisOrchestratorService } from './ais-orchestrator.service';
import { BatchInsertService } from './batch-insert.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [PrismaModule, RedisModule, FusionModule, MetricsModule],
  providers: [AisSignalrService, AisAistreamService, AisOrchestratorService, BatchInsertService],
  controllers: [AisController],
  exports: [AisSignalrService, AisAistreamService, AisOrchestratorService, BatchInsertService],
})
export class AisModule {}
