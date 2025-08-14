export type VesselSource =
  | 'marine_traffic'
  | 'vessel_finder'
  | 'china_port'
  | 'ais_marine'
  | 'custom';
export type AircraftSource = 'adsb_exchange' | 'opensky' | 'custom';

export type RawVessel = {
  mmsi: string;
  name: string;
  lat: number;
  lon: number;
  speed: number;
  course: number;
  heading: number;
  status: string;
  timestamp: number;
  source: VesselSource;
  raw?: any; // Original data for debugging
};

export type NormVesselMsg = {
  source: VesselSource;
  ts: string; // ISO-8601 UTC (event time)
  mmsi?: string;
  imo?: string;
  callsign?: string;
  name?: string;
  lat: number;
  lon: number;
  speed?: number; // knots
  course?: number; // deg
  heading?: number; // deg
  status?: string;
};

export type NormAircraftMsg = {
  source: AircraftSource;
  ts: string; // ISO-8601 UTC (event time)
  icao24?: string;
  registration?: string;
  callsign?: string;
  lat: number;
  lon: number;
  altitude?: number; // feet
  groundSpeed?: number; // knots
  heading?: number; // deg
  verticalRate?: number; // fpm
};

export type EntityKey = string; // derived from identifiers
