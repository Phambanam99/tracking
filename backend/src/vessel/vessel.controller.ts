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
  UseGuards,
  Req,
} from '@nestjs/common';
import { VesselService } from './vessel.service';
import { ApiOperation, ApiQuery, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, UserRole } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  CreateVesselDto,
  UpdateVesselDto,
  CreateVesselPositionDto,
  VesselHistoryQueryDto,
  VesselResponseDto,
  CreateVesselImageDto,
  UpdateVesselImageDto,
} from './dto/vessel.dto';
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@ApiTags('vessels')
@Controller('vessels')
export class VesselController {
  private readonly logger = new Logger(VesselController.name);
  constructor(
    private readonly vesselService: VesselService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // Note: Prediction logic is implemented inline using dead reckoning
  // No need for VesselFusionService injection here

  /**
   * Get online (recent) AIS fused vessels from Redis (geo + hash + active ZSET)
   * Optional bbox filter: minLon,minLat,maxLon,maxLat
   * Optional limit: default 1000 (hard max 5000)
   * stalenessSec: consider active if last timestamp within this window (default 3600s)
   */
  @Get('online')
  @ApiOperation({ summary: 'Get online AIS vessels (Redis) with optional predictions' })
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
  @ApiQuery({
    name: 'includePredicted',
    required: false,
    description: 'If true, include predicted positions for vessels with lost signal',
  })
  async getOnline(
    @Query('bbox') bbox?: string,
    @Query('limit') limitStr?: string,
    @Query('stalenessSec') stalenessStr?: string,
    @Query('allowStale') allowStaleStr?: string,
    @Query('includePredicted') includePredictedStr?: string,
  ) {
    const client = this.redis.getClient();
    const now = Date.now();
    const envDefault = process.env.ONLINE_DEFAULT_STALENESS_SEC
      ? Math.max(10, Number(process.env.ONLINE_DEFAULT_STALENESS_SEC))
      : 3600;
    const stalenessSec = stalenessStr ? Math.max(10, Number(stalenessStr)) : envDefault; // default configurable via env
    const minTs = now - stalenessSec * 1000;
    const limit = limitStr ? Math.min(50000, Math.max(1, Number(limitStr))) : 1000;
    const allowStaleEnv = process.env.ONLINE_AUTO_ALLOW_STALE === '1';
    const allowStale = allowStaleStr === '1' || allowStaleStr === 'true' || allowStaleEnv;
    const includePredicted = includePredictedStr === 'true' || includePredictedStr === '1';

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

    // Fetch all vessel hashes in parallel (much faster than sequential)
    const mmsiToFetch = rawMmsis.slice(0, Math.min(rawMmsis.length, limit * 2)); // Get extra in case filtering
    const hashPromises = mmsiToFetch.map((mmsi) =>
      client.hgetall(`ais:vessel:${mmsi}`).then((hash) => ({ mmsi, hash })),
    );
    const hashResults = await Promise.all(hashPromises);

    const results: any[] = [];
    const maxPredictionAge = 600; // 10 minutes max prediction window

    for (const { mmsi, hash } of hashResults) {
      if (results.length >= limit) break;
      if (!hash || !hash.ts) continue;
      const ts = Number(hash.ts);
      if (!Number.isFinite(ts)) continue;

      const lat = Number(hash.lat);
      const lon = Number(hash.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const timeSinceUpdate = (now - ts) / 1000; // seconds

      // Real-time vessel (within staleness window)
      if (ts >= minTs) {
        if (bboxNums) {
          if (lon < bboxNums[0] || lon > bboxNums[2] || lat < bboxNums[1] || lat > bboxNums[3])
            continue;
        }

        results.push({
          mmsi,
          vesselName: hash.name || undefined,
          latitude: lat,
          longitude: lon,
          timestamp: new Date(ts).toISOString(),
          speed: hash.speed ? Number(hash.speed) : undefined,
          course: hash.course ? Number(hash.course) : undefined,
          sourceId: hash.sourceId || undefined,
          score: hash.score ? Number(hash.score) : undefined,
          predicted: false,
          confidence: 1.0,
          timeSinceLastMeasurement: timeSinceUpdate,
        });
      }
      // Predicted vessel (signal lost but within prediction window)
      else if (includePredicted && timeSinceUpdate <= maxPredictionAge) {
        // Simple dead reckoning prediction
        const speed = hash.speed ? Number(hash.speed) : undefined;
        const course = hash.course ? Number(hash.course) : undefined;

        if (speed && course && speed > 0.1) {
          // Predict position based on last known speed/course
          const dt = timeSinceUpdate;
          const speedDegPerSec = speed * 0.000514; // knots to deg/sec (approximate)
          const courseRad = (course * Math.PI) / 180;
          const vx = speedDegPerSec * Math.sin(courseRad);
          const vy = speedDegPerSec * Math.cos(courseRad);

          const predLat = lat + vy * dt;
          const predLon = lon + vx * dt;

          // Check bbox for predicted position
          if (bboxNums) {
            if (
              predLon < bboxNums[0] ||
              predLon > bboxNums[2] ||
              predLat < bboxNums[1] ||
              predLat > bboxNums[3]
            )
              continue;
          }

          // Confidence decreases with time (exponential decay)
          const confidence = Math.exp(-dt / 300); // 5 min half-life

          // Only include if confidence > 0.3
          if (confidence > 0.3) {
            results.push({
              mmsi,
              vesselName: hash.name || undefined,
              latitude: predLat,
              longitude: predLon,
              timestamp: new Date(ts).toISOString(), // Original timestamp
              speed: speed,
              course: course,
              sourceId: 'predicted',
              score: confidence,
              predicted: true,
              confidence: confidence,
              timeSinceLastMeasurement: timeSinceUpdate,
            });
          }
        }
      }
    }

    return {
      count: results.length,
      stalenessSec,
      allowStale,
      includePredicted,
      bbox: bboxNums || null,
      data: results,
      predictedCount: results.filter((r) => r.predicted).length,
      realTimeCount: results.filter((r) => !r.predicted).length,
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
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    // Use provided dates or null (which means no time filter = all history)
    const fromDate = queryDto.from || null;
    const toDate = queryDto.to || null;

    if (fromDate || toDate) {
      this.logger.debug(
        `[History] Vessel ${id}: from ${fromDate?.toISOString() || 'beginning'} to ${toDate?.toISOString() || 'now'}`,
      );
    } else {
      this.logger.debug(`[History] Vessel ${id}: fetching ALL HISTORY (no time filter)`);
    }

    // Handle pagination: convert page/pageSize to offset/limit
    let limit = queryDto.limit || 1000;
    let offset = queryDto.offset || 0;

    if (pageStr || pageSizeStr) {
      const page = pageStr ? Math.max(1, Number(pageStr)) : 1;
      const pageSize = pageSizeStr ? Math.min(1000, Math.max(1, Number(pageSizeStr))) : 50;
      limit = pageSize;
      offset = (page - 1) * pageSize;
    }

    let vessel = await this.vesselService.findHistory(id, fromDate, toDate, limit, offset);

    // If not found by ID, try finding by MMSI (similar to GET /:id endpoint)
    if (!vessel) {
      this.logger.debug(`[History] Vessel ${id} not found by ID, trying MMSI...`);
      vessel = await this.vesselService.findHistoryByMmsi(
        String(id),
        fromDate,
        toDate,
        limit,
        offset,
      );
    }

    if (!vessel) {
      this.logger.warn(`[History] Vessel ${id} not found`);
      return { error: 'Vessel not found' };
    }

    // Count total positions for pagination
    const total = await this.vesselService.countPositions(vessel.id, fromDate, toDate);

    this.logger.debug(
      `[History] Vessel ${vessel.id} (${vessel.mmsi}): ${vessel.positions?.length || 0} positions returned, ${total} total`,
    );

    return {
      ...vessel,
      total,
    };
  }

  /**
   * Get vessel detail with last known position
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get vessel detail with last position' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const vessel = await this.vesselService.findByIdWithLastPosition(id);
    // If the vessel is not found, using findByMmsiWithLastPosition
    if (!vessel) {
      return this.vesselService.findByMmsiWithLastPosition(String(id));
    }

    if (!vessel) {
      return { error: 'Vessel not found' };
    }
    return vessel;
  }

  /**
   * Create a new vessel
   */
  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a new vessel' })
  async create(@Body() createVesselDto: CreateVesselDto): Promise<VesselResponseDto> {
    return this.vesselService.create(createVesselDto);
  }

  /**
   * Update a vessel
   */
  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update a vessel' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateVesselDto: UpdateVesselDto,
    @Req() req: any,
  ): Promise<VesselResponseDto> {
    const updated = await this.vesselService.update(id, updateVesselDto);

    // Record edit history
    if (req.user?.id) {
      const changes: Record<string, any> = {};
      Object.entries(updateVesselDto).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          changes[key] = value;
        }
      });
      if (Object.keys(changes).length > 0) {
        await this.vesselService.recordEdit(id, req.user.id, changes).catch(() => {
          // Silently fail edit history recording
        });
      }
    }

