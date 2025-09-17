import { Module, forwardRef } from '@nestjs/common';
import { AircraftController } from './aircraft.controller';
import { AircraftService } from './aircraft.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TrackingModule } from '../tracking/tracking.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, forwardRef(() => TrackingModule), RedisModule],
  controllers: [AircraftController],
  providers: [AircraftService],
  exports: [AircraftService],
})
export class AircraftModule {}
