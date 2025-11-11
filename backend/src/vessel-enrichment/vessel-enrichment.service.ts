import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  VesselDataSource,
  VesselEnrichmentData,
  EnrichmentResult,
} from './interfaces/vessel-data-source.interface';
import { VesselFinderScraper } from './data-sources/vesselfinder-scraper';

@Injectable()
export class VesselEnrichmentService {
  private readonly logger = new Logger(VesselEnrichmentService.name);
  private dataSources: VesselDataSource[];
  private isProcessing = false;

  constructor(private prisma: PrismaService) {
    // Initialize only VesselFinder (conservative approach to avoid blocking)
    this.dataSources = [new VesselFinderScraper()];

    this.logger.log(
      `Initialized vessel enrichment with data source: ${this.dataSources.map((s) => s.name).join(', ')}`,
    );
    this.logger.log(
      '⚠️ Using ONLY VesselFinder with conservative rate limiting (2 req/min) to avoid IP blocking',
    );
  }

  /**
   * Enrich a single vessel by MMSI
   */
  async enrichVessel(mmsi: string): Promise<EnrichmentResult> {
    const startTime = Date.now();
    this.logger.debug(`Starting enrichment for MMSI: ${mmsi}`);

    try {
      // Try each data source in priority order
      for (const source of this.dataSources) {
        try {
          const isAvailable = await source.isAvailable();
          if (!isAvailable) {
            this.logger.warn(`Data source ${source.name} is not available`);
            continue;
          }

          const data = await source.fetchByMmsi(mmsi);
          if (data) {
            // Update vessel in database
            const fieldsUpdated = await this.updateVesselData(mmsi, data, source.name);
            const duration = Date.now() - startTime;

            // Log the enrichment
            await this.logEnrichment(mmsi, source.name, true, fieldsUpdated, null, duration);

            this.logger.log(
              `Successfully enriched ${mmsi} from ${source.name} (${fieldsUpdated.length} fields, ${duration}ms)`,
            );

            return {
              success: true,
              data,
              source: source.name,
              fieldsUpdated,
              duration,
            };
          }
        } catch (error: any) {
          this.logger.warn(`Failed to fetch from ${source.name} for ${mmsi}: ${error.message}`);
          continue;
        }
      }

      // No data source succeeded
      const duration = Date.now() - startTime;
      const error = 'No data found from any source';
      await this.logEnrichment(mmsi, 'all', false, [], error, duration);

      return {
        success: false,
        source: 'none',
        fieldsUpdated: [],
        error,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(`Enrichment failed for ${mmsi}: ${error.message}`);
      await this.logEnrichment(mmsi, 'error', false, [], error.message, duration);

      return {
        success: false,
        source: 'error',
        fieldsUpdated: [],
        error: error.message,
        duration,
      };
    }
  }

  /**
   * Update vessel data in database
   */
  private async updateVesselData(
    mmsi: string,
    data: VesselEnrichmentData,
    source: string,
  ): Promise<string[]> {
    const fieldsUpdated: string[] = [];

    // Find existing vessel
    const vessel = await this.prisma.vessel.findUnique({ where: { mmsi } });

    if (!vessel) {
      this.logger.warn(`Vessel ${mmsi} not found in database, skipping update`);
      return fieldsUpdated;
    }

    // Prepare update data - only update if new value is provided and different
    const updateData: any = {
      enrichedAt: new Date(),
      enrichmentSource: source,
      enrichmentAttempts: { increment: 1 },
      lastEnrichmentAttempt: new Date(),
      enrichmentError: null,
    };

    // Update fields only if they have meaningful values
    const fieldMapping: Record<string, string> = {
      vesselName: 'vesselName',
      vesselType: 'vesselType',
      flag: 'flag',
      imo: 'imo',
      callSign: 'callSign',
      operator: 'operator',
      length: 'length',
      width: 'width',
      draught: 'draught',
      destination: 'destination',
      eta: 'eta',
      yearBuilt: 'yearBuilt',
      grossTonnage: 'grossTonnage',
      deadweight: 'deadweight',
      homePort: 'homePort',
      owner: 'owner',
      manager: 'manager',
      classification: 'classification',
      dataQualityScore: 'dataQualityScore',
    };

    for (const [dataKey, dbKey] of Object.entries(fieldMapping)) {
      const value = (data as any)[dataKey];
      if (value !== undefined && value !== null && value !== '' && value !== 'Unknown') {
        const currentValue = (vessel as any)[dbKey];
        if (currentValue !== value) {
          updateData[dbKey] = value;
          fieldsUpdated.push(dbKey);
        }
      }
    }

    // Update vessel
    await this.prisma.vessel.update({
      where: { mmsi },
      data: updateData,
    });

    // If image URL is provided, add it to vessel images
    if (data.imageUrl) {
      try {
        await this.prisma.vesselImage.upsert({
          where: { id: -1 }, // Dummy ID to trigger create
          create: {
            vesselId: vessel.id,
            url: data.imageUrl,
            source,
            isPrimary: false,
            order: 999,
          },
          update: {},
        });
        fieldsUpdated.push('image');
      } catch (error: any) {
        // Ignore duplicate image errors
        if (!error.message.includes('Unique constraint')) {
          this.logger.warn(`Failed to add image: ${error.message}`);
        }
      }
    }

    return fieldsUpdated;
  }

  /**
   * Log enrichment attempt
   */
  private async logEnrichment(
    mmsi: string,
    source: string,
    success: boolean,
    fieldsUpdated: string[],
    error: string | null,
    duration: number,
  ): Promise<void> {
    try {
      await this.prisma.vesselEnrichmentLog.create({
        data: {
          mmsi,
          source,
          success,
          fieldsUpdated,
          error,
          duration,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to log enrichment: ${error.message}`);
    }
  }

  /**
   * Get enrichment statistics
   */
  async getStatistics() {
    const [totalVessels, enrichedVessels, pendingQueue, recentLogs] = await Promise.all([
      this.prisma.vessel.count(),
      this.prisma.vessel.count({
        where: {
          enrichedAt: { not: null },
        },
      }),
      this.prisma.vesselEnrichmentQueue.count({
        where: { status: 'pending' },
      }),
      this.prisma.vesselEnrichmentLog.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        select: {
          success: true,
          duration: true,
        },
      }),
    ]);

    const successCount = recentLogs.filter((l) => l.success).length;
    const avgDuration =
      recentLogs.length > 0
        ? recentLogs.reduce((sum, l) => sum + (l.duration || 0), 0) / recentLogs.length
        : 0;

    return {
      totalVessels,
      enrichedVessels,
      enrichmentPercentage: totalVessels > 0 ? (enrichedVessels / totalVessels) * 100 : 0,
      pendingQueue,
      last24Hours: {
        attempts: recentLogs.length,
        successes: successCount,
        failures: recentLogs.length - successCount,
        successRate: recentLogs.length > 0 ? (successCount / recentLogs.length) * 100 : 0,
        avgDuration: Math.round(avgDuration),
      },
    };
  }

  /**
   * Get enrichment history for a vessel
   */
  async getEnrichmentHistory(mmsi: string, limit = 20) {
    return this.prisma.vesselEnrichmentLog.findMany({
      where: { mmsi },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
