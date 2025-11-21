import { useEffect, useRef } from 'react';
import type Map from 'ol/Map';
import { toLonLat } from 'ol/proj';
import api from '@/services/apiClient';
import { useAircraftStore, Aircraft } from '@/stores/aircraftStore';

/**
 * Generate stable ID from aircraft data
 * Priority: backend id > aircraftId > flightId > hexident > coordinates-based hash
 */
function generateStableAircraftId(data: any): string | number {
  // Use backend provided IDs first
  if (data.id != null) return data.id;
  if (data.aircraftId != null) return data.aircraftId;
  
  // Use flight identifiers (stable across updates)
  if (data.flightId && typeof data.flightId === 'string' && data.flightId.trim()) {
    return data.flightId.trim();
  }
  if (data.hexident && typeof data.hexident === 'string' && data.hexident.trim()) {
    return data.hexident.trim();
  }
  if (data.callSign && typeof data.callSign === 'string' && data.callSign.trim()) {
    return data.callSign.trim();
  }
  
  // Last resort: coordinate-based (without timestamp!)
  // Round coordinates to avoid floating point precision issues
  const lon = Math.round((data.longitude || 0) * 10000) / 10000;
  const lat = Math.round((data.latitude || 0) * 10000) / 10000;
  return `aircraft_${lon}_${lat}`;
}

/**
 * Only load aircraft data based on viewport (online first, fallback initial).
 * Does not touch vessels or ports.
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
        const zoom = Math.round(map.getView().getZoom() ?? 0);
        
        // Skip if same viewport
        if (bboxStr === lastBboxRef.current && zoom === lastZoomRef.current) {
          return;
        }
        
        lastBboxRef.current = bboxStr;
        lastZoomRef.current = zoom;

        console.log('[AircraftLoader] Fetching for bbox:', bboxStr);

        // WebSocket viewport update (optional)
        const { websocketService } = await import('@/services/websocket');
        if (websocketService.socket) {
          websocketService.updateViewport(bbox);
        } else {
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
                .map((a: any) => {
                  // Validate coordinates
                  if (!a || typeof a.longitude !== 'number' || typeof a.latitude !== 'number') {
                    return null;
                  }
                  
                  // Generate stable ID
                  const stableId = generateStableAircraftId(a);
                  
                  return {
                    id: stableId,
                    flightId: a.flightId || a.callSign || '',
                    callSign: a.callSign,
                    registration: a.registration,
                    operator: a.operator,
                    aircraftType: a.aircraftType,
                    hexident: a.hexident,
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
                  };
                })
                .filter(Boolean) as Aircraft[])
            : [];
          
          console.log('[AircraftLoader] Online aircrafts:', aircrafts.length);
          
          // Fallback to initial if online empty
          if (!aircrafts.length) {
            console.log('[AircraftLoader] No online data, falling back to initial');
            const init = await api.get(`/aircrafts/initial${qsInitial}`);
            
            if (Array.isArray(init)) {
              aircrafts = init
                .filter((a: any) => {
                  // Validate has position with coordinates
                  const pos = a?.lastPosition;
                  if (!pos) return false;
                  if (typeof pos.longitude !== 'number' || typeof pos.latitude !== 'number') {
                    return false;
                  }
                  return true;
                })
                .map((a: any) => {
                  // Ensure stable ID even for initial data
                  if (!a.id) {
                    a.id = generateStableAircraftId({
                      ...a,
                      longitude: a.lastPosition.longitude,
                      latitude: a.lastPosition.latitude,
                    });
                  }
                  return a;
                });
              
              console.log('[AircraftLoader] Initial aircrafts:', aircrafts.length);
            }
          }
          
          if (aircrafts.length) {
            console.log('[AircraftLoader] Setting', aircrafts.length, 'aircrafts to store');
            setAircrafts(aircrafts);
          }
        } catch (error) {
          console.error('[AircraftLoader] Error:', error);
        }
      };

      const debounced = () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(send, 300);
      };
      
      console.log('[AircraftLoader] Map attached, triggering initial viewport update');
      debounced();
      map.on('moveend', debounced as any);
      cleanup.push(() => (map as any).un('moveend', debounced));
    };

    if (mapInstanceRef.current) {
      attach(mapInstanceRef.current);
    } else {
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