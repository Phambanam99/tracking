import { useEffect, useRef } from 'react';
import { useWeatherStore } from '@/stores/weatherStore';
import api from '@/services/apiClient';
import type Map from 'ol/Map';

interface UseWeatherDataProps {
  mapInstanceRef: React.RefObject<Map | null>;
}

/**
 * Hook to fetch and update weather data based on map viewport
 */
export function useWeatherData({ mapInstanceRef }: UseWeatherDataProps) {
  const { weatherVisible, setWeatherGrid, setIsLoading, setLastUpdated } =
    useWeatherStore();

  const lastFetchRef = useRef<number>(0);
  const prevVisibleRef = useRef<boolean>(false);
  const FETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes (reduced from 10)

  useEffect(() => {
    console.log(
      '[Weather] useWeatherData hook triggered, weatherVisible:',
      weatherVisible,
      'was:',
      prevVisibleRef.current,
    );

    if (!weatherVisible) {
      console.log('[Weather] Weather disabled, clearing data');
      setWeatherGrid([]);
      prevVisibleRef.current = false;
      return;
    }

    if (!mapInstanceRef.current) {
      console.log('[Weather] Map not ready yet');
      return;
    }

    const fetchWeatherData = async () => {
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchRef.current;

      console.log(
        '[Weather] fetchWeatherData called, last fetch:',
        lastFetchRef.current,
        'time since:',
        Math.round(timeSinceLastFetch / 1000),
        'seconds',
      );

      // Force fetch if just enabled, otherwise respect interval
      const justEnabled = weatherVisible && !prevVisibleRef.current;
      if (!justEnabled && timeSinceLastFetch < FETCH_INTERVAL) {
        console.log(
          '[Weather] Skipping fetch - too soon (wait',
          Math.round((FETCH_INTERVAL - timeSinceLastFetch) / 1000),
          'more seconds)',
        );
        return;
      }

      if (justEnabled) {
        console.log('[Weather] 🔄 Force fetching - weather just enabled');
      }

      const map = mapInstanceRef.current;
      if (!map) {
        console.log('[Weather] No map instance');
        return;
      }

      const view = map.getView();
      const size = map.getSize();
      if (!size) return;

      const extent = view.calculateExtent(size);

      // Import transformExtent dynamically
      const { transformExtent } = await import('ol/proj');

      // Convert extent from Web Mercator to EPSG:4326
      const [minLon, minLat, maxLon, maxLat] = transformExtent(
        extent,
        'EPSG:3857',
        'EPSG:4326',
      );

      setIsLoading(true);

      try {
        // Calculate optimal grid size based on map extent
        const latRange = maxLat - minLat;
        const lonRange = maxLon - minLon;

        // Adaptive grid: more points for smaller viewport, fewer for larger
        // Target: ~1 point per 50-100km
        let gridSize = Math.ceil(Math.sqrt(latRange * lonRange * 15));

        // Clamp to reasonable range (8-18 to balance coverage and API calls)
        gridSize = Math.max(8, Math.min(gridSize, 18));

        console.log(
          `[Weather] Grid calculation: viewport ${latRange.toFixed(
            2,
          )}°x${lonRange.toFixed(2)}° → ${gridSize}x${gridSize} grid (${
            gridSize * gridSize
          } points)`,
        );

        const params = new URLSearchParams({
          minLat: minLat.toString(),
          maxLat: maxLat.toString(),
          minLon: minLon.toString(),
          maxLon: maxLon.toString(),
          gridSize: gridSize.toString(),
        });
        const url = `/weather/grid?${params.toString()}`;
        console.log('[Weather] Fetching weather data:', url);
        const response = await api.get(url);

        console.log('[Weather] API response:', response);
        if (Array.isArray(response)) {
          console.log(
            '[Weather] ✅ Setting weather grid with',
            response.length,
            'points',
          );
          setWeatherGrid(response);
          setLastUpdated(new Date());
          lastFetchRef.current = now;
          prevVisibleRef.current = true;
        } else {
          console.warn('[Weather] Response is not an array:', response);
        }
      } catch (error) {
        console.error('[Weather] Failed to fetch weather data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch when enabled
    console.log('[Weather] Starting initial fetch...');
    fetchWeatherData();

    // Refetch on map move
    const map = mapInstanceRef.current;
    if (!map) return;

    const onMoveEnd = () => {
      fetchWeatherData();
    };

    map.on('moveend', onMoveEnd);

    // Periodic refresh
    const intervalId = setInterval(fetchWeatherData, FETCH_INTERVAL);

    return () => {
      map.un('moveend', onMoveEnd);
      clearInterval(intervalId);
    };
  }, [
    weatherVisible,
    mapInstanceRef,
    setWeatherGrid,
    setIsLoading,
    setLastUpdated,
  ]);
}
