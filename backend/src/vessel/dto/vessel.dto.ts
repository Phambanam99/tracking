import { IsString, IsOptional, IsNumber, IsNotEmpty, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// Base DTO for creating vessel
export class CreateVesselDto {
  @IsString()
  @IsNotEmpty()
  mmsi: string;

  @IsOptional()
  @IsString()
  vesselName?: string;

  @IsOptional()
  @IsString()
  vesselType?: string;

  @IsOptional()
  @IsString()
  flag?: string;

  @IsOptional()
  @IsString()
  operator?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  length?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  width?: number;
}

// DTO for updating vessel
export class UpdateVesselDto {
  @IsOptional()
  @IsString()
  vesselName?: string;

  @IsOptional()
  @IsString()
  vesselType?: string;

  @IsOptional()
  @IsString()
  flag?: string;

  @IsOptional()
  @IsString()
  operator?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  length?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  width?: number;
}

// DTO for vessel position
export class CreateVesselPositionDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  vesselId: number;

  @Type(() => Number)
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  latitude: number;

  @Type(() => Number)
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  speed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(360)
  course?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  timestamp?: Date;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  score?: number;
}

// DTO for querying vessel history
export class VesselHistoryQueryDto {
  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  to?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;

  // Optional pagination (alternative to limit/offset)
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  pageSize?: number;
}

// Response DTOs
export class VesselResponseDto {
  id: number;
  mmsi: string;
  vesselName?: string | null;
  vesselType?: string | null;
  flag?: string | null;
  operator?: string | null;
  length?: number | null;
  width?: number | null;
  createdAt: Date;
  updatedAt: Date;
  lastPosition?: VesselPositionResponseDto;
}

export class VesselPositionResponseDto {
  id: number;
  latitude: number;
  longitude: number;
  speed?: number | null;
  course?: number | null;
  heading?: number | null;
  status?: string | null;
  timestamp: Date;
}
