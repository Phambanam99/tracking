import { Module } from '@nestjs/common';
import { VesselFusionService } from './vessel-fusion.service';
import { AircraftFusionService } from './aircraft-fusion.service';
import { LastPublishedService } from './last-published.service';
import { DataValidationService } from './data-validation.service';
import { ConflictMonitorService } from './conflict-monitor.service';
import { ConflictMonitorController } from './conflict-monitor.controller';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [
    VesselFusionService,
    AircraftFusionService,
    LastPublishedService,
    DataValidationService,
    ConflictMonitorService,
    ConflictMonitorController,
  ],
  exports: [
    VesselFusionService,
    AircraftFusionService,
    LastPublishedService,
    DataValidationService,
    ConflictMonitorService,
  ],
  controllers: [ConflictMonitorController],
})
export class FusionModule {}
