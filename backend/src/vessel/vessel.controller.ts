import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { VesselService } from './vessel.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateVesselDto,
  UpdateVesselDto,
  CreateVesselPositionDto,
  VesselHistoryQueryDto,
  VesselResponseDto,
} from './dto/vessel.dto';

@ApiTags('vessels')
@Controller('vessels')
export class VesselController {
  constructor(private readonly vesselService: VesselService) {}

  /**
   * Get all vessels with their last known positions
   */
  @Get('initial')
  @ApiOperation({ summary: 'Get all vessels with last position' })
  async findAllWithLastPosition(@Query('bbox') bbox?: string): Promise<VesselResponseDto[]> {
    let parsedBbox: [number, number, number, number] | undefined;
    if (bbox) {
      const parts = bbox.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        parsedBbox = [parts[0], parts[1], parts[2], parts[3]];
      }
    }
    return this.vesselService.findAllWithLastPosition(parsedBbox);
  }

  /**
   * Get vessel history by ID
   */
  @Get(':id/history')
  @ApiOperation({ summary: 'Get vessel history' })
  async findHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() queryDto: VesselHistoryQueryDto,
  ) {
    const fromDate = queryDto.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const toDate = queryDto.to || new Date();
    const limit = queryDto.limit || 1000;
    const offset = (queryDto as any).offset ? Number((queryDto as any).offset) : 0;

    const vessel = await this.vesselService.findHistory(id, fromDate, toDate, limit, offset);

    if (!vessel) {
      return { error: 'Vessel not found' };
    }

    return vessel;
  }

  /**
   * Create a new vessel
   */
  @Post()
  @ApiOperation({ summary: 'Create a new vessel' })
  async create(@Body() createVesselDto: CreateVesselDto): Promise<VesselResponseDto> {
    return this.vesselService.create(createVesselDto);
  }

  /**
   * Update a vessel
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update a vessel' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateVesselDto: UpdateVesselDto,
  ): Promise<VesselResponseDto> {
    return this.vesselService.update(id, updateVesselDto);
  }

  /**
   * Delete a vessel
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a vessel' })
  async delete(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.vesselService.delete(id);
    return { message: 'Vessel deleted successfully' };
  }

  /**
   * Add position data for a vessel
   */
  @Post('positions')
  @ApiOperation({ summary: 'Add vessel position' })
  async addPosition(@Body() createPositionDto: CreateVesselPositionDto) {
    return this.vesselService.addPositionWithDto(createPositionDto);
  }
}