    return updated;
  }

  /**
   * Delete a vessel
   */
  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Delete a vessel' })
  async delete(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.vesselService.delete(id);
    return { message: 'Vessel deleted successfully' };
  }

  /**
   * Add position data for a vessel
   */
  @Post('positions')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Add vessel position' })
  async addPosition(@Body() createPositionDto: CreateVesselPositionDto) {
    return this.vesselService.addPositionWithDto(createPositionDto);
  }

  // -------------------- IMAGES CRUD --------------------
  @Get(':id/images')
  @ApiOperation({ summary: 'List vessel images' })
  async listImages(@Param('id', ParseIntPipe) id: number) {
    return this.vesselService.listImages(id);
  }

  @Post(':id/images')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Add vessel image' })
  async addImage(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateVesselImageDto) {
    return this.vesselService.addImage(id, dto);
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
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  @ApiOperation({ summary: 'Upload vessel image file' })
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: any,
    @Body() dto: CreateVesselImageDto,
  ) {
    if (!file) {
      return { error: 'No file uploaded' };
    }
    // Build absolute URL (assumes frontend hits same host or env BASE_URL)
    const base = process.env.PUBLIC_BASE_URL || '';
    const url = base + '/uploads/' + file.filename;
    return this.vesselService.addImage(id, { ...dto, url });
  }

  @Put('images/:imageId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update vessel image' })
  async updateImage(
    @Param('imageId', ParseIntPipe) imageId: number,
    @Body() dto: UpdateVesselImageDto,
  ) {
    return this.vesselService.updateImage(imageId, dto);
  }

  @Delete('images/:imageId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Delete vessel image' })
  async deleteImage(@Param('imageId', ParseIntPipe) imageId: number) {
    await this.vesselService.deleteImage(imageId);
    return { message: 'Deleted' };
  }

  /**
   * Get edit history for a vessel
   */
  @Get(':id/edit-history')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get vessel edit history' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset' })
  async getEditHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.vesselService.getEditHistory(
      id,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }
}
