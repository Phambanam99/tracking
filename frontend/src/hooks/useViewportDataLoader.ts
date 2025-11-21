/**
 * DEPRECATED: Hook kết hợp tải cả aircraft & vessel.
 * Đã tách thành: useAircraftViewportLoader & useVesselViewportLoader.
 * Giữ lại tạm thời để tránh break các nơi khác (nếu còn). Có thể xoá sau khi refactor xong.
 */
import { useEffect, useRef } from 'react';

import type Map from 'ol/Map';
import { toLonLat } from 'ol/proj';
import api from '@/services/apiClient';
import { useAircraftStore } from '@/stores/aircraftStore';
import { useVesselStore } from '@/stores/vesselStore';
import { usePortsStore } from '@/stores/portsStore';
import { Aircraft } from '@/stores/aircraftStore';
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

        // Prefer fast Redis-backed online endpoints; fallback to initial endpoints
        const qsOnline = `?bbox=${encodeURIComponent(bboxStr)}&limit=5000`;
        const qsInitial = `?bbox=${encodeURIComponent(bboxStr)}&zoom=${zoom}`;
        try {
          const promises = [
            api.get(`/aircrafts/online${qsOnline}`),
            api.get(`/vessels/online${qsOnline}`),
          ];
          
          if (showPorts) {
            promises.push(
              api.get(`/vessels/ports?bbox=${encodeURIComponent(bboxStr)}`),
            );
          }
          const [aircraftResponseRaw, vesselResponseRaw, portsResponse] =
            await Promise.all(promises as any);
         console.log('Unwrapping response:', vesselResponseRaw);
          // Helper to unwrap possible nested response shapes:
          // 1. [ {...}, {...} ]
          // 2. { data: [ ... ] }
          // 3. { data: { data: [ ... ], count, ... } }
          // 4. { success: true, data: { data: [ ... ] } }
          // Simple string hash function to convert hexident to stable numeric ID
          const hashString = (str: string): number => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
              const char = str.charCodeAt(i);
              hash = ((hash << 5) - hash) + char;
              hash = hash & hash; // Convert to 32bit integer
            }
            return Math.abs(hash);
          };

          const unwrapArray = (raw: any): any[] => {
            
            if (!raw) return [];
            if (Array.isArray(raw)) return raw;
            if (Array.isArray(raw.data)) return raw.data; // shape 2
            if (raw.data && Array.isArray(raw.data.data)) return raw.data.data; // shape 3/4
            return [];
          };

          const aircraftResponse = unwrapArray(aircraftResponseRaw);
          const vesselResponse = unwrapArray(vesselResponseRaw);

          // Map online payloads to store shape
      let aircrafts: Aircraft[] = Array.isArray(aircraftResponse)
            ? aircraftResponse
                .map((a: any) =>
                  a && typeof a.longitude === 'number' && typeof a.latitude === 'number'
                    ? {
                        // Prefer stable backend id; fallback to aircraftId; if absent hash hexident/flightId to numeric ID
                        id:
                          a.id ??
                          a.aircraftId ??
                          (a.hexident ? hashString(a.hexident) : 
                           a.flightId ? hashString(a.flightId) :
                           hashString(`${a.longitude}:${a.latitude}`)),
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
        .filter(Boolean) as import('@/stores/aircraftStore').Aircraft[]
            : [];
          let vessels: import('@/stores/vesselStore').Vessel[] = Array.isArray(vesselResponse)
            ? vesselResponse
                .map((v: any) =>
                  v && typeof v.longitude === 'number' && typeof v.latitude === 'number'
                    ? {
                        // Use backend id or vesselId; fallback to numeric MMSI if parseable; else hash mmsi or coords
                        id:
                          v.id ??
                          v.vesselId ??
                          (v.mmsi && /^\d+$/.test(v.mmsi)
                            ? parseInt(v.mmsi, 10)
                            : hashString(v.mmsi || `${v.longitude}:${v.latitude}`)),
                        mmsi: v.mmsi ?? '',
                        vesselName: v.vesselName ?? v.name ?? undefined,
                        createdAt: new Date(v.timestamp ?? Date.now()),
                        updatedAt: new Date(v.timestamp ?? Date.now()),
                        lastPosition: {
                          latitude: v.latitude,
                          longitude: v.longitude,
                          speed: v.speed,
                          course: v.course,
                          heading: v.heading ?? v.course, // fallback course as heading if heading absent
                          status: v.status,
                          timestamp: new Date(v.timestamp ?? Date.now()),
                        },
                      }
                    : null,
                )
                .filter(Boolean) as import('@/stores/vesselStore').Vessel[]
            : [];

          // Fallback to initial endpoints if online empty
          if ((!aircrafts?.length || !vessels?.length)) {
            const [aircraftInit, vesselInit] = await Promise.all([
              api.get(`/aircrafts/initial${qsInitial}`),
              api.get(`/vessels/initial${qsInitial}`),
            ]);
            aircrafts = Array.isArray(aircraftInit)
              ? aircraftInit.filter(
                  (a: any) =>
                    a?.lastPosition &&
                    typeof a.lastPosition.longitude === 'number' &&
                    typeof a.lastPosition.latitude === 'number',
                )
              : aircrafts;
            vessels = Array.isArray(vesselInit)
              ? vesselInit.filter(
                  (v: any) =>
                    v?.lastPosition &&
                    typeof v.lastPosition.longitude === 'number' &&
                    typeof v.lastPosition.latitude === 'number',
                )
              : vessels;
          }
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
