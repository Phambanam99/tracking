-- CreateIndex
CREATE INDEX "aircraft_positions_latitude_longitude_idx" ON "public"."aircraft_positions"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "user_sessions_expiresAt_idx" ON "public"."user_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "vessel_positions_latitude_longitude_idx" ON "public"."vessel_positions"("latitude", "longitude");
