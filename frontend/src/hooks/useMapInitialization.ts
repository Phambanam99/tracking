import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';

import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import Cluster from 'ol/source/Cluster'; // ✅ default import
// import { defaults as defaultControls, Attribution } from 'ol/control';
import {
  Style,
  Text,
  Fill,
  Stroke,
  Circle as CircleStyle,
  Icon,
} from 'ol/style';
import { fromLonLat } from 'ol/proj';
import {
  getZoomFromResolution,
  getClusterDistance,
  shouldSimplifyIcons,
} from '../utils/mapUtils';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';

interface UseMapInitializationProps {
  mapRef: React.RefObject<HTMLDivElement | null>;
  mapInstanceRef: React.RefObject<Map | null>;
  aircraftLayerRef: React.RefObject<VectorLayer<any> | null>;
  vesselLayerRef: React.RefObject<VectorLayer<any> | null>;
  regionLayerRef: React.RefObject<VectorLayer<VectorSource> | null>;
}

export function useMapInitialization(
  props: Partial<UseMapInitializationProps> & {
    mapRef: React.RefObject<HTMLDivElement | null>;
    mapInstanceRef: React.RefObject<Map | null>;
  },
) {
  const {
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
    regionLayerRef,
  } = props;

  const { settings } = useSystemSettingsStore();

  // Track URLs for cleanup
  const urlRef = useRef<Set<string>>(new Set());

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

      // Sources
      const aircraftSource = new VectorSource();
      const vesselSource = new VectorSource();
      const regionSource = new VectorSource();

      // Enable/disable clustering via env (default: enabled)
      const clusterEnabled = settings.clusterEnabled;

      // Optimized clusters for large datasets (only if enabled)
      const aircraftCluster = clusterEnabled
        ? new Cluster({
            source: aircraftSource,
            distance: 60,
            minDistance: 20,
          })
        : null;
      const vesselCluster = clusterEnabled
        ? new Cluster({
            source: vesselSource,
            distance: 60,
            minDistance: 20,
          })
        : null;

      // Style caches to avoid repeated object allocations
      const clusterStyleCacheAircraft: Record<string, Style> = {};
      const clusterStyleCacheVessel: Record<string, Style> = {};

      // Icon cache with lazy loading to prevent performance issues
      const iconCacheAircraft: Record<string, Style> = {};
      const iconCacheVessel: Record<string, Style> = {};

      const getClusterStyleAircraft = (
        sizeBucket: number,
        withText: boolean,
      ): Style => {
        const key = `${sizeBucket}-${withText ? 't' : 'n'}`;
        if (!clusterStyleCacheAircraft[key]) {
          clusterStyleCacheAircraft[key] = new Style({
            image: new CircleStyle({
              radius: Math.min(15 + sizeBucket * 2, 30),
              fill: new Fill({ color: 'rgba(59,130,246,0.8)' }),
              stroke: new Stroke({ color: 'white', width: 2 }),
            }),
            text: withText
              ? new Text({
                  text: String(sizeBucket),
                  fill: new Fill({ color: 'white' }),
                  font: 'bold 12px sans-serif',
                })
              : undefined,
          });
        }
        return clusterStyleCacheAircraft[key];
      };

      // const getSingleDotStyleAircraft = (): Style => {
      //   const key = 'dot';
      //   if (!singleDotStyleAircraft[key]) {
      //     singleDotStyleAircraft[key] = new Style({
      //       image: new CircleStyle({
      //         radius: 4,
      //         fill: new Fill({ color: 'rgba(59,130,246,0.9)' }),
      //         stroke: new Stroke({ color: 'white', width: 1 }),
      //       }),
      //     });
      //   }
      //   return singleDotStyleAircraft[key];
      // };

      const getIconStyleAircraft = (
        headingKey: number,
        operator?: string,
      ): Style => {
        const key = `${headingKey}-${operator || 'default'}`;

        // Return cached style if exists
        if (iconCacheAircraft[key]) {
          return iconCacheAircraft[key];
        }

        const customColor = operator
          ? settings.aircraftOperatorColors[operator.toUpperCase()]
          : '#2563eb'; // Default blue color

        // Create inline SVG with custom color
        const svgString = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="${customColor}"/>
          </svg>
        `;

        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        // Cache both style and URL
        const style = new Style({
          image: new Icon({
            src: url,
            scale: 0.8,
            rotation: (headingKey * Math.PI) / 180,
          }),
        });

        iconCacheAircraft[key] = style;
        urlRef.current.add(url); // Track for cleanup

        return style;
      };

      // Style function nên dùng resolution (không truy cập map ở đây)
      const aircraftVectorStyle: import('ol/style/Style').StyleFunction = (
        feature,
        resolution,
      ) => {
        const zoom = getZoomFromResolution(resolution);
        const clusterMembers = feature.get('features') as any[] | undefined;

        if (clusterEnabled) {
          if (!clusterMembers || !Array.isArray(clusterMembers))
            return new Style();
          const size = clusterMembers.length;
          if (size > 1) {
            const bucket = Math.min(99, Math.max(2, size));
            const showText = zoom > 6;
            return getClusterStyleAircraft(bucket, showText);
          }

          if (shouldSimplifyIcons(zoom)) {
            const ac = clusterMembers[0]?.get('aircraft');
            return new Style({
              image: new CircleStyle({
                radius: 4,
                fill: new Fill({
                  color:
                    settings.aircraftOperatorColors[
                      ((ac?.operator as string) || '').toUpperCase()
                    ] || 'rgba(59,130,246,0.9)',
                }),
                stroke: new Stroke({ color: 'white', width: 1 }),
              }),
            });
          }

          const ac = clusterMembers[0]?.get('aircraft');
          const heading = ac?.lastPosition?.heading || 0;
          const headingKey = Math.round(heading / 5) * 5;
          const operator = ac?.operator as string;
          return getIconStyleAircraft(headingKey, operator);
        }

        // Non-clustered: feature itself is the point with 'aircraft'
        const ac = feature.get('aircraft');
        if (!ac) return new Style();
        if (shouldSimplifyIcons(zoom)) {
          return new Style({
            image: new CircleStyle({
              radius: 4,
              fill: new Fill({
                color:
                  settings.aircraftOperatorColors[
                    ((ac?.operator as string) || '').toUpperCase()
                  ] || 'rgba(59,130,246,0.9)',
              }),
              stroke: new Stroke({ color: 'white', width: 1 }),
            }),
          });
        }
        const heading = ac?.lastPosition?.heading || 0;
        const headingKey = Math.round(heading / 5) * 5;
        const operator = ac?.operator as string;
        return getIconStyleAircraft(headingKey, operator);
      };

      const getClusterStyleVessel = (
        sizeBucket: number,
        withText: boolean,
      ): Style => {
        const key = `${sizeBucket}-${withText ? 't' : 'n'}`;
        if (!clusterStyleCacheVessel[key]) {
          // Scale icon by cluster size bucket (bounded)
          // 0.8 -> 1.3
          clusterStyleCacheVessel[key] = new Style({
            image: new Icon({
              src: '/vessel-cluster.svg',
              anchor: [0.5, 0.5],
            }),
            text: withText
              ? new Text({
                  text: String(sizeBucket),
                  fill: new Fill({ color: 'white' }),
                  font: 'bold 12px sans-serif',
                  offsetY: 0,
                })
              : undefined,
          });
        }
        return clusterStyleCacheVessel[key];
      };

      // const getSingleDotStyleVessel = (): Style => {
      //   const key = 'dot';
      //   if (!singleDotStyleVessel[key]) {
      //     singleDotStyleVessel[key] = new Style({
      //       image: new CircleStyle({
      //         radius: 4,
      //         fill: new Fill({ color: 'rgba(34,197,94,0.9)' }),
      //         stroke: new Stroke({ color: 'white', width: 1 }),
      //       }),
      //     });
      //   }
      //   return singleDotStyleVessel[key];
      // };

      const getIconStyleVessel = (headingKey: number, flag?: string): Style => {
        const key = `${headingKey}-${flag || 'default'}`;

        // Return cached style if exists
        if (iconCacheVessel[key]) {
          return iconCacheVessel[key];
        }

        const customColor = flag
          ? settings.vesselFlagColors[flag.toUpperCase()]
          : '#10b981'; // Default green color

        // Create inline SVG with custom color
        const svgString = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 12L22 2L17 12L22 22L2 12Z" fill="${customColor}"/>
          </svg>
        `;

        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        // Cache both style and URL
        const style = new Style({
          image: new Icon({
            src: url,
            scale: 0.8,
            rotation: (headingKey * Math.PI) / 180,
          }),
        });

        iconCacheVessel[key] = style;
        urlRef.current.add(url); // Track for cleanup

        return style;
      };

      const vesselVectorStyle: import('ol/style/Style').StyleFunction = (
        feature,
        resolution,
      ) => {
        const zoom = getZoomFromResolution(resolution);
        const clusterMembers = feature.get('features') as any[] | undefined;

        if (clusterEnabled) {
          if (!clusterMembers || !Array.isArray(clusterMembers))
            return new Style();
          const size = clusterMembers.length;
          if (size > 1) {
            const bucket = Math.min(99, Math.max(2, size));
            const showText = zoom > 6;
            return getClusterStyleVessel(bucket, showText);
          }

          if (shouldSimplifyIcons(zoom)) {
            const vs = clusterMembers[0]?.get('vessel');
            return new Style({
              image: new CircleStyle({
                radius: 4,
                fill: new Fill({
                  color:
                    settings.vesselFlagColors[
                      ((vs?.flag as string) || '').toUpperCase()
                    ] || 'rgba(34,197,94,0.9)',
                }),
                stroke: new Stroke({ color: 'white', width: 1 }),
              }),
            });
          }

          const vs = clusterMembers[0]?.get('vessel');
          const heading = vs?.lastPosition?.heading || 0;
          const headingKey = Math.round(heading / 5) * 5;
          const flag = vs?.flag as string;
          return getIconStyleVessel(headingKey, flag);
        }

        // Non-clustered
        const vs = feature.get('vessel');
        if (!vs) return new Style();
        if (shouldSimplifyIcons(zoom)) {
          return new Style({
            image: new CircleStyle({
              radius: 4,
              fill: new Fill({
                color:
                  settings.vesselFlagColors[
                    ((vs?.flag as string) || '').toUpperCase()
                  ] || 'rgba(34,197,94,0.9)',
              }),
              stroke: new Stroke({ color: 'white', width: 1 }),
            }),
          });
        }
        const heading = vs?.lastPosition?.heading || 0;
        const headingKey = Math.round(heading / 5) * 5;
        const flag = vs?.flag as string;
        return getIconStyleVessel(headingKey, flag);
      };

      const aircraftLayer = new VectorLayer({
        source: aircraftCluster ?? aircraftSource,
        style: aircraftVectorStyle,
        declutter: false,
        renderBuffer: 32,
        updateWhileAnimating: false,
        updateWhileInteracting: false,
      });

      const vesselLayer = new VectorLayer({
        source: vesselCluster ?? vesselSource,
        style: vesselVectorStyle,
        declutter: false,
        renderBuffer: 32,
        updateWhileAnimating: false,
        updateWhileInteracting: false,
      });

      const regionLayer = new VectorLayer({
        source: regionSource,
        style: new Style({
          stroke: new Stroke({ color: 'rgba(255,0,0,0.8)', width: 2 }),
          fill: new Fill({ color: 'rgba(255,0,0,0.1)' }),
        }),
      });

      // WebGL disabled completely due to persistent renderer issues - using vector layers only

      // Map (giữ Attribution hợp lệ cho OSM)
      const map = new Map({
        target: mapRef.current!,
        pixelRatio: 1,

        layers: [
          new TileLayer({
            source: new OSM(), // ❗️đừng xoá attribution của OSM
          }),
          aircraftLayer,
          vesselLayer,
          regionLayer,
        ],
        view: new View({
          center: fromLonLat([108.2194, 16.0544]), // VN center
          zoom: Math.max(settings.minZoom, Math.min(settings.maxZoom, 6)),
          minZoom: settings.minZoom,
          maxZoom: settings.maxZoom,
        }),
      });

      // Zoom-based adjustments (cluster distance + toggle layers)
      const updateByZoom = () => {
        const z = map.getView().getZoom() ?? 6;

        if (clusterEnabled) {
          const dist = getClusterDistance(z);
          aircraftCluster?.setDistance(dist);
          vesselCluster?.setDistance(dist);
        }

        // WebGL disabled - always use vector layers
        aircraftLayer.setVisible(true);
        vesselLayer.setVisible(true);
      };

      updateByZoom();
      map.getView().on('change:resolution', updateByZoom);

      // Lưu ref
      mapInstanceRef.current = map;
      if (aircraftLayerRef) aircraftLayerRef.current = aircraftLayer as any;
      if (vesselLayerRef) vesselLayerRef.current = vesselLayer as any;
      if (regionLayerRef) regionLayerRef.current = regionLayer as any;

      // ensure size cập nhật sau mount
      const updateMapSize = () => {
        map.updateSize();
        if (!map.getSize()) setTimeout(updateMapSize, 50);
      };
      setTimeout(updateMapSize, 100);
    }, 50);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined);
      }
      // Cleanup object URLs to prevent memory leaks
      urlRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
    regionLayerRef,
    settings,
  ]);
}
