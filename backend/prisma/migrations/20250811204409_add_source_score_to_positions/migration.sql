/*
  Warnings:

  - A unique constraint covering the columns `[aircraftId,timestamp,source]` on the table `aircraft_positions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[vesselId,timestamp,source]` on the table `vessel_positions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."aircraft_positions" ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "public"."vessel_positions" ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "source" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "aircraft_positions_aircraftId_timestamp_source_key" ON "public"."aircraft_positions"("aircraftId", "timestamp", "source");

-- CreateIndex
CREATE UNIQUE INDEX "vessel_positions_vesselId_timestamp_source_key" ON "public"."vessel_positions"("vesselId", "timestamp", "source");
