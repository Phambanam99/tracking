import { useEffect } from 'react';
import { websocketService } from '../services/websocket';
import { useAircraftStore, Aircraft } from '../stores/aircraftStore';
import { useVesselStore, Vessel } from '../stores/vesselStore';
import { useRegionStore } from '../stores/regionStore';
import { useSystemSettingsStore } from '../stores/systemSettingsStore';
import { useMapStore } from '../stores/mapStore';
// import Map from 'ol/Map';
// import { toLonLat } from 'ol/proj';

interface _RegionAlert {
  id: number;
  regionId: number;
  message: string;
  timestamp: Date;
}

let _wsInitialized = false;

// Batch update queues to reduce re-renders
let aircraftQueue: Aircraft[] = [];
let vesselQueue: Vessel[] = [];
let batchTimer: NodeJS.Timeout | null = null;

export function useWebSocketHandler() {
  const { updateAircraft } = useAircraftStore();
  const { updateVessel } = useVesselStore();
  const { fetchRegions, addNewAlert } = useRegionStore();
  const { setSettings } = useSystemSettingsStore();
  const {} = useMapStore();

  // Batch processor to reduce re-renders
  const processBatch = () => {
    if (aircraftQueue.length > 0) {
      aircraftQueue.forEach(a => updateAircraft(a));
      aircraftQueue = [];
    }
    if (vesselQueue.length > 0) {
      vesselQueue.forEach(v => updateVessel(v));
      vesselQueue = [];
    }
    batchTimer = null;
  };

  const queueAircraftUpdate = (aircraft: Aircraft) => {
    aircraftQueue.push(aircraft);
    if (!batchTimer) {
      batchTimer = setTimeout(processBatch, 100); // Batch updates every 100ms
    }
  };

  const queueVesselUpdate = (vessel: Vessel) => {
    vesselQueue.push(vessel);
    if (!batchTimer) {
      batchTimer = setTimeout(processBatch, 100); // Batch updates every 100ms
    }
  };

  // Connect WebSocket once globally
  useEffect(() => {
    if (_wsInitialized) return;
    _wsInitialized = true;
    
    // Call async connect without blocking
    websocketService.connect().catch((err) => {
      console.error('[useWebSocketHandler] Failed to connect WebSocket:', err);
    });
    // Do not disconnect on unmount to keep global listeners alive
  }, []);

  // WebSocket event listeners
  useEffect(() => {
    // Aircraft position updates - queue instead of immediate update
    const handleAircraftUpdate = (aircraft: Aircraft) => {
      // console.log('🛩️ [WebSocket] Received aircraft update:', aircraft?.flightId || aircraft);
      if (!aircraft?.lastPosition) return;
      if (
        typeof aircraft.lastPosition.longitude !== 'number' ||
        typeof aircraft.lastPosition.latitude !== 'number'
      )
        return;
      queueAircraftUpdate(aircraft);
    };

    // Vessel position updates - queue instead of immediate update
    const handleVesselUpdate = (vessel: Vessel) => {
      // console.log('🚢 [WebSocket] Received vessel update:', vessel?.mmsi || vessel);
      if (!vessel?.lastPosition) return;
      if (
        typeof vessel.lastPosition.longitude !== 'number' ||
        typeof vessel.lastPosition.latitude !== 'number'
      )
        return;
      queueVesselUpdate(vessel);
    };

    // Region alerts: push alert immediately and refresh regions
    const handleRegionAlert = (alert: any) => {
      console.log('🚨 Received region alert from WebSocket:', alert);
      try {
        // Normalize shape and push into store
        const normalized = {
          id: alert.id,
          regionId: alert.regionId,
          objectType: alert.objectType,
          objectId: alert.objectId,
          alertType: alert.alertType,
          latitude: alert.latitude,
          longitude: alert.longitude,
          isRead: !!alert.isRead,
          createdAt: alert.createdAt || new Date().toISOString(),
          region: alert.region || { name: alert.regionName || 'Khu vực' },
        };
        console.log('✅ Normalized alert:', normalized);
        addNewAlert(normalized);
      } catch (e) {
        console.error('❌ Error handling region alert:', e);
      }
      // Optionally refresh regions to update counts
      fetchRegions();
    };

    // Set up listeners (idempotent via websocketService internal tracking)
    websocketService.onAircraftUpdate(handleAircraftUpdate);
    websocketService.onVesselUpdate(handleVesselUpdate);
    websocketService.onRegionAlert(handleRegionAlert);
    websocketService.onConfigUpdate(setSettings);

    // Cleanup
    return () => {
      websocketService.offAircraftUpdate(handleAircraftUpdate);
      websocketService.offVesselUpdate(handleVesselUpdate);
      websocketService.offRegionAlert(handleRegionAlert);
      websocketService.offConfigUpdate(setSettings);
    };
  }, [updateAircraft, updateVessel, fetchRegions, addNewAlert, setSettings]);

  // Subscribe viewport bbox for server-side filtering
  useEffect(() => {
    // Try to find map container and read bbox periodically
    const interval = setInterval(() => {
      const mapCanvas = document.querySelector('.ol-viewport');
      if (!mapCanvas) return;
      // We cannot get OL map instance directly here; rely on MapComponent to call viewport updates ideally.
      // As a minimal approach, skip here.
    }, 3000);
    return () => clearInterval(interval);
  }, []);
}
