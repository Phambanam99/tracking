import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AircraftModule } from './aircraft/aircraft.module';
import { VesselModule } from './vessel/vessel.module';
import { DataFetcherModule } from './data-fetcher/data-fetcher.module';
import { RedisModule } from './redis/redis.module';
import { EventsModule } from './events/events.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { TrackingModule } from './tracking/tracking.module';
import { RegionModule } from './region/region.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AircraftModule,
    VesselModule,
    DataFetcherModule,
    RedisModule,
    EventsModule,
    UserModule,
    AuthModule,
    TrackingModule,
    RegionModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
