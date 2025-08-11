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
import { AircraftService } from './aircraft.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateAircraftDto,
  UpdateAircraftDto,
  CreateAircraftPositionDto,
  AircraftHistoryQueryDto,
  AircraftResponseDto,
} from './dto/aircraft.dto';

@ApiTags('aircrafts')
@Controller('aircrafts')
export class AircraftController {
  constructor(private readonly aircraftService: AircraftService) {}

  /**
   * Get all aircraft with their last known positions
   */
  @Get('initial')
  @ApiOperation({ summary: 'Get all aircrafts with last position' })
  async findAllWithLastPosition(): Promise<AircraftResponseDto[]> {
    return this.aircraftService.findAllWithLastPosition();
  }

  /**
   * Get aircraft history by ID
   */
  @Get(':id/history')
  @ApiOperation({ summary: 'Get aircraft history' })
  async findHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() queryDto: AircraftHistoryQueryDto,
  ) {
    const fromDate =
      queryDto.from || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to last 24 hours

    const aircraft = await this.aircraftService.findHistory(id, fromDate);

    if (!aircraft) {
      return { error: 'Aircraft not found' };
    }

    return aircraft;
  }

  /**
   * Create a new aircraft
   */
  @Post()
  @ApiOperation({ summary: 'Create a new aircraft' })
  async create(
    @Body() createAircraftDto: CreateAircraftDto,
  ): Promise<AircraftResponseDto> {
    return this.aircraftService.create(createAircraftDto);
  }

  /**
   * Update an aircraft
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update an aircraft' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAircraftDto: UpdateAircraftDto,
  ): Promise<AircraftResponseDto> {
    return this.aircraftService.update(id, updateAircraftDto);
  }

  /**
   * Delete an aircraft
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an aircraft' })
  async delete(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.aircraftService.delete(id);
    return { message: 'Aircraft deleted successfully' };
  }

  /**
   * Add position data for an aircraft
   */
  @Post('positions')
  @ApiOperation({ summary: 'Add aircraft position' })
  async addPosition(@Body() createPositionDto: CreateAircraftPositionDto) {
    return this.aircraftService.addPositionWithDto(createPositionDto);
  }
}
