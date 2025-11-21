/**
 * Test ADSB Collector Health
 */

async function testHealth() {
  console.log('🏥 Testing ADSB Collector Health...\n');

  const url = 'http://localhost:3001/api/aircrafts/adsb/health';
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
      process.exit(1);
    }

    const health = await response.json();
    
    console.log('📊 ADSB Collector Health Status:');
    console.log('================================');
    console.log(`Enabled:                ${health.enabled ? '✅' : '❌'}`);
    console.log(`Stream Active:          ${health.isStreamActive ? '✅' : '❌'}`);
    console.log(`Reconnection Attempts:  ${health.reconnectionAttempts}/${health.maxReconnectionAttempts}`);
    console.log(`Active Jobs:            ${health.activeJobs}/${health.maxConcurrentBatches}`);
    console.log(`External API URL:       ${health.externalApiUrl}`);
    console.log(`Timestamp:              ${health.timestamp}`);
    console.log('');

    // Diagnose issues
    if (!health.enabled) {
      console.log('⚠️  WARNING: ADSB Collector is DISABLED');
      console.log('   Set ADSB_COLLECTOR_ENABLED=true in .env file\n');
    }

    if (health.enabled && !health.isStreamActive) {
      console.log('⚠️  WARNING: ADSB Collector is enabled but stream is NOT active');
      
      if (health.reconnectionAttempts >= health.maxReconnectionAttempts) {
        console.log('   ❌ Max reconnection attempts reached!');
        console.log('   Restart the backend to reset the collector\n');
      } else {
        console.log('   Stream may be starting up or experiencing connection issues\n');
      }
    }

    if (health.enabled && health.isStreamActive) {
      console.log('✅ ADSB Collector is running normally!');
      
      if (health.activeJobs === 0) {
        console.log('   ℹ️  No active jobs - waiting for data from stream\n');
      } else {
        console.log(`   📦 Processing ${health.activeJobs} batches\n`);
      }
    }

  } catch (error) {
    console.error(`❌ Failed to connect to backend: ${error.message}`);
    console.error('   Make sure backend is running on port 3001\n');
    process.exit(1);
  }
}

testHealth();
