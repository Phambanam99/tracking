/**
 * Deadlock Stress Test
 *
 * Tests concurrent upserts to verify deadlock fixes
 *
 * Usage: node deadlock-stress-test.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CONCURRENT_UPDATES = 50;
const ITERATIONS = 100;
const VESSEL_IDS = [1, 2, 3, 4, 5]; // Test with 5 vessels

let successCount = 0;
let errorCount = 0;
let deadlockCount = 0;

async function concurrentUpdate(vesselId, iteration) {
  try {
    await prisma.$executeRaw`
      INSERT INTO "VesselPosition" 
      ("vesselId", latitude, longitude, timestamp, source, score)
      VALUES 
      (${vesselId}, ${Math.random() * 180 - 90}, ${Math.random() * 360 - 180}, 
       ${new Date()}, ${'test'}, ${Math.random()})
      ON CONFLICT ("vesselId", timestamp) DO UPDATE
      SET latitude = EXCLUDED.latitude;
    `;
    successCount++;
  } catch (e) {
    errorCount++;
    if (e.message.includes('deadlock')) {
      deadlockCount++;
    }
  }
}

async function runStressTest() {
  console.log(`🔥 Starting deadlock stress test`);
  console.log(`Concurrent updates: ${CONCURRENT_UPDATES}`);
  console.log(`Iterations: ${ITERATIONS}`);

  for (let i = 0; i < ITERATIONS; i++) {
    const promises = [];
    for (let j = 0; j < CONCURRENT_UPDATES; j++) {
      const vesselId = VESSEL_IDS[Math.floor(Math.random() * VESSEL_IDS.length)];
      promises.push(concurrentUpdate(vesselId, i));
    }
    await Promise.all(promises);

    if (i % 10 === 0) {
      console.log(
        `[${i}/${ITERATIONS}] Success: ${successCount}, Errors: ${errorCount}, Deadlocks: ${deadlockCount}`,
      );
    }
  }

  console.log('\n📊 Stress Test Results:');
  console.log(`Total operations: ${CONCURRENT_UPDATES * ITERATIONS}`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Deadlocks: ${deadlockCount}`);
  console.log(
    `Deadlock rate: ${((deadlockCount / (CONCURRENT_UPDATES * ITERATIONS)) * 100).toFixed(2)}%`,
  );

  await prisma.$disconnect();
}

runStressTest();
