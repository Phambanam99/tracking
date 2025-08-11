import { useEffect } from 'react';
import { websocketService } from '../services/websocket';
import { useAircraftStore, Aircraft } from '../stores/aircraftStore';
import { useVesselStore, Vessel } from '../stores/vesselStore';
import { useRegionStore } from '../stores/regionStore';
import { useMapStore } from '../stores/mapStore';
import Map from 'ol/Map';
import { toLonLat } from 'ol/proj';

interface RegionAlert {
  id: number;
  regionId: number;
  message: string;
  timestamp: Date;
}

export function useWebSocketHandler() {
  const { updateAircraft } = useAircraftStore();
  const { updateVessel } = useVesselStore();
  const { fetchRegions, addNewAlert } = useRegionStore();
  const {} = useMapStore();

  // Connect WebSocket
  useEffect(() => {
    websocketService.connect();
    return () => websocketService.disconnect();
  }, []);

  // WebSocket event listeners
  useEffect(() => {
    console.log('Setting up WebSocket listeners...');

    // Aircraft position updates
    const handleAircraftUpdate = (aircraft: Aircraft) => {
      console.log('Received aircraft update:', aircraft);
      updateAircraft(aircraft);
    };

    // Vessel position updates
    const handleVesselUpdate = (vessel: Vessel) => {
      console.log('Received vessel update:', vessel);
      updateVessel(vessel);
    };

    // Region alerts: push alert immediately and refresh regions
    const handleRegionAlert = (alert: any) => {
      try {
        console.log('Received region alert:', alert);
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

    // Set up listeners
    websocketService.onAircraftUpdate(handleAircraftUpdate);
    websocketService.onVesselUpdate(handleVesselUpdate);
    websocketService.onRegionAlert(handleRegionAlert);

    // Cleanup
    return () => {
      websocketService.offAircraftUpdate(handleAircraftUpdate);
      websocketService.offVesselUpdate(handleVesselUpdate);
      websocketService.offRegionAlert(handleRegionAlert);
    };
  }, [updateAircraft, updateVessel, fetchRegions, addNewAlert]);

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
