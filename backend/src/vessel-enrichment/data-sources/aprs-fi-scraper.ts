import { VesselDataSource, VesselEnrichmentData } from '../interfaces/vessel-data-source.interface';
import { Logger } from '@nestjs/common';

/**
 * APRS.fi public marine data source
 * Scrapes vessel information from APRS.fi info page
 */
export class AprsFiScraper implements VesselDataSource {
  name = 'APRS.fi';
  priority = 3;
  rateLimit = 5; // Conservative: 5 requests per minute
  private lastRequestTime = 0;
  private minDelay = (60 * 1000) / this.rateLimit; // 12 seconds between requests
  private readonly logger = new Logger(AprsFiScraper.name);

  async fetchByMmsi(mmsi: string): Promise<VesselEnrichmentData | null> {
    try {
      await this.respectRateLimit();

      // Use info page URL format
      const url = `https://aprs.fi/info/?call=${mmsi}`;
      this.logger.debug(`Fetching APRS.fi info page for MMSI ${mmsi}: ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(10000),
      });

      this.logger.debug(`APRS.fi response for ${mmsi}: HTTP ${response.status}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const parsed = this.parseAprsFiHtml(html, mmsi);

      if (parsed) {
        this.logger.log(
          `Parsed APRS.fi: mmsi=${mmsi}, name=${parsed.vesselName || '-'}, score=${parsed.dataQualityScore ?? '-'}`,
        );
      } else {
        this.logger.warn(`APRS.fi parse returned null for mmsi=${mmsi}`);
      }

      return parsed;
    } catch (error: any) {
      this.logger.warn(`APRS.fi fetch error for ${mmsi}: ${error.message}`);
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://aprs.fi', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.minDelay - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Parse HTML from APRS.fi info page
   * Extracts vessel information from the info table
   */
  private parseAprsFiHtml(html: string, mmsi: string): VesselEnrichmentData | null {
    try {
      // Extract MMSI number from table
      const mmsiMatch = html.match(/<th[^>]*>MMSI number:<\/th>\s*<td[^>]*>([0-9]+)<\/td>/i);
      if (!mmsiMatch) return null; // Not a valid vessel info page

      // Extract Navigational status
      const statusMatch = html.match(/<th[^>]*>Navigational status:<\/th>\s*<td[^>]*>([^<(]+)/i);

      // Extract Course (heading)
      const courseMatch = html.match(
        /<th[^>]*>Course:<\/th>\s*<td[^>]*>([0-9]+)°[^0-9]*heading\s+([0-9]+)°/i,
      );

      // Extract Speed (convert km/h to knots)
      const speedMatch = html.match(/<th[^>]*>Speed:<\/th>\s*<td[^>]*>([0-9.]+)\s*km\/h/i);

      // Extract Last position timestamp
      const lastPosMatch = html.match(/<th[^>]*>Last position:<\/th>\s*<td[^>]*>([^<]+)<br>/i);

      // Calculate quality score based on fields found
      let fieldsFound = 0;
      const totalFields = 3;
      if (mmsiMatch) fieldsFound++;
      if (courseMatch) fieldsFound++;
      if (speedMatch) fieldsFound++;

      const dataQualityScore = Math.round((fieldsFound / totalFields) * 100);

      return {
        mmsi,
        vesselName: mmsi, // APRS.fi usually shows MMSI as callsign for vessels
        callSign: mmsi,
        dataQualityScore,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse APRS.fi HTML for ${mmsi}:`, error.message);
      return null;
    }
  }
}
