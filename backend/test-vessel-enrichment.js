/**
 * Test script for Vessel Enrichment System
 * Run: node test-vessel-enrichment.js
 *
 * Prerequisites:
 * 1. Backend server running on http://localhost:3000
 * 2. Valid JWT token with ADMIN role
 */

const API_URL = 'http://localhost:3000';
const JWT_TOKEN = process.env.JWT_TOKEN || 'YOUR_JWT_TOKEN_HERE';

async function test() {
  console.log('🧪 Testing Vessel Enrichment System\n');

  // Test 1: Check scheduler status
  console.log('1️⃣ Checking scheduler status...');
  try {
    const response = await fetch(`${API_URL}/vessel-enrichment/scheduler/status`, {
      headers: { Authorization: `Bearer ${JWT_TOKEN}` },
    });
    const data = await response.json();
    console.log('✅ Scheduler status:', data);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 2: Get statistics
  console.log('\n2️⃣ Getting enrichment statistics...');
  try {
    const response = await fetch(`${API_URL}/vessel-enrichment/stats`, {
      headers: { Authorization: `Bearer ${JWT_TOKEN}` },
    });
    const data = await response.json();
    console.log('✅ Statistics:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 3: Get queue stats
  console.log('\n3️⃣ Getting queue statistics...');
  try {
    const response = await fetch(`${API_URL}/vessel-enrichment/queue/stats`, {
      headers: { Authorization: `Bearer ${JWT_TOKEN}` },
    });
    const data = await response.json();
    console.log('✅ Queue stats:', data);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 4: Queue unenriched vessels
  console.log('\n4️⃣ Queuing unenriched vessels (limit 10)...');
  try {
    const response = await fetch(`${API_URL}/vessel-enrichment/queue/unenriched?limit=10`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${JWT_TOKEN}` },
    });
    const data = await response.json();
    console.log('✅ Queue result:', data);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 5: Add specific vessel to queue
  console.log('\n5️⃣ Adding test vessel (MMSI: 412440890) to queue...');
  try {
    const response = await fetch(`${API_URL}/vessel-enrichment/queue`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mmsi: '412440890', priority: 10 }),
    });
    const data = await response.json();
    console.log('✅ Add to queue result:', data);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 6: Process queue (1 item)
  console.log('\n6️⃣ Processing queue (max 1 item)...');
  try {
    const response = await fetch(`${API_URL}/vessel-enrichment/queue/process?maxItems=1`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${JWT_TOKEN}` },
    });
    const data = await response.json();
    console.log('✅ Process result:', data);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 7: Get enrichment history
  console.log('\n7️⃣ Getting enrichment history for MMSI 412440890...');
  try {
    const response = await fetch(`${API_URL}/vessel-enrichment/history/412440890`, {
      headers: { Authorization: `Bearer ${JWT_TOKEN}` },
    });
    const data = await response.json();
    console.log('✅ History:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n✅ All tests completed!');
}

// Run tests
test().catch(console.error);
