import { Module } from '@nestjs/common';
import { AircraftController } from './aircraft.controller';
import { AircraftService } from './aircraft.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AircraftController],
  providers: [AircraftService],
  exports: [AircraftService],
})
export class AircraftModule {}
