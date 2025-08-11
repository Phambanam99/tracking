/*
  Warnings:

  - A unique constraint covering the columns `[aircraftId,source,timestamp]` on the table `aircraft_positions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[vesselId,source,timestamp]` on the table `vessel_positions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[imo]` on the table `vessels` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `source` to the `aircraft_positions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source` to the `vessel_positions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."DataSource" AS ENUM ('MARINE_TRAFFIC', 'VESSEL_FINDER', 'CHINA_PORT', 'SRC4', 'SRC5', 'ADSB_EXCHANGE', 'FLIGHTRADAR24');

-- AlterTable
ALTER TABLE "public"."aircraft_positions" ADD COLUMN     "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "source" "public"."DataSource" NOT NULL DEFAULT 'MARINE_TRAFFIC';

-- Deduplicate existing aircraft_positions by (aircraftId, timestamp)
DELETE FROM "public"."aircraft_positions" ap
USING (
  SELECT "aircraftId", "timestamp", MIN(id) AS keep_id, COUNT(*) AS cnt
  FROM "public"."aircraft_positions"
  GROUP BY "aircraftId", "timestamp"
  HAVING COUNT(*) > 1
) d
WHERE ap."aircraftId" = d."aircraftId"
  AND ap."timestamp" = d."timestamp"
  AND ap.id <> d.keep_id;

-- AlterTable
ALTER TABLE "public"."vessel_positions" ADD COLUMN     "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "source" "public"."DataSource" NOT NULL DEFAULT 'MARINE_TRAFFIC';

-- Deduplicate existing vessel_positions by (vesselId, timestamp)
DELETE FROM "public"."vessel_positions" vp
USING (
  SELECT "vesselId", "timestamp", MIN(id) AS keep_id, COUNT(*) AS cnt
  FROM "public"."vessel_positions"
  GROUP BY "vesselId", "timestamp"
  HAVING COUNT(*) > 1
) d
WHERE vp."vesselId" = d."vesselId"
  AND vp."timestamp" = d."timestamp"
  AND vp.id <> d.keep_id;

-- AlterTable
ALTER TABLE "public"."vessels" ADD COLUMN     "imo" TEXT;

-- CreateTable
CREATE TABLE "public"."aircraft_external_refs" (
    "id" SERIAL NOT NULL,
    "aircraftId" INTEGER NOT NULL,
    "source" "public"."DataSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aircraft_external_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vessel_external_refs" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "source" "public"."DataSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vessel_external_refs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aircraft_external_refs_aircraftId_idx" ON "public"."aircraft_external_refs"("aircraftId");

-- CreateIndex
CREATE UNIQUE INDEX "aircraft_external_refs_source_externalId_key" ON "public"."aircraft_external_refs"("source", "externalId");

-- CreateIndex
CREATE INDEX "vessel_external_refs_vesselId_idx" ON "public"."vessel_external_refs"("vesselId");

-- CreateIndex
CREATE UNIQUE INDEX "vessel_external_refs_source_externalId_key" ON "public"."vessel_external_refs"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "aircraft_positions_aircraftId_source_timestamp_key" ON "public"."aircraft_positions"("aircraftId", "source", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "vessel_positions_vesselId_source_timestamp_key" ON "public"."vessel_positions"("vesselId", "source", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "vessels_imo_key" ON "public"."vessels"("imo");

-- AddForeignKey
ALTER TABLE "public"."aircraft_external_refs" ADD CONSTRAINT "aircraft_external_refs_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "public"."aircrafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vessel_external_refs" ADD CONSTRAINT "vessel_external_refs_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "public"."vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
