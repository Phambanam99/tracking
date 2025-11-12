import { useEffect, useRef } from 'react';
import type Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { WindLayer } from 'ol-wind';
import {
  Style,
  Circle as CircleStyle,
  Fill,
  Stroke,
  Text,
} from 'ol/style';
import { useWeatherStore } from '@/stores/weatherStore';

interface UseWeatherLayerProps {
  mapInstanceRef: React.RefObject<Map | null>;
}

/**
 * Get color for temperature (blue -> yellow -> red) with opacity
 */
function getTemperatureColor(temp: number): string {
  const opacity = 0.6; // Semi-transparent for blending
  if (temp < 0) return `rgba(0, 0, 255, ${opacity})`; // Blue (freezing)
  if (temp < 10) return `rgba(0, 191, 255, ${opacity})`; // Deep Sky Blue (cold)
  if (temp < 15) return `rgba(64, 224, 208, ${opacity})`; // Turquoise (cool)
  if (temp < 20) return `rgba(0, 255, 127, ${opacity})`; // Spring Green (mild)
  if (temp < 25) return `rgba(255, 255, 0, ${opacity})`; // Yellow (warm)
  if (temp < 30) return `rgba(255, 165, 0, ${opacity})`; // Orange (hot)
  if (temp < 35) return `rgba(255, 69, 0, ${opacity})`; // Red-Orange (very hot)
  return `rgba(220, 20, 60, ${opacity})`; // Crimson (extreme heat)
}

/**
 * Get color for precipitation (transparent -> blue)
 */
function getPrecipitationColor(precip: number): string {
  if (precip === 0) return 'rgba(173, 216, 230, 0.2)'; // Very light blue (dry)
  if (precip < 1) return 'rgba(135, 206, 250, 0.4)'; // Light blue (drizzle)
  if (precip < 3) return `rgba(70, 130, 180, 0.5)`; // Steel blue (light rain)
  if (precip < 5) return `rgba(30, 144, 255, 0.6)`; // Dodger blue (rain)
  if (precip < 10) return 'rgba(0, 0, 255, 0.65)'; // Blue (heavy rain)
  return 'rgba(0, 0, 139, 0.7)'; // Dark blue (very heavy rain)
}

/**
 * Hook to render weather layers on OpenLayers map
 */
