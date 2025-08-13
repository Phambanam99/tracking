// src/ais/ais.module.ts
import { Module } from '@nestjs/common';
import { AisSignalrService } from './ais-signalr.service';
import { AisController } from './ais.controller';

@Module({
  providers: [AisSignalrService],
  controllers: [AisController],
  exports: [AisSignalrService],
})
export class AisModule {}
