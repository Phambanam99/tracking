/**
 * Map initialization system - Exports
 * Centralized export point for all map-related modules
 */

// Core types
export * from './types';

// Cache utilities
export { LRUCache, createCacheKey, throttle, debounce } from './cache';

// Hooks
export { useIconCache } from './useIconCache';
export { useVehicleStyleFactory } from './useVehicleStyleFactory';
export { useBaseMapLayer } from './useBaseMapLayer';
export { useMapInitialization } from './useMapInitialization.refactored';

// Plugin system
export { VehicleLayerPlugin, VehicleLayerFactory } from './VehicleLayerPlugin';

// Configuration factories
export {
  VehicleConfigFactory,
  createAircraftConfig,
  createVesselConfig,
  createDroneConfig,
  createSatelliteConfig,
} from './vehicleConfigFactory';
