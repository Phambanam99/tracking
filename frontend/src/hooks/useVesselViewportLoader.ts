import { useEffect, useRef } from 'react';
import type Map from 'ol/Map';
import { toLonLat } from 'ol/proj';
import api from '@/services/apiClient';
import { useVesselStore } from '@/stores/vesselStore';
import { usePortsStore } from '@/stores/portsStore';
import { useMapStore } from '@/stores/mapStore';

/**
 * Chỉ tải vessels (online trước, fallback initial) và optionally ports.
 * Tách biệt khỏi aircraft để giảm tải & tránh fetch thừa khi chỉ xem 1 lớp.
 */
export function useVesselViewportLoader(params: {
  mapInstanceRef: React.RefObject<Map | null>;
  isActive?: boolean;
}) {
  const { mapInstanceRef, isActive = true } = params;
  const { setVessels } = useVesselStore();
  const { setPorts, showPorts } = usePortsStore();
  const { showPredictedVessels } = useMapStore();
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

        // WebSocket viewport update
        const { websocketService } = await import('@/services/websocket');
        if (websocketService.socket) websocketService.updateViewport(bbox);
        else {
          websocketService.connect();
          setTimeout(() => websocketService.subscribeViewport(bbox), 200);
        }

        const qsOnline = `?bbox=${encodeURIComponent(
          bboxStr,
        )}&limit=50000&includePredicted=${showPredictedVessels}`;
        const qsInitial = `?bbox=${encodeURIComponent(bboxStr)}&zoom=${zoom}`;
        try {
          const promises: Promise<any>[] = [
            api.get(`/vessels/online${qsOnline}`),
          ];
          if (showPorts) {
            promises.push(
              api.get(`/vessels/ports?bbox=${encodeURIComponent(bboxStr)}`),
            );
          }
          const [vesselRaw, portsRaw] = await Promise.all(promises);
          const unwrap = (r: any): any[] => {
            if (!r) return [];
            if (Array.isArray(r)) return r;
            if (Array.isArray(r.data)) return r.data;
            if (r.data && Array.isArray(r.data.data)) return r.data.data;
            return [];
          };
          const arr = unwrap(vesselRaw);
          let vessels: import('@/stores/vesselStore').Vessel[] = Array.isArray(
            arr,
          )
            ? (arr
                .map((v: any) =>
                  v &&
                  typeof v.longitude === 'number' &&
                  typeof v.latitude === 'number'
                    ? {
                        id:
                          v.id ??
                          v.vesselId ??
                          (v.mmsi && /^\d+$/.test(v.mmsi)
                            ? parseInt(v.mmsi, 10)
                            : `${v.mmsi || ''}:${v.longitude}:${v.latitude}`),
                        mmsi: v.mmsi ?? '',
                        vesselName: v.vesselName ?? v.name ?? undefined,
                        createdAt: new Date(v.timestamp ?? Date.now()),
                        updatedAt: new Date(v.timestamp ?? Date.now()),
                        lastPosition: {
                          latitude: v.latitude,
                          longitude: v.longitude,
                          speed: v.speed,
                          course: v.course,
                          heading: v.heading ?? v.course,
                          status: v.status,
                          timestamp: new Date(v.timestamp ?? Date.now()),
                        },
                        // ✅ Prediction fields
                        predicted: v.predicted ?? false,
                        confidence: v.confidence ?? 1.0,
                        timeSinceLastMeasurement:
                          v.timeSinceLastMeasurement ?? 0,
                      }
                    : null,
                )
                .filter(Boolean) as import('@/stores/vesselStore').Vessel[])
            : [];
          console.log('[VesselLoader] Online vessels:', vessels.length);
          if (!vessels.length) {
            const init = await api.get(`/vessels/initial${qsInitial}`);
            console.log(
              '[VesselLoader] Initial API response:',
              Array.isArray(init) ? init.length : 'not array',
              init,
            );
            if (Array.isArray(init)) {
              const beforeFilter = init.length;
              vessels = init.filter(
                (v: any) =>
                  v?.lastPosition &&
                  typeof v.lastPosition.longitude === 'number' &&
                  typeof v.lastPosition.latitude === 'number',
              );
              console.log(
                '[VesselLoader] Filtered vessels:',
                vessels.length,
                'of',
                beforeFilter,
                '(removed',
                beforeFilter - vessels.length,
                'without valid position)',
              );
            }
          }
          console.log(
            '[VesselLoader] Setting vessels to store:',
            vessels.length,
          );
          if (vessels.length) setVessels(vessels);
          if (showPorts && Array.isArray(portsRaw)) setPorts(portsRaw as any);
        } catch (e) {
          console.error('[VesselLoader] Error:', e);
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
  }, [
    mapInstanceRef,
    setVessels,
    setPorts,
    showPorts,
    showPredictedVessels,
    isActive,
  ]);
}
