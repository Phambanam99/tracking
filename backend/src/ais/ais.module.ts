// src/ais/ais.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AisSignalrService } from './ais-signalr.service';
import { AisController } from './ais.controller';
import { AisFusionService } from './ais-fusion.service';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [AisSignalrService, AisFusionService],
  controllers: [AisController],
  exports: [AisSignalrService, AisFusionService],
})
export class AisModule {}
