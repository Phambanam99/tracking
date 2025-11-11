import { VesselDataSource, VesselEnrichmentData } from '../interfaces/vessel-data-source.interface';
import { Logger } from '@nestjs/common';

/**
 * VesselFinder public data scraper
 * Uses publicly available information from VesselFinder website
 * Note: This is a basic implementation using public pages
 * For production, consider using official API if available
 */
export class VesselFinderScraper implements VesselDataSource {
  name = 'VesselFinder';
  priority = 1;
  rateLimit = 1; // 1 request per minute (extremely conservative)
  private lastRequestTime = 0;
  private minDelay = (60 * 1000) / this.rateLimit; // 60 seconds between requests
  private consecutiveErrors = 0;
  private readonly logger = new Logger(VesselFinderScraper.name);

  async fetchByMmsi(mmsi: string): Promise<VesselEnrichmentData | null> {
    try {
      await this.respectRateLimit();

      // Scrape from VesselFinder public website (not using unreliable API)
      // Using direct vessel page scraping as conservative approach
      const url = `https://www.vesselfinder.com/vessels/details/${mmsi}`;
      this.logger.debug(`Fetching VesselFinder details page for MMSI ${mmsi}: ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://www.vesselfinder.com/',
        },
        signal: AbortSignal.timeout(15000), // 15s timeout (more patient)
      });

      this.logger.debug(`VesselFinder response for ${mmsi}: HTTP ${response.status}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          this.consecutiveErrors = 0;
          return null;
        }
        if (response.status === 406 || response.status === 429) {
          // Rate limited or blocked - increase delay
          this.consecutiveErrors++;
          this.logger.warn(
            `VesselFinder rate limit hit for ${mmsi} (HTTP ${response.status}). Consecutive errors: ${this.consecutiveErrors}`,
          );
          
          // Add exponential backoff on consecutive errors
          if (this.consecutiveErrors > 2) {
            const backoffDelay = Math.min(300000, this.minDelay * Math.pow(2, this.consecutiveErrors - 2));
            this.logger.warn(`Adding backoff delay: ${backoffDelay / 1000}s`);
            await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          }
          
          throw new Error(`HTTP ${response.status} - Rate limited`);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      // Success - reset error counter
      this.consecutiveErrors = 0;

      const html = await response.text();
      const parsed = this.parseVesselFinderHtml(html, mmsi);
      if (parsed) {
        const msg = `Parsed VesselFinder: mmsi=${mmsi}, name=${parsed.vesselName || '-'}, imo=${parsed.imo || '-'}, score=${parsed.dataQualityScore ?? '-'}`;
        this.logger.log(msg);
      } else {
        this.logger.warn(`VesselFinder parse returned null for mmsi=${mmsi}`);
      }
      return parsed;
    } catch (error: any) {
      this.logger.warn(`VesselFinder fetch error for ${mmsi}: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse HTML response from VesselFinder details page
   * Extracts vessel info from the details page structure
   */
  private parseVesselFinderHtml(html: string, mmsi: string): VesselEnrichmentData | null {
    try {
      // Extract from h1 title
      const titleMatch = html.match(/<h1[^>]*class="title"[^>]*>([^<]+)<\/h1>/);
      if (!titleMatch) return null;

      const vesselName = titleMatch[1]?.trim();
      if (!vesselName) return null;

      // Extract IMO from page content
      // Pattern: "IMO 9548055" or in table "IMO number</td><td>9548055"
      const imoMatch =
        html.match(/IMO[^0-9]*(\d{7})/i) ||
        html.match(/<td[^>]*>IMO number<\/td>\s*<td[^>]*>(\d+)<\/td>/i);

      // Extract Call Sign - Pattern: "Callsign</td><td>BSGK"
      const callSignMatch = html.match(/<td[^>]*>Callsign<\/td>\s*<td[^>]*>([A-Z0-9]+)<\/td>/i);

      // Extract Ship Type - Pattern: "Search & Rescue Vessel"
      const shipTypeMatch = html.match(/<h2[^>]*class="vst"[^>]*>([^<]+)<\/h2>/);

      // Extract Flag - Pattern: "Flag</td><td>China"
      const flagMatch = html.match(/<td[^>]*>Flag<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);

      // Extract Year Built
      const yearMatch = html.match(/<td[^>]*>Year of Build<\/td>\s*<td[^>]*>(\d{4})<\/td>/i);

      // Extract Length Overall (in meters)
      const lengthMatch = html.match(
        /<td[^>]*>Length Overall[^<]*<\/td>\s*<td[^>]*>([0-9.]+)<\/td>/i,
      );

      // Extract Beam/Width (in meters)
      const beamMatch = html.match(/<td[^>]*>Beam[^<]*<\/td>\s*<td[^>]*>([0-9.]+)<\/td>/i);

      // Extract Gross Tonnage
      const tonMatch = html.match(/<td[^>]*>Gross Tonnage<\/td>\s*<td[^>]*>([0-9]+)<\/td>/i);

      // Extract Destination
      const destMatch = html.match(/en route to\s*<strong>([^<]+)<\/strong>/i);

      // Calculate quality score based on fields found
      let fieldsFound = 0;
      const totalFields = 8;
      if (vesselName) fieldsFound++;
      if (imoMatch) fieldsFound++;
      if (callSignMatch) fieldsFound++;
      if (shipTypeMatch) fieldsFound++;
      if (flagMatch) fieldsFound++;
      if (yearMatch) fieldsFound++;
      if (lengthMatch) fieldsFound++;
      if (tonMatch) fieldsFound++;

      const dataQualityScore = Math.round((fieldsFound / totalFields) * 100);

      return {
        mmsi,
        imo: imoMatch ? imoMatch[1] : undefined,
        vesselName,
        vesselType: shipTypeMatch ? shipTypeMatch[1]?.trim().split(',')[0] : undefined,
        flag: flagMatch ? flagMatch[1]?.trim() : undefined,
        callSign: callSignMatch ? callSignMatch[1]?.trim() : undefined,
        length: lengthMatch ? parseInt(lengthMatch[1]) : undefined,
        width: beamMatch ? parseFloat(beamMatch[1]) : undefined,
        yearBuilt: yearMatch ? parseInt(yearMatch[1]) : undefined,
        grossTonnage: tonMatch ? parseInt(tonMatch[1]) : undefined,
        destination: destMatch ? destMatch[1]?.trim() : undefined,
        dataQualityScore,
      };
    } catch (error: any) {
      console.warn(`Failed to parse VesselFinder HTML for ${mmsi}:`, error.message);
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://www.vesselfinder.com', {
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

  private parseVesselFinderData(data: any): VesselEnrichmentData | null {
    if (!data || !data.mmsi) return null;

    return {
      mmsi: data.mmsi?.toString(),
      imo: data.imo?.toString(),
      vesselName: data.name || data.shipname,
      vesselType: data.type || data.shiptype,
      flag: data.flag || data.country,
      callSign: data.callsign || data.call_sign,
      length: data.length ? parseInt(data.length) : undefined,
      width: data.width || data.beam ? parseInt(data.width || data.beam) : undefined,
      draught: data.draught ? parseFloat(data.draught) : undefined,
      destination: data.destination || data.dest,
      yearBuilt: data.year || data.year_built ? parseInt(data.year || data.year_built) : undefined,
      grossTonnage:
        data.gt || data.gross_tonnage ? parseInt(data.gt || data.gross_tonnage) : undefined,
      deadweight: data.dwt || data.deadweight ? parseInt(data.dwt || data.deadweight) : undefined,
      dataQualityScore: this.calculateQualityScore(data),
    };
  }

  private calculateQualityScore(data: any): number {
    let score = 0;
    const fields = [
      'mmsi',
      'imo',
      'name',
      'type',
      'flag',
      'callsign',
      'length',
      'width',
      'year',
      'gt',
    ];
    fields.forEach((field) => {
      if (data[field] && data[field] !== '' && data[field] !== 'Unknown') {
        score += 10;
      }
    });
    return Math.min(100, score);
  }
}
