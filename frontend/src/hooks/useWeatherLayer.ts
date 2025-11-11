import { useEffect, useRef } from 'react';
import type Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import {
  Style,
  Circle as CircleStyle,
  Fill,
  Stroke,
  Text,
  Icon,
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
  if (precip < 3) return 'rgba(70, 130, 180, 0.5)'; // Steel blue (light rain)
  if (precip < 5) return 'rgba(30, 144, 255, 0.6)'; // Dodger blue (rain)
  if (precip < 10) return 'rgba(0, 0, 255, 0.65)'; // Blue (heavy rain)
  return 'rgba(0, 0, 139, 0.7)'; // Dark blue (very heavy rain)
}

/**
 * Get wind arrow rotation (convert wind direction to arrow rotation)
 */
function getWindArrowRotation(windDirection: number): number {
  // Wind direction is where wind comes FROM
  // Arrow should point where wind goes TO
  return ((windDirection + 180) % 360) * (Math.PI / 180);
}

/**
 * Hook to render weather layers on OpenLayers map
 */
export function useWeatherLayer({ mapInstanceRef }: UseWeatherLayerProps) {
  const { weatherGrid, activeLayer, weatherVisible, windArrowsVisible } =
    useWeatherStore();

  const weatherLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const windLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
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
      visible: true,
      opacity: 0.85, // Slightly transparent for better visibility
    });
    map.addLayer(weatherLayerRef.current);

    // Create wind arrows layer
    windLayerRef.current = new VectorLayer({
      source: new VectorSource(),
      zIndex: 51,
      visible: true,
    });
    map.addLayer(windLayerRef.current);

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
      if (windLayerRef.current && map) {
        map.removeLayer(windLayerRef.current);
        windLayerRef.current = null;
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

    // Ensure layers are initialized first
    if (!isInitializedRef.current) {
      console.log('[Weather] Initializing layers first...');
      initializeLayers();
    }

    // Now render
    if (!weatherLayerRef.current || !windLayerRef.current) {
      console.log('[Weather] ⚠ Layers still not ready, skipping render');
      return;
    }

    renderWeatherData();
  }, [weatherGrid, activeLayer, weatherVisible, windArrowsVisible]);

  // Separate rendering logic
  const renderWeatherData = () => {
    const weatherSource = weatherLayerRef.current.getSource();
    const windSource = windLayerRef.current.getSource();
    if (!weatherSource || !windSource) {
      console.log('[Weather] No sources');
      return;
    }

    // Clear previous features
    weatherSource.clear();
    windSource.clear();

    if (!weatherVisible || weatherGrid.length === 0) {
      console.log(
        '[Weather] Not rendering - visible:',
        weatherVisible,
        'grid empty:',
        weatherGrid.length === 0,
      );
      return;
    }

    // Render weather data points
    weatherGrid.forEach((data) => {
      const coord = fromLonLat([data.longitude, data.latitude]);

      // Temperature/precipitation visualization
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
            // More opaque base with cloud coverage scaling
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
              radius: 60, // Increased from 20 to 60 for better coverage
              fill: new Fill({ color: fillColor }),
              stroke: new Stroke({ color: 'rgba(255,255,255,0.2)', width: 1 }),
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

      // Wind arrows
      if (windArrowsVisible && data.windSpeed > 1) {
        const windFeature = new Feature({
          geometry: new Point(coord),
          weather: data,
        });

        const windSpeedKn = data.windSpeed * 0.539957; // km/h to knots
        const arrowSize = Math.min(0.5 + windSpeedKn / 20, 1.5); // Scale based on wind speed

        windFeature.setStyle(
          new Style({
            image: new Icon({
              src:
                'data:image/svg+xml;utf8,' +
                encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path d="M12 2 L12 18 M12 18 L8 14 M12 18 L16 14" 
                    stroke="white" stroke-width="2" fill="none" 
                    stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              `),
              scale: arrowSize,
              rotation: getWindArrowRotation(data.windDirection),
              rotateWithView: false,
            }),
            text: new Text({
              text: `${Math.round(windSpeedKn)} kn`,
              offsetY: 20,
              font: '10px sans-serif',
              fill: new Fill({ color: '#fff' }),
              stroke: new Stroke({ color: '#000', width: 2 }),
            }),
          }),
        );

        windSource.addFeature(windFeature);
      }
    });

    console.log(
      `[Weather] Rendered ${
        weatherSource.getFeatures().length
      } weather points, ${windSource.getFeatures().length} wind arrows`,
    );
  };

  // Toggle layer visibility
  useEffect(() => {
    if (weatherLayerRef.current) {
      weatherLayerRef.current.setVisible(
        weatherVisible && activeLayer !== 'none',
      );
    }
    if (windLayerRef.current) {
      windLayerRef.current.setVisible(windArrowsVisible);
    }
  }, [weatherVisible, windArrowsVisible, activeLayer]);
}
