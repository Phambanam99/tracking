import { useEffect } from 'react';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { useAircraftStore } from '../stores/aircraftStore';
import { useVesselStore } from '../stores/vesselStore';
import { useMapStore } from '../stores/mapStore';
import { useTrackingStore } from '../stores/trackingStore';

interface UseFeatureUpdaterProps {
  aircraftLayerRef: React.RefObject<VectorLayer<any> | null>;
  vesselLayerRef: React.RefObject<VectorLayer<any> | null>;
}

// Helper: animate geometry with ease-out cubic using performance.now
function animateFeature(
  geometry: Point,
  targetCoords: number[],
  duration = 1000
): () => void {
  const startCoords = geometry.getCoordinates();
  const dx = targetCoords[0] - startCoords[0];
  const dy = targetCoords[1] - startCoords[1];

  // tiny epsilon check (projected coordinates)
  if (Math.abs(dx) < 1e-8 && Math.abs(dy) < 1e-8) return () => {};

  const startTime = performance.now();
  let cancelled = false;
  let rafId = 0;

  const step = (ts: number) => {
    if (cancelled) return;
    const elapsed = ts - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

    const currentX = startCoords[0] + dx * eased;
    const currentY = startCoords[1] + dy * eased;

    geometry.setCoordinates([currentX, currentY]);

    if (progress < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      // ensure final exact coordinate
      geometry.setCoordinates(targetCoords);
    }
  };

  rafId = requestAnimationFrame(step);

  return () => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
  };
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

  // ------------------------- AIRCRAFT EFFECT -------------------------
  useEffect(() => {
    const layer = aircraftLayerRef.current;
    if (!layer) return;

    const source = layer.getSource() as VectorSource<any> | null;
    if (!source || typeof source.addFeatures !== 'function') return;

    // Cancel any running animations for features that will be removed/updated
    const cancelAllOnSource = () => {
      source.getFeatures().forEach((f) => {
        const cancel = f.get('_cancelAnimation');
        if (typeof cancel === 'function') {
          try {
            cancel();
          } catch (e) {
            // ignore
          }
        }
      });
    };

    // If not visible, cancel and clear
    if (!aircraftVisible) {
      cancelAllOnSource();
      source.clear();
      return;
    }

    // Build filtered aircraft list (apply tracked mode + advanced filters)
    let targetAircrafts = aircrafts || [];

    if (aircraftViewMode === 'tracked') {
      const trackedAircraftIds = trackedItems
        .filter((i) => i.type === 'aircraft')
        .map((i) => i.data.id);
      targetAircrafts = targetAircrafts.filter((a) => trackedAircraftIds.includes(a.id));
    }

    const af = filters.aircraft || {};
    const noAdvancedFilters =
      !af.searchQuery && !af.operator && !af.aircraftType && af.minAltitude == null && af.maxAltitude == null && af.minSpeed == null && af.maxSpeed == null;

    const filteredAircrafts = targetAircrafts.filter((aircraft) => {
      if (noAdvancedFilters) return true;

      const searchLower = (af.searchQuery || '').toLowerCase().trim();
      const matchesSearch =
        !searchLower ||
        aircraft.flightId?.toLowerCase().includes(searchLower) ||
        aircraft.callSign?.toLowerCase().includes(searchLower) ||
        aircraft.registration?.toLowerCase().includes(searchLower) ||
        aircraft.operator?.toLowerCase().includes(searchLower) ||
        aircraft.aircraftType?.toLowerCase().includes(searchLower);

      const matchesOperator = !af.operator || (aircraft.operator || '').toLowerCase().includes(af.operator.toLowerCase());
      const matchesType = !af.aircraftType || (aircraft.aircraftType || '').toLowerCase().includes(af.aircraftType.toLowerCase());

      const speed = aircraft.lastPosition?.speed ?? null;
      const altitude = aircraft.lastPosition?.altitude ?? null;
      const matchesSpeedMin = af.minSpeed == null || (speed != null && speed >= af.minSpeed);
      const matchesSpeedMax = af.maxSpeed == null || (speed != null && speed <= af.maxSpeed);
      const matchesAltMin = af.minAltitude == null || (altitude != null && altitude >= af.minAltitude);
      const matchesAltMax = af.maxAltitude == null || (altitude != null && altitude <= af.maxAltitude);

      return (
        matchesSearch && matchesOperator && matchesType && matchesSpeedMin && matchesSpeedMax && matchesAltMin && matchesAltMax
      );
    });

    // Build set of current ids (only those that have lastPosition)
    const currentIds = new Set(
      filteredAircrafts.filter((a) => a.lastPosition).map((a) => String(a.id))
    );

    // Remove obsolete features (also cancel animations)
    source.getFeatures().forEach((f) => {
      const fid = f.getId ? String(f.getId()) : String(f.get('aircraft')?.id ?? '');
      if (!fid || !currentIds.has(fid)) {
        const cancel = f.get('_cancelAnimation');
        if (typeof cancel === 'function') {
          try { cancel(); } catch (e) { /* ignore */ }
        }
        source.removeFeature(f);
      }
    });

    // Keep track of cancel functions created in this run to cleanup on effect cleanup
    const createdCancels: Array<() => void> = [];

    // Update existing or create new features
    for (const aircraft of filteredAircrafts) {
      if (!aircraft.lastPosition) continue;
      const id = String(aircraft.id);
      const coords = fromLonLat([aircraft.lastPosition.longitude, aircraft.lastPosition.latitude]);

      const existing = source.getFeatureById(id) as Feature<Point> | undefined | null;

      if (existing) {
        // cancel previous animation for this feature
        const prevCancel = existing.get('_cancelAnimation');
        if (typeof prevCancel === 'function') {
          try { prevCancel(); } catch (e) { /* ignore */ }
        }

        // update data property (only the part we need)
        existing.set('aircraft', aircraft);

        const geom = existing.getGeometry() as Point | null;
        if (geom) {
          const cancel = animateFeature(geom, coords);
          existing.set('_cancelAnimation', cancel);
          createdCancels.push(cancel);
        } else {
          existing.setGeometry(new Point(coords));
        }
      } else {
        const f = new Feature({ geometry: new Point(coords), type: 'aircraft', aircraft });
        f.setId(id);
        source.addFeature(f);
      }
    }

    // cleanup when effect re-runs / component unmounts
    return () => {
      createdCancels.forEach((c) => {
        try { c(); } catch (e) { /* ignore */ }
      });
    };
    // Note: stringify the aircraft filter object to avoid unnecessary re-runs when reference changes
  }, [
    aircrafts,
    aircraftVisible,
    aircraftViewMode,
    JSON.stringify(filters.aircraft || {}),
    JSON.stringify(trackedItems || []),
    aircraftLayerRef,
  ]);

  // ------------------------- VESSEL EFFECT -------------------------
  useEffect(() => {
    const layer = vesselLayerRef.current;
    if (!layer) return;

    const source = layer.getSource() as VectorSource<any> | null;
    if (!source || typeof source.addFeatures !== 'function') return;

    const cancelAllOnSource = () => {
      source.getFeatures().forEach((f) => {
        const cancel = f.get('_cancelAnimation');
        if (typeof cancel === 'function') {
          try { cancel(); } catch (e) { /* ignore */ }
        }
      });
    };

    if (!vesselVisible) {
      cancelAllOnSource();
      source.clear();
      return;
    }

    let targetVessels = vessels || [];
    if (vesselViewMode === 'tracked') {
      const trackedVesselIds = trackedItems.filter((i) => i.type === 'vessel').map((i) => i.data.id);
      targetVessels = targetVessels.filter((v) => trackedVesselIds.includes(v.id));
    }

    const vf = filters.vessel || {};
    const noAdvancedFilters = !vf.searchQuery && !vf.operator && !vf.vesselType && !vf.flag && vf.minSpeed == null && vf.maxSpeed == null;

    const filteredVessels = targetVessels.filter((vessel) => {
      if (noAdvancedFilters) return true;

      const searchLower = (vf.searchQuery || '').toLowerCase().trim();
      const matchesSearch =
        !searchLower ||
        String(vessel.mmsi || '').toLowerCase().includes(searchLower) ||
        (vessel.vesselName || '').toLowerCase().includes(searchLower) ||
        (vessel.operator || '').toLowerCase().includes(searchLower) ||
        (vessel.flag || '').toLowerCase().includes(searchLower) ||
        (vessel.vesselType || '').toLowerCase().includes(searchLower);

      const matchesOperator = !vf.operator || (vessel.operator || '').toLowerCase().includes(vf.operator.toLowerCase());
      const matchesType = !vf.vesselType || (vessel.vesselType || '').toLowerCase().includes(vf.vesselType.toLowerCase());
      const matchesFlag = !vf.flag || (vessel.flag || '').toLowerCase().includes(vf.flag.toLowerCase());

      const speed = vessel.lastPosition?.speed ?? null;
      const matchesSpeedMin = vf.minSpeed == null || (speed != null && speed >= vf.minSpeed);
      const matchesSpeedMax = vf.maxSpeed == null || (speed != null && speed <= vf.maxSpeed);

      return matchesSearch && matchesOperator && matchesType && matchesFlag && matchesSpeedMin && matchesSpeedMax;
    });

    const currentIds = new Set(filteredVessels.filter((v) => v.lastPosition).map((v) => String(v.id)));

    // Remove obsolete
    source.getFeatures().forEach((f) => {
      const fid = f.getId ? String(f.getId()) : String(f.get('vessel')?.id ?? '');
      if (!fid || !currentIds.has(fid)) {
        const cancel = f.get('_cancelAnimation');
        if (typeof cancel === 'function') {
          try { cancel(); } catch (e) { /* ignore */ }
        }
        source.removeFeature(f);
      }
    });

    const createdCancels: Array<() => void> = [];

    for (const vessel of filteredVessels) {
      if (!vessel.lastPosition) continue;
      const id = String(vessel.id);
      const coords = fromLonLat([vessel.lastPosition.longitude, vessel.lastPosition.latitude]);

      const existing = source.getFeatureById(id) as Feature<Point> | undefined | null;

      if (existing) {
        const prevCancel = existing.get('_cancelAnimation');
        if (typeof prevCancel === 'function') {
          try { prevCancel(); } catch (e) { /* ignore */ }
        }

        existing.set('vessel', vessel);

        const geom = existing.getGeometry() as Point | null;
        if (geom) {
          const cancel = animateFeature(geom, coords);
          existing.set('_cancelAnimation', cancel);
          createdCancels.push(cancel);
        } else {
          existing.setGeometry(new Point(coords));
        }
      } else {
        const f = new Feature({ geometry: new Point(coords), type: 'vessel', vessel });
        f.setId(id);
        source.addFeature(f);
      }
    }

    return () => {
      createdCancels.forEach((c) => { try { c(); } catch (e) { /* ignore */ } });
    };
  }, [
    vessels,
    vesselVisible,
    vesselViewMode,
    JSON.stringify(filters.vessel || {}),
    JSON.stringify(trackedItems || []),
    vesselLayerRef,
  ]);
}
