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
 * Get color for atmospheric pressure (purple -> blue -> green -> orange)
 */
function getPressureColor(pressure: number): string {
  const opacity = 0.6;
  if (pressure < 980) return `rgba(138, 43, 226, ${opacity})`; // Purple (very low - storm)
  if (pressure < 1000) return `rgba(75, 0, 130, ${opacity})`; // Indigo (low)
  if (pressure < 1010) return `rgba(0, 191, 255, ${opacity})`; // Deep Sky Blue (below normal)
  if (pressure < 1020) return `rgba(0, 255, 127, ${opacity})`; // Spring Green (normal)
  if (pressure < 1030) return `rgba(255, 165, 0, ${opacity})`; // Orange (high)
  return `rgba(255, 69, 0, ${opacity})`; // Red-Orange (very high)
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
          activeLayer === 'clouds' ||
          activeLayer === 'pressure'
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
            case 'pressure':
              fillColor = getPressureColor(data.pressure);
              text = `${Math.round(data.pressure)}`;
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
      // Validate weather data has required fields
      const validWeatherData = weatherGrid.filter(
        (p) =>
          p &&
          typeof p.windSpeed === 'number' &&
          typeof p.windDirection === 'number' &&
          !isNaN(p.windSpeed) &&
          !isNaN(p.windDirection) &&
          typeof p.longitude === 'number' &&
          typeof p.latitude === 'number' &&
          !isNaN(p.longitude) &&
          !isNaN(p.latitude),
      );

      if (validWeatherData.length === 0) {
        console.warn('[Weather] No valid wind data available');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        olWindLayerRef.current.setVisible(false);
        return;
      }

      // Wind direction is 'coming from', but for U/V components we need 'going to'
      // U = speed * cos(angle), V = speed * sin(angle)
      // The angle should be meteorological (0° = North, clockwise)
      // The library expects U (zonal, west-east) and V (meridional, south-north)
      // A wind from 90° (East) should have a negative U component.
      // A wind from 0° (North) should have a negative V component.
      // Angle for calculation: (270 - direction) mod 360

      // First, get unique sorted lons and lats
      const lons = [...new Set(validWeatherData.map((p) => p.longitude))].sort(
        (a, b) => a - b,
      );
      const lats = [...new Set(validWeatherData.map((p) => p.latitude))].sort(
        (a, b) => b - a, // Sort descending for lat
      );

      if (lons.length < 2 || lats.length < 2) {
        console.warn('[Weather] Not enough grid points to form a wind field.');
        console.warn(`[Weather] Grid dimensions: ${lons.length}x${lats.length}`);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        olWindLayerRef.current.setVisible(false);
        return;
      }

      // Create a map for quick lookup using object
      const dataMap: Record<string, typeof validWeatherData[0]> = {};
      validWeatherData.forEach((d) => {
        const key = `${d.latitude.toFixed(4)},${d.longitude.toFixed(4)}`;
        dataMap[key] = d;
      });

      // Build U and V arrays in the correct grid order (row by row, lat then lon)
      const uData: number[] = [];
      const vData: number[] = [];
      let missingPoints = 0;

      for (const lat of lats) {
        for (const lon of lons) {
          const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
          const point = dataMap[key];
          
          if (point) {
            const u = -point.windSpeed * Math.sin((point.windDirection * Math.PI) / 180);
            const v = -point.windSpeed * Math.cos((point.windDirection * Math.PI) / 180);
            
            // Additional validation
            if (!isFinite(u) || !isFinite(v) || isNaN(u) || isNaN(v)) {
              console.warn('[Weather] Invalid wind calculation at', { lat, lon, point });
              uData.push(0);
              vData.push(0);
              missingPoints++;
            } else {
              uData.push(u);
              vData.push(v);
            }
          } else {
            // Missing point in grid - use zero values
            uData.push(0);
            vData.push(0);
            missingPoints++;
          }
        }
      }

      // Check if we have too many missing points
      const totalPoints = lons.length * lats.length;
      const missingPercent = (missingPoints / totalPoints) * 100;
      
      if (missingPercent > 50) {
        console.error(
          `[Weather] Too many missing grid points: ${missingPoints}/${totalPoints} (${missingPercent.toFixed(1)}%)`
        );
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        olWindLayerRef.current.setVisible(false);
        return;
      }

      // Validate array lengths match expected grid size
      if (uData.length !== totalPoints || vData.length !== totalPoints) {
        console.error('[Weather] Array length mismatch:', {
          expected: totalPoints,
          uLength: uData.length,
          vLength: vData.length,
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        olWindLayerRef.current.setVisible(false);
        return;
      }

      const dx = Math.abs(lons[1] - lons[0]);
      const dy = Math.abs(lats[1] - lats[0]);

      // Validate grid spacing
      if (!isFinite(dx) || !isFinite(dy) || dx === 0 || dy === 0) {
        console.error('[Weather] Invalid grid spacing:', { dx, dy });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        olWindLayerRef.current.setVisible(false);
        return;
      }

      // Validate data arrays - replace any invalid values with 0
      const cleanedU = uData.map(v => (isFinite(v) ? v : 0));
      const cleanedV = vData.map(v => (isFinite(v) ? v : 0));

      // Check if we have any valid data
      const validUCount = cleanedU.filter(v => v !== 0).length;
      const validVCount = cleanedV.filter(v => v !== 0).length;
      
      if (validUCount === 0 && validVCount === 0) {
        console.warn('[Weather] No valid wind data (all zeros)');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        olWindLayerRef.current.setVisible(false);
        return;
      }

      // Validate header coordinates
      if (!isFinite(lons[0]) || !isFinite(lats[0])) {
        console.error('[Weather] Invalid header coordinates:', { lo1: lons[0], la1: lats[0] });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        olWindLayerRef.current.setVisible(false);
        return;
      }

      const windData = {
        header: {
          nx: lons.length,
          ny: lats.length,
          lo1: Number(lons[0]),
          la1: Number(lats[0]),
          dx: Number(dx),
          dy: Number(dy),
          parameterUnit: 'm.s-1',
        },
        u: cleanedU,
        v: cleanedV,
      };

      console.log('[Weather] Wind data prepared:', {
        gridSize: `${lons.length}x${lats.length}`,
        totalPoints: totalPoints,
        dataPoints: cleanedU.length,
        missingPoints: missingPoints,
        missingPercent: missingPercent.toFixed(1) + '%',
        validU: validUCount,
        validV: validVCount,
        bounds: { 
          lo1: windData.header.lo1, 
          la1: windData.header.la1, 
          lo2: lons[lons.length - 1],
          la2: lats[lats.length - 1],
          dx: windData.header.dx, 
          dy: windData.header.dy 
        },
        sampleU: cleanedU.slice(0, 5),
        sampleV: cleanedV.slice(0, 5),
      });

      try {
        olWindLayerRef.current.setData(windData);
        console.log('[Weather] ✅ Wind data set successfully');
      } catch (error) {
        console.error('[Weather] ❌ Failed to set wind data:', error);
        console.error('[Weather] Wind data structure:', JSON.stringify({
          header: windData.header,
          uLength: windData.u.length,
          vLength: windData.v.length,
          uSample: windData.u.slice(0, 3),
          vSample: windData.v.slice(0, 3),
        }, null, 2));
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        olWindLayerRef.current.setVisible(false);
      }
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
