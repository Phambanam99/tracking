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
  UseGuards,
  Req,
} from '@nestjs/common';
import { AircraftService } from './aircraft.service';
import { RedisService } from '../redis/redis.service';
import {
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, UserRole } from '../auth/decorators/roles.decorator';
import {
  CreateAircraftDto,
  UpdateAircraftDto,
  CreateAircraftPositionDto,
  AircraftHistoryQueryDto,
  AircraftResponseDto,
  CreateAircraftImageDto,
  UpdateAircraftImageDto,
  OnlineAircraftQueryDto,
} from './dto/aircraft.dto';
import { AircraftEditHistoryDto } from './dto/aircraft-edit-history.dto';
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

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
    @Query() queryDto: OnlineAircraftQueryDto,
  ): Promise<AircraftResponseDto[]> {
    // bbox is "minLon,minLat,maxLon,maxLat"
    let parsedBbox: [number, number, number, number] | undefined;
    if (queryDto.bbox) {
      const parts = queryDto.bbox.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        parsedBbox = [parts[0], parts[1], parts[2], parts[3]];
      }
    }
    const z = queryDto.zoom;
    const lim = queryDto.limit;
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

    let aircraft = await this.aircraftService.findHistory(id, fromDate, toDate, limit, offset);

    // If not found by ID, try finding by flightId (similar to GET /:id endpoint)
    if (!aircraft) {
      aircraft = await this.aircraftService.findHistoryByFlightId(
        String(id),
        fromDate,
        toDate,
        limit,
        offset,
      );
    }

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
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('bearer')
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
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('bearer')
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
    @Req() req: any,
  ): Promise<AircraftResponseDto> {
    const updated = await this.aircraftService.update(id, updateAircraftDto);

    // Record edit history
    if (req.user?.id) {
      const changes: Record<string, any> = {};
      Object.entries(updateAircraftDto).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          changes[key] = value;
        }
      });
      if (Object.keys(changes).length > 0) {
        await this.aircraftService.recordEdit(id, req.user.id, changes).catch(() => {
          // Silently fail edit history recording
        });
      }
    }

    return updated;
  }

  /**
   * Delete an aircraft
   */
  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('bearer')
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
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Add aircraft position' })
  @ApiResponse({ status: 201, description: 'Position added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Aircraft not found' })
  async addPosition(@Body() createPositionDto: CreateAircraftPositionDto) {
    return this.aircraftService.addPositionWithDto(createPositionDto);
  }

  // -------------------- IMAGES CRUD --------------------
  @Get(':id/images')
  @ApiOperation({ summary: 'List aircraft images' })
  async listImages(@Param('id', ParseIntPipe) id: number) {
    return this.aircraftService.listImages(id);
  }

  @Post(':id/images')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Add aircraft image' })
  async addImage(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateAircraftImageDto) {
    return this.aircraftService.addImage(id, dto);
  }

  @Put('images/:imageId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update aircraft image' })
  async updateImage(
    @Param('imageId', ParseIntPipe) imageId: number,
    @Body() dto: UpdateAircraftImageDto,
  ) {
    return this.aircraftService.updateImage(imageId, dto);
  }

  @Delete('images/:imageId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Delete aircraft image' })
  async deleteImage(@Param('imageId', ParseIntPipe) imageId: number) {
    await this.aircraftService.deleteImage(imageId);
    return { message: 'Deleted' };
  }

  @Post(':id/images/upload')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('bearer')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, 'uploads'),
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload aircraft image file' })
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: any,
    @Body() dto: CreateAircraftImageDto,
  ) {
    if (!file) return { error: 'No file uploaded' };
    const base = process.env.PUBLIC_BASE_URL || '';
    const url = base + '/uploads/' + file.filename;
    return this.aircraftService.addImage(id, { ...dto, url });
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
  @ApiQuery({ name: 'limit', required: false, description: 'Max number of aircraft (<=5000)' })
  @ApiQuery({
    name: 'stalenessSec',
    required: false,
    description: 'Max age in seconds (default 3600)',
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

    const limit = limitStr ? Math.max(1, Math.min(5000, parseInt(limitStr, 10))) : 1000;
    const stalenessSec = stalenessStr ? Math.max(10, parseInt(stalenessStr, 10)) : 3600;

    return {
      count: 0,
      stalenessSec,
      bbox: bboxNums,
      data: [],
      note: 'Aircraft online feed not yet implemented',
    };
  }

  /**
   * Get edit history for an aircraft
   */
  @Get(':id/edit-history')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get aircraft edit history' })
  @ApiParam({ name: 'id', description: 'Aircraft ID', type: 'number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset' })
  @ApiResponse({ status: 200, description: 'Edit history' })
  async getEditHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.aircraftService.getEditHistory(
      id,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }
}
