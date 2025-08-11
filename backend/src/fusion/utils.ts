import { FUSION_CONFIG, SOURCE_WEIGHT } from './config';
import { NormVesselMsg, NormAircraftMsg } from './types';

export function isFiniteNumber(n: any): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function parseIso(ts: string | Date | number | undefined): number | undefined {
  if (!ts) return undefined;
  const d = typeof ts === 'string' ? Date.parse(ts) : ts instanceof Date ? ts.getTime() : ts;
  return Number.isFinite(d) ? d : undefined;
}

export function saneVessel(m: NormVesselMsg, now = Date.now()): boolean {
  const t = parseIso(m.ts);
  if (!t || Math.abs(now - t) > FUSION_CONFIG.MAX_EVENT_AGE_MS) return false;
  if (!isFiniteNumber(m.lat) || !isFiniteNumber(m.lon)) return false;
  if (m.lat < -90 || m.lat > 90 || m.lon < -180 || m.lon > 180) return false;
  if (isFiniteNumber(m.speed) && m.speed! > FUSION_CONFIG.SPEED_LIMIT_KN * 1.5) return false;
  return true;
}

export function saneAircraft(m: NormAircraftMsg, now = Date.now()): boolean {
  const t = parseIso(m.ts);
  if (!t || Math.abs(now - t) > FUSION_CONFIG.MAX_EVENT_AGE_MS) return false;
  if (!isFiniteNumber(m.lat) || !isFiniteNumber(m.lon)) return false;
  if (m.lat < -90 || m.lat > 90 || m.lon < -180 || m.lon > 180) return false;
  if (isFiniteNumber(m.groundSpeed) && m.groundSpeed! > 750) return false; // basic sanity
  return true;
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function scoreBySource(source?: string): number {
  if (!source) return SOURCE_WEIGHT.default;
  return (SOURCE_WEIGHT as any)[source] ?? SOURCE_WEIGHT.default;
}

export function recencyScore(tsIso: string, now = Date.now()): number {
  const t = parseIso(tsIso);
  if (!t) return 0;
  const ageMin = (now - t) / 60000;
  const recency = Math.max(0, 1 - ageMin / 15);
  return recency;
}

export function physicalValidityVessel(m: NormVesselMsg): 0 | 1 {
  // Here only basic checks are applied; teleport check can be added with history
  return saneVessel(m) ? 1 : 0;
}

export function physicalValidityAircraft(m: NormAircraftMsg): 0 | 1 {
  return saneAircraft(m) ? 1 : 0;
}

export function scoreVessel(m: NormVesselMsg, now = Date.now()): number {
  const recency = recencyScore(m.ts, now);
  const sw = scoreBySource(m.source);
  const pv = physicalValidityVessel(m);
  return 0.5 * recency + 0.3 * sw + 0.2 * pv;
}

export function scoreAircraft(m: NormAircraftMsg, now = Date.now()): number {
  const recency = recencyScore(m.ts, now);
  const sw = scoreBySource(m.source);
  const pv = physicalValidityAircraft(m);
  return 0.5 * recency + 0.3 * sw + 0.2 * pv;
}

export function keyOfVessel(m: NormVesselMsg): string | undefined {
  return m.mmsi || m.imo || m.callsign || (m.name ? `name:${m.name}` : undefined);
}

export function keyOfAircraft(m: NormAircraftMsg): string | undefined {
  return m.icao24 || m.registration || m.callsign;
}
