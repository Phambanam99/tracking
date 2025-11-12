/**
 * Style factory for creating cluster and icon styles
 * Implements caching and memoization for performance
 */

import { useRef, useCallback } from 'react';
import { Style, Text, Fill, Stroke, Circle as CircleStyle, Icon } from 'ol/style';
import { VehicleTypeConfig } from './types';
import { LRUCache, createCacheKey } from './cache';
import { useIconCache } from './useIconCache';

const CLUSTER_STYLE_CACHE_SIZE = 100;
const ICON_STYLE_CACHE_SIZE = 500;
const HEADING_QUANTIZATION = 15; // degrees

interface ClusterStyleConfig {
  sizeBucket: number;
  withText: boolean;
  color: string;
  type: 'aircraft' | 'vessel';
}

/**
 * Hook for creating and caching vehicle styles
 */
export function useVehicleStyleFactory(config: VehicleTypeConfig) {
  const iconCache = useIconCache();
  
  const clusterStyleCache = useRef<LRUCache<Style>>(
    new LRUCache({ maxSize: CLUSTER_STYLE_CACHE_SIZE })
  );
  
  const iconStyleCache = useRef<LRUCache<Style>>(
    new LRUCache({ maxSize: ICON_STYLE_CACHE_SIZE })
  );

  /**
   * Create cluster style with proper caching
   */
  const createClusterStyle = useCallback(
    (styleConfig: ClusterStyleConfig): Style => {
      const key = createCacheKey(
        styleConfig.sizeBucket,
        styleConfig.withText,
        styleConfig.color,
        styleConfig.type
      );

      const cached = clusterStyleCache.current.get(key);
      if (cached) return cached;

      let style: Style;

      if (config.type === 'vessel') {
        // Vessel cluster uses custom SVG icon
        style = new Style({
          image: new Icon({
            src: '/vessel-cluster.svg',
            anchor: [0.5, 0.5],
          }),
          text: styleConfig.withText
            ? new Text({
                text: String(styleConfig.sizeBucket),
                fill: new Fill({ color: 'white' }),
                font: 'bold 12px sans-serif',
                offsetY: 0,
              })
            : undefined,
        });
      } else {
        // Aircraft and other types use circle
        const radius = Math.min(15 + styleConfig.sizeBucket * 2, 30);
        style = new Style({
          image: new CircleStyle({
            radius,
            fill: new Fill({ color: styleConfig.color }),
            stroke: new Stroke({ color: 'white', width: 2 }),
          }),
          text: styleConfig.withText
            ? new Text({
                text: String(styleConfig.sizeBucket),
                fill: new Fill({ color: 'white' }),
                font: 'bold 12px sans-serif',
              })
            : undefined,
        });
      }

      clusterStyleCache.current.set(key, style);
      return style;
    },
    [config.type]
  );

  /**
   * Create simple dot style for simplified rendering
   */
  const createDotStyle = useCallback(
    (color: string): Style => {
      const key = createCacheKey('dot', color);
      
      const cached = iconStyleCache.current.get(key);
      if (cached) return cached;

      const style = new Style({
        image: new CircleStyle({
          radius: 4,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: 'white', width: 1 }),
        }),
      });

      iconStyleCache.current.set(key, style);
      return style;
    },
    []
  );

  /**
   * Create icon style with rotation and color
   */
  const createIconStyle = useCallback(
    (headingDeg: number, identifier?: string): Style => {
      // Quantize heading to reduce cache entries
      const headingBucket = Math.round(headingDeg / HEADING_QUANTIZATION) * HEADING_QUANTIZATION;
      const color = config.getColor(identifier);
      const key = createCacheKey(headingBucket, color, config.type);

      const cached = iconStyleCache.current.get(key);
      if (cached) return cached;

      // Try to get loaded image
      const baseImg = iconCache.getImage(config.iconPath);
      const isImageReady = baseImg && baseImg.complete && baseImg.naturalWidth > 0;

      // Get or create tinted canvas
      const tinted = isImageReady
        ? iconCache.getTintedCanvas(baseImg, color, config.iconPath)
        : null;

      if (!tinted) {
        // Fallback to dot if image not ready
        if (baseImg && !baseImg.complete) {
          // Schedule retry when image loads
          iconCache.preloadImage(config.iconPath, () => {
            iconStyleCache.current.delete(key);
          });
        }
        return createDotStyle(color);
      }

      // Create icon style with rotation
      const style = new Style({
        image: new Icon({
          img: tinted,
          scale: 0.9,
          rotation: (headingBucket * Math.PI) / 180,
          rotateWithView: true,
        } as any),
      });

      iconStyleCache.current.set(key, style);
      return style;
    },
    [config, iconCache, createDotStyle]
  );

  /**
   * Clear all style caches
   */
  const clearCache = useCallback(() => {
    clusterStyleCache.current.clear();
    iconStyleCache.current.clear();
    iconCache.clearCache();
  }, [iconCache]);

  /**
   * Get cache statistics
   */
  const getCacheStats = useCallback(() => {
    return {
      clusterStyles: clusterStyleCache.current.getStats(),
      iconStyles: iconStyleCache.current.getStats(),
      icons: iconCache.getCacheStats(),
    };
  }, [iconCache]);

  return {
    createClusterStyle,
    createDotStyle,
    createIconStyle,
    clearCache,
    getCacheStats,
  };
}
