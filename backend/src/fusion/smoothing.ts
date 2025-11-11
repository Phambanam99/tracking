// smoothings.ts
import { FUSION_CONFIG } from './config';

/**
 * α-β Filter for position smoothing and short-term prediction
 *
 * Lightweight alternative to Kalman filter, suitable for real-time tracking
 *
 * State: [x, y, vx, vy]
 * - (x, y): Position in decimal degrees (lon, lat)
 * - (vx, vy): Velocity in degrees/second (lon_deg/s, lat_deg/s)
 */

// ========== TYPES (UNCHANGED FOR COMPATIBILITY) ==========
export interface FilterState {
  x: number; // Longitude (degrees)
  y: number; // Latitude (degrees)
  vx: number; // Velocity X (degrees/second, longitude axis; scaled by cos(lat))
  vy: number; // Velocity Y (degrees/second, latitude axis)
  lastUpdate: number; // Timestamp (ms)
  confidence: number; // 0-1, decreases with time since last measurement
}

export interface Measurement {
  lat: number;
  lon: number;
  timestamp: number; // ms
  speed?: number; // knots
  course?: number; // degrees, 0°=North, 90°=East (maritime convention)
}

export interface PredictedPosition {
  lat: number;
  lon: number;
  speed?: number;
  course?: number;
  predicted: boolean;
  confidence: number; // 0-1
  timeSinceLastMeasurement: number; // seconds
}

// ========== INTERNAL CONFIGURATION ==========
// These can be moved to FUSION_CONFIG if external tuning is needed
const KNOT_TO_MPS = 0.514444; // 1 knot = 0.514444 m/s
const DEG_LAT_M = 111_320; // ~ meters per one degree latitude
const MIN_DT_SECONDS = 0.5; // Minimum time delta for stability
const CONFIDENCE_TAU_SECONDS = 300; // Confidence decay time constant (τ)
const COS_LAT_EPSILON = 1e-6; // Minimum cos(lat) to avoid division by zero
const VELOCITY_BLEND_FACTOR = 0.3; // Blend measured velocity to reduce drift
const SPEED_THRESHOLD_KNOTS = 0.1; // Minimum speed to report
const ACTIVE_FILTER_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes for active filters
const DEFAULT_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes default max age

// ========== INTERNAL HELPERS ==========
function speedCourseToVelocity(
  speedKnots: number,
  courseDeg: number,
  refLatDeg: number,
): { vx: number; vy: number } {
  if (!Number.isFinite(speedKnots) || !Number.isFinite(courseDeg) || !Number.isFinite(refLatDeg)) {
    return { vx: 0, vy: 0 };
  }

  const speedMps = speedKnots * KNOT_TO_MPS;
  const courseRad = (courseDeg * Math.PI) / 180;

  const cosLat = Math.cos((refLatDeg * Math.PI) / 180);
  if (!Number.isFinite(cosLat) || Math.abs(cosLat) < COS_LAT_EPSILON) {
    return { vx: 0, vy: 0 }; // Invalid latitude (near pole or NaN)
  }

  const vyMps = speedMps * Math.cos(courseRad); // North component
  const vxMps = speedMps * Math.sin(courseRad); // East component

  return {
    vx: vxMps / (DEG_LAT_M * cosLat), // degrees/second
    vy: vyMps / DEG_LAT_M, // degrees/second
  };
}

function velocityToSpeedCourse(
  vx: number,
  vy: number,
  refLatDeg: number,
): { speed: number; course: number } {
  const cosLat = Math.cos((refLatDeg * Math.PI) / 180);
  const safeCosLat = Math.abs(cosLat) < COS_LAT_EPSILON ? COS_LAT_EPSILON : cosLat;

  const vxMps = vx * (DEG_LAT_M * safeCosLat);
  const vyMps = vy * DEG_LAT_M;
  const speedMps = Math.hypot(vxMps, vyMps);

  let courseRad = Math.atan2(vxMps, vyMps); // 0 rad = North, +90 rad = East
  if (courseRad < 0) courseRad += 2 * Math.PI;

  return {
    speed: speedMps / KNOT_TO_MPS,
    course: (courseRad * 180) / Math.PI,
  };
}

function validateMeasurement(m: Measurement): boolean {
  return (
    Number.isFinite(m.lat) &&
    Math.abs(m.lat) <= 90 &&
    Number.isFinite(m.lon) &&
    Math.abs(m.lon) <= 180 &&
    Number.isFinite(m.timestamp) &&
    m.timestamp > 0
  );
}

