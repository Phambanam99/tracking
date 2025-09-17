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
import { RedisService } from '../redis/redis.service';
import { ApiOperation, ApiTags, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
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
  constructor(
    private readonly aircraftService: AircraftService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get all aircraft with their last known positions
   */
  @Get('initial')
  @ApiOperation({
    summary: 'Get all aircrafts with last position (bbox/zoom, no pagination)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of aircrafts with last positions filtered by bbox/zoom',
    type: [AircraftResponseDto],
  })
  async findAllWithLastPosition(
    @Query('bbox') bbox?: string,
    @Query('zoom') zoom?: string,
    @Query('limit') limit?: string,
  ): Promise<AircraftResponseDto[]> {
    // bbox is "minLon,minLat,maxLon,maxLat"
    let parsedBbox: [number, number, number, number] | undefined;
    if (bbox) {
      const parts = bbox.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        parsedBbox = [parts[0], parts[1], parts[2], parts[3]];
      }
    }
    const z = zoom ? Number(zoom) : undefined;
    const lim = limit ? Number(limit) : undefined;
    return this.aircraftService.findAllWithLastPosition(parsedBbox, z, lim);
  }

  /**
   * Paginated list endpoint for aircrafts (for list pages)
   */
  @Get()
  @ApiOperation({ summary: 'Paginated list of aircrafts with last position' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-based)',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Items per page (max 5000)',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Search query',
  })
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('hasSignal') hasSignal?: string,
    @Query('operator') operator?: string,
    @Query('aircraftType') aircraftType?: string,
    @Query('registration') registration?: string,
    @Query('callSign') callSign?: string,
    @Query('minSpeed') minSpeed?: string,
    @Query('maxSpeed') maxSpeed?: string,
    @Query('minAltitude') minAltitude?: string,
    @Query('maxAltitude') maxAltitude?: string,
  ): Promise<{
    data: AircraftResponseDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const p = page ? Math.max(1, Number(page)) : 1;
    const ps = pageSize ? Math.min(Math.max(1, Number(pageSize)), 5000) : 1000;
    return this.aircraftService.findAllWithLastPositionPaginated(
      undefined,
      undefined,
      undefined,
      p,
      ps,
      q,
      typeof hasSignal === 'string'
        ? hasSignal === 'true'
          ? true
          : hasSignal === 'false'
            ? false
            : undefined
        : undefined,
      {
        operator,
        aircraftType,
        registration,
        callSign,
        minSpeed: minSpeed ? Number(minSpeed) : undefined,
        maxSpeed: maxSpeed ? Number(maxSpeed) : undefined,
        minAltitude: minAltitude ? Number(minAltitude) : undefined,
        maxAltitude: maxAltitude ? Number(maxAltitude) : undefined,
      },
    );
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
    const fromDate = queryDto.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const toDate = queryDto.to || new Date();
    const limit = queryDto.limit || 1000;
    const offset = (queryDto as any).offset ? Number((queryDto as any).offset) : 0;

    const aircraft = await this.aircraftService.findHistory(id, fromDate, toDate, limit, offset);

    if (!aircraft) {
      return { error: 'Aircraft not found' };
    }

    return aircraft;
  }

  /**
   * Get aircraft detail with last known position
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get aircraft detail with last position' })
  @ApiParam({ name: 'id', description: 'Aircraft ID', type: 'number' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const aircraft = await this.aircraftService.findByIdWithLastPosition(id);
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
  async create(@Body() createAircraftDto: CreateAircraftDto): Promise<AircraftResponseDto> {
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
  async delete(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
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

  /**
   * Get online aircraft (from Redis fused AIS if stored similarly or fallback to DB recent positions)
   * For now emulate structure similar to vessels online using ais:vessels:* keys filtered by an aircraft prefix if future separation needed.
   * Since fusion currently targets vessels, we provide a placeholder returning empty array to avoid 400 misuse.
   * Later can be wired to an `ais:aircraft:*` key namespace.
   */
  @Get('online')
  @ApiOperation({ summary: 'Get online aircraft (placeholder – not yet populated)' })
  @ApiQuery({ name: 'bbox', required: false, description: 'minLon,minLat,maxLon,maxLat' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max number (<=5000)' })
  @ApiQuery({
    name: 'stalenessSec',
    required: false,
    description: 'Max age seconds (default 3600)',
  })
  async getOnlineAircraft(
    @Query('bbox') bbox?: string,
    @Query('limit') limitStr?: string,
    @Query('stalenessSec') stalenessStr?: string,
  ) {
    // Placeholder until aircraft fusion implemented. Return structure consistent with vessels.
    let bboxNums: [number, number, number, number] | null = null;
    if (bbox) {
      const parts = bbox.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        bboxNums = [parts[0], parts[1], parts[2], parts[3]];
      }
    }
    const _limit = limitStr ? Math.min(5000, Math.max(1, Number(limitStr))) : 1000; // reserved for future use
    const stalenessSec = stalenessStr ? Math.max(10, Number(stalenessStr)) : 3600;
    return {
      count: 0,
      stalenessSec,
      bbox: bboxNums,
      data: [],
      note: 'Aircraft online feed not yet implemented',
    };
  }
}
