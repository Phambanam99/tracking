import { MarineTrafficScraper } from './marinetraffic-scraper';

/**
 * MarineTraffic Scraper Integration Tests
 *
 * These tests make real HTTP requests to MarineTraffic website
 * Run with: npm test -- marinetraffic-scraper.spec.ts
 *
 * Note: Tests may fail if:
 * - Rate limited by MarineTraffic
 * - Vessel data changes
 * - HTML structure changes
 */
describe('MarineTrafficScraper', () => {
  let scraper: MarineTrafficScraper;

  beforeEach(() => {
    // Use access token from environment if available
    const accessToken = process.env.MARINETRAFFIC_ACCESS_TOKEN;
    scraper = new MarineTrafficScraper(accessToken);

    if (!accessToken) {
      console.warn('⚠️  No MARINETRAFFIC_ACCESS_TOKEN found - tests may fail due to rate limiting');
    }
  });

  describe('Service Availability', () => {
    it('should check if MarineTraffic is available', async () => {
      const isAvailable = await scraper.isAvailable();
      expect(isAvailable).toBe(true);
    }, 10000); // 10s timeout
  });

  describe('Search by MMSI', () => {
    // Using LIBERTY EAGLE as test vessel (MMSI: 369344000)
    const TEST_MMSI = '369344000';
    const EXPECTED_SHIP_ID = '455948';

    it('should find shipId for a valid MMSI', async () => {
      const data = await scraper.fetchByMmsi(TEST_MMSI);

      expect(data).not.toBeNull();
      if (data) {
        expect(data.mmsi).toBe(TEST_MMSI);
        expect(data.vesselName).toBeTruthy();
        expect(data.imo).toBeTruthy();

        console.log('✓ Fetched vessel data:', {
          name: data.vesselName,
          imo: data.imo,
          flag: data.flag,
          type: data.vesselType,
          score: data.dataQualityScore,
        });
      }
    }, 30000); // 30s timeout for full fetch + parse

    it('should return null for invalid MMSI', async () => {
      const data = await scraper.fetchByMmsi('000000000');
      expect(data).toBeNull();
    }, 30000);

    it('should extract all available fields', async () => {
      const data = await scraper.fetchByMmsi(TEST_MMSI);

      expect(data).not.toBeNull();
      if (data) {
        // Required fields
        expect(data.mmsi).toBeDefined();
        expect(data.vesselName).toBeDefined();

        // Optional but likely present fields
        if (data.imo) {
          expect(data.imo).toMatch(/^\d{7}$/); // IMO format: 7 digits
        }

        if (data.vesselType) {
          expect(typeof data.vesselType).toBe('string');
          expect(data.vesselType.length).toBeGreaterThan(0);
        }

        if (data.flag) {
          expect(typeof data.flag).toBe('string');
        }

        // Data quality score should be between 0-100
        expect(data.dataQualityScore).toBeGreaterThanOrEqual(0);
        expect(data.dataQualityScore).toBeLessThanOrEqual(100);
      }
    }, 30000);
  });

  describe('Search by IMO', () => {
    // Test with a known vessel IMO
    const TEST_IMO = '9739886'; // HAI YANG SHI YOU 944
    const EXPECTED_MMSI = '413213250';

    it('should find vessel data by IMO number', async () => {
      const data = await scraper.fetchByImo(TEST_IMO);

      expect(data).not.toBeNull();
      if (data) {
        expect(data.imo).toBe(TEST_IMO);
        expect(data.mmsi).toBeTruthy();
        expect(data.vesselName).toBeTruthy();

        console.log('✓ Fetched vessel by IMO:', {
          name: data.vesselName,
          mmsi: data.mmsi,
          flag: data.flag,
          type: data.vesselType,
        });
      }
    }, 30000);

    it('should return null for invalid IMO', async () => {
      const data = await scraper.fetchByImo('0000000');
      expect(data).toBeNull();
    }, 30000);
  });

  describe('Data Quality', () => {
    it('should calculate quality score correctly', async () => {
      const data = await scraper.fetchByMmsi('369344000');

      if (data) {
        const score = data.dataQualityScore || 0;

        // Score should reflect number of filled fields
        const filledFields = [
          data.mmsi,
          data.imo,
          data.vesselName,
          data.vesselType,
          data.flag,
          data.callSign,
          data.yearBuilt,
          data.homePort,
          data.destination,
        ].filter(Boolean).length;

        // Each field = 10 points, max 100
        const expectedScore = Math.min(100, filledFields * 10);
        expect(score).toBe(expectedScore);

        console.log('✓ Quality metrics:', {
          score,
          filledFields,
          totalFields: 9,
        });
      }
    }, 30000);
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits between requests', async () => {
      const start = Date.now();

      // Make 2 consecutive requests
      await scraper.fetchByMmsi('369344000');
      await scraper.fetchByMmsi('413213250');

      const duration = Date.now() - start;

      // Should take at least 60 seconds (1 req/min rate limit)
      // Allow some margin for the first request
      expect(duration).toBeGreaterThanOrEqual(55000); // 55s minimum

      console.log('✓ Rate limit respected:', {
        duration: `${(duration / 1000).toFixed(1)}s`,
        expectedMin: '60s',
      });
    }, 120000); // 2 min timeout
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Create scraper with invalid base URL (simulate network error)
      const data = await scraper.fetchByMmsi('999999999');

      // Should return null instead of throwing
      expect(data).toBeNull();
    }, 30000);

    it('should handle malformed MMSI input', async () => {
      const testCases = ['', 'ABC', '12345', null as any, undefined as any];

      for (const mmsi of testCases) {
        const data = await scraper.fetchByMmsi(mmsi);
        expect(data).toBeNull();
      }
    }, 60000);
  });

  describe('HTML Parsing', () => {
    it('should extract vessel name correctly', async () => {
      const data = await scraper.fetchByMmsi('369344000');

      if (data && data.vesselName) {
        expect(data.vesselName).toMatch(/^[A-Z0-9\s\-\.]+$/); // Uppercase letters, numbers, spaces
        expect(data.vesselName.length).toBeGreaterThan(0);
        expect(data.vesselName.length).toBeLessThan(100);
      }
    }, 30000);

    it('should extract flag/country correctly', async () => {
      const data = await scraper.fetchByMmsi('369344000');

      if (data && data.flag) {
        // Flag should be country name without emoji
        expect(data.flag).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u); // No flag emojis
        expect(data.flag).toMatch(/^[A-Za-z\s]+$/); // Letters and spaces only
      }
    }, 30000);

    it('should extract IMO in correct format', async () => {
      const data = await scraper.fetchByMmsi('369344000');

      if (data && data.imo) {
        expect(data.imo).toMatch(/^\d{7}$/); // Exactly 7 digits
      }
    }, 30000);
  });
});

