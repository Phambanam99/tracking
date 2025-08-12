export const FUSION_CONFIG = {
  WINDOW_MS: 5 * 60 * 1000,
  ALLOWED_LATENESS_MS: 10 * 60 * 1000,
  MAX_EVENT_AGE_MS: 24 * 60 * 60 * 1000,
  SPEED_LIMIT_KN: 60,
  ALPHA: 0.25,
  BETA: 0.08,
} as const;

export const SOURCE_WEIGHT = {
  marine_traffic: 0.9,
  vessel_finder: 0.85,
  china_port: 0.8,
  custom: 0.7,
  default: 0.7,
  adsb_exchange: 0.9,
  opensky: 0.85,
} as const;

export type SourceKey = keyof typeof SOURCE_WEIGHT;

