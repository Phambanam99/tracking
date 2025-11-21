import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdsbModel, AdsbStreamRequestDto, AdsbQueryRequestDto, AdsbConfig } from './dto/adsb.dto';

@Injectable()
export class AdsbService {
  private readonly logger = new Logger(AdsbService.name);
  private readonly config: AdsbConfig;
  private readonly externalApiUrl: string;

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // External ADSB API URL
    this.externalApiUrl = this.configService.get<string>(
      'ADSB_EXTERNAL_API_URL',
      'http://10.75.20.5:6001/api/osint',
    );

    // Initialize ADSB configuration
    this.config = {
      selectField: this.configService.get<string>(
        'ADSB_SELECT_FIELDS',
        'ID,SQUAWK,UPDATETIME,HEXIDENT,RECEVERSOURCEID,LONGITUDE,CONTRUCTORNUMBER,SPEED,SECSOFTRACK,COUNTRY,BEARING,AIRCRAFTID,TYPE,REGISTER,SPEEDTYPE,DISTANCE,TARGETALT,ENGINES,ISTISB,MANUFACTURE,FROMPORT,TOPORT,ALTITUDE,UNIXTIME,ENGINETYPE,ALTITUDETYPE,CALLSIGN,OPERATOR,TRANSPONDERTYPE,SOURCE,OPERATORCODE,LATITUDE,VERTICALSPEED',
      ),
      limitQuery: this.configService.get<number>('ADSB_LIMIT_QUERY', 1000),
      redisHashKey: this.configService.get<string>('ADSB_REDIS_HASH_KEY', 'adsb:current_flights'),
      redisTTL: this.configService.get<number>('ADSB_REDIS_TTL', 300), // 5 minutes default
    };

