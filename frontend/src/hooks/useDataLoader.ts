import { useEffect } from "react";
import { useAircraftStore } from "../stores/aircraftStore";
import { useVesselStore } from "../stores/vesselStore";
import api from "../services/apiClient";
import { useMapStore } from "../stores/mapStore";
import { toLonLat } from "ol/proj";

export function useDataLoader() {
  const { setAircrafts } = useAircraftStore();
  const { setVessels } = useVesselStore();
  const { } = useMapStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("Loading initial data by viewport bbox...");
        // Try to read current map view bbox (if map exists)
        // Fallback to whole world if not available
        let bboxParam = "";
        const mapEl = document.querySelector('.ol-viewport');
        // We can't access OL Map instance here directly; load all for now
        // A future improvement: pass map instance or current extent via context

        const aircraftResponse = await api.get(`/aircrafts/initial${bboxParam}`);
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

        const vesselResponse = await api.get(`/vessels/initial${bboxParam}`);
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
