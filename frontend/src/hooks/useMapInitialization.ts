import { useEffect } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';

import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import Cluster from 'ol/source/Cluster'; // ✅ default import
import { defaults as defaultControls, Attribution } from 'ol/control';
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
  aircraftLayerRef: React.RefObject<VectorLayer<Cluster> | null>;
  vesselLayerRef: React.RefObject<VectorLayer<Cluster> | null>;
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

      // Optimized clusters for large datasets
      const aircraftCluster = new Cluster({
        source: aircraftSource,
        distance: 60,
        minDistance: 20,
      });
      const vesselCluster = new Cluster({
        source: vesselSource,
        distance: 60,
        minDistance: 20,
      });

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
          return new Style({
            image: new CircleStyle({
              radius: Math.min(15 + size * 2, 30),
              fill: new Fill({ color: 'rgba(59,130,246,0.8)' }),
              stroke: new Stroke({ color: 'white', width: 2 }),
            }),
            text: new Text({
              text: String(size),
              fill: new Fill({ color: 'white' }),
              font: 'bold 12px sans-serif',
            }),
          });
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
        return new Style({
          image: new Icon({
            src: '/aircraft-icon.svg',
            scale: 0.8,
            rotation: aircraft?.lastPosition?.heading
              ? (aircraft.lastPosition.heading * Math.PI) / 180
              : 0,
          }),
        });
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
          return new Style({
            image: new CircleStyle({
              radius: Math.min(15 + size * 2, 30),
              fill: new Fill({ color: 'rgba(34,197,94,0.8)' }),
              stroke: new Stroke({ color: 'white', width: 2 }),
            }),
            text: new Text({
              text: String(size),
              fill: new Fill({ color: 'white' }),
              font: 'bold 12px sans-serif',
            }),
          });
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
        return new Style({
          image: new Icon({
            src: '/vessel-icon.svg',
            scale: 0.8,
            rotation: vessel?.lastPosition?.heading
              ? (vessel.lastPosition.heading * Math.PI) / 180
              : 0,
          }),
        });
      };

      const aircraftLayer = new VectorLayer({
        source: aircraftCluster,
        style: aircraftVectorStyle,

        updateWhileAnimating: false, // Disable updates during animation
        updateWhileInteracting: false, // Disable updates during interaction
      });

      const vesselLayer = new VectorLayer({
        source: vesselCluster,
        style: vesselVectorStyle,

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
        controls: defaultControls({ attribution: true }).extend([
          new Attribution({ collapsible: true }),
        ]),
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
        }),
      });

      // Zoom-based adjustments (cluster distance + toggle layers)
      const updateByZoom = () => {
        const z = map.getView().getZoom() ?? 6;

        const dist = getClusterDistance(z);
        aircraftCluster.setDistance(dist);
        vesselCluster.setDistance(dist);

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
