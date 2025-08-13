-- Create ports table
CREATE TABLE IF NOT EXISTS "ports" (
  "id" SERIAL PRIMARY KEY,
  "city" TEXT NOT NULL,
  "state" TEXT,
  "country" TEXT,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ports_city_state_country_lat_lon_key"
  ON "ports" ("city", "state", "country", "latitude", "longitude");

CREATE INDEX IF NOT EXISTS "ports_lat_lon_idx"
  ON "ports" ("latitude", "longitude");


