import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DataFetcherService } from './data-fetcher.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AircraftModule } from '../aircraft/aircraft.module';
import { VesselModule } from '../vessel/vessel.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, AircraftModule, VesselModule, RedisModule],
  providers: [DataFetcherService],
  exports: [DataFetcherService],
})
export class DataFetcherModule {}
