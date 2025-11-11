-- Add enrichment tracking fields to vessels table
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "imo" VARCHAR(10);
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "callSign" VARCHAR(20);
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "destination" TEXT;
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "eta" TIMESTAMP;
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "draught" FLOAT;
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "yearBuilt" INTEGER;
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "grossTonnage" INTEGER;
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "deadweight" INTEGER;
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "homePort" VARCHAR(100);
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "owner" TEXT;
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "manager" TEXT;
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "classification" VARCHAR(50);
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "enrichedAt" TIMESTAMP;
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "enrichmentSource" VARCHAR(50);
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "enrichmentAttempts" INTEGER DEFAULT 0;
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "lastEnrichmentAttempt" TIMESTAMP;
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "enrichmentError" TEXT;
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "dataQualityScore" FLOAT;

-- Create index for enrichment queries
CREATE INDEX IF NOT EXISTS "idx_vessels_enrichment" ON "vessels"("enrichedAt", "enrichmentAttempts");
CREATE INDEX IF NOT EXISTS "idx_vessels_imo" ON "vessels"("imo") WHERE "imo" IS NOT NULL;

-- Create vessel enrichment queue table
CREATE TABLE IF NOT EXISTS "vessel_enrichment_queue" (
  "id" SERIAL PRIMARY KEY,
  "mmsi" VARCHAR(20) NOT NULL,
  "priority" INTEGER DEFAULT 0,
  "status" VARCHAR(20) DEFAULT 'pending',
  "attempts" INTEGER DEFAULT 0,
  "lastAttemptAt" TIMESTAMP,
  "error" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_enrichment_queue_status" ON "vessel_enrichment_queue"("status", "priority" DESC, "createdAt" ASC);
CREATE INDEX IF NOT EXISTS "idx_enrichment_queue_mmsi" ON "vessel_enrichment_queue"("mmsi");

-- Create vessel enrichment log table for tracking history
CREATE TABLE IF NOT EXISTS "vessel_enrichment_log" (
  "id" SERIAL PRIMARY KEY,
  "mmsi" VARCHAR(20) NOT NULL,
  "source" VARCHAR(50),
  "success" BOOLEAN,
  "fieldsUpdated" TEXT[],
  "error" TEXT,
  "duration" INTEGER,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_enrichment_log_mmsi" ON "vessel_enrichment_log"("mmsi", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_enrichment_log_created" ON "vessel_enrichment_log"("createdAt" DESC);

