/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `aircrafts` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `aircrafts` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `vessels` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `vessels` table. All the data in the column will be lost.
  - You are about to drop the `vessel_positions_archive` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `success` on table `vessel_enrichment_log` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `vessel_enrichment_log` required. This step will fail if there are existing NULL values in that column.
  - Made the column `priority` on table `vessel_enrichment_queue` required. This step will fail if there are existing NULL values in that column.
  - Made the column `status` on table `vessel_enrichment_queue` required. This step will fail if there are existing NULL values in that column.
  - Made the column `attempts` on table `vessel_enrichment_queue` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `vessel_enrichment_queue` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `vessel_enrichment_queue` required. This step will fail if there are existing NULL values in that column.
  - Made the column `enrichmentAttempts` on table `vessels` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."vessel_positions_archive" DROP CONSTRAINT "vessel_positions_archive_vesselId_fkey";

-- DropIndex
DROP INDEX "public"."aircrafts_isActive_idx";

-- DropIndex
DROP INDEX "public"."idx_enrichment_log_created";

-- DropIndex
DROP INDEX "public"."idx_enrichment_log_mmsi";

-- DropIndex
DROP INDEX "public"."idx_enrichment_queue_status";

-- DropIndex
DROP INDEX "public"."vessels_isActive_idx";

-- AlterTable
ALTER TABLE "public"."aircrafts" DROP COLUMN "deletedAt",
DROP COLUMN "isActive";

-- AlterTable
ALTER TABLE "public"."vessel_enrichment_log" ALTER COLUMN "mmsi" SET DATA TYPE TEXT,
ALTER COLUMN "source" SET DATA TYPE TEXT,
ALTER COLUMN "success" SET NOT NULL,
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."vessel_enrichment_queue" ALTER COLUMN "mmsi" SET DATA TYPE TEXT,
ALTER COLUMN "priority" SET NOT NULL,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DATA TYPE TEXT,
ALTER COLUMN "attempts" SET NOT NULL,
ALTER COLUMN "lastAttemptAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."vessels" DROP COLUMN "deletedAt",
DROP COLUMN "isActive",
ALTER COLUMN "imo" SET DATA TYPE TEXT,
ALTER COLUMN "callSign" SET DATA TYPE TEXT,
ALTER COLUMN "eta" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "homePort" SET DATA TYPE TEXT,
ALTER COLUMN "classification" SET DATA TYPE TEXT,
ALTER COLUMN "enrichedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "enrichmentSource" SET DATA TYPE TEXT,
ALTER COLUMN "enrichmentAttempts" SET NOT NULL,
ALTER COLUMN "lastEnrichmentAttempt" SET DATA TYPE TIMESTAMP(3);

-- DropTable
DROP TABLE "public"."vessel_positions_archive";

-- CreateIndex
CREATE INDEX "vessel_enrichment_log_mmsi_createdAt_idx" ON "public"."vessel_enrichment_log"("mmsi", "createdAt");

-- CreateIndex
CREATE INDEX "vessel_enrichment_log_createdAt_idx" ON "public"."vessel_enrichment_log"("createdAt");

-- CreateIndex
CREATE INDEX "vessel_enrichment_queue_status_priority_createdAt_idx" ON "public"."vessel_enrichment_queue"("status", "priority", "createdAt");

-- RenameIndex
ALTER INDEX "public"."idx_enrichment_queue_mmsi" RENAME TO "vessel_enrichment_queue_mmsi_idx";

-- RenameIndex
ALTER INDEX "public"."idx_vessels_enrichment" RENAME TO "vessels_enrichedAt_enrichmentAttempts_idx";
