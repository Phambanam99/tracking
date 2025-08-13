import { Module } from '@nestjs/common';
import { VesselFusionService } from './vessel-fusion.service';
import { AircraftFusionService } from './aircraft-fusion.service';
import { LastPublishedService } from './last-published.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [VesselFusionService, AircraftFusionService, LastPublishedService],
  exports: [VesselFusionService, AircraftFusionService, LastPublishedService],
})
export class FusionModule {}
