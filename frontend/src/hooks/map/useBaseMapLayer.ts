/**
 * Base map layer management
 * Handles different base map providers (OSM, MapTiler, OpenSeaMap, custom)
 */

import { useEffect, useRef, useCallback } from 'react';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import Map from 'ol/Map';
import { BaseMapProvider } from './types';

interface BaseMapConfig {
  provider: BaseMapProvider;
  maptilerApiKey?: string;
  maptilerStyle?: string;
  maxZoom: number;
  customMapSources?: Array<{
    id: string;
    name: string;
    urlTemplate: string;
    attribution?: string;
    maxZoom?: number;
  }>;
}

const MAPTILER_STYLE_MAP: Record<string, string> = {
  streets: 'streets-v2',
  outdoor: 'outdoor-v2',
  satellite: 'satellite',
  topo: 'topo-v2',
  terrain: 'terrain',
  bright: 'bright-v2',
  basic: 'basic-v2',
};

/**
 * Hook for managing base map layer
 */
export function useBaseMapLayer(config: BaseMapConfig) {
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const openSeaMapOverlayRef = useRef<TileLayer<any> | null>(null);

  /**
   * Create tile source based on provider
   */
  const createTileSource = useCallback(
    (provider: BaseMapProvider) => {
      // OpenSeaMap requires OSM base + overlay
      if (provider === 'openseamap' || provider === 'osm') {
        return new OSM();
      }

      // MapTiler
      if (provider === 'maptiler' && config.maptilerApiKey) {
        const styleKey = (config.maptilerStyle || 'streets').toLowerCase();
        const styleId = MAPTILER_STYLE_MAP[styleKey] || config.maptilerStyle || 'streets-v2';

        return new XYZ({
          url: `https://api.maptiler.com/maps/${styleId}/256/{z}/{x}/{y}.png?key=${config.maptilerApiKey}`,
          attributions: 'Map data © OpenStreetMap contributors, Imagery © MapTiler',
          maxZoom: config.maxZoom,
        });
      }

      // Custom map source
      if (provider.startsWith('custom:')) {
        const id = provider.slice('custom:'.length);
        const customSource = config.customMapSources?.find(s => s.id === id);
        
        if (customSource) {
          return new XYZ({
            url: customSource.urlTemplate,
            attributions: customSource.attribution || '',
            maxZoom: customSource.maxZoom ?? config.maxZoom,
          });
        }
      }

      // Default to OSM
      return new OSM();
    },
    [
      config.provider,
      config.maptilerApiKey,
      config.maptilerStyle,
      config.maxZoom,
      config.customMapSources,
    ]
  );

  /**
   * Initialize base layers
   */
  const initializeLayers = useCallback(() => {
    if (baseLayerRef.current) return;

    // Create base layer
    const source = createTileSource(config.provider);
    baseLayerRef.current = new TileLayer({ source });

    // Create OpenSeaMap overlay (initially hidden)
    openSeaMapOverlayRef.current = new TileLayer({
      source: new XYZ({
        url: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
        attributions: 'Map data © OpenSeaMap contributors',
        maxZoom: 18,
      }),
      visible: config.provider === 'openseamap',
    });
  }, [config.provider, createTileSource]);

  /**
   * Update base layer when provider changes
   */
  const updateBaseLayer = useCallback(
    (newProvider: BaseMapProvider) => {
      if (!baseLayerRef.current) return;

      const source = createTileSource(newProvider);
      baseLayerRef.current.setSource(source);

      // Toggle OpenSeaMap overlay
      if (openSeaMapOverlayRef.current) {
        openSeaMapOverlayRef.current.setVisible(newProvider === 'openseamap');
      }
    },
    [createTileSource]
  );

  /**
   * Get base layer instance
   */
  const getBaseLayer = useCallback(() => {
    if (!baseLayerRef.current) {
      initializeLayers();
    }
    return baseLayerRef.current!;
  }, [initializeLayers]);

  /**
   * Get OpenSeaMap overlay instance
   */
  const getOpenSeaMapOverlay = useCallback(() => {
    if (!openSeaMapOverlayRef.current) {
      initializeLayers();
    }
    return openSeaMapOverlayRef.current!;
  }, [initializeLayers]);

  /**
   * Attach layers to map
   */
  const attachToMap = useCallback(
    (map: Map) => {
      const baseLayer = getBaseLayer();
      const overlay = getOpenSeaMapOverlay();

      // Store references on map for external access
      try {
        if (typeof (map as any).set === 'function') {
          (map as any).set('baseLayer', baseLayer);
          (map as any).set('openSeaMapOverlay', overlay);
        }
      } catch (e) {
        console.warn('Failed to set map properties:', e);
      }
    },
    [getBaseLayer, getOpenSeaMapOverlay]
  );

  return {
    getBaseLayer,
    getOpenSeaMapOverlay,
    updateBaseLayer,
    attachToMap,
  };
}
