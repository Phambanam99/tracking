-- CreateTable
CREATE TABLE "public"."aircrafts" (
    "id" SERIAL NOT NULL,
    "flightId" TEXT NOT NULL,
    "callSign" TEXT,
    "registration" TEXT,
    "aircraftType" TEXT,
    "operator" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aircrafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."aircraft_positions" (
    "id" SERIAL NOT NULL,
    "aircraftId" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "altitude" INTEGER,
    "speed" INTEGER,
    "heading" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aircraft_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vessels" (
    "id" SERIAL NOT NULL,
    "mmsi" TEXT NOT NULL,
    "vesselName" TEXT,
    "vesselType" TEXT,
    "flag" TEXT,
    "operator" TEXT,
    "length" INTEGER,
    "width" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vessels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vessel_positions" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION,
    "course" INTEGER,
    "heading" INTEGER,
    "status" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vessel_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aircrafts_flightId_key" ON "public"."aircrafts"("flightId");

-- CreateIndex
CREATE INDEX "aircraft_positions_aircraftId_idx" ON "public"."aircraft_positions"("aircraftId");

-- CreateIndex
CREATE INDEX "aircraft_positions_timestamp_idx" ON "public"."aircraft_positions"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "vessels_mmsi_key" ON "public"."vessels"("mmsi");

-- CreateIndex
CREATE INDEX "vessel_positions_vesselId_idx" ON "public"."vessel_positions"("vesselId");

-- CreateIndex
CREATE INDEX "vessel_positions_timestamp_idx" ON "public"."vessel_positions"("timestamp");

-- AddForeignKey
ALTER TABLE "public"."aircraft_positions" ADD CONSTRAINT "aircraft_positions_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "public"."aircrafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vessel_positions" ADD CONSTRAINT "vessel_positions_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "public"."vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
