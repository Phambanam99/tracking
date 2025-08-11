import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { RegionService } from './region.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateRegionDto, UpdateRegionDto } from './dto/region.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@ApiTags('regions')
@Controller('regions')
@UseGuards(AuthGuard)
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a region' })
  async createRegion(@Request() req, @Body() createRegionDto: CreateRegionDto) {
    const result = this.regionService.createRegion(
      req.user.id,
      createRegionDto,
    );
    console.log(result);
    return result;
  }

  @Get()
  @ApiOperation({ summary: 'List user regions' })
  async getUserRegions(@Request() req: any) {
    return this.regionService.findUserRegions(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get region by id' })
  async getRegion(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.regionService.findRegionById(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update region' })
  async updateRegion(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRegionDto: UpdateRegionDto,
  ) {
    return this.regionService.updateRegion(id, req.user.id, updateRegionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete region' })
  async deleteRegion(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.regionService.deleteRegion(id, req.user.id);
  }

  @Get('alerts/list')
  @ApiOperation({ summary: 'List user alerts' })
  async getUserAlerts(
    @Request() req: any,
    @Query('unread') unreadOnly?: string,
  ) {
    return this.regionService.getUserAlerts(req.user.id, unreadOnly === 'true');
  }

  @Put('alerts/:id/read')
  @ApiOperation({ summary: 'Mark alert as read' })
  async markAlertAsRead(
    @Request() req: any,
    @Param('id', ParseIntPipe) alertId: number,
  ) {
    return this.regionService.markAlertAsRead(alertId, req.user.id);
  }

  @Put('alerts/read-all')
  @ApiOperation({ summary: 'Mark all alerts as read' })
  async markAllAlertsAsRead(@Request() req: any) {
    return this.regionService.markAllAlertsAsRead(req.user.id);
  }
}
