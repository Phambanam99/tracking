import { VesselDataSource, VesselEnrichmentData } from '../interfaces/vessel-data-source.interface';
import { Logger } from '@nestjs/common';

/**
 * MyShipTracking public data source
 * Scrapes vessel information from MyShipTracking vessel detail page
 */
export class MyShipTrackingScraper implements VesselDataSource {
  name = 'MyShipTracking';
  priority = 2;
  rateLimit = 5; // Conservative: 5 requests per minute
  private lastRequestTime = 0;
  private minDelay = (60 * 1000) / this.rateLimit; // 12 seconds between requests
  private readonly logger = new Logger(MyShipTrackingScraper.name);

  async fetchByMmsi(mmsi: string): Promise<VesselEnrichmentData | null> {
    try {
      await this.respectRateLimit();

      // Use vessel detail page URL
      const url = `https://www.myshiptracking.com/vessels/us-gov-vessel-mmsi-${mmsi}-imo-0`;
      this.logger.debug(`Fetching MyShipTracking page for MMSI ${mmsi}: ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      });

      this.logger.debug(`MyShipTracking response for ${mmsi}: HTTP ${response.status}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const parsed = this.parseMyShipTrackingHtml(html, mmsi);

      if (parsed) {
        this.logger.log(
          `Parsed MyShipTracking: mmsi=${mmsi}, name=${parsed.vesselName || '-'}, imo=${parsed.imo || '-'}, score=${parsed.dataQualityScore ?? '-'}`,
        );
      } else {
        this.logger.warn(`MyShipTracking parse returned null for mmsi=${mmsi}`);
      }

      return parsed;
    } catch (error: any) {
      this.logger.warn(`MyShipTracking fetch error for ${mmsi}: ${error.message}`);
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://www.myshiptracking.com', {
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
   * Parse HTML from MyShipTracking vessel detail page
   * Extracts vessel information from the info table
   */
  private parseMyShipTrackingHtml(html: string, mmsi: string): VesselEnrichmentData | null {
    try {
      // Extract vessel name from breadcrumb or title
      const nameMatch = html.match(
        /<li[^>]*class="breadcrumb-item active"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
      );
      const vesselName = nameMatch ? nameMatch[1]?.trim() : undefined;

      // Extract IMO from table
      const imoMatch = html.match(/<th>IMO<\/th>\s*<td>([0-9]+)<\/td>/i);

      // Extract MMSI from table (for validation)
      const mmsiMatch = html.match(/<th>MMSI<\/th>\s*<td>([0-9]+)<\/td>/i);
      if (!mmsiMatch || mmsiMatch[1] !== mmsi) {
        // MMSI mismatch or not found
        return null;
      }

      // Extract Flag - Pattern: <img ... title="China"> China
      const flagMatch = html.match(
        /<th>Flag<\/th>\s*<td><div[^>]*><img[^>]*title="([^"]+)"[^>]*>\s*([^<]+)<\/div><\/td>/i,
      );

      // Extract Call Sign
      const callSignMatch = html.match(/<th>Call Sign<\/th>\s*<td>([^<-]+)<\/td>/i);

      // Extract Size - Pattern: 55 x 9 m
      const sizeMatch = html.match(/<th>Size<\/th>\s*<td>([0-9]+)\s*x\s*([0-9]+)\s*m<\/td>/i);

      // Extract GT (Gross Tonnage)
      const gtMatch = html.match(/<th>GT<\/th>\s*<td>([0-9]+)<\/td>/i);

      // Extract DWT (Deadweight)
      const dwtMatch = html.match(/<th>DWT<\/th>\s*<td>([0-9]+)<\/td>/i);

      // Extract Build year
      const buildMatch = html.match(/<th>Build<\/th>\s*<td>([0-9]{4})<\/td>/i);

      // Extract vessel type from breadcrumb or icon
      const typeMatch = html.match(
        /<a href="\/vessels\?vessel_type=[0-9]+"[^>]*><span[^>]*>([^<]+)<\/span>/i,
      );

      // Calculate quality score based on fields found
      let fieldsFound = 0;
      const totalFields = 9;
      if (vesselName) fieldsFound++;
      if (imoMatch && imoMatch[1] !== '0' && imoMatch[1] !== '---') fieldsFound++;
      if (mmsiMatch) fieldsFound++;
      if (flagMatch) fieldsFound++;
      if (callSignMatch && callSignMatch[1]?.trim() !== '---') fieldsFound++;
      if (sizeMatch) fieldsFound++;
      if (gtMatch && gtMatch[1] !== '---') fieldsFound++;
      if (dwtMatch && dwtMatch[1] !== '---') fieldsFound++;
      if (buildMatch && buildMatch[1] !== '---') fieldsFound++;

      const dataQualityScore = Math.round((fieldsFound / totalFields) * 100);

      return {
        mmsi,
        imo: imoMatch && imoMatch[1] !== '0' && imoMatch[1] !== '---' ? imoMatch[1] : undefined,
        vesselName: vesselName !== 'Unknown' ? vesselName : undefined,
        vesselType: typeMatch ? typeMatch[1]?.trim() : undefined,
        flag: flagMatch ? flagMatch[2]?.trim() : undefined,
        callSign:
          callSignMatch && callSignMatch[1]?.trim() !== '---'
            ? callSignMatch[1]?.trim()
            : undefined,
        length: sizeMatch ? parseInt(sizeMatch[1]) : undefined,
        width: sizeMatch ? parseInt(sizeMatch[2]) : undefined,
        grossTonnage: gtMatch && gtMatch[1] !== '---' ? parseInt(gtMatch[1]) : undefined,
        deadweight: dwtMatch && dwtMatch[1] !== '---' ? parseInt(dwtMatch[1]) : undefined,
        yearBuilt: buildMatch && buildMatch[1] !== '---' ? parseInt(buildMatch[1]) : undefined,
        dataQualityScore,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse MyShipTracking HTML for ${mmsi}:`, error.message);
      return null;
    }
  }
}
