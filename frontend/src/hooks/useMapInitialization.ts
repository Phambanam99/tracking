import { useEffect } from 'react';
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
      const disableCluster =
        (process.env.NEXT_PUBLIC_DISABLE_CLUSTER || '').toLowerCase() ===
        'true';
      const clusterExplicit = process.env.NEXT_PUBLIC_CLUSTER_ENABLED;
      const clusterEnabled =
        clusterExplicit != null
          ? clusterExplicit.toLowerCase() === 'true'
          : !disableCluster;

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
      // const singleDotStyleAircraft: Record<string, Style> = {};
      const iconStyleAircraft: Record<string, Style> = {};

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

      const getIconStyleAircraft = (headingKey: number): Style => {
        const key = String(headingKey);
        if (!iconStyleAircraft[key]) {
          iconStyleAircraft[key] = new Style({
            image: new Icon({
              src: '/aircraft-icon.svg',
              scale: 0.8,
              rotation: (headingKey * Math.PI) / 180,
            }),
          });
        }
        return iconStyleAircraft[key];
      };

      // Style function nên dùng resolution (không truy cập map ở đây)
      const aircraftVectorStyle: import('ol/style/Style').StyleFunction = (
        feature,
        resolution,
      ) => {
        const features = feature.get('features') as any[] | undefined;
        if (!features || !Array.isArray(features)) return new Style();

        const zoom = getZoomFromResolution(resolution);

        const size = features.length;
        if (size > 1) {
          const bucket = Math.min(99, Math.max(2, size));
          const showText = zoom > 6;
          return getClusterStyleAircraft(bucket, showText);
        }

        if (shouldSimplifyIcons(zoom)) {
          return new Style({
            image: new CircleStyle({
              radius: 4,
              fill: new Fill({ color: 'rgba(59,130,246,0.9)' }),
              stroke: new Stroke({ color: 'white', width: 1 }),
            }),
          });
        }

        const aircraft = features[0]?.get('aircraft');
        const heading = aircraft?.lastPosition?.heading || 0;
        const headingKey = Math.round(heading / 5) * 5;
        return getIconStyleAircraft(headingKey);
      };

      const clusterStyleCacheVessel: Record<string, Style> = {};
      // const singleDotStyleVessel: Record<string, Style> = {};
      const iconStyleVessel: Record<string, Style> = {};

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

      const getIconStyleVessel = (headingKey: number): Style => {
        const key = String(headingKey);
        if (!iconStyleVessel[key]) {
          iconStyleVessel[key] = new Style({
            image: new Icon({
              src: '/vessel-icon.svg',
              scale: 0.8,
              rotation: (headingKey * Math.PI) / 180,
            }),
          });
        }
        return iconStyleVessel[key];
      };

      const vesselVectorStyle: import('ol/style/Style').StyleFunction = (
        feature,
        resolution,
      ) => {
        const features = feature.get('features') as any[] | undefined;
        if (!features || !Array.isArray(features)) return new Style();

        const zoom = getZoomFromResolution(resolution);

        const size = features.length;
        if (size > 1) {
          const bucket = Math.min(99, Math.max(2, size));
          const showText = zoom > 6;
          return getClusterStyleVessel(bucket, showText);
        }

        if (shouldSimplifyIcons(zoom)) {
          return new Style({
            image: new CircleStyle({
              radius: 4,
              fill: new Fill({ color: 'rgba(34,197,94,0.9)' }),
              stroke: new Stroke({ color: 'white', width: 1 }),
            }),
          });
        }

        const vessel = features[0]?.get('vessel');
        const heading = vessel?.lastPosition?.heading || 0;
        const headingKey = Math.round(heading / 5) * 5;
        return getIconStyleVessel(headingKey);
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
          zoom: 6,
          minZoom: 4,
          maxZoom: 16,
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
    };
  }, [
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
    regionLayerRef,
  ]);
}
