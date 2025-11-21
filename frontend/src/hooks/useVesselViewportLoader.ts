import { useEffect, useRef } from 'react';
import type Map from 'ol/Map';
import { toLonLat } from 'ol/proj';
import api from '@/services/apiClient';
import { useVesselStore } from '@/stores/vesselStore';
import { usePortsStore } from '@/stores/portsStore';
import { useMapStore } from '@/stores/mapStore';

/**
 * Generate stable ID from vessel data
 * Priority: backend id > vesselId > MMSI (numeric) > coordinates-based hash
 */
function generateStableVesselId(data: any): string | number {
  // Use backend provided IDs first
  if (data.id != null) return data.id;
  if (data.vesselId != null) return data.vesselId;
  
  // MMSI is the most stable identifier for vessels
  if (data.mmsi) {
    // If MMSI is numeric, use it as number
    if (/^\d+$/.test(String(data.mmsi))) {
      return parseInt(String(data.mmsi), 10);
    }
    // Otherwise use as string
    return String(data.mmsi).trim();
  }
  
  // Use IMO number if available
  if (data.imo && /^\d+$/.test(String(data.imo))) {
    return `imo_${data.imo}`;
  }
  
  // Use vessel name as fallback
  if (data.vesselName && typeof data.vesselName === 'string' && data.vesselName.trim()) {
    return `vessel_${data.vesselName.trim().replace(/\s+/g, '_')}`;
  }
  
  // Last resort: coordinate-based (without timestamp!)
  const lon = Math.round((data.longitude || 0) * 10000) / 10000;
  const lat = Math.round((data.latitude || 0) * 10000) / 10000;
  return `vessel_${lon}_${lat}`;
}

/**
 * Only load vessels (online first, fallback initial) and optionally ports.
 * Separated from aircraft to reduce load and avoid redundant fetches.
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
  const initialLoadDoneRef = useRef<boolean>(false);

  useEffect(() => {
    const cleanup: Array<() => void> = [];
    lastBboxRef.current = '';
    lastZoomRef.current = null;
    initialLoadDoneRef.current = false;

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

        // WebSocket viewport update (always update viewport)
        const { websocketService } = await import('@/services/websocket');
        if (websocketService.socket) {
          websocketService.updateViewport(bbox);
        } else {
          websocketService.connect();
          setTimeout(() => websocketService.subscribeViewport(bbox), 200);
        }

        // ✅ Only load from API on first load, then rely on WebSocket updates
        if (initialLoadDoneRef.current) {
          console.log('[VesselLoader] Skipping API call, using WebSocket updates for viewport:', bboxStr);
          return;
        }

        console.log('[VesselLoader] Initial load for bbox:', bboxStr);
        initialLoadDoneRef.current = true;

        const qsOnline = `?bbox=${encodeURIComponent(bboxStr)}&limit=50000&includePredicted=${showPredictedVessels}`;
        const qsInitial = `?bbox=${encodeURIComponent(bboxStr)}&zoom=${zoom}`;
        
        try {
          // ✅ Try Redis first (faster)
          console.log('[VesselLoader] Trying Redis initial first...');
          const promises: Promise<any>[] = [
            api.get(`/vessels/initial${qsInitial}`),
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
          
          let vessels: import('@/stores/vesselStore').Vessel[] = Array.isArray(arr)
            ? (arr
                .map((v: any) => {
                  // Validate coordinates
                  if (!v || typeof v.longitude !== 'number' || typeof v.latitude !== 'number') {
                    return null;
                  }
                  
                  // Generate stable ID
                  const stableId = generateStableVesselId(v);
                  
                  return {
                    id: stableId,
                    mmsi: v.mmsi ?? '',
                    imo: v.imo,
                    vesselName: v.vesselName ?? v.name ?? undefined,
                    vesselType: v.vesselType,
                    flag: v.flag,
                    operator: v.operator,
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
                    // Prediction fields
                    predicted: v.predicted ?? false,
                    confidence: v.confidence ?? 1.0,
                    timeSinceLastMeasurement: v.timeSinceLastMeasurement ?? 0,
                  };
                })
                .filter(Boolean) as import('@/stores/vesselStore').Vessel[])
            : [];
          
          console.log('[VesselLoader] Redis initial vessels:', vessels.length);
          
          // ❌ Fallback to PostgreSQL if Redis empty
          if (!vessels.length) {
            console.log('[VesselLoader] No Redis data, falling back to PostgreSQL online');
            const onlinePromises: Promise<any>[] = [
              api.get(`/vessels/online${qsOnline}`),
            ];
            
            const [onlineRaw] = await Promise.all(onlinePromises);
            const onlineArr = unwrap(onlineRaw);
            
            if (Array.isArray(onlineArr)) {
              const [minLon, minLat, maxLon, maxLat] = bbox;
              const freshnessMs = 48 * 60 * 60 * 1000; // 48 hours
              const cutoffTs = Date.now() - freshnessMs;

              const normalizeTimestamp = (value: unknown): number | null => {
                if (!value) return null;
                if (value instanceof Date) return value.getTime();
                if (typeof value === 'number') return Number.isFinite(value) ? value : null;
                if (typeof value === 'string') {
                  const parsed = Date.parse(value);
                  return Number.isFinite(parsed) ? parsed : null;
                }
                return null;
              };

              const filtered = onlineArr.filter((v: any) => {
                const pos = v?.lastPosition;
                if (!pos) return false;

                const lon = typeof pos.longitude === 'number' ? pos.longitude : Number(pos.longitude);
                const lat = typeof pos.latitude === 'number' ? pos.latitude : Number(pos.latitude);
                if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
                if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return false;

                const tsValue = normalizeTimestamp(pos.timestamp);
                if (tsValue != null && tsValue < cutoffTs) return false;

                return true;
              });

              const sortedByRecency = filtered.sort((a: any, b: any) => {
                const tsA = normalizeTimestamp(a?.lastPosition?.timestamp);
                const tsB = normalizeTimestamp(b?.lastPosition?.timestamp);
                return (tsB ?? 0) - (tsA ?? 0);
              });

              const MAX_FALLBACK_VESSELS = 1500;
              vessels = sortedByRecency.slice(0, MAX_FALLBACK_VESSELS).map((v: any) => {
                // Ensure stable ID for PostgreSQL fallback data
                if (!v.id) {
                  v.id = generateStableVesselId({
                    ...v,
                    longitude: v.lastPosition.longitude,
                    latitude: v.lastPosition.latitude,
                  });
                }
                return v;
              });

              console.log('[VesselLoader] PostgreSQL fallback vessels:', vessels.length);
            }
          }
          
          if (vessels.length) {
            console.log('[VesselLoader] Setting', vessels.length, 'vessels to store');
            setVessels(vessels);
          }
          
          if (showPorts && Array.isArray(portsRaw)) {
            setPorts(portsRaw as any);
          }
        } catch (error) {
          console.error('[VesselLoader] Error:', error);
        }
      };

      const debounced = () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(send, 300);
      };
      
      console.log('[VesselLoader] Map attached, triggering initial viewport update');
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
  }, [
    mapInstanceRef,
    setVessels,
    setPorts,
    showPorts,
    showPredictedVessels,
    isActive,
  ]);
}