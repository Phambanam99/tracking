import { useEffect } from 'react';
import { useAircraftStore } from '../stores/aircraftStore';
import { useVesselStore } from '../stores/vesselStore';
import api from '../services/apiClient';
import { useMapStore } from '../stores/mapStore';
// Removed unused import

export function useDataLoader() {
  const { setAircrafts } = useAircraftStore();
  const { setVessels } = useVesselStore();
  const {} = useMapStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Try to read current map view bbox (if map exists)
        // Fallback to whole world if not available
        const bboxParam = '';
        const _mapEl = document.querySelector('.ol-viewport');
        // We can't access OL Map instance here directly; load all for now
        // A future improvement: pass map instance or current extent via context

        const aircraftResponse = await api.get(
          `/aircrafts/initial${bboxParam}`,
        );
        if (aircraftResponse) {
          setAircrafts(aircraftResponse);
        } else {
        }

        const vesselResponse = await api.get(`/vessels/initial${bboxParam}`);
        if (vesselResponse) {
          setVessels(vesselResponse);
        } else {
        }

      } catch (error) {
      }
    };

    loadData();
  }, [setAircrafts, setVessels]);
}
