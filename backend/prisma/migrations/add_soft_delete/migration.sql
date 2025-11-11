-- Add soft delete columns to vessels and aircrafts tables

ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "aircrafts" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "aircrafts" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Create indexes for soft delete queries
CREATE INDEX IF NOT EXISTS "vessels_isActive_idx" ON "vessels"("isActive");
CREATE INDEX IF NOT EXISTS "aircrafts_isActive_idx" ON "aircrafts"("isActive");

