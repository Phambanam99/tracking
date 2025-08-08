import { Module } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RegionModule } from '../region/region.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, AuthModule, RegionModule, RedisModule],
  controllers: [TrackingController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
