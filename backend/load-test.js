/**
 * Load Test Script
 *
 * Tests system with 10k messages/sec for 5 minutes
 *
 * Usage: node load-test.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const TARGET_RPS = 10000; // 10k requests per second
const DURATION_MINUTES = 5;
const BATCH_SIZE = 100;

let successCount = 0;
let errorCount = 0;
let totalLatency = 0;

function generateVesselPosition() {
  return {
    mmsi: `${Math.floor(Math.random() * 900000000) + 100000000}`,
    latitude: Math.random() * 180 - 90,
    longitude: Math.random() * 360 - 180,
    speed: Math.random() * 30,
    course: Math.random() * 360,
    timestamp: new Date().toISOString(),
  };
}

async function sendBatch() {
  const batch = Array.from({ length: BATCH_SIZE }, generateVesselPosition);
  const start = Date.now();

  try {
    await axios.post(`${BASE_URL}/api/vessels/positions/batch`, batch);
    successCount += BATCH_SIZE;
    totalLatency += Date.now() - start;
  } catch (e) {
    errorCount += BATCH_SIZE;
  }
}

async function runLoadTest() {
  console.log(`🚀 Starting load test: ${TARGET_RPS} msg/sec for ${DURATION_MINUTES} minutes`);
  console.log(`Batch size: ${BATCH_SIZE}`);

  const batchesPerSecond = TARGET_RPS / BATCH_SIZE;
  const intervalMs = 1000 / batchesPerSecond;
  const totalDuration = DURATION_MINUTES * 60 * 1000;
  const startTime = Date.now();

  const interval = setInterval(async () => {
    if (Date.now() - startTime > totalDuration) {
      clearInterval(interval);
      printResults();
      return;
    }

    await sendBatch();

    // Print progress every 10 seconds
    if (successCount % (TARGET_RPS * 10) === 0) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const avgLatency = totalLatency / (successCount / BATCH_SIZE);
      console.log(
        `[${elapsed}s] Success: ${successCount}, Errors: ${errorCount}, Avg Latency: ${avgLatency.toFixed(0)}ms`,
      );
    }
  }, intervalMs);
}

function printResults() {
  console.log('\n📊 Load Test Results:');
  console.log(`Total messages: ${successCount + errorCount}`);
  console.log(
    `Success: ${successCount} (${((successCount / (successCount + errorCount)) * 100).toFixed(2)}%)`,
  );
  console.log(
    `Errors: ${errorCount} (${((errorCount / (successCount + errorCount)) * 100).toFixed(2)}%)`,
  );
  console.log(`Average latency: ${(totalLatency / (successCount / BATCH_SIZE)).toFixed(0)}ms`);
  console.log(`Throughput: ${(successCount / (DURATION_MINUTES * 60)).toFixed(0)} msg/sec`);
}

runLoadTest();
