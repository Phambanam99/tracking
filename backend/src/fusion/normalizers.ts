import { NormVesselMsg, NormAircraftMsg, VesselSource, AircraftSource } from './types';
import { toValidISOString } from '../utils/timestamp-validator';

// ========== INTERNAL CONSTANTS (Không ảnh hưởng API) ==========
// Relaxed MMSI validation: 7-9 digits (some sources use 7-8 digits)
const MMSI_REGEX = /^[0-9]{7,9}$/;
const VESSEL_FIELD_MAP = {
  lat: ['lat', 'latitude', 'Lat', 'LAT'],
  lon: ['lon', 'lng', 'longitude', 'Lon', 'LON', 'LONGITUDE', 'long', 'Long'],
  ts: [
    'ts',
    'time',
    'observedAt',
    'datetime',
    'updatetime', // AISStream.io uses this
    'updateTime',
    'UpdateTime',
    'lastSeen',
    // 'timestamp' deliberately moved to end because it's often a relative value (seconds in minute)
    'timestamp',
  ],
} as const;

// ========== CORE HELPERS (Internal) ==========
function extractValue<T>(obj: unknown, ...fields: string[]): T | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const field of fields) {
    const value = (obj as Record<string, any>)[field];
    if (value !== undefined && value !== null) return value as T;
  }
  return undefined;
}

function parseLatLon(obj: unknown): { lat: number; lon: number } | undefined {
  const lat = Number(extractValue(obj, ...VESSEL_FIELD_MAP.lat));
  const lon = Number(extractValue(obj, ...VESSEL_FIELD_MAP.lon));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return undefined;
  return { lat, lon };
}

function parseTimestamp(obj: unknown, _source: string): string | undefined {
  const tsValue = extractValue<string | number | Date>(obj, ...VESSEL_FIELD_MAP.ts);
  if (!tsValue) {
    // Don't log here - will be tracked in normalizeAis/normalizeVessel
    return undefined;
  }

  // ✅ USE VALIDATED TIMESTAMP PARSER
  const isoString = toValidISOString(tsValue);
  if (!isoString) {
    // Timestamp is invalid/malformed
    return undefined;
  }

  return isoString;
}

function sanitizeString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
}

function parseInteger(value: unknown): number | undefined {
  if (typeof value === 'number') return Math.floor(value);
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
}

function normalizeMmsi(mmsi: string): string | undefined {
  if (!mmsi) return undefined;

  // Remove any non-digit characters
  const digits = mmsi.replace(/\D/g, '');

  // Must have 7-9 digits
  if (digits.length < 7 || digits.length > 9) return undefined;

  // Additional validation: reject obviously invalid MMSIs
  // MMSI should not be all zeros or all nines
  if (/^0+$/.test(digits) || /^9+$/.test(digits)) return undefined;
  
  // Reject MMSIs that are too short even after padding
  if (digits.length < 6) return undefined;

  // Pad to 9 digits if needed (left-pad with zeros)
  return digits.padStart(9, '0');
}

// ========== PUBLIC API (100% Backward Compatible) ==========

// Track invalid vessel messages per source
const invalidVesselCounts: Record<string, number> = {};
let lastVesselReportTime = Date.now();
const VESSEL_REPORT_INTERVAL = 60000; // Report every 60 seconds

export function normalizeVessel(raw: any, source: VesselSource): NormVesselMsg | undefined {
  const coords = parseLatLon(raw);
  if (!coords) {
    invalidVesselCounts[source] = (invalidVesselCounts[source] || 0) + 1;
    const now = Date.now();
    if (now - lastVesselReportTime > VESSEL_REPORT_INTERVAL) {
      const summary = Object.entries(invalidVesselCounts)
        .map(([src, count]) => `${src}:${count}`)
        .join(', ');
      console.warn(
        `[normalizeVessel] Filtered invalid lat/lon messages in last ${VESSEL_REPORT_INTERVAL / 1000}s: ${summary}`,
      );
      Object.keys(invalidVesselCounts).forEach((key) => delete invalidVesselCounts[key]);
      lastVesselReportTime = now;
    }
    return undefined;
  }

  const ts = parseTimestamp(raw, source);
  if (!ts) return undefined;

  const result: NormVesselMsg = {
    source,
    ts,
    lat: coords.lat,
    lon: coords.lon,
    mmsi: sanitizeString(extractValue(raw, 'mmsi')),
    imo: sanitizeString(extractValue(raw, 'imo')),
    callsign: sanitizeString(extractValue(raw, 'callsign', 'call_sign')),
    name: sanitizeString(extractValue(raw, 'name', 'vesselName')),
    speed: parseNumber(extractValue(raw, 'speed', 'sog')),
    course: parseNumber(extractValue(raw, 'course', 'cog')),
    heading: parseNumber(extractValue(raw, 'heading')),
    status: sanitizeString(extractValue(raw, 'status', 'nav_status')),
  };

  return result;
}

