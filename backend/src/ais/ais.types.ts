// src/ais/ais.types.ts
export enum QueryResultState {
  Start = 'Start',
  Query = 'Query',
  End = 'End',
}

export interface AisModel {
  _id?: Record<string, any>;
  index?: number;
  shipId?: number;
  flag?: string | null;
  callsign?: string | null;
  course?: number | null;
  destination?: string | null;
  dis?: string | null;
  dn?: string | null;
  draught?: number | null;
  dwt?: number | null;
  eta?: string | null;
  fn?: string | null;
  heading?: number | null;
  imo?: number | null;
  latitude?: number;
  longitude?: number;
  length?: number | null;
  minotype?: string | null;
  minudiff?: number | null;
  mmsi?: number | string;
  name?: string | null;
  offseta?: number | null;
  offsetb?: number | null;
  offsetc?: number | null;
  offsetd?: number | null;
  rs?: string | null;
  speed?: number | null;
  status?: string | null;
  turnrate?: number | null;
  type?: string | null;
  updatetime?: string; // ISO
  width?: number | null;
  location?: string | null;
  liveId?: string | null;
  source?: string | null;
  unixTime?: number | null;
  userId?: number | null;
  loc?: { type?: 'Point'; coordinates?: [number, number] };
  point?: { isEmpty?: boolean; x?: number; y?: number };
  // legacy fields
  lat?: number;
  lon?: number;
  shipName?: string | null;
  [k: string]: any;
}

export interface QueryRequestDto {
  query?: string;
  usingLastUpdateTime?: boolean;
  userId?: number;
}
