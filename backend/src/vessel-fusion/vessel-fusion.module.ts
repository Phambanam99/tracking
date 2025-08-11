import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { VesselFusionService } from './vessel-fusion.service';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [VesselFusionService],
  exports: [VesselFusionService],
})
export class VesselFusionModule {}


