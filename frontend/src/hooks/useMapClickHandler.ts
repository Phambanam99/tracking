import { useEffect } from "react";
import Map from "ol/Map";
import { useMapStore } from "../stores/mapStore";
import { useRegionStore } from "../stores/regionStore";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let clickHandler: ((event: any) => void) | null = null;

    const tryAttach = () => {
      const mapInstance = mapInstanceRef.current;
      if (!mapInstance) {
        // Retry shortly until map is ready
        retryTimer = window.setTimeout(tryAttach, 100);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clickHandler = (event: any) => {
        const features = mapInstance.getFeaturesAtPixel(event.pixel, {
          hitTolerance: 8,
        });

        if (features.length > 0) {
          // Look for region features first
          let regionFeature = null;
          let region = null;

          for (const feature of features) {
            const featureRegion = feature.get("region");
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
            const directAircraft = clickedFeature.get("aircraft");
            const directVessel = clickedFeature.get("vessel");
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
            const clusteredFeatures = clickedFeature.get("features");
            if (
              clusteredFeatures &&
              Array.isArray(clusteredFeatures) &&
              clusteredFeatures.length === 1
            ) {
              const feature = clusteredFeatures[0];
              const aircraft = feature.get("aircraft");
              const vessel = feature.get("vessel");
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
              const extent = clickedFeature.getGeometry()?.getExtent();
              if (extent) {
                mapInstance.getView().fit(extent, {
                  duration: 300,
                  padding: [50, 50, 50, 50],
                });
              }
            }
          }
        } else {
          hidePopup();
        }
      };

      mapInstance.on("singleclick", clickHandler);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (attachedMap as any).un("singleclick", clickHandler);
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
