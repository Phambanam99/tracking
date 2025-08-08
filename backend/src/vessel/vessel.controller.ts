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
import {
  CreateVesselDto,
  UpdateVesselDto,
  CreateVesselPositionDto,
  VesselHistoryQueryDto,
  VesselResponseDto,
} from './dto/vessel.dto';

@Controller('vessels')
export class VesselController {
  constructor(private readonly vesselService: VesselService) {}

  /**
   * Get all vessels with their last known positions
   */
  @Get('initial')
  async findAllWithLastPosition(): Promise<VesselResponseDto[]> {
    return this.vesselService.findAllWithLastPosition();
  }

  /**
   * Get vessel history by ID
   */
  @Get(':id/history')
  async findHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() queryDto: VesselHistoryQueryDto,
  ) {
    const fromDate =
      queryDto.from || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to last 24 hours

    const vessel = await this.vesselService.findHistory(id, fromDate);

    if (!vessel) {
      return { error: 'Vessel not found' };
    }

    return vessel;
  }

  /**
   * Create a new vessel
   */
  @Post()
  async create(
    @Body() createVesselDto: CreateVesselDto,
  ): Promise<VesselResponseDto> {
    return this.vesselService.create(createVesselDto);
  }

  /**
   * Update a vessel
   */
  @Put(':id')
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
  async delete(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.vesselService.delete(id);
    return { message: 'Vessel deleted successfully' };
  }

  /**
   * Add position data for a vessel
   */
  @Post('positions')
  async addPosition(@Body() createPositionDto: CreateVesselPositionDto) {
    return this.vesselService.addPositionWithDto(createPositionDto);
  }
}
