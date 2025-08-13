// src/ais/ais.types.ts
export enum QueryResultState {
  Start = 'Start',
  Query = 'Query',
  End = 'End',
}

export interface AisModel {
  mmsi?: string;
  shipName?: string;
  lat?: number;
  lon?: number;
  speed?: number;
  course?: number;
  updatetime?: string; // ISO
  [k: string]: any;
}

export interface QueryRequestDto {
  query?: string;
  usingLastUpdateTime?: boolean;
  userId?: number;
}
