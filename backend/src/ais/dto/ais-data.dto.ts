import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AisObjectIdDto {
  @IsNumber()
  @IsOptional()
  timestamp?: number;

  @IsNumber()
  @IsOptional()
  machine?: number;

  @IsNumber()
  @IsOptional()
  pid?: number;

  @IsNumber()
  @IsOptional()
  increment?: number;

  @IsString()
  @IsOptional()
  creationTime?: string; // ISO
}

export class AisGeoJSONPointDto {
  @IsString()
  @IsOptional()
  type?: 'Point';

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  coordinates?: [number, number]; // [lon, lat]
}

export class AisPointDto {
  @IsBoolean()
  @IsOptional()
  isEmpty?: boolean;

  @IsNumber()
  @IsOptional()
  x?: number; // lon

  @IsNumber()
  @IsOptional()
  y?: number; // lat
}

export class AisDataDto {
  @ValidateNested()
  @Type(() => AisObjectIdDto)
  @IsOptional()
  _id?: AisObjectIdDto;

  @IsNumber()
  @IsOptional()
  index?: number;

  @IsNumber()
  @IsOptional()
  shipId?: number;

  @IsString()
  @IsOptional()
  flag?: string | null;

  @IsString()
  @IsOptional()
  callsign?: string | null;

  @IsNumber()
  @IsOptional()
  course?: number | null;

  @IsString()
  @IsOptional()
  destination?: string | null;

  @IsString()
  @IsOptional()
  dis?: string | null;

  @IsString()
  @IsOptional()
  dn?: string | null;

  @IsNumber()
  @IsOptional()
  draught?: number | null;

  @IsNumber()
  @IsOptional()
  dwt?: number | null;

  @IsString()
  @IsOptional()
  eta?: string | null;

  @IsString()
  @IsOptional()
  fn?: string | null;

  @IsNumber()
  @IsOptional()
  heading?: number | null;

  @IsNumber()
  @IsOptional()
  imo?: number | null;

  @IsNumber()
  @IsOptional()
  latitude?: number; // preferred

  @IsNumber()
  @IsOptional()
  longitude?: number; // preferred

  @IsNumber()
  @IsOptional()
  length?: number | null;

  @IsString()
  @IsOptional()
  minotype?: string | null;

  @IsNumber()
  @IsOptional()
  minudiff?: number | null;

  @IsNumber()
  @IsOptional()
  mmsi?: number; // source provides number; we normalize to string later

  @IsString()
  @IsOptional()
  name?: string | null;

  @IsNumber()
  @IsOptional()
  offseta?: number | null;

  @IsNumber()
  @IsOptional()
  offsetb?: number | null;

  @IsNumber()
  @IsOptional()
  offsetc?: number | null;

  @IsNumber()
  @IsOptional()
  offsetd?: number | null;

  @IsString()
  @IsOptional()
  rs?: string | null;

  @IsNumber()
  @IsOptional()
  speed?: number | null;

  @IsString()
  @IsOptional()
  status?: string | null;

  @IsNumber()
  @IsOptional()
  turnrate?: number | null;

  @IsString()
  @IsOptional()
  type?: string | null;

  @IsString()
  @IsOptional()
  updatetime?: string; // ISO

  @IsNumber()
  @IsOptional()
  width?: number | null;

  @IsString()
  @IsOptional()
  location?: string | null;

  @IsString()
  @IsOptional()
  liveId?: string | null;

  @IsString()
  @IsOptional()
  source?: string | null;

  @IsNumber()
  @IsOptional()
  unixTime?: number | null;

  @IsNumber()
  @IsOptional()
  userId?: number | null;

  @ValidateNested()
  @Type(() => AisGeoJSONPointDto)
  @IsOptional()
  loc?: AisGeoJSONPointDto;

  @ValidateNested()
  @Type(() => AisPointDto)
  @IsOptional()
  point?: AisPointDto;

  // Fallback legacy field names the source may send
  @IsNumber()
  @IsOptional()
  lat?: number;

  @IsNumber()
  @IsOptional()
  lon?: number;

  @IsString()
  @IsOptional()
  shipName?: string | null;
}
