import { IsString, IsOptional, IsInt, IsNotEmpty, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Base DTO for creating aircraft
export class CreateAircraftDto {
  @ApiProperty({ description: 'Flight ID', example: 'VN123' })
  @IsString()
  @IsNotEmpty()
  flightId: string;

  @ApiPropertyOptional({ description: 'Call sign', example: 'VNA123' })
  @IsOptional()
  @IsString()
  callSign?: string;

  @ApiPropertyOptional({
    description: 'Aircraft registration',
    example: 'VN-A123',
  })
  @IsOptional()
  @IsString()
  registration?: string;

  @ApiPropertyOptional({ description: 'Aircraft type', example: 'Boeing 787' })
  @IsOptional()
  @IsString()
  aircraftType?: string;

  @ApiPropertyOptional({
    description: 'Operator/Airline',
    example: 'Vietnam Airlines',
  })
  @IsOptional()
  @IsString()
  operator?: string;
}

// DTO for updating aircraft
export class UpdateAircraftDto {
  @ApiPropertyOptional({ description: 'Call sign', example: 'VNA123' })
  @IsOptional()
  @IsString()
  callSign?: string;

  @ApiPropertyOptional({
    description: 'Aircraft registration',
    example: 'VN-A123',
  })
  @IsOptional()
  @IsString()
  registration?: string;

  @ApiPropertyOptional({ description: 'Aircraft type', example: 'Boeing 787' })
  @IsOptional()
  @IsString()
  aircraftType?: string;

  @ApiPropertyOptional({
    description: 'Operator/Airline',
    example: 'Vietnam Airlines',
  })
  @IsOptional()
  @IsString()
  operator?: string;
}

// DTO for aircraft position
export class CreateAircraftPositionDto {
  @ApiProperty({ description: 'Aircraft ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  aircraftId: number;

  @ApiProperty({
    description: 'Latitude (-90 to 90)',
    example: 21.0285,
    minimum: -90,
    maximum: 90,
  })
  @Type(() => Number)
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    description: 'Longitude (-180 to 180)',
    example: 105.8542,
    minimum: -180,
    maximum: 180,
  })
  @Type(() => Number)
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({
    description: 'Altitude in feet',
    example: 35000,
    minimum: 0,
    maximum: 60000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60000)
  altitude?: number;

  @ApiPropertyOptional({
    description: 'Speed in knots',
    example: 450,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  speed?: number;

  @ApiPropertyOptional({
    description: 'Heading in degrees (0-360)',
    example: 180,
    minimum: 0,
    maximum: 360,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(360)
  heading?: number;

  @ApiPropertyOptional({
    description: 'Timestamp',
    example: '2024-01-01T12:00:00Z',
  })
  @IsOptional()
  timestamp?: Date;

  @ApiPropertyOptional({ description: 'Source of the message', example: 'adsb' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'Fusion score', example: 0.92 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  score?: number;
}

// DTO for querying aircraft history
export class AircraftHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Start date',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @ApiPropertyOptional({
    description: 'End date',
    example: '2024-01-02T00:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  to?: Date;

  @ApiPropertyOptional({
    description: 'Maximum number of records',
    example: 100,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset for pagination', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

// Response DTOs
export class AircraftPositionResponseDto {
  @ApiProperty({ description: 'Position ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Latitude', example: 21.0285 })
  latitude: number;

  @ApiProperty({ description: 'Longitude', example: 105.8542 })
  longitude: number;

  @ApiPropertyOptional({ description: 'Altitude in feet', example: 35000 })
  altitude?: number | null;

  @ApiPropertyOptional({ description: 'Speed in knots', example: 450 })
  speed?: number | null;

  @ApiPropertyOptional({ description: 'Heading in degrees', example: 180 })
  heading?: number | null;

  @ApiProperty({ description: 'Position timestamp' })
  timestamp: Date;
}

export class AircraftResponseDto {
  @ApiProperty({ description: 'Aircraft ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Flight ID', example: 'VN123' })
  flightId: string;

  @ApiPropertyOptional({ description: 'Call sign', example: 'VNA123' })
  callSign?: string | null;

  @ApiPropertyOptional({
    description: 'Aircraft registration',
    example: 'VN-A123',
  })
  registration?: string | null;

  @ApiPropertyOptional({ description: 'Aircraft type', example: 'Boeing 787' })
  aircraftType?: string | null;

  @ApiPropertyOptional({
    description: 'Operator/Airline',
    example: 'Vietnam Airlines',
  })
  operator?: string | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Last known position' })
  lastPosition?: AircraftPositionResponseDto;
  @ApiPropertyOptional({ description: 'Images of the aircraft' })
  images?: AircraftImageDto[];
}

export class AircraftImageDto {
  @ApiProperty({ description: 'Image ID', example: 1 })
  id: number;
  @ApiProperty({ description: 'Image URL' })
  url: string;
  @ApiPropertyOptional({ description: 'Caption' })
  caption?: string | null;
  @ApiPropertyOptional({ description: 'Source / credit' })
  source?: string | null;
  @ApiProperty({ description: 'Primary image flag' })
  isPrimary: boolean;
  @ApiProperty({ description: 'Ordering integer' })
  order: number;
  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;
  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

export class CreateAircraftImageDto {
  @ApiProperty({ description: 'Image URL' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional({ description: 'Caption' })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({ description: 'Source / credit' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'Primary image flag' })
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: 'Ordering integer' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;
}

export class UpdateAircraftImageDto {
  @ApiPropertyOptional({ description: 'Image URL' })
  @IsOptional()
  @IsString()
  url?: string;
  @ApiPropertyOptional({ description: 'Caption' })
  @IsOptional()
  @IsString()
  caption?: string;
  @ApiPropertyOptional({ description: 'Source / credit' })
  @IsOptional()
  @IsString()
  source?: string;
  @ApiPropertyOptional({ description: 'Primary image flag' })
  @IsOptional()
  isPrimary?: boolean;
  @ApiPropertyOptional({ description: 'Ordering integer' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;
}
