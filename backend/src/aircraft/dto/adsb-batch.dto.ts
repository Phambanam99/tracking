export interface AdsbAircraftDto {
  hexident: string;
  callsign?: string;
  callSign?: string;
  register?: string;
  type?: string;
  operator?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  bearing?: number;
  unixtime?: number;
  source?: string;
  [key: string]: any;
}

export type AdsbAircraftBatch = AdsbAircraftDto[];
