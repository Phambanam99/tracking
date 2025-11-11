-- Cleanup duplicate vessel positions before migration
-- Keep the newest record for each (vesselId, timestamp) combination

-- Step 1: Identify duplicates
SELECT "vesselId", "timestamp", COUNT(*) as count
FROM vessel_positions
GROUP BY "vesselId", "timestamp"
HAVING COUNT(*) > 1
ORDER BY count DESC
LIMIT 10;

-- Step 2: Delete duplicates, keeping only the newest (highest id)
DELETE FROM vessel_positions
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "vesselId", "timestamp" 
        ORDER BY id DESC  -- Keep newest (highest id)
      ) as rn
    FROM vessel_positions
  ) t
  WHERE t.rn > 1
);

-- Step 3: Verify no more duplicates
SELECT "vesselId", "timestamp", COUNT(*) as count
FROM vessel_positions
GROUP BY "vesselId", "timestamp"
HAVING COUNT(*) > 1;

-- Expected result: 0 rows (no duplicates)

