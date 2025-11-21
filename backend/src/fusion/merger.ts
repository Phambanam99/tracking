import { NormVesselMsg, NormAircraftMsg, VesselSource, AircraftSource } from './types';
import { scoreBySource } from './utils';
import { ConflictMonitorService } from './conflict-monitor.service';

// ========== INTERNAL CONSTANTS ==========
const TIME_WINDOW_MS = 60_000; // 1 minute for timestamp priority
const MIN_SOURCE_SCORE = 0.1; // Minimum source weight to be considered
const CONFLICT_LOG_THRESHOLD = 3; // Reduced threshold for more sensitive logging
const SIGNIFICANT_DIFF_THRESHOLD = 0.5; // 50% difference instead of 20%

// ========== EXISTING EXPORTS (KEEP FOR COMPATIBILITY) ==========
export interface FieldScore {
  value: any;
  score: number;
  source: string;
  timestamp: string;
}

// ========== INTERNAL HELPERS (NOT EXPORTED) ==========
/**
 * Find the newest message efficiently (O(n) instead of O(n log n))
 */
function findNewestMessage<T extends { ts: string }>(messages: T[]): T {
  return messages.reduce((newest, current) =>
    Date.parse(current.ts) > Date.parse(newest.ts) ? current : newest,
  );
}

/**
 * Combine sources from multiple messages
 */
function combineSources<T extends { source?: string }>(messages: T[]): string {
  const sources = [...new Set(messages.map((m) => m.source).filter(Boolean))];
  return sources.length > 1 ? 'fused' : sources[0] || 'unknown';
}

/**
 * Generic field selector with conflict detection and type safety
 */
function selectBestFieldGeneric<T extends Record<string, any>, K extends keyof T>(
  messages: T[],
  field: K,
  now: number,
  conflictMonitor?: ConflictMonitorService,
  mmsi?: string,
): T[K] | undefined {
  type MessageWithField = T & { [key in K]: NonNullable<T[K]> };

  const candidates = messages
    .filter((m): m is MessageWithField => {
      const value = m[field];
      return value !== null && value !== undefined && value !== '';
    })
    .map((m) => ({
      value: m[field],
      score: scoreBySource(m.source),
      source: m.source || 'unknown',
      timestamp: Date.parse(m.ts),
    }))
    .filter((c) => c.score >= MIN_SOURCE_SCORE);

  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0].value;

  // Conflict detection - only log significant conflicts
  const uniqueValues = new Set(candidates.map((c) => JSON.stringify(c.value)));
  if (uniqueValues.size >= CONFLICT_LOG_THRESHOLD) {
    // For numeric fields, check if difference is significant (> 50%)
    const isSignificant = (() => {
      if (typeof candidates[0].value === 'number' && candidates.length >= 2) {
        const values = candidates.map((c) => c.value as number).filter((v) => v > 0);
        if (values.length < 2) return false;
        const max = Math.max(...values);
        const min = Math.min(...values);
        const diff = (max - min) / max;
        return diff > SIGNIFICANT_DIFF_THRESHOLD; // > 50% difference
      }
      return true; // Log non-numeric conflicts
    })();

    if (isSignificant) {
      // Log to console for backward compatibility
      // console.warn(
      //   `[FieldFusion] Conflict detected for "${String(field)}": ${JSON.stringify(
      //     candidates.map((c) => ({
      //       source: c.source,
      //       value: c.value,
      //       timestamp: new Date(c.timestamp).toISOString(),
      //       age: ((now - c.timestamp) / 1000).toFixed(1) + 's'
      //     })),
      //   )}`,
      // );

      // Also record in conflict monitor if available
      if (conflictMonitor) {
        conflictMonitor.recordConflict(
          String(field),
          candidates.map((c) => ({ source: c.source, value: c.value, timestamp: c.timestamp })),
          mmsi,
        );
      }
    }
  }

  // Prioritize by: 1) Recency (within time window), 2) Source score, 3) Value length (strings)
  candidates.sort((a, b) => {
    const timeDiff = Math.abs(a.timestamp - b.timestamp);

    if (timeDiff < TIME_WINDOW_MS) {
      // Within time window: prioritize source score
      if (Math.abs(a.score - b.score) > 0.01) {
        return b.score - a.score;
      }
      // For strings, prefer longer/more detailed values
      if (typeof a.value === 'string' && typeof b.value === 'string') {
        return b.value.length - a.value.length;
      }
    }

    // Outside time window: always prefer newer
    return b.timestamp - a.timestamp;
  });

  return candidates[0].value;
}

