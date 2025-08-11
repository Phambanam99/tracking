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
    const map = mapInstanceRef.current;
    if (!map) return;

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
      // Skip if bbox changed rất nhỏ và zoom không đổi (hạn chế spam pan rất ngắn)
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
      // Truyền thêm zoom để backend có thể decimate theo zoom
      const qs = `?bbox=${encodeURIComponent(bboxStr)}&zoom=${zoom}`;
      try {
        const [aircraftResponse, vesselResponse] = await Promise.all([
          api.get(`/aircrafts/initial${qs}`),
          api.get(`/vessels/initial${qs}`),
        ]);
        // initial returns array directly
        const aircrafts = aircraftResponse;
        const vessels = vesselResponse;

        if (Array.isArray(aircrafts)) setAircrafts(aircrafts);
        if (Array.isArray(vessels)) setVessels(vessels);

        // Log counts
        console.log(`Loaded initial aircrafts: ${aircrafts.length}`);
        console.log(`Loaded initial vessels: ${vessels.length}`);
      } catch (e) {
        // Swallow errors to avoid spamming
        // console.error('Viewport data load failed', e);
      }
    };

    const debounced = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(send, 300);
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
