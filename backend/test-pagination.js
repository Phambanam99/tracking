// Simple test script to verify pagination is working
const https = require('http');

async function testPagination() {
  console.log('🔄 Testing pagination endpoints...\n');

  // Test vessels pagination
  console.log('📡 Testing vessels pagination:');
  try {
    const vesselUrl = 'http://localhost:4000/vessels/initial?page=1&pageSize=100';
    console.log(`GET ${vesselUrl}`);

    const vesselResponse = await fetch(vesselUrl);
    const vesselData = await vesselResponse.json();

    if (vesselData.data && Array.isArray(vesselData.data)) {
      console.log(`✅ Vessels: Loaded ${vesselData.data.length} items`);
      console.log(
        `   Total: ${vesselData.total}, Page: ${vesselData.page}, PageSize: ${vesselData.pageSize}, TotalPages: ${vesselData.totalPages}`,
      );
    } else if (Array.isArray(vesselData)) {
      console.log(`⚠️  Vessels: Got array response (legacy format), length: ${vesselData.length}`);
    } else {
      console.log(`❌ Vessels: Unexpected response format:`, vesselData);
    }
  } catch (error) {
    console.log(`❌ Vessels error:`, error.message);
  }

  console.log('');

  // Test aircrafts pagination
  console.log('✈️  Testing aircrafts pagination:');
  try {
    const aircraftUrl = 'http://localhost:4000/aircrafts/initial?page=1&pageSize=100';
    console.log(`GET ${aircraftUrl}`);

    const aircraftResponse = await fetch(aircraftUrl);
    const aircraftData = await aircraftResponse.json();

    if (aircraftData.data && Array.isArray(aircraftData.data)) {
      console.log(`✅ Aircrafts: Loaded ${aircraftData.data.length} items`);
      console.log(
        `   Total: ${aircraftData.total}, Page: ${aircraftData.page}, PageSize: ${aircraftData.pageSize}, TotalPages: ${aircraftData.totalPages}`,
      );
    } else if (Array.isArray(aircraftData)) {
      console.log(
        `⚠️  Aircrafts: Got array response (legacy format), length: ${aircraftData.length}`,
      );
    } else {
      console.log(`❌ Aircrafts: Unexpected response format:`, aircraftData);
    }
  } catch (error) {
    console.log(`❌ Aircrafts error:`, error.message);
  }

  console.log('\n🏁 Pagination test completed');
}

// Add fetch polyfill for Node.js
global.fetch = require('node-fetch');

testPagination().catch(console.error);
