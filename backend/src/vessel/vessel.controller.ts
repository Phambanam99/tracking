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
  Logger,
} from '@nestjs/common';
import { VesselService } from './vessel.service';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
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
  private readonly logger = new Logger(VesselController.name);
  constructor(
    private readonly vesselService: VesselService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get online (recent) AIS fused vessels from Redis (geo + hash + active ZSET)
   * Optional bbox filter: minLon,minLat,maxLon,maxLat
   * Optional limit: default 1000 (hard max 5000)
   * stalenessSec: consider active if last timestamp within this window (default 3600s)
   */
  @Get('online')
  @ApiOperation({ summary: 'Get online AIS vessels (Redis)' })
  @ApiQuery({ name: 'bbox', required: false, description: 'minLon,minLat,maxLon,maxLat' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max number of vessels (<=5000)' })
  @ApiQuery({
    name: 'stalenessSec',
    required: false,
    description: 'Max age in seconds (default 3600)',
  })
  @ApiQuery({
    name: 'allowStale',
    required: false,
    description: 'If 1, fallback to returning newest vessels even if older than stalenessSec',
  })
  async getOnline(
    @Query('bbox') bbox?: string,
    @Query('limit') limitStr?: string,
    @Query('stalenessSec') stalenessStr?: string,
    @Query('allowStale') allowStaleStr?: string,
  ) {
    const client = this.redis.getClient();
    const now = Date.now();
    const envDefault = process.env.ONLINE_DEFAULT_STALENESS_SEC
      ? Math.max(10, Number(process.env.ONLINE_DEFAULT_STALENESS_SEC))
      : 3600;
    const stalenessSec = stalenessStr ? Math.max(10, Number(stalenessStr)) : envDefault; // default configurable via env
    const minTs = now - stalenessSec * 1000;
    const limit = limitStr ? Math.min(5000, Math.max(1, Number(limitStr))) : 1000;
    const allowStaleEnv = process.env.ONLINE_AUTO_ALLOW_STALE === '1';
    const allowStale = allowStaleStr === '1' || allowStaleStr === 'true' || allowStaleEnv;

    let bboxNums: [number, number, number, number] | undefined;
    if (bbox) {
      const parts = bbox.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        bboxNums = [parts[0], parts[1], parts[2], parts[3]];
      }
    }

    let rawMmsis: string[] = await client.zrangebyscore(
      'ais:vessels:active',
      minTs,
      '+inf',
      'LIMIT',
      0,
      limit * 2,
    );
    const zcard = await client.zcard('ais:vessels:active');
    if (rawMmsis.length === 0) {
      if (zcard > 0) {
        // Means all members have score < minTs (likely timestamp unit mismatch: seconds vs ms)
        const oldest = await client.zrange('ais:vessels:active', 0, 0, 'WITHSCORES');
        const newest = await client.zrange('ais:vessels:active', -1, -1, 'WITHSCORES');
        const newestScore = newest && newest.length === 2 ? Number(newest[1]) : undefined;
        const newestAgeSec = newestScore ? ((now - newestScore) / 1000).toFixed(1) : 'n/a';
        this.logger.warn(
          `Online query returned 0 but ZSET has ${zcard} members. minTs=${minTs} oldest=${oldest?.join(':') || 'n/a'} newest=${newest?.join(':') || 'n/a'} newestAgeSec=${newestAgeSec} (likely all older than stalenessSec=${stalenessSec}). allowStale=${allowStale}`,
        );
        if (allowStale) {
          // fallback: newest first ignoring staleness window
          rawMmsis = await client.zrevrange('ais:vessels:active', 0, limit - 1);
          this.logger.log(
            `allowStale fallback returning newest ${rawMmsis.length} vessels despite staleness window`,
          );
        }
      } else {
        this.logger.warn(
          `Online query found no active vessels; ZSET empty (minTs=${minTs}). Possibly no publishes yet or fusion filtering all records.`,
        );
      }
    } else {
      this.logger.log(
        `Online vessels in ZSET (filtered by time)=${rawMmsis.length}/${zcard}, limit=${limit}, bbox=${bboxNums ? bboxNums.join(',') : 'none'}`,
      );
    }
    const results: any[] = [];
    for (const mmsi of rawMmsis) {
      if (results.length >= limit) break;
      const hash = await client.hgetall(`ais:vessel:${mmsi}`);
      if (!hash || !hash.ts) continue;
      const ts = Number(hash.ts);
      if (!Number.isFinite(ts) || ts < minTs) continue;
      const lat = Number(hash.lat);
      const lon = Number(hash.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (bboxNums) {
        if (lon < bboxNums[0] || lon > bboxNums[2] || lat < bboxNums[1] || lat > bboxNums[3])
          continue;
      }
      results.push({
        mmsi,
        latitude: lat,
        longitude: lon,
        timestamp: new Date(ts).toISOString(),
        speed: hash.speed ? Number(hash.speed) : undefined,
        course: hash.course ? Number(hash.course) : undefined,
        sourceId: hash.sourceId || undefined,
        score: hash.score ? Number(hash.score) : undefined,
      });
    }

    return {
      count: results.length,
      stalenessSec,
      allowStale,
      bbox: bboxNums || null,
      data: results,
    };
  }

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
