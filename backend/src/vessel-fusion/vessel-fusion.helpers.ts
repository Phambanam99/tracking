import { DataSource } from '@prisma/client';

export type Source = DataSource;

export type RawVesselMsg = {
  mmsi?: string;
  imo?: string;
  name?: string;
  callsign?: string;
  lat?: number;
  lon?: number;
  speed?: number;
  course?: number;
  heading?: number;
  ts: string | number; // event-time
  source: Source;
};

export type NormVesselMsg = {
  key: string;
  mmsi?: string;
  imo?: string;
  name?: string;
  callsign?: string;
  lat: number;
  lon: number;
  speed?: number;
  course?: number;
  heading?: number;
  ts: string; // ISO
  ingestTs: string; // ISO
  source: Source;
  sane: boolean;
};

export const SOURCE_WEIGHT: Record<Source, number> = {
  [DataSource.MARINE_TRAFFIC]: 0.9,
  [DataSource.VESSEL_FINDER]: 0.85,
  [DataSource.CHINA_PORT]: 0.8,
  [DataSource.SRC4]: 0.8,
  [DataSource.SRC5]: 0.8,
  [DataSource.ADSB_EXCHANGE]: 0.8,
  [DataSource.FLIGHTRADAR24]: 0.8,
};

export const WINDOW_MS = 5 * 60_000;
export const ALLOWED_LATENESS_MS = 10 * 60_000;

export function keyOf(n: NormVesselMsg): string {
  if (n.mmsi) return `mmsi:${n.mmsi}`;
  if (n.imo) return `imo:${n.imo}`;
  return `name:${(n.name || '').trim().toUpperCase()}|cs:${(n.callsign || '')
    .trim()
    .toUpperCase()}`;
}

export function normalize(r: RawVesselMsg): NormVesselMsg {
  const tsISO = new Date(
    typeof r.ts === 'number' ? r.ts : Date.parse(String(r.ts)),
  ).toISOString();
  const n: NormVesselMsg = {
    key: '',
    mmsi: r.mmsi?.trim(),
    imo: r.imo?.trim(),
    name: r.name?.trim(),
    callsign: r.callsign?.trim(),
    lat: Number(r.lat),
    lon: Number(r.lon),
    speed: r.speed != null ? Number(r.speed) : undefined,
    course: r.course != null ? Math.round(Number(r.course)) : undefined,
    heading: r.heading != null ? Math.round(Number(r.heading)) : undefined,
    ts: tsISO,
    ingestTs: new Date().toISOString(),
    source: r.source,
    sane: true,
  };
  n.key = keyOf(n);
  n.sane = sane(n);
  return n;
}

export function sane(n: NormVesselMsg): boolean {
  if (isNaN(n.lat) || isNaN(n.lon)) return false;
  if (n.lat < -85 || n.lat > 85) return false;
  if (n.lon < -180 || n.lon > 180) return false;
  const ageMin = (Date.now() - Date.parse(n.ts)) / 60000;
  if (ageMin > 24 * 60) return false;
  if (n.speed && n.speed > 60) return false;
  return true;
}

export function score(n: NormVesselMsg): number {
  const ageMin = Math.max(0, (Date.now() - Date.parse(n.ts)) / 60000);
  const recency = Math.max(0, 1 - ageMin / 15);
  const sw = SOURCE_WEIGHT[n.source] ?? 0.8;
  const phys = n.sane ? 1 : 0;
  return 0.5 * recency + 0.3 * sw + 0.2 * phys;
}

export function selectBest(windowMsgs: NormVesselMsg[]): NormVesselMsg | null {
  if (!windowMsgs.length) return null;
  return windowMsgs.slice().sort((a, b) => score(b) - score(a))[0];
}


