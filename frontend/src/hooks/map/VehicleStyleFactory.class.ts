/**
 * Style factory class (non-hook version)
 * For use within useEffect or other non-hook contexts
 */

import { Style, Text, Fill, Stroke, Circle as CircleStyle, Icon } from 'ol/style';
import { VehicleTypeConfig } from './types';
import { LRUCache, createCacheKey } from './cache';

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
 * Style factory class (non-hook version for use in useEffect)
 */
export class VehicleStyleFactory {
  private config: VehicleTypeConfig;
  private clusterStyleCache: LRUCache<Style>;
  private iconStyleCache: LRUCache<Style>;
  private imageCache: Map<string, HTMLImageElement>;
  private tintCache: Map<string, HTMLCanvasElement>;

  constructor(config: VehicleTypeConfig) {
    this.config = config;
    this.clusterStyleCache = new LRUCache({ maxSize: CLUSTER_STYLE_CACHE_SIZE });
    this.iconStyleCache = new LRUCache({ maxSize: ICON_STYLE_CACHE_SIZE });
    this.imageCache = new Map();
    this.tintCache = new Map();
    
    // Preload image
    this.preloadImage(config.iconPath);
  }

  private preloadImage(src: string): void {
    if (this.imageCache.has(src)) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      console.log(`[StyleFactory] Loaded image: ${src}`);
      // Clear icon cache to force re-render
      this.iconStyleCache.clear();
    };
    img.src = src;
    this.imageCache.set(src, img);
  }

  private getTintedCanvas(color: string): HTMLCanvasElement | null {
    const key = createCacheKey(this.config.iconPath, color);
    
    const cached = this.tintCache.get(key);
    if (cached) return cached;

    const img = this.imageCache.get(this.config.iconPath);
    if (!img || !img.complete || img.naturalWidth === 0) {
      return null;
    }

    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
    if (!ctx) return null;

    const imgWidth = img.naturalWidth || size;
    const imgHeight = img.naturalHeight || size;
    const scale = Math.min(size / imgWidth, size / imgHeight);
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;
    const offsetX = (size - drawWidth) / 2;
    const offsetY = (size - drawHeight) / 2;

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';

    this.tintCache.set(key, canvas);
    return canvas;
  }

  createClusterStyle(styleConfig: ClusterStyleConfig): Style {
    const key = createCacheKey(
      styleConfig.sizeBucket,
      styleConfig.withText,
      styleConfig.color,
      styleConfig.type
    );

    const cached = this.clusterStyleCache.get(key);
    if (cached) return cached;

    let style: Style;

    if (this.config.type === 'vessel') {
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

    this.clusterStyleCache.set(key, style);
    return style;
  }

  createDotStyle(color: string): Style {
    const key = createCacheKey('dot', color);
    
    const cached = this.iconStyleCache.get(key);
    if (cached) return cached;

    const style = new Style({
      image: new CircleStyle({
        radius: 4,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: 'white', width: 1 }),
      }),
    });

    this.iconStyleCache.set(key, style);
    return style;
  }

  createIconStyle(headingDeg: number, identifier?: string): Style {
    const headingBucket = Math.round(headingDeg / HEADING_QUANTIZATION) * HEADING_QUANTIZATION;
    const color = this.config.getColor(identifier);
    const key = createCacheKey(headingBucket, color, this.config.type);

    const cached = this.iconStyleCache.get(key);
    if (cached) return cached;

    const tinted = this.getTintedCanvas(color);
    if (!tinted) {
      return this.createDotStyle(color);
    }

    const style = new Style({
      image: new Icon({
        img: tinted,
        scale: 0.9,
        rotation: (headingBucket * Math.PI) / 180,
        rotateWithView: true,
      } as any),
    });

    this.iconStyleCache.set(key, style);
    return style;
  }

  clearCache(): void {
    this.clusterStyleCache.clear();
    this.iconStyleCache.clear();
    this.tintCache.clear();
  }
}
