import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Draw } from 'ol/interaction';
import Polygon from 'ol/geom/Polygon';
import Circle from 'ol/geom/Circle';
import { toLonLat } from 'ol/proj';
import { useMapStore } from '../stores/mapStore';

interface UseDrawingModeProps {
  mapInstanceRef: React.RefObject<Map | null>;
  regionLayerRef: React.RefObject<VectorLayer<VectorSource> | null>;
}

export function useDrawingMode({
  mapInstanceRef,
  regionLayerRef,
}: UseDrawingModeProps) {
  const drawInteractionRef = useRef<Draw | null>(null);
  const lastDrawnFeatureRef = useRef<Feature | null>(null);

  const { isDrawingMode, drawingTool, showDrawingActionPopup } = useMapStore();

  useEffect(() => {
    if (!mapInstanceRef.current || !regionLayerRef.current) return;

    const map = mapInstanceRef.current;
    const regionSource = regionLayerRef.current.getSource();

    // Remove existing draw interaction
    if (drawInteractionRef.current) {
      map.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }

    if (isDrawingMode && drawingTool && regionSource) {
      let drawInteraction: Draw;

      if (drawingTool === 'polygon') {
        drawInteraction = new Draw({
          source: regionSource,
          type: 'Polygon',
        });
      } else if (drawingTool === 'circle') {
        drawInteraction = new Draw({
          source: regionSource,
          type: 'Circle',
        });
      }

      if (drawInteraction!) {
        map.addInteraction(drawInteraction);
        drawInteractionRef.current = drawInteraction;

        // Handle draw end event
        drawInteraction.on('drawend', async (event) => {
          const feature = event.feature;
          const geometry = feature.getGeometry();

          // Lưu reference đến feature vừa vẽ
          lastDrawnFeatureRef.current = feature;

          if (geometry) {
            // Convert geometry to GeoJSON format for storage
            let boundary;
            if (geometry instanceof Polygon) {
              const coordinates = geometry
                .getCoordinates()[0]
                .map((coord) => toLonLat(coord));
              boundary = {
                type: 'Polygon',
                coordinates: [coordinates],
              };
            } else if (geometry instanceof Circle) {
              // Handle circle
              const center = geometry.getCenter();
              const radius = geometry.getRadius();
              const centerCoords = toLonLat(center);
              boundary = {
                type: 'Circle',
                center: centerCoords,
                radius: radius,
              };
            }

            // Get mouse position for popup positioning
            const mapElement = mapInstanceRef.current?.getTargetElement();
            if (mapElement && boundary) {
              const rect = mapElement.getBoundingClientRect();
              const popupPosition = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
              };

              // Show action popup instead of directly creating region
              showDrawingActionPopup(boundary, popupPosition);
            }
          }
        });
      }
    }
  }, [
    isDrawingMode,
    drawingTool,
    showDrawingActionPopup,
    mapInstanceRef,
    regionLayerRef,
  ]);

  return {
    lastDrawnFeatureRef,
  };
}
