/**
 * Timestamp validation utilities
 * Prevents NaN and invalid timestamps from propagating through the pipeline
 */

/**
 * Validate if a value can be parsed as a valid timestamp
 * @param ts - Timestamp string, number, or Date
 * @returns true if valid, false otherwise
 */
export function isValidTimestamp(ts: unknown): boolean {
  if (!ts) return false;

  // If it's already a valid Date object
  if (ts instanceof Date) {
    return !isNaN(ts.getTime()) && ts.getTime() > 0;
  }

  // Try parsing string or number
  const parsed = Date.parse(String(ts));

  // Check if parsed value is valid and positive
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return false;
  }

  // Additional check: timestamp should not be in the future by more than 1 day
  const now = Date.now();
  if (parsed > now + 24 * 60 * 60 * 1000) {
    return false; // More than 24 hours in the future
  }

  return true;
}

/**
 * Parse and validate timestamp
 * @param ts - Timestamp to parse
 * @returns Valid timestamp in milliseconds, or null if invalid
 */
export function parseValidTimestamp(ts: unknown): number | null {
  if (!isValidTimestamp(ts)) {
    return null;
  }

  if (ts instanceof Date) {
    return ts.getTime();
  }

  const parsed = Date.parse(String(ts));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Get ISO string from validated timestamp
 * @param ts - Timestamp to convert
 * @returns ISO string, or null if invalid
 */
export function toValidISOString(ts: unknown): string | null {
  const validated = parseValidTimestamp(ts);
  if (validated === null) {
    return null;
  }

  try {
    return new Date(validated).toISOString();
  } catch {
    return null;
  }
}

/**
 * Check if timestamp is within allowed lateness window
 * @param ts - Timestamp to check
 * @param now - Current time
 * @param allowedLatenessMs - Maximum allowed lateness in milliseconds
 * @returns true if within window, false otherwise
 */
export function isWithinLatenessWindow(
  ts: unknown,
  now: number,
  allowedLatenessMs: number,
): boolean {
  const validated = parseValidTimestamp(ts);
  if (validated === null) {
    return false;
  }

  const timeSince = now - validated;
  return timeSince >= 0 && timeSince <= allowedLatenessMs;
}
