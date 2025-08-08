import { useEffect } from "react";
import { useAircraftStore } from "../stores/aircraftStore";
import { useVesselStore } from "../stores/vesselStore";
import api from "../services/apiClient";

export function useDataLoader() {
  const { setAircrafts } = useAircraftStore();
  const { setVessels } = useVesselStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("Loading initial data...");

        // Fetch aircraft data
        console.log("Fetching aircraft from /aircrafts/initial...");
        const aircraftResponse = await api.get("/aircrafts/initial");
        if (aircraftResponse) {
          console.log(
            "Aircraft data loaded:",
            aircraftResponse.length,
            "aircraft"
          );
          console.log("Sample aircraft:", aircraftResponse[0]);
          setAircrafts(aircraftResponse);
        } else {
          console.log("No aircraft data received");
        }

        // Fetch vessel data
        console.log("Fetching vessels from /vessels/initial...");
        const vesselResponse = await api.get("/vessels/initial");
        if (vesselResponse) {
          console.log("Vessel data loaded:", vesselResponse.length, "vessels");
          console.log("Sample vessel:", vesselResponse[0]);
          setVessels(vesselResponse);
        } else {
          console.log("No vessel data received");
        }

        console.log("Data loading completed");
      } catch (error) {
        console.error("Error loading initial data:", error);
      }
    };

    loadData();
  }, [setAircrafts, setVessels]);
}
