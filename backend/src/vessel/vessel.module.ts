import { Module } from '@nestjs/common';
import { VesselController } from './vessel.controller';
import { VesselService } from './vessel.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VesselController],
  providers: [VesselService],
  exports: [VesselService],
})
export class VesselModule {}
