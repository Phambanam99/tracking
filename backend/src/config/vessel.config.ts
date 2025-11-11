/**
 * Vessel Configuration
 *
 * Configurable settings for vessel tracking and position filtering
 */

export const vesselConfig = {
  /**
   * Minimum distance (in meters) between consecutive positions
   * Positions closer than this will be filtered out to reduce DB writes
   *
   * Default: 10000 meters (10 km)
   * Set to 0 to disable filtering
   */
  minPositionDistanceMeters: parseInt(
    process.env.VESSEL_MIN_POSITION_DISTANCE_METERS || '10000',
    10,
  ),

  /**
   * Maximum time (in seconds) between position updates
   * Even if distance is small, update if time exceeded
   *
   * Default: 3600 seconds (1 hour)
   */
  maxPositionAgeSeconds: parseInt(process.env.VESSEL_MAX_POSITION_AGE_SECONDS || '3600', 10),

  /**
   * Enable/disable position distance filtering
   *
   * Default: true
   */
  enablePositionFiltering: process.env.VESSEL_ENABLE_POSITION_FILTERING !== 'false',
};

/**
 * Calculate distance between two coordinates using Haversine formula
 *
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
