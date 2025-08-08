import {
  IsString,
  IsOptional,
  IsInt,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// Base DTO for creating aircraft
export class CreateAircraftDto {
  @IsString()
  @IsNotEmpty()
  flightId: string;

  @IsOptional()
  @IsString()
  callSign?: string;

  @IsOptional()
  @IsString()
  registration?: string;

  @IsOptional()
  @IsString()
  aircraftType?: string;

  @IsOptional()
  @IsString()
  operator?: string;
}

// DTO for updating aircraft
export class UpdateAircraftDto {
  @IsOptional()
  @IsString()
  callSign?: string;

  @IsOptional()
  @IsString()
  registration?: string;

  @IsOptional()
  @IsString()
  aircraftType?: string;

  @IsOptional()
  @IsString()
  operator?: string;
}

// DTO for aircraft position
export class CreateAircraftPositionDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  aircraftId: number;

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
  @IsInt()
  @Min(0)
  @Max(60000)
  altitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  speed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(360)
  heading?: number;

  @IsOptional()
  timestamp?: Date;
}

// DTO for querying aircraft history
export class AircraftHistoryQueryDto {
  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  to?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

// Response DTOs
export class AircraftResponseDto {
  id: number;
  flightId: string;
  callSign?: string | null;
  registration?: string | null;
  aircraftType?: string | null;
  operator?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastPosition?: AircraftPositionResponseDto;
}

export class AircraftPositionResponseDto {
  id: number;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp: Date;
}
