export const FUSION_CONFIG = {
  WINDOW_MS: 5 * 60 * 1000,
  ALLOWED_LATENESS_MS: 10 * 60 * 1000,
  MAX_EVENT_AGE_MS: 24 * 60 * 60 * 1000,
  SPEED_LIMIT_KN: 60,
  ALPHA: 0.25,
  BETA: 0.08,
} as const;

export const SOURCE_WEIGHT = {
  // Vessel sources
  marine_traffic: 0.9,
  vessel_finder: 0.85,
  china_port: 0.8,
  'aisstream.io': 0.88, // AISStream.io - high quality
  signalr: 0.82, // SignalR feed - good quality
  custom: 0.7,
  default: 0.7,
  // Aircraft sources
  adsb_exchange: 0.9,
  opensky: 0.85,
  api: 0.6, // Manual API submissions
} as const;

export type SourceKey = keyof typeof SOURCE_WEIGHT;
