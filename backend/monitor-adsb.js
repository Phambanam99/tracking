/**
 * Real-time ADSB System Monitor
 * Monitors: Redis hash, Bull queue, Pub/Sub messages
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

let messageCount = 0;
let lastMessageTime = null;

// Subscribe to aircraft updates
subscriber.subscribe('aircraft:position:update', (err) => {
  if (err) {
    console.error('❌ Failed to subscribe:', err);
  } else {
    console.log('✅ Subscribed to aircraft:position:update\n');
  }
});

subscriber.on('message', (channel, message) => {
  messageCount++;
  lastMessageTime = new Date();
  
  try {
    const data = JSON.parse(message);
    // Only log every 10th message to avoid spam
    if (messageCount % 10 === 0) {
      console.log(`📨 Message #${messageCount}: ${data.flightId || data.aircraftId}`);
    }
  } catch (e) {
    // Ignore parse errors
  }
});

console.log('📊 ADSB System Monitor');
console.log('======================\n');

// Monitor stats every 5 seconds
setInterval(async () => {
  try {
    const hashSize = await redis.hlen('adsb:current_flights');
    const queueWait = await redis.llen('bull:adsb-processing:wait');
    const queueActive = await redis.llen('bull:adsb-processing:active');
    const queueFailed = await redis.llen('bull:adsb-processing:failed');
    const queueCompleted = await redis.llen('bull:adsb-processing:completed');
    
    const now = new Date();
    const timeSinceLastMsg = lastMessageTime 
      ? Math.round((now - lastMessageTime) / 1000) 
      : '∞';
    
    console.log(`[${now.toLocaleTimeString()}]`);
    console.log(`  Redis Aircraft:  ${hashSize.toString().padStart(5)}`);
    console.log(`  Queue Active:    ${queueActive.toString().padStart(5)}`);
    console.log(`  Queue Waiting:   ${queueWait.toString().padStart(5)}`);
    console.log(`  Queue Failed:    ${queueFailed.toString().padStart(5)}`);
    console.log(`  Messages Total:  ${messageCount.toString().padStart(5)}`);
    console.log(`  Last Message:    ${timeSinceLastMsg}s ago`);
    
    // Warnings
    if (hashSize === 0) {
      console.log('  ⚠️  WARNING: No aircraft in Redis!');
    }
    if (queueFailed > 0) {
      console.log(`  ⚠️  WARNING: ${queueFailed} failed jobs in queue!`);
    }
    if (lastMessageTime && timeSinceLastMsg > 60) {
      console.log(`  ⚠️  WARNING: No messages for ${timeSinceLastMsg}s!`);
    }
    
    console.log('');
  } catch (error) {
    console.error('❌ Monitoring error:', error.message);
  }
}, 5000);

// Handle exit
process.on('SIGINT', async () => {
  console.log('\n\n📊 Final Summary:');
  console.log(`  Total messages received: ${messageCount}`);
  await redis.quit();
  await subscriber.quit();
  process.exit(0);
});

console.log('Press Ctrl+C to stop monitoring\n');
