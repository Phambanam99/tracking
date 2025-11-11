import { Module, forwardRef } from '@nestjs/common';
import { VesselController } from './vessel.controller';
import { VesselService } from './vessel.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TrackingModule } from '../tracking/tracking.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, forwardRef(() => TrackingModule), RedisModule, AuthModule],
  controllers: [VesselController],
  providers: [VesselService],
  exports: [VesselService],
})
export class VesselModule {}
