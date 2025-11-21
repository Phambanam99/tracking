import { VesselDataSource, VesselEnrichmentData } from '../interfaces/vessel-data-source.interface';
import { Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

/**
 * MarineTraffic public data scraper
 * Scrapes publicly available information from MarineTraffic website
 * Note: This is for educational/research purposes only
 * Consider using official API for production use
 */
export class MarineTrafficScraper implements VesselDataSource {
  name = 'MarineTraffic';
  priority = 2; // Higher priority than VesselFinder
  rateLimit = 1; // 1 request per minute (very conservative)
  private lastRequestTime = 0;
  private minDelay = (60 * 1000) / this.rateLimit; // 60 seconds between requests
  private consecutiveErrors = 0;
  private readonly logger = new Logger(MarineTrafficScraper.name);

  async fetchByMmsi(mmsi: string): Promise<VesselEnrichmentData | null> {
    try {
      await this.respectRateLimit();

      // First, search for the vessel to get shipid
      const shipId = await this.searchShipId(mmsi);
      if (!shipId) {
        this.logger.debug(`No shipId found for MMSI ${mmsi}`);
        return null;
      }

      // Then fetch vessel details using shipid
      const url = `https://www.marinetraffic.com/en/ais/details/ships/shipid:${shipId}`;
      this.logger.debug(
        `Fetching MarineTraffic details for MMSI ${mmsi} (shipId: ${shipId}): ${url}`,
      );

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://www.marinetraffic.com/',
        },
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      this.logger.debug(`MarineTraffic response for ${mmsi}: HTTP ${response.status}`);

      if (!response.ok) {
        if (response.status === 404) {
          this.consecutiveErrors = 0;
          return null;
        }
        if (response.status === 429 || response.status === 403) {
          // Rate limited or blocked
          this.consecutiveErrors++;
          this.logger.warn(
            `MarineTraffic rate limit/blocked for ${mmsi} (HTTP ${response.status}). Consecutive errors: ${this.consecutiveErrors}`,
          );

          // Exponential backoff
          if (this.consecutiveErrors > 2) {
            const backoffDelay = Math.min(
              300000,
              this.minDelay * Math.pow(2, this.consecutiveErrors - 2),
            );
            this.logger.warn(`Adding backoff delay: ${backoffDelay / 1000}s`);
            await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          }

          throw new Error(`HTTP ${response.status} - Rate limited or blocked`);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      // Success - reset error counter
      this.consecutiveErrors = 0;

      const html = await response.text();
      const parsed = this.parseMarineTrafficHtml(html, mmsi);

      if (parsed) {
        const msg = `✓ Parsed MarineTraffic: mmsi=${mmsi}, name=${parsed.vesselName || '-'}, imo=${parsed.imo || '-'}, type=${parsed.vesselType || '-'}, score=${parsed.dataQualityScore ?? '-'}`;
        this.logger.log(msg);
      } else {
        this.logger.warn(`MarineTraffic parse returned null for mmsi=${mmsi}`);
      }

      return parsed;
    } catch (error: any) {
      this.logger.warn(`MarineTraffic fetch error for ${mmsi}: ${error.message}`);
      return null;
    }
  }

  /**
   * Search for shipId using MMSI
   */
  private async searchShipId(mmsi: string): Promise<string | null> {
    try {
      // Use the global search API endpoint
      const searchUrl = `https://www.marinetraffic.com/en/global_search/search?term=${mmsi}`;

      this.logger.debug(`Searching MarineTraffic for MMSI ${mmsi}: ${searchUrl}`);

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-US,en;q=0.9',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: 'https://www.marinetraffic.com/',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        this.logger.warn(`Search failed for ${mmsi}: HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();

      // Response format: { results: [...], hasMoreResults: bool }
      if (data.results && Array.isArray(data.results) && data.results.length > 0) {
        // Find MMSI type result matching our search
        const vessel = data.results.find(
          (item: any) =>
            item.type === 'MMSI' && (item.value === parseInt(mmsi) || item.value === mmsi),
        );

        if (vessel && vessel.id) {
          this.logger.debug(`Found shipId ${vessel.id} for MMSI ${mmsi}: ${vessel.desc}`);
          return vessel.id.toString();
        }
      }

      this.logger.debug(`No shipId found in search results for MMSI ${mmsi}`);
      return null;
    } catch (error: any) {
      this.logger.warn(`Failed to search shipId for ${mmsi}: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse HTML response from MarineTraffic details page
   * Based on the HTML structure provided
   */
  private parseMarineTrafficHtml(html: string, mmsi: string): VesselEnrichmentData | null {
    try {
      const $ = cheerio.load(html);

      const data: Partial<VesselEnrichmentData> = {
        mmsi,
      };

      // Parse from vesselDetails_generalSection table
      const generalSection = $('#vesselDetails_generalSection');
      if (generalSection.length === 0) {
        this.logger.warn('General section not found in HTML');
        return null;
      }

      // Extract data from table rows
      generalSection.find('tbody tr').each((_, row) => {
        const $row = $(row);
        const label = $row.find('th').text().trim();
        const value = $row.find('td').text().trim();

        switch (label) {
          case 'Name':
            data.vesselName = value;
            break;
          case 'Flag':
            // Extract country name after flag emoji
            const flagMatch = value.match(/\s+(.+)$/);
            data.flag = flagMatch ? flagMatch[1].trim() : value;
            break;
          case 'IMO':
            data.imo = value;
            break;
          case 'MMSI':
            data.mmsi = value;
            break;
          case 'Call sign':
            data.callSign = value;
            break;
          case 'General vessel type':
            if (!value.includes('Upgrade to unlock')) {
              data.vesselType = value;
            }
            break;
          case 'Detailed vessel type':
            if (!value.includes('Upgrade to unlock')) {
              // Use detailed type if available, otherwise keep general type
              data.vesselType = value;
            }
            break;
          case 'Port of registry':
            if (!value.includes('Upgrade to unlock')) {
              data.homePort = value;
            }
            break;
          case 'Year built':
            if (!value.includes('Upgrade to unlock')) {
              const year = parseInt(value);
              if (!isNaN(year)) {
                data.yearBuilt = year;
              }
            }
            break;
        }
      });

      // Extract voyage information
      const voyageSection = $('.MuiGrid2-root');
      voyageSection.find('.MuiStack-root').each((_, stack) => {
        const $stack = $(stack);
        const label = $stack.find('.MuiTypography-caption').first().text().trim();

        if (label.includes('Departure from')) {
          // Extract departure port
          const portCode = $stack.find('a b').text().trim();
          if (portCode && !data.homePort) {
            data.homePort = portCode;
          }
        }
      });

      // Extract destination from voyage info
      const destText = voyageSection.find('p[aria-label*="Destination"]').text().trim();
      if (destText && !destText.includes('not recognized')) {
        data.destination = destText;
      }

      // Calculate quality score
      data.dataQualityScore = this.calculateQualityScore(data);

      // Return null if no useful data was extracted
      if (!data.vesselName && !data.imo && !data.vesselType) {
        this.logger.warn('No useful data extracted from MarineTraffic HTML');
        return null;
      }

      return data as VesselEnrichmentData;
    } catch (error: any) {
      this.logger.warn(`Failed to parse MarineTraffic HTML for ${mmsi}: ${error.message}`);
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://www.marinetraffic.com', {
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

  private calculateQualityScore(data: Partial<VesselEnrichmentData>): number {
    let score = 0;
    const fields: (keyof VesselEnrichmentData)[] = [
      'mmsi',
      'imo',
      'vesselName',
      'vesselType',
      'flag',
      'callSign',
      'yearBuilt',
      'homePort',
      'destination',
    ];

    fields.forEach((field) => {
      const value = data[field];
      if (value && value !== '' && value !== 'Unknown') {
        score += 10;
      }
    });

    return Math.min(100, score);
  }

  async fetchByImo(imo: string): Promise<VesselEnrichmentData | null> {
    try {
      await this.respectRateLimit();

      // Use the global search API endpoint
      const searchUrl = `https://www.marinetraffic.com/en/global_search/search?term=${imo}`;

      this.logger.debug(`Searching MarineTraffic by IMO ${imo}: ${searchUrl}`);

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-US,en;q=0.9',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: 'https://www.marinetraffic.com/',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        this.logger.warn(`Search by IMO failed for ${imo}: HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();

      // Response format: { results: [...], hasMoreResults: bool }
      if (data.results && Array.isArray(data.results) && data.results.length > 0) {
        // Find IMO type result
        const vessel = data.results.find(
          (item: any) => item.type === 'IMO' || item.type === 'MMSI',
        );

        if (vessel && vessel.id) {
          this.logger.debug(`Found shipId ${vessel.id} for IMO ${imo}: ${vessel.desc}`);

          // If we got a result, fetch details using shipId
          const url = `https://www.marinetraffic.com/en/ais/details/ships/shipid:${vessel.id}`;
          const detailsResponse = await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              Referer: 'https://www.marinetraffic.com/',
            },
            signal: AbortSignal.timeout(15000),
          });

          if (detailsResponse.ok) {
            const html = await detailsResponse.text();
            return this.parseMarineTrafficHtml(html, vessel.value?.toString() || '');
          }
        }
      }

      this.logger.debug(`No shipId found for IMO ${imo}`);
      return null;
    } catch (error: any) {
      this.logger.warn(`MarineTraffic fetch by IMO error for ${imo}: ${error.message}`);
      return null;
    }
  }
}