function validateLatLon(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

// ========== ALPHA-BETA FILTER ==========
export class AlphaBetaFilter {
  private alpha: number;
  private beta: number;
  private state: FilterState | null = null;

  constructor(alpha = FUSION_CONFIG.ALPHA, beta = FUSION_CONFIG.BETA) {
    this.alpha = alpha;
    this.beta = beta;
  }

  initialize(measurement: Measurement): void {
    if (!validateMeasurement(measurement)) {
      console.warn('[AlphaBetaFilter] Invalid measurement in initialize');
      return;
    }

    const { vx, vy } =
      measurement.speed !== undefined && measurement.course !== undefined
        ? speedCourseToVelocity(measurement.speed, measurement.course, measurement.lat)
        : { vx: 0, vy: 0 };

    this.state = {
      x: measurement.lon,
      y: measurement.lat,
      vx,
      vy,
      lastUpdate: measurement.timestamp,
      confidence: 1.0,
    };
  }

  update(measurement: Measurement): FilterState {
    if (!validateMeasurement(measurement)) {
      throw new Error('[AlphaBetaFilter] Invalid measurement: ' + JSON.stringify(measurement));
    }

    if (!this.state) {
      this.initialize(measurement);
      return this.state!;
    }

    const rawDt = (measurement.timestamp - this.state.lastUpdate) / 1000;
    const dt = Math.max(rawDt, MIN_DT_SECONDS);

    // Prediction step
    const xPred = this.state.x + this.state.vx * dt;
    const yPred = this.state.y + this.state.vy * dt;

    // Innovation (residual)
    const rx = measurement.lon - xPred;
    const ry = measurement.lat - yPred;

    // Update step
    this.state.x = xPred + this.alpha * rx;
    this.state.y = yPred + this.alpha * ry;
    this.state.vx = this.state.vx + (this.beta / dt) * rx;
    this.state.vy = this.state.vy + (this.beta / dt) * ry;
    this.state.lastUpdate = measurement.timestamp;
    this.state.confidence = 1.0;

    // Optional: blend measured velocity to reduce drift
    if (measurement.speed !== undefined && measurement.course !== undefined) {
      const measuredVelocity = speedCourseToVelocity(
        measurement.speed,
        measurement.course,
        this.state.y,
      );
      this.state.vx =
        (1 - VELOCITY_BLEND_FACTOR) * this.state.vx + VELOCITY_BLEND_FACTOR * measuredVelocity.vx;
      this.state.vy =
        (1 - VELOCITY_BLEND_FACTOR) * this.state.vy + VELOCITY_BLEND_FACTOR * measuredVelocity.vy;
    }

    return this.state;
  }

  predict(timestamp: number): PredictedPosition | null {
    if (!this.state) return null;

    const dt = (timestamp - this.state.lastUpdate) / 1000;

    // Predict position
    const predLon = this.state.x + this.state.vx * dt;
    const predLat = this.state.y + this.state.vy * dt;

    // Reconstruct speed/course
    const { speed, course } = velocityToSpeedCourse(this.state.vx, this.state.vy, this.state.y);

    // Decay confidence
    const confidence = this.state.confidence * Math.exp(-dt / CONFIDENCE_TAU_SECONDS);

    return {
      lat: predLat,
      lon: predLon,
      speed: speed > SPEED_THRESHOLD_KNOTS ? speed : undefined,
      course,
      predicted: true,
      confidence,
      timeSinceLastMeasurement: dt,
    };
  }

  getState(): FilterState | null {
    return this.state;
  }

  reset(): void {
    this.state = null;
  }
}

// ========== FILTER MANAGER ==========
export class FilterManager {
  private filters = new Map<string, AlphaBetaFilter>();
  private readonly maxAge: number;

  constructor() {
    // Use config if available, fallback to default
    this.maxAge = (FUSION_CONFIG as any).MAX_FILTER_AGE_MS ?? DEFAULT_MAX_AGE_MS;
  }

  update(key: string, measurement: Measurement): FilterState {
    let filter = this.filters.get(key);
    if (!filter) {
      filter = new AlphaBetaFilter();
      this.filters.set(key, filter);
    }
    return filter.update(measurement);
  }

  predict(key: string, timestamp: number): PredictedPosition | null {
    const filter = this.filters.get(key);
    if (!filter) return null;

    const prediction = filter.predict(timestamp);
    if (prediction && prediction.timeSinceLastMeasurement > this.maxAge / 1000) {
      return null;
    }
    return prediction;
  }

  getState(key: string): FilterState | null {
    return this.filters.get(key)?.getState() ?? null;
  }

  cleanup(now: number): void {
    for (const [key, filter] of this.filters.entries()) {
      const state = filter.getState();
      if (state && now - state.lastUpdate > this.maxAge) {
        this.filters.delete(key);
      }
    }
  }

  getStats(): { total: number; active: number } {
    const now = Date.now();
    let active = 0;

    for (const filter of this.filters.values()) {
      const state = filter.getState();
      if (state && now - state.lastUpdate < ACTIVE_FILTER_THRESHOLD_MS) {
        active++;
      }
    }

    return { total: this.filters.size, active };
  }
}

// ========== DEAD RECKONING ==========
export function deadReckon(
  lastPosition: { lat: number; lon: number; speed?: number; course?: number; timestamp: number },
  targetTimestamp: number,
  maxPredictionSeconds = 600,
): PredictedPosition | null {
  const dt = (targetTimestamp - lastPosition.timestamp) / 1000;
  if (dt > maxPredictionSeconds || dt < 0) return null;

  if (lastPosition.speed === undefined || lastPosition.course === undefined) {
    return {
      lat: lastPosition.lat,
      lon: lastPosition.lon,
      predicted: false,
      confidence: 0,
      timeSinceLastMeasurement: dt,
    };
  }

  const velocity = speedCourseToVelocity(lastPosition.speed, lastPosition.course, lastPosition.lat);

  const predLon = lastPosition.lon + velocity.vx * dt;
  const predLat = lastPosition.lat + velocity.vy * dt;
  const confidence = Math.exp(-dt / CONFIDENCE_TAU_SECONDS);

  return {
    lat: predLat,
    lon: predLon,
    speed: lastPosition.speed,
    course: lastPosition.course,
    predicted: true,
    confidence,
    timeSinceLastMeasurement: dt,
  };
}
