/**
 * Refactored map initialization hook
 * Uses plugin architecture for extensibility and maintainability
 */

import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Fill, Stroke } from 'ol/style';
import { fromLonLat } from 'ol/proj';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';
import { getClusterDistance } from '../../utils/mapUtils';
import { useBaseMapLayer } from './useBaseMapLayer';
import { VehicleLayerFactory } from './VehicleLayerPlugin';
import { VehicleConfigFactory } from './vehicleConfigFactory';
import { VehicleStyleFactory } from './VehicleStyleFactory.class';
import { MapInitializationResult } from './types';

interface UseMapInitializationProps {
  mapRef: React.RefObject<HTMLDivElement | null>;
  mapInstanceRef: React.RefObject<Map | null>;
  aircraftLayerRef?: React.RefObject<VectorLayer<any> | null>;
  vesselLayerRef?: React.RefObject<VectorLayer<any> | null>;
  regionLayerRef?: React.RefObject<VectorLayer<VectorSource> | null>;
}

/**
 * Main map initialization hook
 * Orchestrates all map components using plugin architecture
 */
export function useMapInitialization(props: UseMapInitializationProps) {
  const {
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
    regionLayerRef,
  } = props;

  const { settings } = useSystemSettingsStore();
  const { baseMapProvider, maptilerStyle: userMaptilerStyle } = useUserPreferencesStore();

  // Plugin instances
  const aircraftPluginRef = useRef<ReturnType<typeof VehicleLayerFactory.createPlugin> | null>(null);
  const vesselPluginRef = useRef<ReturnType<typeof VehicleLayerFactory.createPlugin> | null>(null);

  // Base map layer management
  const effectiveProvider = baseMapProvider === 'default' ? settings.mapProvider : baseMapProvider;
  const baseMapLayer = useBaseMapLayer({
    provider: effectiveProvider,
    maptilerApiKey: settings.maptilerApiKey,
    maptilerStyle: baseMapProvider === 'default' ? settings.maptilerStyle : userMaptilerStyle,
    maxZoom: settings.maxZoom,
    customMapSources: settings.customMapSources,
  });

  /**
   * Initialize map instance
   */
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const timer = setTimeout(() => {
      if (
        !mapRef.current ||
        mapRef.current.offsetWidth === 0 ||
        mapRef.current.offsetHeight === 0
      ) {
        console.error('Map container has no dimensions!');
        return;
      }

      // Create vehicle configurations
      const configOptions = {
        clusterEnabled: settings.clusterEnabled,
        operatorColors: settings.aircraftOperatorColors,
        flagColors: settings.vesselFlagColors,
      };

      const aircraftConfig = VehicleConfigFactory.createConfig('aircraft', configOptions);
      const vesselConfig = VehicleConfigFactory.createConfig('vessel', configOptions);

      // Create style factories (class-based, not hooks)
      const aircraftStyleFactory = new VehicleStyleFactory(aircraftConfig);
      const vesselStyleFactory = new VehicleStyleFactory(vesselConfig);

      // Create plugins
      const aircraftPlugin = VehicleLayerFactory.createPlugin(aircraftConfig, aircraftStyleFactory);
      const vesselPlugin = VehicleLayerFactory.createPlugin(vesselConfig, vesselStyleFactory);

      aircraftPluginRef.current = aircraftPlugin;
      vesselPluginRef.current = vesselPlugin;

      // Create layers
      const aircraftLayer = aircraftPlugin.createLayer();
      const vesselLayer = vesselPlugin.createLayer();

      // Region layer
      const regionSource = new VectorSource();
      const regionLayer = new VectorLayer({
        source: regionSource,
        style: new Style({
          stroke: new Stroke({ color: 'rgba(255,0,0,0.8)', width: 2 }),
          fill: new Fill({ color: 'rgba(255,0,0,0.1)' }),
        }),
      });

      // Get base layers
      const baseLayer = baseMapLayer.getBaseLayer();
      const openSeaMapOverlay = baseMapLayer.getOpenSeaMapOverlay();

      // Create map
      const map = new Map({
        target: mapRef.current!,
        pixelRatio: 1,
        layers: [baseLayer, openSeaMapOverlay, aircraftLayer, vesselLayer, regionLayer],
        view: new View({
          center: fromLonLat([108.2194, 16.0544]), // VN center
          zoom: Math.max(settings.minZoom, Math.min(settings.maxZoom, 6)),
          minZoom: settings.minZoom,
          maxZoom: settings.maxZoom,
        }),
      });

      // Initialize plugins with map
      aircraftPlugin.initialize(map);
      vesselPlugin.initialize(map);

      // Attach base layer references
      baseMapLayer.attachToMap(map);

      // Zoom-based adjustments
      const updateByZoom = () => {
        const z = map.getView().getZoom() ?? 6;
        const dist = getClusterDistance(z);

        if (settings.clusterEnabled) {
          aircraftPlugin.updateClusterDistance(dist);
          vesselPlugin.updateClusterDistance(dist);
        }

        aircraftLayer.setVisible(true);
        vesselLayer.setVisible(true);
      };

      updateByZoom();
      map.getView().on('change:resolution', updateByZoom);

      // Store references
      mapInstanceRef.current = map;
      if (aircraftLayerRef) aircraftLayerRef.current = aircraftLayer;
      if (vesselLayerRef) vesselLayerRef.current = vesselLayer;
      if (regionLayerRef) regionLayerRef.current = regionLayer;

      // Expose map instance for sibling hooks
      try {
        (regionLayer as any).set?.('map', map);
      } catch {}

      // Ensure size updates after mount
      const updateMapSize = () => {
        map.updateSize();
        if (!map.getSize()) setTimeout(updateMapSize, 50);
      };
      setTimeout(updateMapSize, 100);

      console.log('[Map] Initialized with plugin architecture');
    }, 50);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined);
      }
      // Cleanup plugins
      aircraftPluginRef.current?.destroy();
      vesselPluginRef.current?.destroy();
    };
  }, [
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
    regionLayerRef,
    settings.clusterEnabled,
    settings.minZoom,
    settings.maxZoom,
    settings.aircraftOperatorColors,
    settings.vesselFlagColors,
  ]);

  /**
   * Update base layer when provider changes
   */
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const provider = baseMapProvider === 'default' ? settings.mapProvider : baseMapProvider;
    baseMapLayer.updateBaseLayer(provider);
  }, [
    settings.mapProvider,
    settings.maptilerApiKey,
    settings.maptilerStyle,
    settings.customMapSources,
    settings.maxZoom,
    baseMapProvider,
    userMaptilerStyle,
    mapInstanceRef,
    baseMapLayer,
  ]);
}
