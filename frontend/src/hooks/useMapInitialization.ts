import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';

import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import Cluster from 'ol/source/Cluster'; // ✅ default import
// import { defaults as defaultControls, Attribution } from 'ol/control';
import {
  Style,
  Text,
  Fill,
  Stroke,
  Circle as CircleStyle,
  Icon,
} from 'ol/style';
import RegularShape from 'ol/style/RegularShape';
import { fromLonLat } from 'ol/proj';
import {
  getZoomFromResolution,
  getClusterDistance,
  shouldSimplifyIcons,
} from '../utils/mapUtils';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';

interface UseMapInitializationProps {
  mapRef: React.RefObject<HTMLDivElement | null>;
  mapInstanceRef: React.RefObject<Map | null>;
  aircraftLayerRef: React.RefObject<VectorLayer<any> | null>;
  vesselLayerRef: React.RefObject<VectorLayer<any> | null>;
  regionLayerRef: React.RefObject<VectorLayer<VectorSource> | null>;
}

export function useMapInitialization(
  props: Partial<UseMapInitializationProps> & {
    mapRef: React.RefObject<HTMLDivElement | null>;
    mapInstanceRef: React.RefObject<Map | null>;
  },
) {
  const {
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
    regionLayerRef,
  } = props;

  const { settings } = useSystemSettingsStore();
  const { baseMapProvider, maptilerStyle: userMaptilerStyle } =
    useUserPreferencesStore();

  // Track URLs for cleanup
  const urlRef = useRef<Set<string>>(new Set());
  // Preloaded base images and tinted canvas caches (for SVG coloring without Blob)
  const baseAircraftImgRef = useRef<HTMLImageElement | null>(null);
  const baseVesselImgRef = useRef<HTMLImageElement | null>(null);
  const aircraftTintCacheRef = useRef<{ [key: string]: HTMLCanvasElement }>({});
  const vesselTintCacheRef = useRef<{ [key: string]: HTMLCanvasElement }>({});

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const timer = setTimeout(() => {
      if (
        !mapRef.current ||
        mapRef.current.offsetWidth === 0 ||
        mapRef.current.offsetHeight === 0
      ) {
        console.error('Map container has no dimensions!');
        return;
      }

      // Sources
      const aircraftSource = new VectorSource();
      const vesselSource = new VectorSource();
      const regionSource = new VectorSource();

      // Enable/disable clustering via env (default: enabled)
      const clusterEnabled = settings.clusterEnabled;

      // Optimized clusters for large datasets (only if enabled)
      const aircraftCluster = clusterEnabled
        ? new Cluster({
            source: aircraftSource,
            distance: 60,
            minDistance: 20,
          })
        : null;
      const vesselCluster = clusterEnabled
        ? new Cluster({
            source: vesselSource,
            distance: 60,
            minDistance: 20,
          })
        : null;

      // Style caches to avoid repeated object allocations
      const clusterStyleCacheAircraft: Record<string, Style> = {};
      const clusterStyleCacheVessel: Record<string, Style> = {};

      // Icon cache with lazy loading to prevent performance issues
      const iconCacheAircraft: Record<string, Style> = {};
      const iconCacheVessel: Record<string, Style> = {};

      // Ensure base SVGs are preloaded from public/
      const ensureBaseImagesLoaded = () => {
        if (!baseAircraftImgRef.current) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = '/aircraft-icon.svg';
          baseAircraftImgRef.current = img;
        }
        if (!baseVesselImgRef.current) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = '/vessel-icon.svg';
          baseVesselImgRef.current = img;
        }
      };
      ensureBaseImagesLoaded();

      const getTintedCanvas = (
        img: HTMLImageElement,
        color: string,
        cache: { [key: string]: HTMLCanvasElement },
      ): HTMLCanvasElement | null => {
        const key = color.toUpperCase();
        const cached = cache[key];
        if (cached) return cached;
        if (!img || !img.complete || img.naturalWidth === 0) return null;
        const size = Math.max(img.naturalWidth, img.naturalHeight) || 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', {
          // Hint for browsers when frequent readbacks/blending occur
          willReadFrequently: true,
        } as any) as CanvasRenderingContext2D | null;
        if (!ctx) return null;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        ctx.globalCompositeOperation = 'source-in';
        (ctx as CanvasRenderingContext2D).fillStyle = color;
        ctx.fillRect(0, 0, size, size);
        ctx.globalCompositeOperation = 'source-over';
        cache[key] = canvas;
        return canvas;
      };

      const getClusterStyleAircraft = (
        sizeBucket: number,
        withText: boolean,
      ): Style => {
        const key = `${sizeBucket}-${withText ? 't' : 'n'}`;
        if (!clusterStyleCacheAircraft[key]) {
          clusterStyleCacheAircraft[key] = new Style({
            image: new CircleStyle({
              radius: Math.min(15 + sizeBucket * 2, 30),
              fill: new Fill({ color: 'rgba(59,130,246,0.8)' }),
              stroke: new Stroke({ color: 'white', width: 2 }),
            }),
            text: withText
              ? new Text({
                  text: String(sizeBucket),
                  fill: new Fill({ color: 'white' }),
                  font: 'bold 12px sans-serif',
                })
              : undefined,
          });
        }
        return clusterStyleCacheAircraft[key];
      };

      // const getSingleDotStyleAircraft = (): Style => {
      //   const key = 'dot';
      //   if (!singleDotStyleAircraft[key]) {
      //     singleDotStyleAircraft[key] = new Style({
      //       image: new CircleStyle({
      //         radius: 4,
      //         fill: new Fill({ color: 'rgba(59,130,246,0.9)' }),
      //         stroke: new Stroke({ color: 'white', width: 1 }),
      //       }),
      //     });
      //   }
      //   return singleDotStyleAircraft[key];
      // };

      const getIconStyleAircraft = (
        headingDeg: number,
        operator?: string,
      ): Style => {
        // Quantize heading to reduce style variants
        const headingBucket = Math.round(headingDeg / 15) * 15; // 15° buckets
        const color =
          (operator &&
            settings.aircraftOperatorColors[operator.toUpperCase()]) ||
          '#2563eb';
        const key = `${headingBucket}-${color}`;
        if (iconCacheAircraft[key]) return iconCacheAircraft[key];

        // Try to build tinted canvas based on user's SVG icon
        const baseImg = baseAircraftImgRef.current;
        const tinted = baseImg
          ? getTintedCanvas(baseImg, color, aircraftTintCacheRef.current)
          : null;
        if (!tinted) {
          // Fallback to vector shape until image is ready
          return new Style({
            image: new RegularShape({
              points: 3,
              radius: 10,
              rotation: (headingBucket * Math.PI) / 180,
              fill: new Fill({ color }),
              stroke: new Stroke({ color: 'white', width: 1.5 }),
            }),
          });
        }
        const style = new Style({
          image: new Icon({
            img: tinted,
            scale: 0.9,
            rotation: (headingBucket * Math.PI) / 180,
            rotateWithView: true,
          } as any),
        });
        iconCacheAircraft[key] = style;
        return style;
      };

      // Style function nên dùng resolution (không truy cập map ở đây)
      const aircraftVectorStyle: import('ol/style/Style').StyleFunction = (
        feature,
        resolution,
      ) => {
        const zoom = getZoomFromResolution(resolution);
        const clusterMembers = feature.get('features') as any[] | undefined;

        if (clusterEnabled) {
          if (!clusterMembers || !Array.isArray(clusterMembers))
            return new Style();
          const size = clusterMembers.length;
          if (size > 1) {
            const bucket = Math.min(99, Math.max(2, size));
            const showText = zoom > 6;
            return getClusterStyleAircraft(bucket, showText);
          }

          if (shouldSimplifyIcons(zoom)) {
            const ac = clusterMembers[0]?.get('aircraft');
            return new Style({
              image: new CircleStyle({
                radius: 4,
                fill: new Fill({
                  color:
                    settings.aircraftOperatorColors[
                      ((ac?.operator as string) || '').toUpperCase()
                    ] || 'rgba(59,130,246,0.9)',
                }),
                stroke: new Stroke({ color: 'white', width: 1 }),
              }),
            });
          }

          const ac = clusterMembers[0]?.get('aircraft');
          const heading = ac?.lastPosition?.heading || 0;
          const headingKey = Math.round(heading / 5) * 5;
          const operator = ac?.operator as string;
          return getIconStyleAircraft(headingKey, operator);
        }

        // Non-clustered: feature itself is the point with 'aircraft'
        const ac = feature.get('aircraft');
        if (!ac) return new Style();
        if (shouldSimplifyIcons(zoom)) {
          return new Style({
            image: new CircleStyle({
              radius: 4,
              fill: new Fill({
                color:
                  settings.aircraftOperatorColors[
                    ((ac?.operator as string) || '').toUpperCase()
                  ] || 'rgba(59,130,246,0.9)',
              }),
              stroke: new Stroke({ color: 'white', width: 1 }),
            }),
          });
        }
        const heading = ac?.lastPosition?.heading || 0;
        const headingKey = Math.round(heading / 5) * 5;
        const operator = ac?.operator as string;
        return getIconStyleAircraft(headingKey, operator);
      };

      const getClusterStyleVessel = (
        sizeBucket: number,
        withText: boolean,
      ): Style => {
        const key = `${sizeBucket}-${withText ? 't' : 'n'}`;
        if (!clusterStyleCacheVessel[key]) {
          // Scale icon by cluster size bucket (bounded)
          // 0.8 -> 1.3
          clusterStyleCacheVessel[key] = new Style({
            image: new Icon({
              src: '/vessel-cluster.svg',
              anchor: [0.5, 0.5],
            }),
            text: withText
              ? new Text({
                  text: String(sizeBucket),
                  fill: new Fill({ color: 'white' }),
                  font: 'bold 12px sans-serif',
                  offsetY: 0,
                })
              : undefined,
          });
        }
        return clusterStyleCacheVessel[key];
      };

      // const getSingleDotStyleVessel = (): Style => {
      //   const key = 'dot';
      //   if (!singleDotStyleVessel[key]) {
      //     singleDotStyleVessel[key] = new Style({
      //       image: new CircleStyle({
      //         radius: 4,
      //         fill: new Fill({ color: 'rgba(34,197,94,0.9)' }),
      //         stroke: new Stroke({ color: 'white', width: 1 }),
      //       }),
      //     });
      //   }
      //   return singleDotStyleVessel[key];
      // };

      const getIconStyleVessel = (headingDeg: number, flag?: string): Style => {
        const headingBucket = Math.round(headingDeg / 15) * 15;
        const color =
          (flag && settings.vesselFlagColors[flag.toUpperCase()]) || '#10b981';
        const key = `${headingBucket}-${color}`;
        if (iconCacheVessel[key]) return iconCacheVessel[key];

        const baseImg = baseVesselImgRef.current;
        const tinted = baseImg
          ? getTintedCanvas(baseImg, color, vesselTintCacheRef.current)
          : null;
        if (!tinted) {
          // Fallback to vector shape until image is ready
          return new Style({
            image: new RegularShape({
              points: 4,
              radius: 9,
              angle: Math.PI / 4,
              rotation: (headingBucket * Math.PI) / 180,
              fill: new Fill({ color }),
              stroke: new Stroke({ color: 'white', width: 1.5 }),
            }),
          });
        }
        const style = new Style({
          image: new Icon({
            img: tinted,
            scale: 0.9,
            rotation: (headingBucket * Math.PI) / 180,
            rotateWithView: true,
          } as any),
        });
        iconCacheVessel[key] = style;
        return style;
      };

      let vesselStyleCallCount = 0;
      const vesselVectorStyle: import('ol/style/Style').StyleFunction = (
        feature,
        resolution,
      ) => {
        vesselStyleCallCount++;
        if (vesselStyleCallCount === 1) {
          console.log(
            '[VesselStyle] First call - clusterEnabled:',
            clusterEnabled,
            'feature:',
            feature,
          );
        }
        const zoom = getZoomFromResolution(resolution);
        const clusterMembers = feature.get('features') as any[] | undefined;

        if (clusterEnabled) {
          if (!clusterMembers || !Array.isArray(clusterMembers)) {
            console.warn(
              '[VesselStyle] No cluster members for feature:',
              feature,
            );
            return new Style();
          }
          const size = clusterMembers.length;
          if (size > 1) {
            const bucket = Math.min(99, Math.max(2, size));
            const showText = zoom > 6;
            return getClusterStyleVessel(bucket, showText);
          }

          if (shouldSimplifyIcons(zoom)) {
            const vs = clusterMembers[0]?.get('vessel');
            return new Style({
              image: new CircleStyle({
                radius: 4,
                fill: new Fill({
                  color:
                    settings.vesselFlagColors[
                      ((vs?.flag as string) || '').toUpperCase()
                    ] || 'rgba(34,197,94,0.9)',
                }),
                stroke: new Stroke({ color: 'white', width: 1 }),
              }),
            });
          }

          const vs = clusterMembers[0]?.get('vessel');
          if (!vs) {
            console.warn('[VesselStyle] No vessel data in cluster member');
            return new Style();
          }
          const heading = vs?.lastPosition?.heading || 0;
          const headingKey = Math.round(heading / 5) * 5;
          const flag = vs?.flag as string;
          return getIconStyleVessel(headingKey, flag);
        }

        // Non-clustered
        const vs = feature.get('vessel');
        if (!vs) return new Style();
        if (shouldSimplifyIcons(zoom)) {
          return new Style({
            image: new CircleStyle({
              radius: 4,
              fill: new Fill({
                color:
                  settings.vesselFlagColors[
                    ((vs?.flag as string) || '').toUpperCase()
                  ] || 'rgba(34,197,94,0.9)',
              }),
              stroke: new Stroke({ color: 'white', width: 1 }),
            }),
          });
        }
        const heading = vs?.lastPosition?.heading || 0;
        const headingKey = Math.round(heading / 5) * 5;
        const flag = vs?.flag as string;
        return getIconStyleVessel(headingKey, flag);
      };

      const aircraftLayer = new VectorLayer({
        source: aircraftCluster ?? aircraftSource,
        style: aircraftVectorStyle,
        declutter: false,
        renderBuffer: 32,
        updateWhileAnimating: false,
        updateWhileInteracting: false,
      });

      const vesselLayer = new VectorLayer({
        source: vesselCluster ?? vesselSource,
        style: vesselVectorStyle,
        declutter: false,
        renderBuffer: 32,
        updateWhileAnimating: false,
        updateWhileInteracting: false,
      });

      const regionLayer = new VectorLayer({
        source: regionSource,
        style: new Style({
          stroke: new Stroke({ color: 'rgba(255,0,0,0.8)', width: 2 }),
          fill: new Fill({ color: 'rgba(255,0,0,0.1)' }),
        }),
      });

      // WebGL disabled completely due to persistent renderer issues - using vector layers only

      // Base layer selection (OSM, MapTiler, or custom) with user preference override
      const maptilerStyleMap: Record<string, string> = {
        streets: 'streets-v2',
        outdoor: 'outdoor-v2',
        satellite: 'satellite',
        topo: 'topo-v2',
        terrain: 'terrain',
        bright: 'bright-v2',
        basic: 'basic-v2',
      };
      // On initial mount, follow system default only. User preference updates are handled in a separate effect.
      const effectiveProvider = settings.mapProvider;
      const styleKey = (settings.maptilerStyle || 'streets').toLowerCase();
      const styleId =
        maptilerStyleMap[styleKey] || settings.maptilerStyle || 'streets-v2';
      const makeBaseSource = () => {
        if (effectiveProvider === 'maptiler' && settings.maptilerApiKey) {
          return new XYZ({
            url: `https://api.maptiler.com/maps/${styleId}/256/{z}/{x}/{y}.png?key=${settings.maptilerApiKey}`,
            attributions:
              'Map data © OpenStreetMap contributors, Imagery © MapTiler',
            maxZoom: settings.maxZoom,
          });
        }
        return new OSM();
      };
      const baseLayer = new TileLayer({ source: makeBaseSource() });

      // Map (giữ Attribution hợp lệ cho OSM)
      const map = new Map({
        target: mapRef.current!,
        pixelRatio: 1,

        layers: [baseLayer, aircraftLayer, vesselLayer, regionLayer],
        view: new View({
          center: fromLonLat([108.2194, 16.0544]), // VN center
          zoom: Math.max(settings.minZoom, Math.min(settings.maxZoom, 6)),
          minZoom: settings.minZoom,
          maxZoom: settings.maxZoom,
        }),
      });

      // Zoom-based adjustments (cluster distance + toggle layers)
      const updateByZoom = () => {
        const z = map.getView().getZoom() ?? 6;

        if (clusterEnabled) {
          const dist = getClusterDistance(z);
          aircraftCluster?.setDistance(dist);
          vesselCluster?.setDistance(dist);
        }

        // WebGL disabled - always use vector layers
        aircraftLayer.setVisible(true);
        vesselLayer.setVisible(true);
      };

      updateByZoom();
      map.getView().on('change:resolution', updateByZoom);

      // Lưu ref
      mapInstanceRef.current = map;
      if (aircraftLayerRef) aircraftLayerRef.current = aircraftLayer as any;
      if (vesselLayerRef) vesselLayerRef.current = vesselLayer as any;
      if (regionLayerRef) regionLayerRef.current = regionLayer as any;
      // expose map instance via custom property for sibling hooks
      try {
        (regionLayer as any).set?.('map', map);
      } catch {}
      // Keep a reference to base layer for dynamic updates
      try {
        if (typeof (map as any).set === 'function') {
          (map as any).set('baseLayer', baseLayer);
        }
      } catch {}

      // ensure size cập nhật sau mount
      const updateMapSize = () => {
        map.updateSize();
        if (!map.getSize()) setTimeout(updateMapSize, 50);
      };
      setTimeout(updateMapSize, 100);
    }, 50);

    const urlSetSnapshot = new Set(urlRef.current);
    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined);
      }
      // Cleanup object URLs to prevent memory leaks
      const urls = Array.from(urlSetSnapshot);
      urls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
    regionLayerRef,
    settings.clusterEnabled,
    settings.minZoom,
    settings.maxZoom,
    settings.aircraftOperatorColors,
    settings.vesselFlagColors,
    settings.mapProvider,
    settings.maptilerApiKey,
    settings.maptilerStyle,
  ]);

  // Update base layer when settings or user preference change after map is initialized
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const baseLayer: any = (map as any).get?.('baseLayer');
    if (!baseLayer) return;

    const maptilerStyleMap: Record<string, string> = {
      streets: 'streets-v2',
      outdoor: 'outdoor-v2',
      satellite: 'satellite',
      topo: 'topo-v2',
      terrain: 'terrain',
      bright: 'bright-v2',
      basic: 'basic-v2',
    };
    const effectiveProvider =
      baseMapProvider === 'default'
        ? settings.mapProvider
        : baseMapProvider.startsWith('custom:')
        ? 'custom'
        : baseMapProvider;
    const styleKey = (
      (baseMapProvider === 'default'
        ? settings.maptilerStyle
        : userMaptilerStyle) || 'streets'
    ).toLowerCase();
    const styleId =
      maptilerStyleMap[styleKey] || settings.maptilerStyle || 'streets-v2';

    const getSource = () => {
      if (effectiveProvider === 'maptiler' && settings.maptilerApiKey) {
        return new XYZ({
          url: `https://api.maptiler.com/maps/${styleId}/256/{z}/{x}/{y}.png?key=${settings.maptilerApiKey}`,
          attributions:
            'Map data © OpenStreetMap contributors, Imagery © MapTiler',
          maxZoom: settings.maxZoom,
        });
      }
      if (
        effectiveProvider === 'custom' &&
        baseMapProvider.startsWith('custom:')
      ) {
        const id = baseMapProvider.slice('custom:'.length);
        const src = (settings.customMapSources || []).find((s) => s.id === id);
        if (src) {
          return new XYZ({
            url: src.urlTemplate,
            attributions: src.attribution || '',
            maxZoom: src.maxZoom ?? settings.maxZoom,
          });
        }
      }
      return new OSM();
    };

    baseLayer.setSource(getSource());
  }, [
    settings.mapProvider,
    settings.maptilerApiKey,
    settings.maptilerStyle,
    settings.customMapSources,
    settings.maxZoom,
    baseMapProvider,
    userMaptilerStyle,
    mapInstanceRef,
  ]);
}
