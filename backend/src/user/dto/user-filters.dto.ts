import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AircraftFiltersDto {
  @ApiProperty({ description: 'Aircraft search query', example: 'VN123' })
  @IsString()
  searchQuery: string;

  @ApiPropertyOptional({
    description: 'Aircraft operator filter',
    example: 'Vietnam Airlines',
  })
  @IsOptional()
  @IsString()
  operator?: string;

  @ApiPropertyOptional({ description: 'Aircraft type filter', example: 'A320' })
  @IsOptional()
  @IsString()
  aircraftType?: string;

  @ApiPropertyOptional({ description: 'Minimum speed filter', example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minSpeed?: number;

  @ApiPropertyOptional({ description: 'Maximum speed filter', example: 900 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSpeed?: number;

  @ApiPropertyOptional({
    description: 'Minimum altitude filter',
    example: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAltitude?: number;

  @ApiPropertyOptional({
    description: 'Maximum altitude filter',
    example: 45000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAltitude?: number;
}

export class VesselFiltersDto {
  @ApiProperty({ description: 'Vessel search query', example: 'CARGO SHIP' })
  @IsString()
  searchQuery: string;

  @ApiPropertyOptional({
    description: 'Vessel operator filter',
    example: 'Maersk',
  })
  @IsOptional()
  @IsString()
  operator?: string;

  @ApiPropertyOptional({
    description: 'Vessel type filter',
    example: 'Container Ship',
  })
  @IsOptional()
  @IsString()
  vesselType?: string;

  @ApiPropertyOptional({
    description: 'Vessel flag filter',
    example: 'Denmark',
  })
  @IsOptional()
  @IsString()
  flag?: string;

  @ApiPropertyOptional({ description: 'Minimum speed filter', example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minSpeed?: number;

  @ApiPropertyOptional({ description: 'Maximum speed filter', example: 25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSpeed?: number;
}

export class SaveUserFiltersDto {
  @ApiProperty({ description: 'Filter name', example: 'My Custom Filter' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Active filter tab',
    enum: ['aircraft', 'vessel'],
  })
  @IsString()
  activeFilterTab: 'aircraft' | 'vessel';

  @ApiProperty({ description: 'Aircraft view mode', enum: ['all', 'tracked'] })
  @IsString()
  aircraftViewMode: 'all' | 'tracked';

  @ApiProperty({ description: 'Vessel view mode', enum: ['all', 'tracked'] })
  @IsString()
  vesselViewMode: 'all' | 'tracked';

  @ApiProperty({ description: 'Aircraft filters' })
  @IsObject()
  @Type(() => AircraftFiltersDto)
  aircraft: AircraftFiltersDto;

  @ApiProperty({ description: 'Vessel filters' })
  @IsObject()
  @Type(() => VesselFiltersDto)
  vessel: VesselFiltersDto;
}

export class UserFiltersResponseDto {
  @ApiProperty({ description: 'Filter ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Filter name', example: 'My Custom Filter' })
  name: string;

  @ApiProperty({ description: 'User ID', example: 1 })
  userId: number;

  @ApiProperty({
    description: 'Active filter tab',
    enum: ['aircraft', 'vessel'],
  })
  activeFilterTab: 'aircraft' | 'vessel';

  @ApiProperty({ description: 'Aircraft view mode', enum: ['all', 'tracked'] })
  aircraftViewMode: 'all' | 'tracked';

  @ApiProperty({ description: 'Vessel view mode', enum: ['all', 'tracked'] })
  vesselViewMode: 'all' | 'tracked';

  @ApiProperty({ description: 'Aircraft filters' })
  aircraft: AircraftFiltersDto;

  @ApiProperty({ description: 'Vessel filters' })
  vessel: VesselFiltersDto;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}
