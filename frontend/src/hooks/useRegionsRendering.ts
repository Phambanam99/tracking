import { useEffect, useRef } from 'react';
import type Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import Circle from 'ol/geom/Circle';
import { fromLonLat } from 'ol/proj';
import { useRegionStore } from '../stores/regionStore';
import { useMapStore } from '../stores/mapStore';
import { usePortsStore } from '@/stores/portsStore';
import { Style, Icon, Text, Fill, Stroke } from 'ol/style';
import Point from 'ol/geom/Point';

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
  mapInstanceRef?: React.RefObject<Map | null>;
}

export function useRegionsRendering({
  regionLayerRef,
  mapInstanceRef,
}: UseRegionsRenderingProps) {
  const { regions, fetchRegions } = useRegionStore();
  const { regionsVisible } = useMapStore();
  const { ports, showPorts } = usePortsStore();
  const portsLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const lastSelectedRef = useRef<Feature<Point> | null>(null);
  const currentScaleRef = useRef<number>(1);

  // Load and display regions
  useEffect(() => {
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
      // Add stored regions - filter out any null/undefined values
      const validRegions = regions.filter(Boolean);

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
            }
          }

          if (feature) {
            regionSource.addFeature(feature);
          }
        }
      });
    }
  }, [regions, regionsVisible, regionLayerRef]);

  // Ports rendering layer (SVG icon)
  useEffect(() => {
    if (!regionLayerRef.current) return;
    // Get map from prop or from region layer custom property
    const map: any =
      mapInstanceRef?.current ||
      (regionLayerRef.current as any).get?.('map') ||
      (regionLayerRef.current as any).getMap?.();
    if (!map) return;

    if (!portsLayerRef.current) {
      portsLayerRef.current = new VectorLayer({
        source: new VectorSource(),
        zIndex: 3000,
        declutter: true,
      });
      map.addLayer(portsLayerRef.current);
    }

    const layer = portsLayerRef.current;
    const source = layer.getSource();
    if (!source) return;

    layer.setVisible(!!showPorts);
    source.clear();
    if (!showPorts || !ports || ports.length === 0) return;

    // Scale icon slightly with zoom so it stays noticeable but not huge
    const view = map.getView();
    const zoom = view.getZoom() ?? 6;
    const scale = Math.max(0.6, Math.min(1.6, 0.6 + (zoom - 4) * 0.12));
    currentScaleRef.current = scale;
    const style = new Style({
      image: new Icon({
        src: '/port.svg',
        anchor: [0.5, 0.5],
        scale,
        color: '#6366f1',
      }),
    });

    for (const p of ports) {
      const f = new Feature({
        geometry: new Point(fromLonLat([p.longitude, p.latitude])),
        port: p,
      });
      f.setStyle(style);
      source.addFeature(f);
    }

    // Debug logs
    if (process.env.NODE_ENV !== 'production') {
    }
  }, [ports, showPorts, regionLayerRef, mapInstanceRef]);

  // Update icon size when zoom changes
  useEffect(() => {
    const map = mapInstanceRef?.current;
    const layer = portsLayerRef.current;
    if (!map || !layer) return;
    const source = layer.getSource();
    if (!source) return;

    const updateScale = () => {
      const z = map.getView().getZoom() ?? 6;
      const scale = Math.max(0.6, Math.min(1.6, 0.6 + (z - 4) * 0.12));
      const style = new Style({
        image: new Icon({
          src: '/port.svg',
          anchor: [0.5, 0.5],
          scale,
          color: '#6366f1',
        }),
      });
      for (const f of source.getFeatures()) {
        f.setStyle(style);
      }
      layer.changed();
      // Re-apply selected label if any
      const selected = lastSelectedRef.current;
      if (selected) {
        const p: any = (selected as any).get('port');
        const label = [p?.city, p?.state, p?.country]
          .filter(Boolean)
          .join(', ');
        (selected as any).setStyle(
          new Style({
            image: new Icon({
              src: '/port.svg',
              anchor: [0.5, 0.5],
              scale,
              color: '#6366f1',
            }),
            text: new Text({
              text: label,
              offsetY: -14,
              font: '12px sans-serif',
              fill: new Fill({ color: '#111827' }),
              stroke: new Stroke({ color: 'white', width: 3 }),
            }),
          }),
        );
      }
    };

    updateScale();
    map.getView().on('change:resolution', updateScale);
    return () => {
      map.getView().un('change:resolution', updateScale);
    };
  }, [mapInstanceRef]);

  // Click label for ports (hover removed)
  useEffect(() => {
    const map = mapInstanceRef?.current;
    const layer = portsLayerRef.current;
    if (!map || !layer) return;
    const source = layer.getSource();
    if (!source) return;

    const handleClick = (evt: any) => {
      if (!showPorts) return;
      let clicked: Feature<Point> | null = null;
      map.forEachFeatureAtPixel(
        evt.pixel,
        (f: any, lyr: any) => {
          if (lyr === layer) {
            clicked = f as Feature<Point>;
            return true;
          }
          return undefined;
        },
        { hitTolerance: 8 },
      );

      // Reset previous selection
      if (lastSelectedRef.current && lastSelectedRef.current !== clicked) {
        (lastSelectedRef.current as any).setStyle(
          new Style({
            image: new Icon({
              src: '/port.svg',
              anchor: [0.5, 0.5],
              scale: currentScaleRef.current,
              color: '#6366f1',
            }),
          }),
        );
      }

      if (clicked) {
        const p: any = (clicked as any).get('port');
        const label = [p?.city, p?.state, p?.country]
          .filter(Boolean)
          .join(', ');
        (clicked as any).setStyle(
          new Style({
            image: new Icon({
              src: '/port.svg',
              anchor: [0.5, 0.5],
              scale: currentScaleRef.current,
              color: '#6366f1',
            }),
            text: new Text({
              text: label,
              offsetY: -14,
              font: '12px sans-serif',
              fill: new Fill({ color: '#111827' }),
              stroke: new Stroke({ color: 'white', width: 3 }),
            }),
          }),
        );
      }
      lastSelectedRef.current = clicked;
    };

    if (showPorts) map.on('singleclick', handleClick);
    return () => {
      map.un('singleclick', handleClick);
    };
  }, [mapInstanceRef, showPorts]);
}
