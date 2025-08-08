import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsObject,
  IsEnum,
} from 'class-validator';
import { RegionType } from '@prisma/client';

export class CreateRegionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  alertOnEntry?: boolean;

  @IsBoolean()
  @IsOptional()
  alertOnExit?: boolean;

  @IsObject()
  boundary: any; // GeoJSON polygon

  @IsEnum(RegionType)
  regionType: RegionType;

  @IsOptional()
  @IsNumber()
  centerLat?: number;

  @IsOptional()
  @IsNumber()
  centerLng?: number;

  @IsOptional()
  @IsNumber()
  radius?: number;
}

export class UpdateRegionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  alertOnEntry?: boolean;

  @IsOptional()
  @IsBoolean()
  alertOnExit?: boolean;

  @IsOptional()
  @IsObject()
  boundary?: any; // GeoJSON polygon

  @IsOptional()
  @IsEnum(RegionType)
  regionType?: RegionType;

  @IsOptional()
  @IsNumber()
  centerLat?: number;

  @IsOptional()
  @IsNumber()
  centerLng?: number;

  @IsOptional()
  @IsNumber()
  radius?: number;
}

export class RegionResponseDto {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  alertOnEntry: boolean;
  alertOnExit: boolean;
  boundary: any;
  regionType: RegionType;
  centerLat?: number;
  centerLng?: number;
  radius?: number;
  createdAt: Date;
  updatedAt: Date;
}

export class RegionAlertDto {
  id: number;
  regionId: number;
  objectType: string;
  objectId: number;
  alertType: string;
  latitude: number;
  longitude: number;
  isRead: boolean;
  createdAt: Date;
  region: {
    name: string;
  };
}
