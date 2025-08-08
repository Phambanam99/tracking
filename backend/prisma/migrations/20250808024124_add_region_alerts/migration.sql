-- CreateEnum
CREATE TYPE "public"."RegionType" AS ENUM ('POLYGON', 'CIRCLE');

-- CreateEnum
CREATE TYPE "public"."ObjectType" AS ENUM ('AIRCRAFT', 'VESSEL');

-- CreateEnum
CREATE TYPE "public"."AlertType" AS ENUM ('ENTRY', 'EXIT');

-- CreateTable
CREATE TABLE "public"."regions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "alertOnEntry" BOOLEAN NOT NULL DEFAULT true,
    "alertOnExit" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "boundary" JSONB NOT NULL,
    "regionType" "public"."RegionType" NOT NULL DEFAULT 'POLYGON',
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "radius" DOUBLE PRECISION,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."region_alerts" (
    "id" SERIAL NOT NULL,
    "regionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "objectType" "public"."ObjectType" NOT NULL,
    "objectId" INTEGER NOT NULL,
    "alertType" "public"."AlertType" NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "region_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."region_object_history" (
    "id" SERIAL NOT NULL,
    "regionId" INTEGER NOT NULL,
    "objectType" "public"."ObjectType" NOT NULL,
    "objectId" INTEGER NOT NULL,
    "isInside" BOOLEAN NOT NULL,
    "enteredAt" TIMESTAMP(3),
    "exitedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "region_object_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "regions_userId_idx" ON "public"."regions"("userId");

-- CreateIndex
CREATE INDEX "region_alerts_userId_isRead_idx" ON "public"."region_alerts"("userId", "isRead");

-- CreateIndex
CREATE INDEX "region_alerts_regionId_idx" ON "public"."region_alerts"("regionId");

-- CreateIndex
CREATE INDEX "region_alerts_createdAt_idx" ON "public"."region_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "region_object_history_regionId_idx" ON "public"."region_object_history"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "region_object_history_regionId_objectType_objectId_key" ON "public"."region_object_history"("regionId", "objectType", "objectId");

-- AddForeignKey
ALTER TABLE "public"."regions" ADD CONSTRAINT "regions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."region_alerts" ADD CONSTRAINT "region_alerts_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "public"."regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."region_alerts" ADD CONSTRAINT "region_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."region_object_history" ADD CONSTRAINT "region_object_history_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "public"."regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
