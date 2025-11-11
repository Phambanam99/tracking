/*
  Warnings:

  - A unique constraint covering the columns `[vesselId,timestamp]` on the table `vessel_positions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."vessel_positions_vesselId_timestamp_source_key";

-- CreateTable
CREATE TABLE "public"."vessel_positions_archive" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION,
    "course" INTEGER,
    "heading" INTEGER,
    "status" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "score" DOUBLE PRECISION,
    "sampleCount" INTEGER,
    "avgSpeed" DOUBLE PRECISION,

    CONSTRAINT "vessel_positions_archive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vessel_positions_archive_vesselId_idx" ON "public"."vessel_positions_archive"("vesselId");

-- CreateIndex
CREATE INDEX "vessel_positions_archive_timestamp_idx" ON "public"."vessel_positions_archive"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "vessel_positions_archive_vesselId_timestamp_key" ON "public"."vessel_positions_archive"("vesselId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "vessel_positions_vesselId_timestamp_key" ON "public"."vessel_positions"("vesselId", "timestamp");

-- AddForeignKey
ALTER TABLE "public"."vessel_positions_archive" ADD CONSTRAINT "vessel_positions_archive_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "public"."vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
