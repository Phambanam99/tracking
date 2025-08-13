-- Alter table system_settings to add map provider configuration
-- Safe to run if columns already exist

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings' AND column_name = 'mapProvider'
  ) THEN
    ALTER TABLE "system_settings" ADD COLUMN "mapProvider" TEXT NOT NULL DEFAULT 'osm';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings' AND column_name = 'maptilerApiKey'
  ) THEN
    ALTER TABLE "system_settings" ADD COLUMN "maptilerApiKey" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings' AND column_name = 'maptilerStyle'
  ) THEN
    ALTER TABLE "system_settings" ADD COLUMN "maptilerStyle" TEXT NOT NULL DEFAULT 'streets';
  END IF;
END $$;


