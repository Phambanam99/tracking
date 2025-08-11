import { useEffect } from 'react';
import VectorLayer from 'ol/layer/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Cluster } from 'ol/source';
import { useAircraftStore } from '../stores/aircraftStore';
import { useVesselStore } from '../stores/vesselStore';
import { useMapStore } from '../stores/mapStore';
import { useTrackingStore } from '../stores/trackingStore';

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
  const { trackedItems } = useTrackingStore();
  const { filters, aircraftViewMode, vesselViewMode } = useMapStore();
  const { showAircraft: aircraftVisible, showVessels: vesselVisible } = filters;

  // Update aircraft features
  useEffect(() => {
    if (!aircraftLayerRef.current) return;

    // Get the cluster source first, then get the underlying vector source
    const clusterSource = aircraftLayerRef.current.getSource();
    if (!clusterSource) return;

    const aircraftSource = clusterSource.getSource();
    if (!aircraftSource) return;

    // Clear existing features then batch add
    aircraftSource.clear();

    // Only add aircraft if visible
    if (aircraftVisible && aircrafts.length > 0) {
      // Build filtered list applying view mode and advanced filters
      let targetAircrafts = aircrafts;

      if (aircraftViewMode === 'tracked') {
        const trackedAircraftIds = trackedItems
          .filter((item) => item.type === 'aircraft')
          .map((item) => item.data.id);
        targetAircrafts = targetAircrafts.filter((a) =>
          trackedAircraftIds.includes(a.id),
        );
      }

      const filteredAircrafts = targetAircrafts.filter((aircraft) => {
        const af = filters.aircraft;
        const noAdvancedFilters =
          !af.searchQuery &&
          !af.operator &&
          !af.aircraftType &&
          af.minAltitude == null &&
          af.maxAltitude == null &&
          af.minSpeed == null &&
          af.maxSpeed == null;
        if (noAdvancedFilters) return true;

        const searchLower = (af.searchQuery || '').toLowerCase();
        const matchesSearch =
          !searchLower ||
          aircraft.flightId.toLowerCase().includes(searchLower) ||
          aircraft.callSign?.toLowerCase().includes(searchLower) ||
          aircraft.registration?.toLowerCase().includes(searchLower) ||
          aircraft.operator?.toLowerCase().includes(searchLower) ||
          aircraft.aircraftType?.toLowerCase().includes(searchLower);

        const matchesOperator =
          !af.operator ||
          (aircraft.operator || '')
            .toLowerCase()
            .includes(af.operator.toLowerCase());
        const matchesType =
          !af.aircraftType ||
          (aircraft.aircraftType || '')
            .toLowerCase()
            .includes(af.aircraftType.toLowerCase());

        const speed = aircraft.lastPosition?.speed ?? null;
        const altitude = aircraft.lastPosition?.altitude ?? null;
        const matchesSpeedMin =
          af.minSpeed == null || (speed != null && speed >= af.minSpeed);
        const matchesSpeedMax =
          af.maxSpeed == null || (speed != null && speed <= af.maxSpeed);
        const matchesAltMin =
          af.minAltitude == null ||
          (altitude != null && altitude >= af.minAltitude);
        const matchesAltMax =
          af.maxAltitude == null ||
          (altitude != null && altitude <= af.maxAltitude);

        return (
          matchesSearch &&
          matchesOperator &&
          matchesType &&
          matchesSpeedMin &&
          matchesSpeedMax &&
          matchesAltMin &&
          matchesAltMax
        );
      });

      console.log(
        'Updating aircraft features:',
        filteredAircrafts.length,
        'aircraft (post-filter)',
      );

      const features: Feature<Point>[] = [];
      for (const aircraft of filteredAircrafts) {
        if (!aircraft.lastPosition) continue;
        const coordinates = fromLonLat([
          aircraft.lastPosition.longitude,
          aircraft.lastPosition.latitude,
        ]);
        features.push(
          new Feature({
            geometry: new Point(coordinates),
            type: 'aircraft',
            aircraft,
          }),
        );
      }
      if (features.length > 0) aircraftSource.addFeatures(features);

      console.log(
        'Aircraft features updated, total:',
        aircraftSource.getFeatures().length,
      );
    }
  }, [
    aircrafts,
    aircraftVisible,
    aircraftViewMode,
    filters.aircraft,
    trackedItems,
    aircraftLayerRef,
  ]);

  // Update vessel features
  useEffect(() => {
    if (!vesselLayerRef.current) return;

    // Get the cluster source first, then get the underlying vector source
    const clusterSource = vesselLayerRef.current.getSource();
    if (!clusterSource) return;

    const vesselSource = clusterSource.getSource();
    if (!vesselSource) return;

    // Clear existing features then batch add
    vesselSource.clear();

    // Only add vessels if visible
    if (vesselVisible && vessels.length > 0) {
      // Build filtered list applying view mode and advanced filters
      let targetVessels = vessels;

      if (vesselViewMode === 'tracked') {
        const trackedVesselIds = trackedItems
          .filter((item) => item.type === 'vessel')
          .map((item) => item.data.id);
        targetVessels = targetVessels.filter((v) =>
          trackedVesselIds.includes(v.id),
        );
      }

      const filteredVessels = targetVessels.filter((vessel) => {
        const vf = filters.vessel;
        const noAdvancedFilters =
          !vf.searchQuery &&
          !vf.operator &&
          !vf.vesselType &&
          !vf.flag &&
          vf.minSpeed == null &&
          vf.maxSpeed == null;
        if (noAdvancedFilters) return true;

        const searchLower = (vf.searchQuery || '').toLowerCase();
        const matchesSearch =
          !searchLower ||
          vessel.mmsi.toLowerCase().includes(searchLower) ||
          vessel.vesselName?.toLowerCase().includes(searchLower) ||
          vessel.operator?.toLowerCase().includes(searchLower) ||
          vessel.flag?.toLowerCase().includes(searchLower) ||
          vessel.vesselType?.toLowerCase().includes(searchLower);

        const matchesOperator =
          !vf.operator ||
          (vessel.operator || '')
            .toLowerCase()
            .includes(vf.operator.toLowerCase());
        const matchesType =
          !vf.vesselType ||
          (vessel.vesselType || '')
            .toLowerCase()
            .includes(vf.vesselType.toLowerCase());
        const matchesFlag =
          !vf.flag ||
          (vessel.flag || '').toLowerCase().includes(vf.flag.toLowerCase());

        const speed = vessel.lastPosition?.speed ?? null;
        const matchesSpeedMin =
          vf.minSpeed == null || (speed != null && speed >= vf.minSpeed);
        const matchesSpeedMax =
          vf.maxSpeed == null || (speed != null && speed <= vf.maxSpeed);

        return (
          matchesSearch &&
          matchesOperator &&
          matchesType &&
          matchesFlag &&
          matchesSpeedMin &&
          matchesSpeedMax
        );
      });

      console.log(
        'Updating vessel features:',
        filteredVessels.length,
        'vessels (post-filter)',
      );

      const features: Feature<Point>[] = [];
      for (const vessel of filteredVessels) {
        if (!vessel.lastPosition) continue;
        const coordinates = fromLonLat([
          vessel.lastPosition.longitude,
          vessel.lastPosition.latitude,
        ]);
        features.push(
          new Feature({
            geometry: new Point(coordinates),
            type: 'vessel',
            vessel,
          }),
        );
      }
      if (features.length > 0) vesselSource.addFeatures(features);

      console.log(
        'Vessel features updated, total:',
        vesselSource.getFeatures().length,
      );
    }
  }, [
    vessels,
    vesselVisible,
    vesselViewMode,
    filters.vessel,
    trackedItems,
    vesselLayerRef,
  ]);
}
