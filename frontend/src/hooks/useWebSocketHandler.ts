import { useEffect } from "react";
import { websocketService } from "../services/websocket";
import { useAircraftStore, Aircraft } from "../stores/aircraftStore";
import { useVesselStore, Vessel } from "../stores/vesselStore";
import { useRegionStore } from "../stores/regionStore";

interface RegionAlert {
  id: number;
  regionId: number;
  message: string;
  timestamp: Date;
}

export function useWebSocketHandler() {
  const { updateAircraft } = useAircraftStore();
  const { updateVessel } = useVesselStore();
  const { fetchRegions } = useRegionStore();

  // Connect WebSocket
  useEffect(() => {
    websocketService.connect();
    return () => websocketService.disconnect();
  }, []);

  // WebSocket event listeners
  useEffect(() => {
    console.log("Setting up WebSocket listeners...");

    // Aircraft position updates
    const handleAircraftUpdate = (aircraft: Aircraft) => {
      console.log("Received aircraft update:", aircraft);
      updateAircraft(aircraft);
    };

    // Vessel position updates
    const handleVesselUpdate = (vessel: Vessel) => {
      console.log("Received vessel update:", vessel);
      updateVessel(vessel);
    };

    // Region alerts (refresh regions when alerts change)
    const handleRegionAlert = (alert: RegionAlert) => {
      console.log("Received region alert:", alert);
      // Refresh regions to get updated alert counts
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
  }, [updateAircraft, updateVessel, fetchRegions]);
}
