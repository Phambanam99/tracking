import { useEffect } from 'react';
import Map from 'ol/Map';
import { useMapStore } from '../stores/mapStore';
import { useRegionStore } from '../stores/regionStore';

interface UseMapClickHandlerProps {
  mapInstanceRef: React.RefObject<Map | null>;
  mapRef: React.RefObject<HTMLDivElement | null>;
}

export function useMapClickHandler({
  mapInstanceRef,
  mapRef,
}: UseMapClickHandlerProps) {
  const { showPopup, hidePopup, isDeleteMode } = useMapStore();
  const { deleteRegion } = useRegionStore();

  useEffect(() => {
    let retryTimer: number | null = null;
    let attached = false;
    let attachedMap: Map | null = null;
    let clickHandler: ((event: unknown) => void) | null = null;

    const tryAttach = () => {
      const mapInstance = mapInstanceRef.current;
      if (!mapInstance) {
        // Retry shortly until map is ready
        retryTimer = window.setTimeout(tryAttach, 100);
        return;
      }

      clickHandler = (evt: unknown) => {
        const event = evt as { pixel: [number, number] };
        const features = mapInstance.getFeaturesAtPixel(event.pixel as any, {
          hitTolerance: 8,
        });

        if (features.length > 0) {
          // Look for region features first
          let regionFeature = null;
          let region = null;

          for (const feature of features) {
            const featureRegion = feature.get('region');
            if (featureRegion) {
              regionFeature = feature;
              region = featureRegion;
              break;
            }
          }

          if (region && isDeleteMode) {
            if (confirm(`Bạn có chắc muốn xóa vùng "${region.name}"?`)) {
              deleteRegion(region.id);
            }
            return;
          }

          if (!regionFeature) {
            const clickedFeature = features[0];

            // Check for non-clustered single feature
            const directAircraft = clickedFeature.get('aircraft');
            const directVessel = clickedFeature.get('vessel');
            if (directAircraft || directVessel) {
              const featureData = directAircraft
                ? { aircraft: directAircraft }
                : { vessel: directVessel };
              const mapElement = mapRef.current;
              if (mapElement) {
                const mapRect = mapElement.getBoundingClientRect();
                const viewportX = mapRect.left + event.pixel[0];
                const viewportY = mapRect.top + event.pixel[1];
                showPopup(featureData, [viewportX, viewportY]);
              }
              return;
            }

            // Handle clustered features
            const clusteredFeatures = clickedFeature.get('features');
            if (
              clusteredFeatures &&
              Array.isArray(clusteredFeatures) &&
              clusteredFeatures.length === 1
            ) {
              const feature = clusteredFeatures[0];
              const aircraft = feature.get('aircraft');
              const vessel = feature.get('vessel');
              const featureData = aircraft ? { aircraft } : { vessel };
              const mapElement = mapRef.current;
              if (mapElement) {
                const mapRect = mapElement.getBoundingClientRect();
                const viewportX = mapRect.left + event.pixel[0];
                const viewportY = mapRect.top + event.pixel[1];
                showPopup(featureData, [viewportX, viewportY]);
              }
            } else if (
              clusteredFeatures &&
              Array.isArray(clusteredFeatures) &&
              clusteredFeatures.length > 1
            ) {
              const geom = clickedFeature.getGeometry() as any;
              if (geom && typeof geom.getCoordinates === 'function') {
                const coord = geom.getCoordinates();
                const view = mapInstance.getView();
                const current = view.getZoom() ?? 6;
                const target = Math.min(current + 2, 14);
                view.animate({ center: coord, zoom: target, duration: 300 });
              }
            }
          }
        } else {
          hidePopup();
        }
      };

      mapInstance.on('singleclick', clickHandler);
      attached = true;
      attachedMap = mapInstance;
    };

    // Kick off attach attempts
    tryAttach();

    return () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      if (attached && attachedMap && clickHandler) {
        (attachedMap as unknown as any).un('singleclick', clickHandler);
      }
    };
  }, [
    showPopup,
    hidePopup,
    isDeleteMode,
    deleteRegion,
    mapInstanceRef,
    mapRef,
  ]);
}
