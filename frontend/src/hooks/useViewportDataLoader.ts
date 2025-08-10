import { useEffect, useRef } from 'react';
import type Map from 'ol/Map';
import { toLonLat } from 'ol/proj';
import api from '@/services/apiClient';
import { useAircraftStore } from '@/stores/aircraftStore';
import { useVesselStore } from '@/stores/vesselStore';

export function useViewportDataLoader(params: { mapInstanceRef: React.RefObject<Map | null> }) {
  const { mapInstanceRef } = params;
  const { setAircrafts } = useAircraftStore();
  const { setVessels } = useVesselStore();
  const lastBboxRef = useRef<string>('');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const send = async () => {
      const size = map.getSize();
      if (!size) return;
      const extent = map.getView().calculateExtent(size);
      const bl = toLonLat([extent[0], extent[1]]);
      const tr = toLonLat([extent[2], extent[3]]);
      const bbox: [number, number, number, number] = [bl[0], bl[1], tr[0], tr[1]];
      const bboxStr = bbox.join(',');
      if (bboxStr === lastBboxRef.current) return;
      lastBboxRef.current = bboxStr;

      // Update server viewport for realtime filtering
      const { websocketService } = await import('@/services/websocket');
      if (websocketService.socket) {
        websocketService.updateViewport(bbox);
      } else {
        websocketService.connect();
        setTimeout(() => websocketService.subscribeViewport(bbox), 200);
      }

      // Fetch initial data limited to viewport
      const qs = `?bbox=${encodeURIComponent(bboxStr)}`;
      try {
        const [aircrafts, vessels] = await Promise.all([
          api.get(`/aircrafts/initial${qs}`),
          api.get(`/vessels/initial${qs}`),
        ]);
        if (Array.isArray(aircrafts)) setAircrafts(aircrafts);
        if (Array.isArray(vessels)) setVessels(vessels);
      } catch (e) {
        // Swallow errors to avoid spamming
        // console.error('Viewport data load failed', e);
      }
    };

    const debounced = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(send, 250);
    };

    // Initial load
    debounced();
    map.on('moveend', debounced);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      (map as any).un('moveend', debounced);
    };
  }, [mapInstanceRef, setAircrafts, setVessels]);
}


