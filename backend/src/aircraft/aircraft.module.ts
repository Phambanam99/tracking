import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AircraftController } from './aircraft.controller';
import { AircraftService } from './aircraft.service';
import { AdsbService } from './adsb.service';
import { AdsbCollectorService } from './adsb-collector.service';
import { AdsbProcessingProcessor } from './adsb-processing.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { TrackingModule } from '../tracking/tracking.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => TrackingModule),
    RedisModule,
    AuthModule,
    BullModule.registerQueue({
      name: 'adsb-processing',
    }),
  ],
  controllers: [AircraftController],
  providers: [AircraftService, AdsbService, AdsbCollectorService, AdsbProcessingProcessor],
  exports: [AircraftService, AdsbService],
})
export class AircraftModule {}
