import { IsOptional, IsNumber, IsArray, IsString, IsNumberString } from 'class-validator';
import { Type } from 'class-transformer';

export class SubscribeAircraftDto {
  @IsOptional()
  @IsNumber()
  aircraftId?: number;
}

export class SubscribeVesselDto {
  @IsOptional()
  @IsNumber()
  vesselId?: number;
}

export class ViewportDto {
  @IsArray()
  @IsNumber({}, { each: true })
  bbox: [number, number, number, number];
}

export class PingDto {
  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class ConnectionStatsDto {
  totalClients: number;
  activeViewports: number;
  timestamp: string;
}
