import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
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
import { AisModule } from './ais/ais.module';
import { MetricsModule } from './metrics/metrics.module';
import { ResilienceModule } from './resilience/resilience.module';
import { WeatherModule } from './weather/weather.module';
import { VesselEnrichmentModule } from './vessel-enrichment/vessel-enrichment.module';
import aisConfig from './config/ais.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000, // 60 seconds
          limit: 10, // 10 requests per 60 seconds globally
        },
      ],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          db: configService.get<number>('REDIS_DB', 0),
        },
      }),
      inject: [ConfigService],
    }),
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
    AisModule,
    MetricsModule,
    ResilienceModule,
    WeatherModule,
    VesselEnrichmentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