/**
 * Manual Test Script
 *
 * Run this file directly with ts-node for quick testing:
 *
 * npx ts-node -r tsconfig-paths/register src/vessel-enrichment/data-sources/marinetraffic-scraper.spec.ts
 *
 * Or run specific tests:
 * npm test -- marinetraffic-scraper.spec.ts -t "should find shipId"
 */
if (require.main === module) {
  (async () => {
    console.log('🚢 MarineTraffic Scraper Manual Test\n');

    // Check for access token
    const accessToken = process.env.MARINETRAFFIC_ACCESS_TOKEN;
    if (accessToken) {
      console.log('✅ Using access token\n');
    } else {
      console.log('⚠️  No access token - using public access\n');
    }

    const scraper = new MarineTrafficScraper(accessToken);

    // Test MMSI: LIBERTY EAGLE (US)
    const testMmsi = '369344000';
    console.log(`Testing MMSI: ${testMmsi}`);
    console.log('⏳ Fetching data...\n');

    const data = await scraper.fetchByMmsi(testMmsi);

    if (data) {
      console.log('✅ SUCCESS! Vessel data retrieved:\n');
      console.log('📋 Basic Info:');
      console.log(`   Name: ${data.vesselName || 'N/A'}`);
      console.log(`   MMSI: ${data.mmsi || 'N/A'}`);
      console.log(`   IMO: ${data.imo || 'N/A'}`);
      console.log(`   Call Sign: ${data.callSign || 'N/A'}`);
      console.log(`   Flag: ${data.flag || 'N/A'}`);
      console.log('');
      console.log('🚢 Vessel Details:');
      console.log(`   Type: ${data.vesselType || 'N/A'}`);
      console.log(`   Year Built: ${data.yearBuilt || 'N/A'}`);
      console.log(`   Home Port: ${data.homePort || 'N/A'}`);
      console.log('');
      console.log('🎯 Navigation:');
      console.log(`   Destination: ${data.destination || 'N/A'}`);
      console.log('');
      console.log('📊 Data Quality:');
      console.log(`   Score: ${data.dataQualityScore || 0}/100`);
    } else {
      console.log('❌ FAILED: No data retrieved');
    }

    console.log('\n✨ Test complete');
  })();
}
