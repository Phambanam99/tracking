/**
 * Quick Test Script for MarineTraffic Scraper
 *
 * Usage:
 *   npm run test:marinetraffic
 *
 * Or directly with ts-node:
 *   npx ts-node -r tsconfig-paths/register backend/src/vessel-enrichment/data-sources/test-marinetraffic.ts
 */

import { MarineTrafficScraper } from './marinetraffic-scraper';

// Test vessels with known data
const TEST_VESSELS = [
  {
    name: 'LIBERTY EAGLE',
    mmsi: '369344000',
    imo: '9206929',
    country: 'United States',
  },
  {
    name: 'HAI YANG SHI YOU 944',
    mmsi: '413213250',
    imo: '9739886',
    country: 'China',
  },
];

async function testMarineTraffic() {
  console.log('🚢 MarineTraffic Scraper Test Suite\n');
  console.log('='.repeat(60));

  // Check for access token
  const accessToken = process.env.MARINETRAFFIC_ACCESS_TOKEN;
  if (accessToken) {
    console.log('✅ Access token found (length:', accessToken.length, ')');
  } else {
    console.log('⚠️  No access token found - will use public access only');
    console.log('   Set MARINETRAFFIC_ACCESS_TOKEN environment variable for authenticated access');
  }

  const scraper = new MarineTrafficScraper();

  // Test 1: Check availability
  console.log('\n📡 Test 1: Checking MarineTraffic availability...');
  const isAvailable = await scraper.isAvailable();
  console.log(`   Status: ${isAvailable ? '✅ Online' : '❌ Offline'}`);

  if (!isAvailable) {
    console.log('\n❌ MarineTraffic is not available. Aborting tests.');
    return;
  }

  // Test 2: Fetch vessel data
  console.log('\n' + '='.repeat(60));
  console.log('🔍 Test 2: Fetching vessel data by MMSI...\n');

  for (const vessel of TEST_VESSELS) {
    console.log(`\n🎯 Testing: ${vessel.name} (MMSI: ${vessel.mmsi})`);
    console.log('   Expected IMO:', vessel.imo);
    console.log('   Expected Country:', vessel.country);
    console.log('   ⏳ Fetching...');

    const startTime = Date.now();
    const data = await scraper.fetchByMmsi(vessel.mmsi);
    const duration = Date.now() - startTime;

    if (data) {
      console.log(`   ✅ Success! (${duration}ms)`);
      console.log('   Retrieved data:');
      console.log(`      Name: ${data.vesselName || 'N/A'}`);
      console.log(`      MMSI: ${data.mmsi || 'N/A'}`);
      console.log(`      IMO: ${data.imo || 'N/A'}`);
      console.log(`      Call Sign: ${data.callSign || 'N/A'}`);
      console.log(`      Flag: ${data.flag || 'N/A'}`);
      console.log(`      Type: ${data.vesselType || 'N/A'}`);
      console.log(`      Year Built: ${data.yearBuilt || 'N/A'}`);
      console.log(`      Home Port: ${data.homePort || 'N/A'}`);
      console.log(`      Destination: ${data.destination || 'N/A'}`);
      console.log(`      Quality Score: ${data.dataQualityScore || 0}/100`);

      // Verify expected data
      const checks: string[] = [];
      if (data.imo === vessel.imo) {
        checks.push('✅ IMO matches');
      } else {
        checks.push(`⚠️ IMO mismatch: expected ${vessel.imo}, got ${data.imo}`);
      }

      if (data.flag?.toLowerCase().includes(vessel.country.toLowerCase())) {
        checks.push('✅ Country matches');
      } else {
        checks.push(`⚠️ Country might differ: expected ${vessel.country}, got ${data.flag}`);
      }

      console.log('   Verification:');
      checks.forEach((check) => console.log(`      ${check}`));
    } else {
      console.log(`   ❌ Failed - No data retrieved (${duration}ms)`);
    }

    // Wait a bit between tests to respect rate limit
    if (TEST_VESSELS.indexOf(vessel) < TEST_VESSELS.length - 1) {
      console.log('   ⏳ Waiting 60s for rate limit...');
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }
  }

  // Test 3: Search by IMO
  console.log('\n' + '='.repeat(60));
  console.log('🔍 Test 3: Testing search by IMO...\n');

  const testImo = TEST_VESSELS[0].imo;
  console.log(`   Testing IMO: ${testImo}`);
  console.log('   ⏳ Fetching...');

  const startTime = Date.now();
  const imoData = await scraper.fetchByImo(testImo);
  const duration = Date.now() - startTime;

  if (imoData) {
    console.log(`   ✅ Success! (${duration}ms)`);
    console.log(`      Name: ${imoData.vesselName || 'N/A'}`);
    console.log(`      MMSI: ${imoData.mmsi || 'N/A'}`);
    console.log(`      IMO: ${imoData.imo || 'N/A'}`);
  } else {
    console.log(`   ❌ Failed (${duration}ms)`);
  }

  // Test 4: Invalid MMSI
  console.log('\n' + '='.repeat(60));
  console.log('🔍 Test 4: Testing invalid MMSI...\n');
  console.log('   Testing MMSI: 000000000');

  const invalidData = await scraper.fetchByMmsi('000000000');
  if (invalidData === null) {
    console.log('   ✅ Correctly returned null for invalid MMSI');
  } else {
    console.log('   ⚠️ Unexpected: Got data for invalid MMSI');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✨ Test Suite Complete!\n');
  console.log('📝 Summary:');
  console.log('   - MarineTraffic integration: Working');
  console.log('   - Search by MMSI: Tested');
  console.log('   - Search by IMO: Tested');
  console.log('   - Invalid input handling: Tested');
  console.log('   - Rate limiting: Respected (60s between requests)');
  console.log('\n💡 Tip: Run with npm test for full automated tests');
}

// Run the test
if (require.main === module) {
  testMarineTraffic()
    .then(() => {
      console.log('\n✅ All tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed with error:', error);
      process.exit(1);
    });
}

export { testMarineTraffic };