export function useWeatherLayer({ mapInstanceRef }: UseWeatherLayerProps) {
  const { weatherGrid, activeLayer, weatherVisible } =
    useWeatherStore();

  const weatherLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const olWindLayerRef = useRef<WindLayer | null>(null);
  const isInitializedRef = useRef(false);

  // Initialize layers immediately when map is available
  const initializeLayers = () => {
    const map = mapInstanceRef.current;
    if (!map || isInitializedRef.current) return;

    console.log('[Weather] Initializing weather layers...');

    // Create temperature/precipitation layer
    weatherLayerRef.current = new VectorLayer({
      source: new VectorSource(),
      zIndex: 50,
      visible: false, // Initially hidden
      opacity: 0.85,
    });
    map.addLayer(weatherLayerRef.current);

    // Create wind layer
    olWindLayerRef.current = new WindLayer(null, {
      windOptions: {
        colorScale: [
          'rgb(36,104, 180)',
          'rgb(60,157, 194)',
          'rgb(128,205,193 )',
          'rgb(151,218,168 )',
          'rgb(198,231,181)',
          'rgb(238,247,217)',
          'rgb(255,238,159)',
          'rgb(252,217,125)',
          'rgb(255,182,100)',
          'rgb(252,150,75)',
          'rgb(250,112,52)',
          'rgb(245,64,32)',
          'rgb(237,45,28)',
          'rgb(220,24,32)',
          'rgb(180,0,35)',
        ],
        velocityScale: 1 / 20,
        paths: 5000,
        style: 'velocity',
        displayValues: true,
        displayOptions: {
          velocityType: 'Velocity',
          position: 'bottomleft',
          emptyString: 'No wind data',
        },
      },
      layerName: 'WindLayer',
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    olWindLayerRef.current.setVisible(false); // Initially hidden
    map.addLayer(olWindLayerRef.current);

    isInitializedRef.current = true;
    console.log('[Weather] ✓ Layers initialized successfully');
  };

  // Create weather layers once when map is ready
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) {
      console.log('[Weather] Map not ready yet');
      return;
    }

    initializeLayers();

    return () => {
      console.log('[Weather] Cleaning up weather layers');
      if (weatherLayerRef.current && map) {
        map.removeLayer(weatherLayerRef.current);
        weatherLayerRef.current = null;
      }
      if (olWindLayerRef.current && map) {
        map.removeLayer(olWindLayerRef.current);
        olWindLayerRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, [mapInstanceRef]);

  // Update weather visualization
  useEffect(() => {
    console.log(
      '[Weather] Render effect triggered - visible:',
      weatherVisible,
      'grid size:',
      weatherGrid.length,
      'active layer:',
      activeLayer,
      'initialized:',
      isInitializedRef.current,
    );

    if (!isInitializedRef.current) {
      initializeLayers();
    }

    if (!weatherLayerRef.current || !olWindLayerRef.current) {
      console.log('[Weather] ⚠ Layers still not ready, skipping render');
      return;
    }

    renderWeatherData();
  }, [weatherGrid, activeLayer, weatherVisible]);

  // Separate rendering logic
  const renderWeatherData = () => {
    const weatherSource = weatherLayerRef.current!.getSource();
    if (!weatherSource || !olWindLayerRef.current) {
      console.log('[Weather] No sources');
      return;
    }

    weatherSource.clear();

    if (!weatherVisible || weatherGrid.length === 0) {
      console.log(
        '[Weather] Not rendering - visible:',
        weatherVisible,
        'grid empty:',
        weatherGrid.length === 0,
      );
      // Don't set data for wind layer if not visible/empty
      if (olWindLayerRef.current) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        olWindLayerRef.current.setVisible(false);
      }
      return;
    }

    // Render non-wind data points
    if (activeLayer !== 'wind') {
      weatherGrid.forEach((data) => {
        const coord = fromLonLat([data.longitude, data.latitude]);

        if (
          activeLayer === 'temperature' ||
          activeLayer === 'precipitation' ||
          activeLayer === 'clouds'
        ) {
          const feature = new Feature({
            geometry: new Point(coord),
            weather: data,
          });

          let fillColor: string;
          let text: string;

          switch (activeLayer) {
            case 'temperature':
              fillColor = getTemperatureColor(data.temperature);
              text = `${Math.round(data.temperature)}°`;
              break;
            case 'precipitation':
              fillColor = getPrecipitationColor(data.precipitation);
              text =
                data.precipitation > 0
                  ? `${data.precipitation.toFixed(1)}mm`
                  : '';
              break;
            case 'clouds':
              const baseOpacity = 0.3;
              const cloudOpacity = baseOpacity + (data.cloudCover / 100) * 0.5;
              fillColor = `rgba(180,180,180,${cloudOpacity})`;
              text = `${Math.round(data.cloudCover)}%`;
              break;
            default:
              fillColor = 'rgba(0,0,0,0.1)';
              text = '';
          }

          feature.setStyle(
            new Style({
              image: new CircleStyle({
                radius: 60,
                fill: new Fill({ color: fillColor }),
                stroke: new Stroke({
                  color: 'rgba(255,255,255,0.2)',
                  width: 1,
                }),
              }),
              text: new Text({
                text,
                font: 'bold 12px sans-serif',
                fill: new Fill({ color: '#fff' }),
                stroke: new Stroke({ color: '#000', width: 3 }),
              }),
            }),
          );

          weatherSource.addFeature(feature);
        }
      });
    }

    // Handle wind data
    if (activeLayer === 'wind' && weatherGrid.length > 0) {
      // Wind direction is 'coming from', but for U/V components we need 'going to'
      // U = speed * cos(angle), V = speed * sin(angle)
      // The angle should be meteorological (0° = North, clockwise)
      // The library expects U (zonal, west-east) and V (meridional, south-north)
      // A wind from 90° (East) should have a negative U component.
      // A wind from 0° (North) should have a negative V component.
      // Angle for calculation: (270 - direction) mod 360
      const uData = weatherGrid.map(
        (p) =>
          -p.windSpeed *
          Math.sin((p.windDirection * Math.PI) / 180),
      );
      const vData = weatherGrid.map(
        (p) =>
          -p.windSpeed *
          Math.cos((p.windDirection * Math.PI) / 180),
      );

      const lons = [...new Set(weatherGrid.map((p) => p.longitude))].sort(
        (a, b) => a - b,
      );
      const lats = [...new Set(weatherGrid.map((p) => p.latitude))].sort(
        (a, b) => b - a,
      );

      if (lons.length < 2 || lats.length < 2) {
        console.warn('[Weather] Not enough grid points to form a wind field.');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        olWindLayerRef.current.setVisible(false);
        return;
      }

      const windData = {
        header: {
          nx: lons.length,
          ny: lats.length,
          lo1: lons[0],
          la1: lats[0],
          dx: Math.abs(lons[1] - lons[0]),
          dy: Math.abs(lats[1] - lats[0]),
          parameterUnit: 'm.s-1',
        },
        u: uData,
        v: vData,
      };
      olWindLayerRef.current.setData(windData);
    } else if (olWindLayerRef.current) {
      // Hide the wind layer when it's not active
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      olWindLayerRef.current.setVisible(false);
    }

    console.log(
      `[Weather] Rendered ${
        weatherSource.getFeatures().length
      } weather points.`,
    );
  };

  // Toggle layer visibility
  useEffect(() => {
    const isWindActive = weatherVisible && activeLayer === 'wind';
    const isOtherWeatherActive =
      weatherVisible && activeLayer !== 'none' && activeLayer !== 'wind';

    if (weatherLayerRef.current) {
      weatherLayerRef.current.setVisible(isOtherWeatherActive);
    }
    if (olWindLayerRef.current) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      olWindLayerRef.current.setVisible(isWindActive);
    }
  }, [weatherVisible, activeLayer]);
}
