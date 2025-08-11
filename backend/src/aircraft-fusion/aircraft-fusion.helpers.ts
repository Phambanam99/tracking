import { DataSource } from '@prisma/client';

export type Source = DataSource;

export type RawAircraftMsg = {
  flightId?: string;
  callSign?: string;
  registration?: string;
  lat?: number;
  lon?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  ts: string | number;
  source: Source;
};

export type NormAircraftMsg = {
  key: string;
  flightId?: string;
  callSign?: string;
  registration?: string;
  lat: number;
  lon: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  ts: string;
  ingestTs: string;
  source: Source;
  sane: boolean;
};

export const SOURCE_WEIGHT: Record<Source, number> = {
  [DataSource.FLIGHTRADAR24]: 0.9,
  [DataSource.ADSB_EXCHANGE]: 0.85,
  [DataSource.MARINE_TRAFFIC]: 0.8,
  [DataSource.VESSEL_FINDER]: 0.8,
  [DataSource.CHINA_PORT]: 0.8,
  [DataSource.SRC4]: 0.8,
  [DataSource.SRC5]: 0.8,
};

export const WINDOW_MS = 5 * 60_000;
export const ALLOWED_LATENESS_MS = 10 * 60_000;

export function keyOf(n: NormAircraftMsg): string {
  if (n.flightId) return `flight:${n.flightId}`;
  if (n.registration) return `reg:${n.registration}`;
  return `cs:${(n.callSign || '').trim().toUpperCase()}`;
}

export function normalize(r: RawAircraftMsg): NormAircraftMsg {
  const tsISO = new Date(
    typeof r.ts === 'number' ? r.ts : Date.parse(String(r.ts)),
  ).toISOString();
  const n: NormAircraftMsg = {
    key: '',
    flightId: r.flightId?.trim(),
    callSign: r.callSign?.trim(),
    registration: r.registration?.trim(),
    lat: Number(r.lat),
    lon: Number(r.lon),
    speed: r.speed != null ? Number(r.speed) : undefined,
    heading: r.heading != null ? Math.round(Number(r.heading)) : undefined,
    altitude: r.altitude != null ? Math.round(Number(r.altitude)) : undefined,
    ts: tsISO,
    ingestTs: new Date().toISOString(),
    source: r.source,
    sane: true,
  };
  n.key = keyOf(n);
  n.sane = sane(n);
  return n;
}

export function sane(n: NormAircraftMsg): boolean {
  if (isNaN(n.lat) || isNaN(n.lon)) return false;
  if (n.lat < -85 || n.lat > 85) return false;
  if (n.lon < -180 || n.lon > 180) return false;
  const ageMin = (Date.now() - Date.parse(n.ts)) / 60000;
  if (ageMin > 24 * 60) return false;
  if (n.speed && n.speed > 650) return false;
  if (n.altitude && n.altitude > 60000) return false;
  return true;
}

export function score(n: NormAircraftMsg): number {
  const ageMin = Math.max(0, (Date.now() - Date.parse(n.ts)) / 60000);
  const recency = Math.max(0, 1 - ageMin / 15);
  const sw = SOURCE_WEIGHT[n.source] ?? 0.8;
  const phys = n.sane ? 1 : 0;
  return 0.5 * recency + 0.3 * sw + 0.2 * phys;
}

export function selectBest(windowMsgs: NormAircraftMsg[]): NormAircraftMsg | null {
  if (!windowMsgs.length) return null;
  return windowMsgs.slice().sort((a, b) => score(b) - score(a))[0];
}


