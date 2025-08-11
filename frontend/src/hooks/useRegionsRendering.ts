import { useEffect } from 'react';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import Circle from 'ol/geom/Circle';
import { fromLonLat } from 'ol/proj';
import { useRegionStore } from '../stores/regionStore';
import { useMapStore } from '../stores/mapStore';

// Type definitions for boundary data
interface PolygonBoundary {
  coordinates: number[][][];
}

interface CircleBoundary {
  center: number[];
  radius: number;
}

interface UseRegionsRenderingProps {
  regionLayerRef: React.RefObject<VectorLayer<VectorSource> | null>;
}

export function useRegionsRendering({
  regionLayerRef,
}: UseRegionsRenderingProps) {
  const { regions, fetchRegions } = useRegionStore();
  const { regionsVisible } = useMapStore();

  // Load and display regions
  useEffect(() => {
    console.log('Fetching regions...');
    fetchRegions();
  }, [fetchRegions]);

  useEffect(() => {
    if (!regionLayerRef.current) return;

    const regionSource = regionLayerRef.current.getSource();
    if (!regionSource) return;

    // Clear existing regions (but keep drawn regions)
    const features = regionSource.getFeatures();
    const drawnFeatures = features.filter((f) => !f.get('isStoredRegion'));
    regionSource.clear();
    regionSource.addFeatures(drawnFeatures);

    // Only add stored regions if regionsVisible is true
    if (regionsVisible && regions && regions.length > 0) {
      console.log('Loading regions:', regions.length, 'regions');
      // Add stored regions - filter out any null/undefined values
      const validRegions = regions.filter(Boolean);
      console.log('Valid regions after filtering:', validRegions.length);

      validRegions.forEach((region) => {
        if (region && region.boundary) {
          let feature;

          if (
            region.regionType === 'POLYGON' &&
            'coordinates' in region.boundary
          ) {
            const boundaryData = region.boundary as PolygonBoundary;
            const coordinates = boundaryData.coordinates[0].map(
              (coord: number[]) => fromLonLat(coord),
            );
            feature = new Feature({
              geometry: new Polygon([coordinates]),
              isStoredRegion: true,
              region,
            });
            console.log('Created polygon region feature:', region.name);
          } else if (region.regionType === 'CIRCLE') {
            let center, radius;

            // Try to get circle data from boundary first (for new regions)
            if ('center' in region.boundary && 'radius' in region.boundary) {
              const boundaryData = region.boundary as CircleBoundary;
              center = fromLonLat(boundaryData.center);
              radius = boundaryData.radius;
            }
            // Fallback to separate fields (for old regions)
            else if (region.centerLat && region.centerLng && region.radius) {
              center = fromLonLat([region.centerLng, region.centerLat]);
              radius = region.radius;
            }

            if (center && radius) {
              feature = new Feature({
                geometry: new Circle(center, radius),
                isStoredRegion: true,
                region,
              });
              console.log('Created circle region feature:', region.name);
            }
          }

          if (feature) {
            regionSource.addFeature(feature);
            console.log('Added region feature to source:', region.name);
          }
        }
      });
      console.log(
        'Total features in region source:',
        regionSource.getFeatures().length,
      );
    }
  }, [regions, regionsVisible, regionLayerRef]);
}
