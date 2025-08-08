import { Module, forwardRef } from '@nestjs/common';
import { VesselController } from './vessel.controller';
import { VesselService } from './vessel.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [PrismaModule, forwardRef(() => TrackingModule)],
  controllers: [VesselController],
  providers: [VesselService],
  exports: [VesselService],
})
export class VesselModule {}
