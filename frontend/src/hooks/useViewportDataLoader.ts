import { useEffect, useRef } from 'react';
import type Map from 'ol/Map';
import { toLonLat } from 'ol/proj';
import api from '@/services/apiClient';
import { useAircraftStore } from '@/stores/aircraftStore';
import { useVesselStore } from '@/stores/vesselStore';
import { usePortsStore } from '@/stores/portsStore';

export function useViewportDataLoader(params: {
  mapInstanceRef: React.RefObject<Map | null>;
}) {
  const { mapInstanceRef } = params;
  const { setAircrafts } = useAircraftStore();
  const { setVessels } = useVesselStore();
  const lastBboxRef = useRef<string>('');
  const lastZoomRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const { setPorts, showPorts } = usePortsStore();

  useEffect(() => {
    const cleanupFns: Array<() => void> = [];

    // Force a refresh when toggling ports visibility
    lastBboxRef.current = '';
    lastZoomRef.current = null;

    const attachToMap = (map: Map) => {
      const send = async () => {
        const size = map.getSize();
        if (!size) return;
        const extent = map.getView().calculateExtent(size);
        const bl = toLonLat([extent[0], extent[1]]);
        const tr = toLonLat([extent[2], extent[3]]);

        // Inflate bbox slightly to avoid edge flicker when zooming
        const inflateRatio = 0.08; // 8% padding on each side
        const width = tr[0] - bl[0];
        const height = tr[1] - bl[1];
        const padX = width * inflateRatio;
        const padY = height * inflateRatio;

        const minLon = Math.max(-180, bl[0] - padX);
        const minLat = Math.max(-85, bl[1] - padY);
        const maxLon = Math.min(180, tr[0] + padX);
        const maxLat = Math.min(85, tr[1] + padY);

        const bbox: [number, number, number, number] = [
          minLon,
          minLat,
          maxLon,
          maxLat,
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
          const promises = [
            api.get(`/aircrafts/initial${qs}`),
            api.get(`/vessels/initial${qs}`),
          ];
          if (showPorts) {
            promises.push(
              api.get(`/vessels/ports?bbox=${encodeURIComponent(bboxStr)}`),
            );
          }
          const [aircraftResponse, vesselResponse, portsResponse] =
            await Promise.all(promises as any);
          const aircrafts = Array.isArray(aircraftResponse)
            ? aircraftResponse.filter(
                (a: any) =>
                  a?.lastPosition &&
                  typeof a.lastPosition.longitude === 'number' &&
                  typeof a.lastPosition.latitude === 'number',
              )
            : [];
          const vessels = Array.isArray(vesselResponse)
            ? vesselResponse.filter(
                (v: any) =>
                  v?.lastPosition &&
                  typeof v.lastPosition.longitude === 'number' &&
                  typeof v.lastPosition.latitude === 'number',
              )
            : [];
          if (aircrafts.length) setAircrafts(aircrafts);
          if (vessels.length) setVessels(vessels);
          if (showPorts && Array.isArray(portsResponse))
            setPorts(portsResponse as any);
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
  }, [mapInstanceRef, setAircrafts, setVessels, setPorts, showPorts]);
}
