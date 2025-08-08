import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { AuthGuard } from '../auth/guards/auth.guard';

interface TrackItemDto {
  alias?: string;
  notes?: string;
}

@Controller('tracking')
@UseGuards(AuthGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  // Aircraft tracking endpoints
  @Post('aircraft/:id')
  async trackAircraft(
    @Param('id') aircraftId: string,
    @Body() body: TrackItemDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return this.trackingService.trackAircraft(
      userId,
      parseInt(aircraftId),
      body.alias,
      body.notes,
    );
  }

  @Delete('aircraft/:id')
  async untrackAircraft(@Param('id') aircraftId: string, @Request() req: any) {
    const userId = req.user.id;
    return this.trackingService.untrackAircraft(userId, parseInt(aircraftId));
  }

  @Get('aircraft/:id/status')
  async getAircraftTrackingStatus(
    @Param('id') aircraftId: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const isTracking = await this.trackingService.isTracking(
      userId,
      'aircraft',
      parseInt(aircraftId),
    );
    return { isTracking };
  }

  // Vessel tracking endpoints
  @Post('vessel/:id')
  async trackVessel(
    @Param('id') vesselId: string,
    @Body() body: TrackItemDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return this.trackingService.trackVessel(
      userId,
      parseInt(vesselId),
      body.alias,
      body.notes,
    );
  }

  @Delete('vessel/:id')
  async untrackVessel(@Param('id') vesselId: string, @Request() req: any) {
    const userId = req.user.id;
    return this.trackingService.untrackVessel(userId, parseInt(vesselId));
  }

  @Get('vessel/:id/status')
  async getVesselTrackingStatus(
    @Param('id') vesselId: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const isTracking = await this.trackingService.isTracking(
      userId,
      'vessel',
      parseInt(vesselId),
    );
    return { isTracking };
  }

  // Combined tracking endpoints
  @Get()
  async getAllTracked(@Request() req: any) {
    const userId = req.user.id;
    return this.trackingService.getAllTracked(userId);
  }

  @Get('aircrafts')
  async getTrackedAircrafts(@Request() req: any) {
    const userId = req.user.id;
    return this.trackingService.getTrackedAircrafts(userId);
  }

  @Get('vessels')
  async getTrackedVessels(@Request() req: any) {
    const userId = req.user.id;
    return this.trackingService.getTrackedVessels(userId);
  }

  @Get('stats')
  async getTrackingStats(@Request() req: any) {
    const userId = req.user.id;
    return this.trackingService.getTrackingStats(userId);
  }
}
