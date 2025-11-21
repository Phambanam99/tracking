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

            // Get aircraft or vessel data directly (no clustering)
            const aircraft = clickedFeature.get('aircraft');
            const vessel = clickedFeature.get('vessel');
            
            // Debug logging
            if (!aircraft && !vessel) {
              console.warn('[MapClick] Feature has no aircraft or vessel data:', {
                properties: clickedFeature.getProperties(),
                keys: clickedFeature.getKeys(),
              });
              return;
            }

            const featureData = aircraft ? { aircraft } : { vessel };
            
            // More debug logging
            console.log('[MapClick] Clicked feature:', {
              type: aircraft ? 'aircraft' : 'vessel',
              data: featureData,
            });
            
            const mapElement = mapRef.current;
            if (mapElement) {
              const mapRect = mapElement.getBoundingClientRect();
              const viewportX = mapRect.left + event.pixel[0];
              const viewportY = mapRect.top + event.pixel[1];
              showPopup(featureData, [viewportX, viewportY]);
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
