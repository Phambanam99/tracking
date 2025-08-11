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
import {
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
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
  @ApiResponse({
    status: 200,
    description: 'List of all aircrafts with their last positions',
    type: [AircraftResponseDto],
  })
  async findAllWithLastPosition(): Promise<AircraftResponseDto[]> {
    return this.aircraftService.findAllWithLastPosition();
  }

  /**
   * Get aircraft history by ID
   */
  @Get(':id/history')
  @ApiOperation({ summary: 'Get aircraft history' })
  @ApiParam({ name: 'id', description: 'Aircraft ID', type: 'number' })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date',
    type: Date,
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'End date',
    type: Date,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum records',
    type: Number,
  })
  @ApiResponse({ status: 200, description: 'Aircraft history data' })
  @ApiResponse({ status: 404, description: 'Aircraft not found' })
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
  @ApiResponse({
    status: 201,
    description: 'Aircraft created successfully',
    type: AircraftResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
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
  @ApiParam({ name: 'id', description: 'Aircraft ID', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Aircraft updated successfully',
    type: AircraftResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Aircraft not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
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
  @ApiParam({ name: 'id', description: 'Aircraft ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Aircraft deleted successfully' })
  @ApiResponse({ status: 404, description: 'Aircraft not found' })
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
  @ApiResponse({ status: 201, description: 'Position added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Aircraft not found' })
  async addPosition(@Body() createPositionDto: CreateAircraftPositionDto) {
    return this.aircraftService.addPositionWithDto(createPositionDto);
  }
}
