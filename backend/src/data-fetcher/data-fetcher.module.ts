import { Module } from '@nestjs/common';
import { DataFetcherService } from './data-fetcher.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AircraftModule } from '../aircraft/aircraft.module';
import { VesselModule } from '../vessel/vessel.module';
import { RedisModule } from '../redis/redis.module';
import { FusionModule } from '../fusion/fusion.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AisModule } from '../ais/ais.module';
import { AisProvider } from './sources/ais.provider';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AircraftModule,
    VesselModule,
    RedisModule,
    FusionModule,
    AisModule,
  ],
  providers: [DataFetcherService, AisProvider],
  exports: [DataFetcherService],
})
export class DataFetcherModule {}
