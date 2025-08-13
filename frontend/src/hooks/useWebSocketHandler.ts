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

export function useWebSocketHandler() {
  const { updateAircraft } = useAircraftStore();
  const { updateVessel } = useVesselStore();
  const { fetchRegions, addNewAlert } = useRegionStore();
  const { setSettings } = useSystemSettingsStore();
  const {} = useMapStore();

  // Connect WebSocket once globally
  useEffect(() => {
    if (_wsInitialized) return;
    _wsInitialized = true;
    websocketService.connect();
    // Do not disconnect on unmount to keep global listeners alive
  }, []);

  // WebSocket event listeners
  useEffect(() => {
    // Aircraft position updates
    const handleAircraftUpdate = (aircraft: Aircraft) => {
      if (!aircraft?.lastPosition) return; // ignore stale/no-signal
      if (
        typeof aircraft.lastPosition.longitude !== 'number' ||
        typeof aircraft.lastPosition.latitude !== 'number'
      )
        return;
      updateAircraft(aircraft);
    };

    // Vessel position updates
    const handleVesselUpdate = (vessel: Vessel) => {
      if (!vessel?.lastPosition) return; // ignore stale/no-signal
      if (
        typeof vessel.lastPosition.longitude !== 'number' ||
        typeof vessel.lastPosition.latitude !== 'number'
      )
        return;
      updateVessel(vessel);
    };

    // Region alerts: push alert immediately and refresh regions
    const handleRegionAlert = (alert: any) => {
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
        addNewAlert(normalized);
      } catch (e) {
        // swallow
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
