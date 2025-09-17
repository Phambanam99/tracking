import { registerAs } from '@nestjs/config';

// Fusion engine configuration pulled from environment variables with sensible defaults.
// These values control buffering windows, lateness tolerance, movement threshold, scoring weights, and publish rate limiting.
export default registerAs('fusion', () => ({
  windowMs: parseInt(process.env.FUSION_WINDOW_MS || '60000', 10),
  allowedLatenessMs: parseInt(process.env.FUSION_ALLOWED_LATENESS_MS || '30000', 10),
  minMoveMeters: parseFloat(process.env.FUSION_MIN_MOVE_METERS || '5'),
  recencyWeight: parseFloat(process.env.FUSION_SCORE_RECENCY_WEIGHT || '0.8'),
  speedBonus: parseFloat(process.env.FUSION_SCORE_SPEED_BONUS || '0.1'),
  publishMinIntervalMs: parseInt(process.env.FUSION_PUBLISH_MIN_INTERVAL_MS || '5000', 10),
  // If set, accept records whose age (now - ts) <= maxAgeMs; if unset -> no age rejection (only window trimming affects fusion buffer)
  maxAgeMs: process.env.FUSION_MAX_AGE_MS ? parseInt(process.env.FUSION_MAX_AGE_MS, 10) : null,
  // Retention for Redis active vessels (milliseconds). Default 9h (9 * 3600 * 1000)
  redisRetentionMs: process.env.FUSION_REDIS_RETENTION_MS
    ? parseInt(process.env.FUSION_REDIS_RETENTION_MS, 10)
    : 9 * 3600 * 1000,
}));
