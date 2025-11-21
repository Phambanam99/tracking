import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { RedisModule } from '../redis/redis.module';
import { AircraftModule } from '../aircraft/aircraft.module';
import { VesselModule } from '../vessel/vessel.module';
import { TrackingModule } from '../tracking/tracking.module';
import { ViewportManager } from './viewport.manager';
import { WsAuthGuard } from './ws-auth.guard';
import { TrackingService } from './tracking.service'; // Import mới

@Module({
  imports: [RedisModule, AircraftModule, VesselModule, TrackingModule],
  providers: [
    EventsGateway,
    ViewportManager,
    WsAuthGuard,
    TrackingService, // ✅ THÊM DÒNG NÀY
  ],
  exports: [EventsGateway],
})
export class EventsModule {}
