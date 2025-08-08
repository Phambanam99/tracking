-- CreateTable
CREATE TABLE "public"."user_tracked_aircrafts" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "aircraftId" INTEGER NOT NULL,
    "alias" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tracked_aircrafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_tracked_vessels" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "alias" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tracked_vessels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_tracked_aircrafts_userId_aircraftId_key" ON "public"."user_tracked_aircrafts"("userId", "aircraftId");

-- CreateIndex
CREATE UNIQUE INDEX "user_tracked_vessels_userId_vesselId_key" ON "public"."user_tracked_vessels"("userId", "vesselId");

-- AddForeignKey
ALTER TABLE "public"."user_tracked_aircrafts" ADD CONSTRAINT "user_tracked_aircrafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_tracked_aircrafts" ADD CONSTRAINT "user_tracked_aircrafts_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "public"."aircrafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_tracked_vessels" ADD CONSTRAINT "user_tracked_vessels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_tracked_vessels" ADD CONSTRAINT "user_tracked_vessels_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "public"."vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
