import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';

interface TrackItemDto {
  alias?: string;
  notes?: string;
}

@ApiTags('tracking')
@Controller('tracking')
@UseGuards(AuthGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  // Aircraft tracking endpoints
  @Post('aircraft/:id')
  @ApiOperation({ summary: 'Track an aircraft' })
  async trackAircraft(
    @Param('id') aircraftId: string,
    @Body() body: TrackItemDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      return await this.trackingService.trackAircraft(
        userId,
        parseInt(aircraftId),
        body.alias,
        body.notes,
      );
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation - already tracking
        throw new Error('Aircraft is already being tracked');
      }
      throw error;
    }
  }

  @Delete('aircraft/:id')
  @ApiOperation({ summary: 'Untrack an aircraft' })
  async untrackAircraft(@Param('id') aircraftId: string, @Request() req: any) {
    const userId = req.user.id;
    return this.trackingService.untrackAircraft(userId, parseInt(aircraftId));
  }

  @Get('aircraft/:id/status')
  @ApiOperation({ summary: 'Get aircraft tracking status' })
  async getAircraftTrackingStatus(@Param('id') aircraftId: string, @Request() req: any) {
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
  @ApiOperation({ summary: 'Track a vessel' })
  async trackVessel(
    @Param('id') vesselId: string,
    @Body() body: TrackItemDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return this.trackingService.trackVessel(userId, parseInt(vesselId), body.alias, body.notes);
  }

  @Delete('vessel/:id')
  @ApiOperation({ summary: 'Untrack a vessel' })
  async untrackVessel(@Param('id') vesselId: string, @Request() req: any) {
    const userId = req.user.id;
    return this.trackingService.untrackVessel(userId, parseInt(vesselId));
  }

  @Get('vessel/:id/status')
  @ApiOperation({ summary: 'Get vessel tracking status' })
  async getVesselTrackingStatus(@Param('id') vesselId: string, @Request() req: any) {
    const userId = req.user.id;
    const isTracking = await this.trackingService.isTracking(userId, 'vessel', parseInt(vesselId));
    return { isTracking };
  }

  // Combined tracking endpoints
  @Get()
  @ApiOperation({ summary: 'Get all tracked items' })
  async getAllTracked(@Request() req: any) {
    const userId = req.user.id;
    return this.trackingService.getAllTracked(userId);
  }

  @Get('aircrafts')
  @ApiOperation({ summary: 'Get tracked aircrafts' })
  async getTrackedAircrafts(@Request() req: any) {
    const userId = req.user.id;
    return this.trackingService.getTrackedAircrafts(userId);
  }

  @Get('vessels')
  @ApiOperation({ summary: 'Get tracked vessels' })
  async getTrackedVessels(@Request() req: any) {
    const userId = req.user.id;
    return this.trackingService.getTrackedVessels(userId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get tracking statistics' })
  async getTrackingStats(@Request() req: any) {
    const userId = req.user.id;
    return this.trackingService.getTrackingStats(userId);
  }
}