/**
 * Generic message merger for any message type
 */
function mergeMessagesInternal<T extends { source?: string; ts: string }>(
  messages: T[],
  fields: {
    static: readonly (keyof T)[];
    position: readonly (keyof T)[];
    dynamic: readonly (keyof T)[];
  },
  now: number,
  conflictMonitor?: ConflictMonitorService,
  mmsi?: string,
): T | undefined {
  // Edge case validation
  if (messages.length === 0) return undefined;
  if (messages.length === 1) {
    const msg = messages[0];
    if (!msg.ts || isNaN(Date.parse(msg.ts))) {
      console.warn('[FieldFusion] Invalid timestamp in single message');
      return undefined;
    }
    return msg;
  }

  // Validate all timestamps
  messages.forEach((m, i) => {
    if (!m.ts || isNaN(Date.parse(m.ts))) {
      console.warn(`[FieldFusion] Invalid timestamp at index ${i}: ${m.ts}`);
    }
  });

  const newest = findNewestMessage(messages);
  const merged = { ...newest };

  // Merge static fields (best available)
  for (const field of fields.static) {
    const bestValue = selectBestFieldGeneric(messages, field, now, conflictMonitor, mmsi);
    if (bestValue !== undefined) {
      merged[field] = bestValue;
    }
  }

  // Merge position fields (always from newest)
  for (const field of fields.position) {
    merged[field] = newest[field];
  }

  // Merge dynamic fields (newest first, fallback to best)
  for (const field of fields.dynamic) {
    const newestValue = newest[field];
    if (newestValue !== null && newestValue !== undefined) {
      merged[field] = newestValue;
    } else {
      const bestValue = selectBestFieldGeneric(messages, field, now, conflictMonitor, mmsi);
      if (bestValue !== undefined) {
        merged[field] = bestValue;
      }
    }
  }

  // Update source
  (merged as any).source = combineSources(messages);

  return merged;
}

// ========== PUBLIC API (KEEP COMPATIBILITY) ==========
/**
 * Select best value for a specific field from multiple messages
 * KEEP ORIGINAL SIGNATURE - used by external code
 */
export function selectBestField<T extends NormVesselMsg | NormAircraftMsg>(
  messages: T[],
  field: keyof T,
  _now: number, // Keep parameter for signature compatibility
  conflictMonitor?: ConflictMonitorService,
): any {
  const now = Date.now();
  const mmsi = (messages[0] as any)?.mmsi;
  return selectBestFieldGeneric(messages, field, now, conflictMonitor, mmsi);
}

/**
 * Merge multiple vessel messages into one best composite
 */
export function mergeVesselMessages(
  messages: NormVesselMsg[],
  now = Date.now(),
  conflictMonitor?: ConflictMonitorService,
): NormVesselMsg | undefined {
  const fields = {
    static: ['mmsi', 'imo', 'callsign', 'name'] as const,
    position: ['lat', 'lon', 'ts'] as const,
    dynamic: ['speed', 'course', 'heading', 'status'] as const,
  };

  const mmsi = messages[0]?.mmsi;
  return mergeMessagesInternal(messages, fields, now, conflictMonitor, mmsi);
}

/**
 * Merge multiple aircraft messages into one best composite
 */
export function mergeAircraftMessages(
  messages: NormAircraftMsg[],
  now = Date.now(),
  conflictMonitor?: ConflictMonitorService,
): NormAircraftMsg | undefined {
  const fields = {
    static: ['icao24', 'registration', 'callsign'] as const,
    position: ['lat', 'lon', 'ts'] as const,
    dynamic: ['altitude', 'groundSpeed', 'heading', 'verticalRate'] as const,
  };

  return mergeMessagesInternal(messages, fields, now, conflictMonitor);
}

/**
 * Calculate confidence score for merged message
 * KEEP ORIGINAL SIGNATURE - used by external code
 */
