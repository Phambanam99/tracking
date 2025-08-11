import { NormVesselMsg, NormAircraftMsg, VesselSource, AircraftSource } from './types';

function toIsoUtc(input: string | number | Date | undefined): string | undefined {
  if (input === undefined || input === null) return undefined;
  const t =
    typeof input === 'string' ? Date.parse(input) : input instanceof Date ? input.getTime() : input;
  if (!Number.isFinite(t as number)) return undefined;
  return new Date(t as number).toISOString();
}

export function normalizeVessel(raw: any, source: VesselSource): NormVesselMsg | undefined {
  const ts = toIsoUtc(raw.ts || raw.timestamp || raw.time || raw.observedAt || raw.datetime);
  const lat = Number(raw.lat ?? raw.latitude);
  const lon = Number(raw.lon ?? raw.lng ?? raw.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !ts) return undefined;
  const m: NormVesselMsg = {
    source,
    ts,
    mmsi: sanitizeStr(raw.mmsi),
    imo: sanitizeStr(raw.imo),
    callsign: sanitizeStr(raw.callsign ?? raw.call_sign),
    name: sanitizeStr(raw.name ?? raw.vesselName),
    lat,
    lon,
    speed: numOrUndef(raw.speed ?? raw.sog),
    course: numOrUndef(raw.course ?? raw.cog),
    heading: numOrUndef(raw.heading),
    status: sanitizeStr(raw.status ?? raw.nav_status),
  };
  return m;
}

export function normalizeAircraft(raw: any, source: AircraftSource): NormAircraftMsg | undefined {
  const ts = toIsoUtc(raw.ts || raw.timestamp || raw.time || raw.lastSeen || raw.datetime);
  const lat = Number(raw.lat ?? raw.latitude);
  const lon = Number(raw.lon ?? raw.lng ?? raw.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !ts) return undefined;
  const m: NormAircraftMsg = {
    source,
    ts,
    icao24: sanitizeStr(raw.icao24 ?? raw.icao),
    registration: sanitizeStr(raw.registration ?? raw.reg),
    callsign: sanitizeStr(raw.callsign ?? raw.callSign),
    lat,
    lon,
    altitude: intOrUndef(raw.altitude ?? raw.alt),
    groundSpeed: numOrUndef(raw.groundSpeed ?? raw.gs ?? raw.speed),
    heading: intOrUndef(raw.heading ?? raw.track),
    verticalRate: numOrUndef(raw.verticalRate ?? raw.vrate ?? raw.rocd),
  };
  return m;
}

function sanitizeStr(s: any): string | undefined {
  if (typeof s !== 'string') return undefined;
  const t = s.trim();
  return t.length ? t : undefined;
}

function numOrUndef(x: any): number | undefined {
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
}

function intOrUndef(x: any): number | undefined {
  const n = Number.parseInt(String(x), 10);
  return Number.isFinite(n) ? n : undefined;
}

