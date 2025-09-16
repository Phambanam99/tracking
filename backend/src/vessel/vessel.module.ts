import { Module, forwardRef } from '@nestjs/common';
import { VesselController } from './vessel.controller';
import { VesselService } from './vessel.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TrackingModule } from '../tracking/tracking.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, forwardRef(() => TrackingModule), RedisModule],
  controllers: [VesselController],
  providers: [VesselService],
  exports: [VesselService],
})
export class VesselModule {}
