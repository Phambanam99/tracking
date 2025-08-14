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
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(
    private readonly vesselService: VesselService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get all vessels with their last known positions
   */
  @Get('initial')
  @ApiOperation({
    summary: 'Get all vessels with last position (bbox/zoom, no pagination)',
  })
  async findAllWithLastPosition(
    @Query('bbox') bbox?: string,
    @Query('zoom') zoom?: string,
    @Query('limit') limit?: string,
  ): Promise<VesselResponseDto[]> {
    let parsedBbox: [number, number, number, number] | undefined;
    if (bbox) {
      const parts = bbox.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        parsedBbox = [parts[0], parts[1], parts[2], parts[3]];
      }
    }
    const z = zoom ? Number(zoom) : undefined;
    const lim = limit ? Number(limit) : undefined;
    return this.vesselService.findAllWithLastPosition(parsedBbox, z, lim);
  }

  /**
   * Paginated list endpoint for vessels (for list pages)
   */
  @Get()
  @ApiOperation({ summary: 'Paginated list of vessels with last position' })
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('hasSignal') hasSignal?: string,
    @Query('operator') operator?: string,
    @Query('vesselType') vesselType?: string,
    @Query('flag') flag?: string,
    @Query('minSpeed') minSpeed?: string,
    @Query('maxSpeed') maxSpeed?: string,
  ): Promise<{
    data: VesselResponseDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const p = page ? Math.max(1, Number(page)) : 1;
    const ps = pageSize ? Math.min(Math.max(1, Number(pageSize)), 5000) : 1000;
    return this.vesselService.findAllWithLastPositionPaginated(
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
        vesselType,
        flag,
        minSpeed: minSpeed ? Number(minSpeed) : undefined,
        maxSpeed: maxSpeed ? Number(maxSpeed) : undefined,
      },
    );
  }

  @Get('ports')
  @ApiOperation({ summary: 'Get ports within viewport' })
  @ApiQuery({ name: 'bbox', required: true, description: 'minLon,minLat,maxLon,maxLat' })
  async getPorts(@Query('bbox') bbox?: string) {
    if (!bbox) return [];
    const parts = bbox.split(',').map((p) => parseFloat(p.trim()));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return [];
    const [minLon, minLat, maxLon, maxLat] = parts as [number, number, number, number];
    // Use $queryRaw to avoid type issues if Prisma Client isn't regenerated yet
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, city, state, country, latitude, longitude
       FROM "ports"
       WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4
       LIMIT 5000`,
      minLat,
      maxLat,
      minLon,
      maxLon,
    );
    return rows;
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
    const fromDate = queryDto.from;
    const toDate = queryDto.to;

    // Support both limit/offset and page/pageSize
    const page = (queryDto as any).page ? Math.max(1, Number((queryDto as any).page)) : undefined;
    const pageSize = (queryDto as any).pageSize
      ? Math.min(1000, Math.max(1, Number((queryDto as any).pageSize)))
      : undefined;
    const limit = pageSize ?? queryDto.limit ?? undefined;
    const offset =
      page != null && limit != null
        ? (page - 1) * limit
        : (queryDto as any).offset
          ? Number((queryDto as any).offset)
          : 0;

    const vessel = await this.vesselService.findHistory(id, fromDate, toDate, limit, offset);

    if (!vessel) {
      return { error: 'Vessel not found' };
    }

    return vessel;
  }

  /**
   * Get vessel detail with last known position
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get vessel detail with last position' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const vessel = await this.vesselService.findByIdWithLastPosition(id);
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
