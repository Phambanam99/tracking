import { useEffect } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import { Cluster } from 'ol/source';
import {
  Style,
  Text,
  Fill,
  Stroke,
  Circle as CircleStyle,
  Icon,
} from 'ol/style';
import { fromLonLat } from 'ol/proj';

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

    // Delay initialization to ensure DOM is fully ready
    const timer = setTimeout(() => {
      console.log('Initializing map...');
      console.log('Map container element:', mapRef.current);
      console.log('Container dimensions:', {
        width: mapRef.current?.offsetWidth,
        height: mapRef.current?.offsetHeight,
        clientWidth: mapRef.current?.clientWidth,
        clientHeight: mapRef.current?.clientHeight,
      });

      // Check if container has actual dimensions
      if (
        !mapRef.current ||
        mapRef.current.offsetWidth === 0 ||
        mapRef.current.offsetHeight === 0
      ) {
        console.error('Map container has no dimensions!');
        return;
      }

      // Create aircraft source and cluster
      const aircraftSource = new VectorSource();
      const aircraftCluster = new Cluster({
        source: aircraftSource,
        distance: 50, // pixels
      });
      const aircraftLayer = new VectorLayer({
        source: aircraftCluster,
        style: (feature) => {
          const features = feature.get('features');

          if (!features || !Array.isArray(features)) {
            console.warn(
              'Aircraft features is undefined or not an array:',
              features,
            );
            return new Style(); // Return empty style
          }

          const size = features.length;

          if (size > 1) {
            // Cluster style
            return new Style({
              image: new CircleStyle({
                radius: Math.min(15 + size * 2, 30),
                fill: new Fill({ color: 'rgba(59, 130, 246, 0.8)' }),
                stroke: new Stroke({ color: 'white', width: 2 }),
              }),
              text: new Text({
                text: size.toString(),
                fill: new Fill({ color: 'white' }),
                font: 'bold 12px sans-serif',
              }),
            });
          }

          // Single aircraft style
          const aircraft = features[0].get('aircraft');
          return new Style({
            image: new Icon({
              src: '/aircraft-icon.svg',
              scale: 0.8,
              rotation: aircraft?.lastPosition?.heading
                ? (aircraft.lastPosition.heading * Math.PI) / 180
                : 0,
            }),
          });
        },
      });

      // Create vessel source and cluster
      const vesselSource = new VectorSource();
      const vesselCluster = new Cluster({
        source: vesselSource,
        distance: 50, // pixels
      });
      const vesselLayer = new VectorLayer({
        source: vesselCluster,
        style: (feature) => {
          const features = feature.get('features');

          if (!features || !Array.isArray(features)) {
            console.warn(
              'Vessel features is undefined or not an array:',
              features,
            );
            return new Style(); // Return empty style
          }

          const size = features.length;

          if (size > 1) {
            // Cluster style
            return new Style({
              image: new CircleStyle({
                radius: Math.min(15 + size * 2, 30),
                fill: new Fill({ color: 'rgba(34, 197, 94, 0.8)' }),
                stroke: new Stroke({ color: 'white', width: 2 }),
              }),
              text: new Text({
                text: size.toString(),
                fill: new Fill({ color: 'white' }),
                font: 'bold 12px sans-serif',
              }),
            });
          }

          // Single vessel style
          const vessel = features[0].get('vessel');
          return new Style({
            image: new Icon({
              src: '/vessel-icon.svg',
              scale: 0.8,
              rotation: vessel?.lastPosition?.heading
                ? (vessel.lastPosition.heading * Math.PI) / 180
                : 0,
            }),
          });
        },
      });

      // Create region layer
      const regionSource = new VectorSource();
      const regionLayer = new VectorLayer({
        source: regionSource,
        style: new Style({
          stroke: new Stroke({
            color: 'rgba(255, 0, 0, 0.8)',
            width: 2,
          }),
          fill: new Fill({
            color: 'rgba(255, 0, 0, 0.1)',
          }),
        }),
      });

      // Create map
      const map = new Map({
        target: mapRef.current,
        controls: [], // Remove all default controls including attribution
        layers: [
          new TileLayer({
            source: new OSM({
              attributions: [], // Remove OSM attribution
            }),
          }),
          aircraftLayer,
          vesselLayer,
          regionLayer,
        ],
        view: new View({
          center: fromLonLat([108.2194, 16.0544]), // Vietnam center
          zoom: 6,
        }),
      });

      // Force immediate render
      map.render();

      mapInstanceRef.current = map;
      if (aircraftLayerRef) aircraftLayerRef.current = aircraftLayer;
      if (vesselLayerRef) vesselLayerRef.current = vesselLayer;
      if (regionLayerRef) regionLayerRef.current = regionLayer;

      console.log('Map initialized successfully:', map);
      console.log('Map target set to:', map.getTarget());
      console.log('Map size:', map.getSize());

      // Force map to update its size with multiple attempts
      const updateMapSize = () => {
        map.updateSize();
        const size = map.getSize();
        console.log('Map size after updateSize():', size);

        if (!size && map.getTarget()) {
          // If size is still undefined, try again
          console.log('Map size undefined, trying again...');
          setTimeout(updateMapSize, 50);
        }
      };

      setTimeout(updateMapSize, 100);
    }, 50); // Delay 50ms for DOM to be ready

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
