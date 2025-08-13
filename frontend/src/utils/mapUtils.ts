/**
 * Map utility functions for OpenLayers
 */

/**
 * Calculate zoom level from resolution for EPSG:3857 projection
 * @param resolution - The map resolution
 * @returns The corresponding zoom level
 */
export const getZoomFromResolution = (
  resolution: number | undefined,
): number => {
  return Math.log2(156543.03392804097 / (resolution || 1));
};

/**
 * Calculate resolution from zoom level for EPSG:3857 projection
 * @param zoom - The zoom level
 * @returns The corresponding resolution
 */
export const getResolutionFromZoom = (zoom: number): number => {
  return 156543.03392804097 / Math.pow(2, zoom);
};

/**
 * Get adaptive cluster distance based on zoom level
 * @param zoom - Current zoom level
 * @returns Cluster distance value
 */
export const getClusterDistance = (zoom: number): number => {
  if (zoom <= 4) return 120;
  if (zoom <= 6) return 80;
  if (zoom <= 9) return 60;
  return 40;
};

/**
 * Determine if icons should be simplified based on zoom level
 * @param zoom - Current zoom level
 * @returns True if icons should be simplified (circles instead of SVG)
 */
export const shouldSimplifyIcons = (zoom: number): boolean => {
  // Show full icons a bit earlier to avoid “missing” markers on transition
  return zoom <= 6;
};
