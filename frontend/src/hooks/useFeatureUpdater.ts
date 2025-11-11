import { useEffect } from 'react';
import VectorLayer from 'ol/layer/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import Cluster from 'ol/source/Cluster';
import { useAircraftStore } from '../stores/aircraftStore';
import { useVesselStore } from '../stores/vesselStore';
import { useMapStore } from '../stores/mapStore';
import { useTrackingStore } from '../stores/trackingStore';

interface UseFeatureUpdaterProps {
  aircraftLayerRef: React.RefObject<VectorLayer<any> | null>;
  vesselLayerRef: React.RefObject<VectorLayer<any> | null>;
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

    // Get layer source; support both Cluster and VectorSource
    const layerSource: any = aircraftLayerRef.current.getSource();
    if (!layerSource) return;
    const aircraftSource: any =
      typeof layerSource.getSource === 'function'
        ? layerSource.getSource()
        : layerSource;
    if (!aircraftSource || typeof aircraftSource.addFeatures !== 'function')
      return;

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

    // Get layer source; support both Cluster and VectorSource
    const layerSource: any = vesselLayerRef.current.getSource();
    if (!layerSource) return;
    const vesselSource: any =
      typeof layerSource.getSource === 'function'
        ? layerSource.getSource()
        : layerSource;
    if (!vesselSource || typeof vesselSource.addFeatures !== 'function') return;

    // Clear existing features then batch add
    vesselSource.clear();

    console.log(
      '[Vessel Render] Total vessels:',
      vessels.length,
      'Visible:',
      vesselVisible,
    );

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

      console.log(
        '[Vessel Render] Current filters:',
        JSON.stringify(filters.vessel, null, 2),
      );
      console.log('[Vessel Render] Sample vessel (first):', targetVessels[0]);

      const vf = filters.vessel;
      const noAdvancedFilters =
        !vf.searchQuery &&
        !vf.operator &&
        !vf.vesselType &&
        !vf.flag &&
        vf.minSpeed == null &&
        vf.maxSpeed == null;

      console.log('[Vessel Render] No advanced filters?', noAdvancedFilters);

      let debugCount = 0;
      const filteredVessels = targetVessels.filter((vessel) => {
        if (noAdvancedFilters) return true;

        const searchLower = (vf.searchQuery || '').toLowerCase().trim();
        const matchesSearch =
          !searchLower ||
          String(vessel.mmsi || '')
            .toLowerCase()
            .includes(searchLower) ||
          (vessel.vesselName || '').toLowerCase().includes(searchLower) ||
          (vessel.operator || '').toLowerCase().includes(searchLower) ||
          (vessel.flag || '').toLowerCase().includes(searchLower) ||
          (vessel.vesselType || '').toLowerCase().includes(searchLower);

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

        const passes =
          matchesSearch &&
          matchesOperator &&
          matchesType &&
          matchesFlag &&
          matchesSpeedMin &&
          matchesSpeedMax;

        // Debug first few rejections
        if (!passes && debugCount < 3) {
          console.log(`[Vessel Render] Vessel ${vessel.mmsi} filtered out:`, {
            matchesSearch,
            matchesOperator,
            matchesType,
            matchesFlag,
            matchesSpeedMin,
            matchesSpeedMax,
            vessel,
          });
          debugCount++;
        }

        return passes;
      });

      console.log('[Vessel Render] After filters:', filteredVessels.length);

      const features: Feature<Point>[] = [];
      let skippedNoPosition = 0;
      const skippedVessels: string[] = [];
      for (const vessel of filteredVessels) {
        if (!vessel.lastPosition) {
          skippedNoPosition++;
          if (skippedVessels.length < 5) {
            skippedVessels.push(
              `${vessel.mmsi} (${vessel.vesselName || 'N/A'})`,
            );
          }
          continue;
        }
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
      console.log(
        '[Vessel Render] Features created:',
        features.length,
        'Skipped (no position):',
        skippedNoPosition,
      );
      if (skippedNoPosition > 0) {
        console.log('[Vessel Render] Sample skipped vessels:', skippedVessels);
      }
      if (features.length > 0) {
        vesselSource.addFeatures(features);
        console.log(
          '[Vessel Render] ✓ Added',
          features.length,
          'features to map layer',
        );
        console.log('[Vessel Render] Sample coordinates:', {
          first: features[0]?.getGeometry()?.getCoordinates(),
          last: features[features.length - 1]?.getGeometry()?.getCoordinates(),
        });
      }
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
