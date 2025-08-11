import { useEffect, useRef } from 'react';
import type Map from 'ol/Map';
import { toLonLat } from 'ol/proj';
import api from '@/services/apiClient';
import { useAircraftStore } from '@/stores/aircraftStore';
import { useVesselStore } from '@/stores/vesselStore';

export function useViewportDataLoader(params: {
  mapInstanceRef: React.RefObject<Map | null>;
}) {
  const { mapInstanceRef } = params;
  const { setAircrafts } = useAircraftStore();
  const { setVessels } = useVesselStore();
  const lastBboxRef = useRef<string>('');
  const lastZoomRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const cleanupFns: Array<() => void> = [];

    const attachToMap = (map: Map) => {
      const send = async () => {
        const size = map.getSize();
        if (!size) return;
        const extent = map.getView().calculateExtent(size);
        const bl = toLonLat([extent[0], extent[1]]);
        const tr = toLonLat([extent[2], extent[3]]);
        const bbox: [number, number, number, number] = [
          bl[0],
          bl[1],
          tr[0],
          tr[1],
        ];
        const bboxStr = bbox.join(',');
        const zoom = map.getView().getZoom() ?? 0;
        if (bboxStr === lastBboxRef.current && zoom === lastZoomRef.current)
          return;
        lastBboxRef.current = bboxStr;
        lastZoomRef.current = zoom;

        // Update server viewport for realtime filtering
        const { websocketService } = await import('@/services/websocket');
        if (websocketService.socket) {
          websocketService.updateViewport(bbox);
        } else {
          websocketService.connect();
          setTimeout(() => websocketService.subscribeViewport(bbox), 200);
        }

        // Fetch initial data limited to viewport (no pagination for initial)
        const qs = `?bbox=${encodeURIComponent(bboxStr)}&zoom=${zoom}`;
        try {
          const [aircraftResponse, vesselResponse] = await Promise.all([
            api.get(`/aircrafts/initial${qs}`),
            api.get(`/vessels/initial${qs}`),
          ]);
          const aircrafts = aircraftResponse;
          const vessels = vesselResponse;
          if (Array.isArray(aircrafts)) setAircrafts(aircrafts);
          if (Array.isArray(vessels)) setVessels(vessels);
          console.log(`Loaded initial aircrafts: ${aircrafts.length}`);
          console.log(`Loaded initial vessels: ${vessels.length}`);
        } catch (e) {
          // swallow
        }
      };

      const debounced = () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(send, 300);
      };

      // Initial load + update on moveend
      debounced();
      map.on('moveend', debounced as any);
      cleanupFns.push(() => (map as any).un('moveend', debounced));
    };

    if (mapInstanceRef.current) {
      attachToMap(mapInstanceRef.current);
    } else {
      const interval = window.setInterval(() => {
        if (mapInstanceRef.current) {
          window.clearInterval(interval);
          attachToMap(mapInstanceRef.current);
        }
      }, 150);
      cleanupFns.push(() => window.clearInterval(interval));
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      cleanupFns.forEach((fn) => fn());
    };
  }, [mapInstanceRef, setAircrafts, setVessels]);
}