// Track invalid messages for periodic reporting
let invalidLatLonCount = 0;
let invalidMmsiCount = 0;
let invalidTimestampCount = 0;
let lastReportTime = Date.now();
const REPORT_INTERVAL = 60000; // Report every 60 seconds

// Sample counter for debugging
let sampleCount = 0;
const MAX_SAMPLES = 5;

export function normalizeAis(raw: any): NormVesselMsg | undefined {
  const coords = parseLatLon(raw);
  if (!coords) {
    invalidLatLonCount++;
    if (sampleCount < MAX_SAMPLES) {
      console.warn(`[normalizeAis] Sample ${sampleCount + 1}: Invalid lat/lon`, { raw });
      sampleCount++;
    }
    const now = Date.now();
    if (now - lastReportTime > REPORT_INTERVAL) {
      console.warn(
        `[normalizeAis] Filtered in last ${REPORT_INTERVAL / 1000}s: ${invalidLatLonCount} invalid lat/lon, ${invalidMmsiCount} invalid MMSI, ${invalidTimestampCount} missing timestamp`,
      );
      invalidLatLonCount = 0;
      invalidMmsiCount = 0;
      invalidTimestampCount = 0;
      lastReportTime = now;
      sampleCount = 0; // Reset sample counter for next period
    }
    return undefined;
  }

  const ts = parseTimestamp(raw, 'ais');
  if (!ts) {
    invalidTimestampCount++;
    if (sampleCount < MAX_SAMPLES) {
      console.warn(`[normalizeAis] Sample ${sampleCount + 1}: Missing timestamp`, { raw });
      sampleCount++;
    }
    return undefined;
  }

  const rawMmsi = sanitizeString(extractValue(raw, 'mmsi', 'MMSI', 'Mmsi', 'shipMMSI', 'ShipMMSI'));
  const mmsi = rawMmsi ? normalizeMmsi(rawMmsi) : undefined;

  if (!mmsi) {
    invalidMmsiCount++;
    // Commented out to reduce log noise
    // if (sampleCount < MAX_SAMPLES) {
    //   console.warn(`[normalizeAis] Sample ${sampleCount + 1}: Invalid MMSI raw="${rawMmsi}"`, {
    //     raw,
    //   });
    //   sampleCount++;
    // }
    return undefined;
  }

  // Determine source from sourceId field if available
  const sourceId = sanitizeString(extractValue(raw, 'sourceId', 'source'));
  const finalSource = sourceId === 'aisstream.io' ? 'aisstream.io' : 'ais';

  const result: NormVesselMsg = {
    source: finalSource as any,
    ts,
    lat: coords.lat,
    lon: coords.lon,
    mmsi,
    imo: sanitizeString(extractValue(raw, 'imo', 'IMO', 'Imo')),
    callsign: sanitizeString(extractValue(raw, 'callsign', 'CallSign', 'call_sign', 'CALLSIGN')),
    name: sanitizeString(extractValue(raw, 'name', 'Name', 'shipName', 'ShipName')),
    speed: parseNumber(extractValue(raw, 'speed', 'SOG', 'sog', 'Speed', 'SPEED')),
    course: parseNumber(extractValue(raw, 'course', 'COG', 'cog', 'Course', 'COURSE')),
    heading: parseNumber(extractValue(raw, 'heading', 'Heading', 'HEADING')),
    status: sanitizeString(
      extractValue(raw, 'status', 'nav_status', 'Status', 'STATUS', 'navStatus'),
    ),
  };

  return result;
}

export function normalizeAircraft(raw: any, source: AircraftSource): NormAircraftMsg | undefined {
  if (!raw || typeof raw !== 'object') {
    console.warn('[normalizeAircraft] Invalid input: not an object');
    return undefined;
  }

  const lat = parseNumber(extractValue(raw, 'lat', 'latitude'));
  const lon = parseNumber(extractValue(raw, 'lon', 'lng', 'longitude'));

  if (!lat || !lon) {
    console.warn('[normalizeAircraft] Missing lat/lon');
    return undefined;
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    console.warn(`[normalizeAircraft] Invalid coordinates: lat=${lat}, lon=${lon}`);
    return undefined;
  }

  const ts = parseTimestamp(raw, source);
  if (!ts) return undefined;

  const result: NormAircraftMsg = {
    source,
    ts,
    lat,
    lon,
    icao24: sanitizeString(extractValue(raw, 'icao24', 'icao')),
    registration: sanitizeString(extractValue(raw, 'registration', 'reg')),
    callsign: sanitizeString(extractValue(raw, 'callsign', 'callSign')),
    altitude: parseInteger(extractValue(raw, 'altitude', 'alt')),
    groundSpeed: parseNumber(extractValue(raw, 'groundSpeed', 'gs', 'speed')),
    heading: parseInteger(extractValue(raw, 'heading', 'track')),
    verticalRate: parseNumber(extractValue(raw, 'verticalRate', 'vrate', 'rocd')),
  };

  return result;
}
