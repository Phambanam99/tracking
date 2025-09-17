-- CreateTable
CREATE TABLE "public"."ais_vessel_latest" (
    "mmsi" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION,
    "course" INTEGER,
    "sourceId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ais_vessel_latest_pkey" PRIMARY KEY ("mmsi")
);

-- CreateTable
CREATE TABLE "public"."ais_vessel_history" (
    "id" SERIAL NOT NULL,
    "mmsi" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION,
    "course" INTEGER,
    "sourceId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ais_vessel_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ais_vessel_latest_timestamp_idx" ON "public"."ais_vessel_latest"("timestamp");

-- CreateIndex
CREATE INDEX "ais_vessel_history_mmsi_idx" ON "public"."ais_vessel_history"("mmsi");

-- CreateIndex
CREATE INDEX "ais_vessel_history_timestamp_idx" ON "public"."ais_vessel_history"("timestamp");

-- CreateIndex
CREATE INDEX "ais_vessel_history_mmsi_timestamp_idx" ON "public"."ais_vessel_history"("mmsi", "timestamp");

-- RenameIndex
ALTER INDEX "public"."ports_city_state_country_lat_lon_key" RENAME TO "ports_city_state_country_latitude_longitude_key";

-- RenameIndex
ALTER INDEX "public"."ports_lat_lon_idx" RENAME TO "ports_latitude_longitude_idx";
