-- CreateTable
CREATE TABLE "public"."vessel_images" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "source" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vessel_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."aircraft_images" (
    "id" SERIAL NOT NULL,
    "aircraftId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "source" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aircraft_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vessel_images_vesselId_idx" ON "public"."vessel_images"("vesselId");

-- CreateIndex
CREATE INDEX "aircraft_images_aircraftId_idx" ON "public"."aircraft_images"("aircraftId");

-- AddForeignKey
ALTER TABLE "public"."vessel_images" ADD CONSTRAINT "vessel_images_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "public"."vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."aircraft_images" ADD CONSTRAINT "aircraft_images_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "public"."aircrafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
