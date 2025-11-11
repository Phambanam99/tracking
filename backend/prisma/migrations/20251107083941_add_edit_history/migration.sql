-- CreateTable
CREATE TABLE "public"."aircraft_edit_history" (
    "id" SERIAL NOT NULL,
    "aircraftId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "changes" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aircraft_edit_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vessel_edit_history" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "changes" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vessel_edit_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aircraft_edit_history_aircraftId_idx" ON "public"."aircraft_edit_history"("aircraftId");

-- CreateIndex
CREATE INDEX "aircraft_edit_history_editedAt_idx" ON "public"."aircraft_edit_history"("editedAt");

-- CreateIndex
CREATE INDEX "vessel_edit_history_vesselId_idx" ON "public"."vessel_edit_history"("vesselId");

-- CreateIndex
CREATE INDEX "vessel_edit_history_editedAt_idx" ON "public"."vessel_edit_history"("editedAt");

-- AddForeignKey
ALTER TABLE "public"."aircraft_edit_history" ADD CONSTRAINT "aircraft_edit_history_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "public"."aircrafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."aircraft_edit_history" ADD CONSTRAINT "aircraft_edit_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vessel_edit_history" ADD CONSTRAINT "vessel_edit_history_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "public"."vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vessel_edit_history" ADD CONSTRAINT "vessel_edit_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
