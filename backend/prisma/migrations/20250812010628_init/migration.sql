-- RenameIndex
ALTER INDEX "public"."ports_city_state_country_lat_lon_key" RENAME TO "ports_city_state_country_latitude_longitude_key";

-- RenameIndex
ALTER INDEX "public"."ports_lat_lon_idx" RENAME TO "ports_latitude_longitude_idx";
