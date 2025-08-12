import { Module } from '@nestjs/common';
import { DataFetcherService } from './data-fetcher.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AircraftModule } from '../aircraft/aircraft.module';
import { VesselModule } from '../vessel/vessel.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  // ScheduleModule.forRoot() is initialized in AppModule; do not call forRoot here
  imports: [PrismaModule, AircraftModule, VesselModule, RedisModule],
  providers: [DataFetcherService],
  exports: [DataFetcherService],
})
export class DataFetcherModule {}