export function calculateMergeConfidence(original: NormVesselMsg[], merged: NormVesselMsg): number {
  if (original.length <= 1) return 1.0;

  const fields: (keyof NormVesselMsg)[] = [
    'mmsi',
    'imo',
    'callsign',
    'name',
    'speed',
    'course',
    'heading',
    'status',
  ];

  let multiSourceFields = 0;
  let totalFields = 0;

  for (const field of fields) {
    totalFields++;
    const sourceCount = original.filter(
      (m) => m[field] !== null && m[field] !== undefined && m[field] !== '',
    ).length;
    if (sourceCount >= 2) {
      multiSourceFields++;
    }
  }

  return totalFields > 0 ? multiSourceFields / totalFields : 0;
}

/**
 * Get merge statistics for debugging
 * KEEP ORIGINAL SIGNATURE - used by external code
 */
export function getMergeStats(
  original: NormVesselMsg[],
  merged: NormVesselMsg,
): {
  sourceCount: number;
  sources: string[];
  fieldsFromEachSource: Record<string, string[]>;
  confidence: number;
} {
  const fields: (keyof NormVesselMsg)[] = [
    'mmsi',
    'imo',
    'callsign',
    'name',
    'speed',
    'course',
    'heading',
    'status',
  ];

  const sources = [...new Set(original.map((m) => m.source).filter(Boolean))];
  const fieldsFromEachSource: Record<string, string[]> = {};

  for (const msg of original) {
    const source = msg.source || 'unknown';
    if (!fieldsFromEachSource[source]) {
      fieldsFromEachSource[source] = [];
    }

    for (const field of fields) {
      const value = msg[field];
      if (value !== null && value !== undefined && value !== '') {
        fieldsFromEachSource[source].push(String(field));
      }
    }
  }

  return {
    sourceCount: sources.length,
    sources,
    fieldsFromEachSource,
    confidence: calculateMergeConfidence(original, merged),
  };
}

// ========== NEW EXPORTS (ADDITIONAL, NOT BREAKING) ==========
/**
 * Aircraft-specific confidence calculator
 * NEW: Add missing functionality for aircraft
 */
export function calculateAircraftMergeConfidence(
  original: NormAircraftMsg[],
  merged: NormAircraftMsg,
): number {
  if (original.length <= 1) return 1.0;

  const fields: (keyof NormAircraftMsg)[] = [
    'icao24',
    'registration',
    'callsign',
    'altitude',
    'groundSpeed',
    'heading',
    'verticalRate',
  ];

  let multiSourceFields = 0;
  let totalFields = 0;

  for (const field of fields) {
    totalFields++;
    const sourceCount = original.filter(
      (m) => m[field] !== null && m[field] !== undefined && m[field] !== '',
    ).length;
    if (sourceCount >= 2) {
      multiSourceFields++;
    }
  }

  return totalFields > 0 ? multiSourceFields / totalFields : 0;
}

/**
 * Aircraft-specific statistics
 * NEW: Add missing functionality for aircraft
 */
export function getAircraftMergeStats(
  original: NormAircraftMsg[],
  merged: NormAircraftMsg,
): {
  sourceCount: number;
  sources: string[];
  fieldsFromEachSource: Record<string, string[]>;
  confidence: number;
} {
  const fields: (keyof NormAircraftMsg)[] = [
    'icao24',
    'registration',
    'callsign',
    'altitude',
    'groundSpeed',
    'heading',
    'verticalRate',
  ];

  const sources = [...new Set(original.map((m) => m.source).filter(Boolean))];
  const fieldsFromEachSource: Record<string, string[]> = {};

  for (const msg of original) {
    const source = msg.source || 'unknown';
    if (!fieldsFromEachSource[source]) {
      fieldsFromEachSource[source] = [];
    }

    for (const field of fields) {
      const value = msg[field];
      if (value !== null && value !== undefined && value !== '') {
        fieldsFromEachSource[source].push(String(field));
      }
    }
  }

  return {
    sourceCount: sources.length,
    sources,
    fieldsFromEachSource,
    confidence: calculateAircraftMergeConfidence(original, merged),
  };
}