    this.logger.log(`ADSB External API URL: ${this.externalApiUrl}`);
  }

  /**
   * Fetch ADSB data from external API (streaming endpoint)
   * Calls the external server's /api/osint/adsb/stream endpoint
   */
  async fetchAdsbFromExternalApi(request: AdsbStreamRequestDto): Promise<AdsbModel[]> {
    try {
      const url = `${this.externalApiUrl}/adsb/stream`;
      this.logger.debug(`Calling external ADSB API: ${url}`);

      // Add timeout configuration with reasonable limit
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          FieldFilter: request.fieldFilter || '',
          PositionFilter: request.positionFilter || '',
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        throw new Error(`External ADSB API error: ${response.status} ${response.statusText}`);
      }

      // Đọc stream theo từng dòng (mỗi dòng là một batch JSON)
      const allAircraft: AdsbModel[] = [];
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        clearTimeout(timeoutId);
        throw new Error('Response body is not readable');
      }

      try {
        // Read batches with safety limits
        let batchCount = 0;
        const MAX_BATCHES = 100; // Limit max batches to prevent infinite loop
        const BATCH_TIMEOUT = 5000; // 5 seconds per batch
        let lastBatchTime = Date.now();

        while (batchCount < MAX_BATCHES) {
          // Check for batch timeout (no data received)
          if (Date.now() - lastBatchTime > BATCH_TIMEOUT) {
            this.logger.warn(`Batch timeout after ${batchCount} batches`);
            break;
          }

          const { done, value } = await reader.read();
          lastBatchTime = Date.now();

          if (done) {
            this.logger.debug(`Stream ended after ${batchCount} batches`);
            break;
          }

          // Safety check: prevent excessive data accumulation
          if (allAircraft.length > 50000) {
            this.logger.warn(`Max aircraft limit reached (${allAircraft.length}), stopping stream`);
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Xử lý các dòng hoàn chỉnh trong buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Giữ lại dòng chưa hoàn chỉnh

          for (const line of lines) {
            if (line.trim()) {
              try {
                const batch = JSON.parse(line);
                if (Array.isArray(batch)) {
                  // Normalize casing cho từng aircraft trong batch
                  const normalizedBatch = batch.map((aircraft) => this.normalizeCasing(aircraft));
                  allAircraft.push(...normalizedBatch);
                  batchCount++;
                  this.logger.debug(
                    `Received batch ${batchCount} with ${batch.length} aircraft (total: ${allAircraft.length})`,
                  );
                }
              } catch (error) {
                this.logger.error(`Failed to parse batch: ${error.message}`);
              }
            }
          }
        }

        // Xử lý dòng cuối cùng trong buffer nếu có
        if (buffer.trim()) {
          try {
            const batch = JSON.parse(buffer);
            if (Array.isArray(batch)) {
              const normalizedBatch = batch.map((aircraft) => this.normalizeCasing(aircraft));
              allAircraft.push(...normalizedBatch);
              batchCount++;
              this.logger.debug(`Received final batch ${batchCount} with ${batch.length} aircraft`);
            }
          } catch (error) {
            this.logger.error(`Failed to parse final batch: ${error.message}`);
          }
        }
      } finally {
        reader.cancel(); // Đóng stream
        clearTimeout(timeoutId);
      }

      this.logger.log(`Fetched ${allAircraft.length} aircraft from external API`);
      return allAircraft;
    } catch (error) {
      this.logger.error('Error fetching from external ADSB API:', error);
      throw error;
    }
  }

  /**
   * Fetch ADSB data from local Redis Hash
   * Returns all current flights stored in local Redis
   */
  async fetchAdsbFromRedis(): Promise<AdsbModel[]> {
    try {
      // Use client without prefix for full control over key naming
      const client = this.redisService.getClientWithoutPrefix();
      const hashEntries = await client.hgetall(this.config.redisHashKey);

      if (!hashEntries || Object.keys(hashEntries).length === 0) {
        this.logger.debug('No ADSB data found in Redis');
        return [];
      }

      const aircrafts: AdsbModel[] = [];
      for (const [hexident, value] of Object.entries(hashEntries)) {
        try {
          const parsed = JSON.parse(value);
          aircrafts.push(parsed);
        } catch (error) {
          this.logger.error(`Failed to parse ADSB data for ${hexident}:`, error);
        }
      }

      this.logger.log(`Loaded ${aircrafts.length} aircraft from Redis`);
      return aircrafts;
    } catch (error) {
      this.logger.error('Error fetching ADSB data from Redis:', error);
      throw error;
    }
  }

  /**
   * Stream ADSB data with optional filtering
   * First tries to get from local Redis, if empty, fetches from external API
   */
  async streamAdsbData(
    request: AdsbStreamRequestDto,
  ): Promise<{ data: AdsbModel[][]; totalCount: number }> {
    try {
      // First try to get from local Redis
      let allPlanes = await this.fetchAdsbFromRedis();

      // If no data in local Redis, fetch from external API
      // if (allPlanes.length === 0) {
      //   this.logger.log('No data in local Redis, fetching from external API...');
      //   allPlanes = await this.fetchAdsbFromExternalApi(request);

      //   // Store in local Redis for future use
      //   if (allPlanes.length > 0) {
      //     await this.storeAdsbDataInLocalRedis(allPlanes);
      //   }
      // }

      if (allPlanes.length === 0) {
        return { data: [], totalCount: 0 };
      }

      // Apply field filter if provided
      if (request.fieldFilter && request.fieldFilter.trim()) {
        allPlanes = this.applyFieldFilter(allPlanes, request.fieldFilter);
      }

      // Apply position filter if provided
      if (request.positionFilter && request.positionFilter.trim()) {
        allPlanes = this.applyPositionFilter(allPlanes, request.positionFilter);
      }

      // Sort by unix time
      allPlanes.sort((a, b) => (a.unixTime || 0) - (b.unixTime || 0));

      // Paginate results
      const batches: AdsbModel[][] = [];
      const limit = this.config.limitQuery;
      for (let i = 0; i < allPlanes.length; i += limit) {
        batches.push(allPlanes.slice(i, i + limit));
      }

      return {
        data: batches,
        totalCount: allPlanes.length,
      };
    } catch (error) {
      this.logger.error('Error streaming ADSB data:', error);
      throw error;
    }
  }

  /**
   * Send ADSB data to external server
   * Calls the external server's /api/osint/adsb/fetch endpoint
   */
  async sendAdsbDataToExternalServer(adsbModels: AdsbModel[]): Promise<void> {
    if (!adsbModels || adsbModels.length === 0) {
      this.logger.warn('No ADSB data to send to external server');
      return;
    }

    try {
      const url = `${this.externalApiUrl}/adsb/fetch`;
      this.logger.debug(`Sending ${adsbModels.length} aircraft to: ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adsbModels),
      });

      if (!response.ok) {
        throw new Error(`Failed to send data to external server: ${response.status}`);
      }

      this.logger.log(`Successfully sent ${adsbModels.length} aircraft to external server`);
    } catch (error) {
      this.logger.error('Error sending data to external server:', error);
      throw error;
    }
  }

  /**
   * Query ADSB data from external server
   * Calls the external server's /api/osint/adsb/query endpoint
   */
  async queryAdsbDataFromExternalServer(request: AdsbQueryRequestDto): Promise<{
    data: any[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const url = `${this.externalApiUrl}/adsb/query`;
      this.logger.debug(`Querying external ADSB API: ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          FieldFilter: request.fieldFilter || '',
          PositionFilter: request.positionFilter || '',
        }),
      });

      if (!response.ok) {
        throw new Error(`External query failed: ${response.status}`);
      }

      // Read the streaming response
      const text = await response.text();
      const lines = text.split('\n').filter((line) => line.trim());

      const allResults: any[] = [];
      for (const line of lines) {
        try {
          const batch = JSON.parse(line);
          if (Array.isArray(batch)) {
            allResults.push(...batch);
          }
        } catch (error) {
          this.logger.error(`Failed to parse query batch: ${error.message}`);
        }
      }

      const page = request.page || 1;
      const pageSize = request.limit || this.config.limitQuery;

      return {
        data: allResults,
        total: allResults.length,
        page,
        pageSize,
      };
    } catch (error) {
      this.logger.error('Error querying external ADSB API:', error);
      throw error;
    }
  }

  /**
   * Query ADSB data from external server's database
   * This calls the external server to query historical ADSB data
   */
  async queryAdsbData(request: AdsbQueryRequestDto): Promise<{
    data: any[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      this.logger.log('Querying ADSB data from external server...');

      // Forward request to external server
      return await this.queryAdsbDataFromExternalServer(request);
    } catch (error) {
      this.logger.error('Error querying ADSB data from external server:', error);
      throw error;
    }
  }

  /**
   * Store ADSB data batch into local Redis
   * This stores data fetched from external API into local Redis for caching
   */
  async storeAdsbDataInLocalRedis(adsbModels: AdsbModel[]): Promise<void> {
    if (!adsbModels || adsbModels.length === 0) {
      this.logger.warn('No ADSB data to store in local Redis');
      return;
    }

    try {
      // Use client without prefix for full control over key naming
      const client = this.redisService.getClientWithoutPrefix();

      // Debug: Check Redis connection info
      this.logger.debug(
        `Redis client connected to: ${client.options.host}:${client.options.port}, DB: ${client.options.db}`,
      );

      // Debug: Log first record to see structure
      if (adsbModels.length > 0) {
        this.logger.debug(`First aircraft raw data keys: ${Object.keys(adsbModels[0]).join(', ')}`);
        this.logger.debug(
          `First aircraft sample: ${JSON.stringify(adsbModels[0]).substring(0, 200)}`,
        );
      }

      // Prepare hash entries for Redis
      const hashEntries: Record<string, string> = {};
      for (const model of adsbModels) {
        // Convert PascalCase fields from .NET to camelCase
        const normalizedModel = this.normalizeCasing(model);

        // Debug first record after normalization
        if (Object.keys(hashEntries).length === 0) {
          this.logger.debug(`After normalization - hexident: ${normalizedModel.hexident}`);
          this.logger.debug(
            `Normalized keys: ${Object.keys(normalizedModel).slice(0, 10).join(', ')}`,
          );
        }

        if (normalizedModel.hexident) {
          hashEntries[normalizedModel.hexident] = JSON.stringify(normalizedModel);
        } else {
          // Debug: Log when hexident is missing
          this.logger.warn(
            `Aircraft missing hexident after normalization. Original keys: ${Object.keys(model).join(', ')}`,
          );
        }
      }

      // Store all entries in Redis Hash in a single operation
      if (Object.keys(hashEntries).length > 0) {
        await client.hset(this.config.redisHashKey, hashEntries);
        await client.expire(this.config.redisHashKey, this.config.redisTTL);

        // Verify data was actually stored
        const storedCount = await client.hlen(this.config.redisHashKey);
        const ttl = await client.ttl(this.config.redisHashKey);

        // Log actual Redis key for debugging
        this.logger.log(
          `Stored ${Object.keys(hashEntries).length} aircraft in Redis. Key: "${this.config.redisHashKey}" | Verified count: ${storedCount} | TTL: ${ttl}s (check with: redis-cli HLEN ${this.config.redisHashKey})`,
        );
      } else {
        this.logger.warn(
          `No valid aircraft with hexident found in ${adsbModels.length} records. Check if data has 'Hexident' (PascalCase) or 'hexident' (camelCase) field.`,
        );
      }
    } catch (error) {
      this.logger.error('Error storing ADSB data in local Redis:', error);
      throw error;
    }
  }

  /**
   * Normalize field casing from PascalCase (C#) to camelCase (TypeScript)
   * Handles both formats for compatibility
   */
  private normalizeCasing(model: any): AdsbModel {
    // If already in camelCase, return as-is
    if (model.hexident !== undefined) {
      return model;
    }

    // Convert from PascalCase to camelCase
    const normalized: any = {};
    for (const [key, value] of Object.entries(model)) {
      // Convert first character to lowercase
      const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
      normalized[camelKey] = value;
    }

    return normalized as AdsbModel;
  }

  /**
   * Store ADSB data batch into Redis and optionally database
   * Alias for storeAdsbDataInLocalRedis for backward compatibility
   */
  async storeAdsbData(adsbModels: AdsbModel[]): Promise<void> {
    return this.storeAdsbDataInLocalRedis(adsbModels);
  }

  /**
   * Get ADSB data for a specific aircraft by hexident
   */
  async getAircraftByHexident(hexident: string): Promise<AdsbModel | null> {
    try {
      // Use client without prefix for full control over key naming
      const client = this.redisService.getClientWithoutPrefix();
      const value = await client.hget(this.config.redisHashKey, hexident);

      if (!value) {
        return null;
      }

      return JSON.parse(value);
    } catch (error) {
      this.logger.error(`Error fetching aircraft ${hexident}:`, error);
      return null;
    }
  }

  /**
   * Get count of current flights in Redis
   */
  async getCurrentFlightCount(): Promise<number> {
    try {
      // Use client without prefix for full control over key naming
      const client = this.redisService.getClientWithoutPrefix();
      return await client.hlen(this.config.redisHashKey);
    } catch (error) {
      this.logger.error('Error getting flight count:', error);
      return 0;
    }
  }

  /**
   * Apply simple field filter to aircraft data
   * Note: This is a basic implementation. For production, consider using a proper
   * query language parser like jsonata or a custom DSL
   */
  private applyFieldFilter(aircrafts: AdsbModel[], filterExpression: string): AdsbModel[] {
    try {
      // Basic filter implementation
      // Example: "altitude > 30000 AND speed > 400"
      // For now, we'll return all data and log the filter
      this.logger.warn(
        `Field filter not fully implemented, returning all data. Filter: ${filterExpression}`,
      );
      return aircrafts;
    } catch (error) {
      this.logger.error('Error applying field filter:', error);
      return aircrafts;
    }
  }

  /**
   * Apply position filter to aircraft data
   * Filters aircraft within specified polygon boundaries
   */
  private applyPositionFilter(aircrafts: AdsbModel[], positionFilter: string): AdsbModel[] {
    try {
      // Basic polygon filtering would go here
      // For now, we'll return all data and log the filter
      this.logger.warn(
        `Position filter not fully implemented, returning all data. Filter: ${positionFilter}`,
      );
      return aircrafts;
    } catch (error) {
      this.logger.error('Error applying position filter:', error);
      return aircrafts;
    }
  }

  /**
   * Clear all ADSB data from Redis
   */
  async clearAdsbCache(): Promise<void> {
    try {
      // Use client without prefix for full control over key naming
      const client = this.redisService.getClientWithoutPrefix();
      await client.del(this.config.redisHashKey);
      this.logger.log('ADSB cache cleared');
    } catch (error) {
      this.logger.error('Error clearing ADSB cache:', error);
      throw error;
    }
  }
}
