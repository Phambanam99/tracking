const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupDuplicates() {
  console.log('🔍 Finding duplicate vessel positions...');

  // Find duplicates
  const duplicates = await prisma.$queryRaw`
    SELECT "vesselId", "timestamp", COUNT(*) as count
    FROM vessel_positions
    GROUP BY "vesselId", "timestamp"
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 10
  `;

  console.log(`Found ${duplicates.length} duplicate groups (showing top 10):`);
  console.table(duplicates);

  if (duplicates.length === 0) {
    console.log('✅ No duplicates found!');
    return;
  }

  console.log('\n🗑️  Deleting duplicates (keeping newest record)...');

  // Delete duplicates, keeping only the newest (highest id)
  const result = await prisma.$executeRaw`
    DELETE FROM vessel_positions
    WHERE id IN (
      SELECT id
      FROM (
        SELECT 
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "vesselId", "timestamp" 
            ORDER BY id DESC
          ) as rn
        FROM vessel_positions
      ) t
      WHERE t.rn > 1
    )
  `;

  console.log(`✅ Deleted ${result} duplicate records`);

  // Verify
  console.log('\n🔍 Verifying no more duplicates...');
  const remaining = await prisma.$queryRaw`
    SELECT "vesselId", "timestamp", COUNT(*) as count
    FROM vessel_positions
    GROUP BY "vesselId", "timestamp"
    HAVING COUNT(*) > 1
  `;

  if (remaining.length === 0) {
    console.log('✅ All duplicates cleaned up! Ready for migration.');
  } else {
    console.log(`⚠️  Still have ${remaining.length} duplicate groups`);
    console.table(remaining);
  }
}

cleanupDuplicates()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
