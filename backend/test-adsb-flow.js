/**
 * Script to test ADSB data flow
 * Run: node test-adsb-flow.js
 */

const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

const subscriber = new Redis({
  host: 'localhost',
  port: 6379,
});

async function testADSBFlow() {
  console.log('🔍 Testing ADSB Data Flow...\n');

  // 1. Check Redis hash for current flights
  console.log('1️⃣ Checking Redis hash "adsb:current_flights"...');
  const hashSize = await redis.hlen('adsb:current_flights');
  console.log(`   ✅ Found ${hashSize} aircraft in Redis hash\n`);

  if (hashSize > 0) {
    // Get a sample aircraft
    const allKeys = await redis.hkeys('adsb:current_flights');
    const sampleKey = allKeys[0];
    const sampleData = await redis.hget('adsb:current_flights', sampleKey);
    console.log(`   Sample aircraft (${sampleKey}):`, JSON.parse(sampleData));
    console.log('');
  }

  // 2. Subscribe to Redis channel
  console.log('2️⃣ Subscribing to Redis channel "aircraft:position:update"...');
  let messageCount = 0;
  
  subscriber.subscribe('aircraft:position:update', (err) => {
    if (err) {
      console.error('   ❌ Failed to subscribe:', err);
    } else {
      console.log('   ✅ Subscribed successfully');
      console.log('   ⏳ Waiting for messages (30 seconds)...\n');
    }
  });

  subscriber.on('message', (channel, message) => {
    messageCount++;
    console.log(`   📨 Message #${messageCount} received on channel "${channel}":`, message.substring(0, 200));
  });

  // Wait 30 seconds for messages
  await new Promise(resolve => setTimeout(resolve, 30000));

  console.log(`\n3️⃣ Summary:`);
  console.log(`   - Aircraft in Redis: ${hashSize}`);
  console.log(`   - Messages received: ${messageCount}`);
  
  if (hashSize === 0) {
    console.log('\n⚠️  WARNING: No aircraft in Redis! Check if ADSB Collector is running.');
  }
  
  if (messageCount === 0) {
    console.log('\n⚠️  WARNING: No messages on Redis channel! Check if processor is publishing updates.');
  }

  if (hashSize > 0 && messageCount > 0) {
    console.log('\n✅ ADSB data flow is working correctly!');
  }

  await redis.quit();
  await subscriber.quit();
  process.exit(0);
}

testADSBFlow().catch(console.error);
