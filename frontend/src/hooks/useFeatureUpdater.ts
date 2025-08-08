import { useEffect } from "react";
import VectorLayer from "ol/layer/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { fromLonLat } from "ol/proj";
import { Cluster } from "ol/source";
import { useAircraftStore } from "../stores/aircraftStore";
import { useVesselStore } from "../stores/vesselStore";
import { useMapStore } from "../stores/mapStore";

interface UseFeatureUpdaterProps {
  aircraftLayerRef: React.RefObject<VectorLayer<Cluster> | null>;
  vesselLayerRef: React.RefObject<VectorLayer<Cluster> | null>;
}

export function useFeatureUpdater({
  aircraftLayerRef,
  vesselLayerRef,
}: UseFeatureUpdaterProps) {
  const { aircrafts } = useAircraftStore();
  const { vessels } = useVesselStore();
  const { filters } = useMapStore();
  const { showAircraft: aircraftVisible, showVessels: vesselVisible } = filters;

  // Update aircraft features
  useEffect(() => {
    if (!aircraftLayerRef.current) return;

    // Get the cluster source first, then get the underlying vector source
    const clusterSource = aircraftLayerRef.current.getSource();
    if (!clusterSource) return;

    const aircraftSource = clusterSource.getSource();
    if (!aircraftSource) return;

    // Clear existing features
    aircraftSource.clear();

    // Only add aircraft if visible
    if (aircraftVisible && aircrafts.length > 0) {
      console.log("Updating aircraft features:", aircrafts.length, "aircraft");

      aircrafts.forEach((aircraft) => {
        if (aircraft.lastPosition) {
          const coordinates = fromLonLat([
            aircraft.lastPosition.longitude,
            aircraft.lastPosition.latitude,
          ]);

          const feature = new Feature({
            geometry: new Point(coordinates),
            type: "aircraft",
            aircraft,
          });

          aircraftSource.addFeature(feature);
        }
      });

      console.log(
        "Aircraft features updated, total:",
        aircraftSource.getFeatures().length
      );
    }
  }, [aircrafts, aircraftVisible, aircraftLayerRef]);

  // Update vessel features
  useEffect(() => {
    if (!vesselLayerRef.current) return;

    // Get the cluster source first, then get the underlying vector source
    const clusterSource = vesselLayerRef.current.getSource();
    if (!clusterSource) return;

    const vesselSource = clusterSource.getSource();
    if (!vesselSource) return;

    // Clear existing features
    vesselSource.clear();

    // Only add vessels if visible
    if (vesselVisible && vessels.length > 0) {
      console.log("Updating vessel features:", vessels.length, "vessels");

      vessels.forEach((vessel) => {
        if (vessel.lastPosition) {
          const coordinates = fromLonLat([
            vessel.lastPosition.longitude,
            vessel.lastPosition.latitude,
          ]);

          const feature = new Feature({
            geometry: new Point(coordinates),
            type: "vessel",
            vessel,
          });

          vesselSource.addFeature(feature);
        }
      });

      console.log(
        "Vessel features updated, total:",
        vesselSource.getFeatures().length
      );
    }
  }, [vessels, vesselVisible, vesselLayerRef]);
}
