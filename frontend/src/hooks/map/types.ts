/**
 * Core types and interfaces for the map plugin system
 */

import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style } from 'ol/style';
import Map from 'ol/Map';

/**
 * Configuration for a vehicle type (aircraft, vessel, drone, etc.)
 */
export interface VehicleTypeConfig {
  /** Unique identifier for this vehicle type */
  type: 'aircraft' | 'vessel' | 'drone' | 'satellite';
  /** Icon path for this vehicle type */
  iconPath: string;
  /** Default color if no operator/flag color is specified */
  defaultColor: string;
  /** Color mapping function (operator/flag -> color) */
  getColor: (identifier?: string) => string;
  /** Heading extraction function */
  getHeading: (data: any) => number;
  /** Identifier extraction function (for color mapping) */
  getIdentifier: (data: any) => string | undefined;
}

/**
 * Cache entry for styles
 */
export interface StyleCacheEntry {
  style: Style;
  lastUsed: number;
  usageCount: number;
}

/**
 * LRU Cache configuration
 */
export interface CacheConfig {
  maxSize: number;
  ttl?: number; // Time to live in ms
}

/**
 * Image cache entry
 */
export interface ImageCacheEntry {
  image: HTMLImageElement;
  isLoaded: boolean;
  callbacks: Array<() => void>;
}

/**
 * Map layer plugin interface for extensibility
 */
export interface IMapLayerPlugin {
  /** Plugin identifier */
  readonly id: string;
  
  /** Plugin name */
  readonly name: string;
  
  /** Initialize the plugin */
  initialize(map: Map): void;
  
  /** Create and return the vector layer */
  createLayer(): VectorLayer<VectorSource>;
  
  /** Get the vector source for external updates */
  getSource(): VectorSource;
  
  /** Update layer visibility */
  setVisible(visible: boolean): void;
  
  /** Cleanup resources */
  destroy(): void;
}

/**
 * Layer factory configuration
 */
export interface LayerFactoryConfig {
  vehicleConfig: VehicleTypeConfig;
  source: VectorSource;
  styleFunction: (feature: any, resolution: number) => Style;
}

/**
 * Base map provider types
 */
export type BaseMapProvider = 
  | 'default' 
  | 'osm' 
  | 'openseamap' 
  | 'maptiler' 
  | `custom:${string}`;

/**
 * Map initialization result
 */
export interface MapInitializationResult {
  map: Map;
  layers: {
    aircraft?: VectorLayer<any>;
    vessel?: VectorLayer<any>;
    region?: VectorLayer<any>;
  };
  sources: {
    aircraft?: VectorSource;
    vessel?: VectorSource;
    region?: VectorSource;
  };
  cleanup: () => void;
}
