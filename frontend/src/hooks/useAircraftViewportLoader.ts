import { useEffect, useRef } from 'react';
import type Map from 'ol/Map';
import { toLonLat } from 'ol/proj';
import api from '@/services/apiClient';
import { useAircraftStore, Aircraft } from '@/stores/aircraftStore';

/**
 * Chỉ tải dữ liệu aircraft theo viewport hiện tại (online trước, fallback initial).
 * Không đụng đến vessels hay ports.
 */
export function useAircraftViewportLoader(params: {
  mapInstanceRef: React.RefObject<Map | null>;
  isActive?: boolean;
}) {
  const { mapInstanceRef, isActive = true } = params;
  const { setAircrafts } = useAircraftStore();
  const lastBboxRef = useRef<string>('');
  const lastZoomRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Skip if not active
    if (!isActive) return;

    const cleanup: Array<() => void> = [];
    lastBboxRef.current = '';
    lastZoomRef.current = null;

    const attach = (map: Map) => {
      const send = async () => {
        const size = map.getSize();
        if (!size) return;
        const extent = map.getView().calculateExtent(size);
        const bl = toLonLat([extent[0], extent[1]]);
        const tr = toLonLat([extent[2], extent[3]]);
        const inflateRatio = 0.08;
        const width = tr[0] - bl[0];
        const height = tr[1] - bl[1];
        const padX = width * inflateRatio;
        const padY = height * inflateRatio;
        const bbox: [number, number, number, number] = [
          Math.max(-180, bl[0] - padX),
          Math.max(-85, bl[1] - padY),
          Math.min(180, tr[0] + padX),
          Math.min(85, tr[1] + padY),
        ];
        const bboxStr = bbox.join(',');
        const zoom = map.getView().getZoom() ?? 0;
        if (bboxStr === lastBboxRef.current && zoom === lastZoomRef.current)
          return;
        lastBboxRef.current = bboxStr;
        lastZoomRef.current = zoom;

        // WebSocket viewport update (optional)
        const { websocketService } = await import('@/services/websocket');
        if (websocketService.socket) websocketService.updateViewport(bbox);
        else {
          websocketService.connect();
          setTimeout(() => websocketService.subscribeViewport(bbox), 200);
        }

        const qsOnline = `?bbox=${encodeURIComponent(bboxStr)}&limit=5000`;
        const qsInitial = `?bbox=${encodeURIComponent(bboxStr)}&zoom=${zoom}`;
        try {
          const raw = await api.get(`/aircrafts/online${qsOnline}`);
          const unwrap = (r: any): any[] => {
            if (!r) return [];
            if (Array.isArray(r)) return r;
            if (Array.isArray(r.data)) return r.data;
            if (r.data && Array.isArray(r.data.data)) return r.data.data;
            return [];
          };
          const arr = unwrap(raw);
          let aircrafts: Aircraft[] = Array.isArray(arr)
            ? (arr
                .map((a: any) =>
                  a &&
                  typeof a.longitude === 'number' &&
                  typeof a.latitude === 'number'
                    ? {
                        id:
                          a.id ??
                          a.aircraftId ??
                          (typeof a.flightId === 'string' && a.flightId
                            ? a.flightId
                            : `${a.longitude}:${a.latitude}:${
                                a.timestamp || ''
                              }`),
                        flightId: a.flightId ?? '',
                        createdAt: new Date(a.timestamp ?? Date.now()),
                        updatedAt: new Date(a.timestamp ?? Date.now()),
                        lastPosition: {
                          latitude: a.latitude,
                          longitude: a.longitude,
                          altitude: a.altitude,
                          speed: a.speed,
                          heading: a.heading,
                          timestamp: new Date(a.timestamp ?? Date.now()),
                        },
                      }
                    : null,
                )
                .filter(Boolean) as Aircraft[])
            : [];
          if (!aircrafts.length) {
            const init = await api.get(`/aircrafts/initial${qsInitial}`);
            if (Array.isArray(init)) {
              aircrafts = init.filter(
                (a: any) =>
                  a?.lastPosition &&
                  typeof a.lastPosition.longitude === 'number' &&
                  typeof a.lastPosition.latitude === 'number',
              );
            }
          }
          if (aircrafts.length) setAircrafts(aircrafts);
        } catch (_) {
          // ignore
        }
      };

      const debounced = () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(send, 300);
      };
      debounced();
      map.on('moveend', debounced as any);
      cleanup.push(() => (map as any).un('moveend', debounced));
    };

    if (mapInstanceRef.current) attach(mapInstanceRef.current);
    else {
      const intv = window.setInterval(() => {
        if (mapInstanceRef.current) {
          window.clearInterval(intv);
          attach(mapInstanceRef.current);
        }
      }, 150);
      cleanup.push(() => window.clearInterval(intv));
    }
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      cleanup.forEach((fn) => fn());
    };
  }, [mapInstanceRef, setAircrafts, isActive]);
}
