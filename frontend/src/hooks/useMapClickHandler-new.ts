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
    const mapInstance = mapInstanceRef.current;
    if (!mapInstance) return;

    // Small delay to ensure map is fully initialized
    const timer = setTimeout(() => {
      console.log("Setting up map click handler, map:", mapInstance);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clickHandler = (event: any) => {
        console.log("Map clicked!", event.pixel);
        const features = mapInstance.getFeaturesAtPixel(event.pixel);
        console.log("Features at pixel:", features);

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
            // Delete region mode
            if (confirm(`Bạn có chắc muốn xóa vùng "${region.name}"?`)) {
              deleteRegion(region.id);
            }
            return;
          }

          // If no region feature found, handle aircraft/vessel clusters
          if (!regionFeature) {
            const clickedFeature = features[0];
            console.log("Clicked feature:", clickedFeature);

            // Handle aircraft/vessel clusters
            const clusteredFeatures = clickedFeature.get("features");
            console.log("Clustered features:", clusteredFeatures);

            if (
              clusteredFeatures &&
              Array.isArray(clusteredFeatures) &&
              clusteredFeatures.length === 1
            ) {
              // Single feature clicked
              console.log("Single feature clicked");
              const feature = clusteredFeatures[0];
              const aircraft = feature.get("aircraft");
              const vessel = feature.get("vessel");

              console.log("Feature data:", { aircraft, vessel });

              const featureData = aircraft ? { aircraft } : { vessel };

              // Convert map pixel coordinates to viewport coordinates
              const mapElement = mapRef.current;
              if (mapElement) {
                const mapRect = mapElement.getBoundingClientRect();
                const viewportX = mapRect.left + event.pixel[0];
                const viewportY = mapRect.top + event.pixel[1];
                console.log("Showing popup at:", [viewportX, viewportY]);
                showPopup(featureData, [viewportX, viewportY]);
              }
            } else if (
              clusteredFeatures &&
              Array.isArray(clusteredFeatures) &&
              clusteredFeatures.length > 1
            ) {
              // Cluster clicked - zoom in
              console.log(
                "Cluster clicked, features:",
                clusteredFeatures.length
              );
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

      console.log("Adding singleclick event listener to map");
      mapInstance.on("singleclick", clickHandler);
    }, 100); // 100ms delay

    return () => {
      clearTimeout(timer);
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
