/**
 * Icon cache and tinting system
 * Manages SVG loading, caching, and color tinting
 */

import { useRef, useCallback, useEffect } from 'react';
import { ImageCacheEntry } from './types';
import { LRUCache, createCacheKey } from './cache';

const CANVAS_SIZE = 24;
const TINT_CACHE_MAX_SIZE = 200;
const IMAGE_CACHE_MAX_SIZE = 10;

/**
 * Hook for managing icon images and tinted canvases
 */
export function useIconCache() {
  // Image cache: base SVG images
  const imageCache = useRef<Map<string, ImageCacheEntry>>(new Map());
  
  // Tinted canvas cache: colored versions of icons
  const tintCache = useRef<LRUCache<HTMLCanvasElement>>(
    new LRUCache({ maxSize: TINT_CACHE_MAX_SIZE })
  );

  /**
   * Load an image with promise-based API
   */
  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const cached = imageCache.current.get(src);
      
      if (cached?.isLoaded && cached.image.complete) {
        resolve(cached.image);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const entry = imageCache.current.get(src);
        if (entry) {
          entry.isLoaded = true;
          entry.callbacks.forEach(cb => cb());
          entry.callbacks = [];
        }
        resolve(img);
      };

      img.onerror = () => {
        imageCache.current.delete(src);
        reject(new Error(`Failed to load image: ${src}`));
      };

      img.src = src;

      // Cache the loading image
      if (!cached) {
        imageCache.current.set(src, {
          image: img,
          isLoaded: false,
          callbacks: [],
        });
      }
    });
  }, []);

  /**
   * Get or create a tinted canvas
   */
  const getTintedCanvas = useCallback(
    (
      img: HTMLImageElement,
      color: string,
      iconPath: string
    ): HTMLCanvasElement | null => {
      const key = createCacheKey(iconPath, color);
      
      // Check cache first
      const cached = tintCache.current.get(key);
      if (cached) return cached;

      // Validate image is ready
      if (!img || !img.complete || img.naturalWidth === 0) {
        return null;
      }

      // Create tinted canvas
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;

      const ctx = canvas.getContext('2d', {
        willReadFrequently: true,
      } as any) as CanvasRenderingContext2D | null;

      if (!ctx) return null;

      // Calculate scaling to fit canvas while maintaining aspect ratio
      const imgWidth = img.naturalWidth || CANVAS_SIZE;
      const imgHeight = img.naturalHeight || CANVAS_SIZE;
      const scale = Math.min(CANVAS_SIZE / imgWidth, CANVAS_SIZE / imgHeight);
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;
      const offsetX = (CANVAS_SIZE - drawWidth) / 2;
      const offsetY = (CANVAS_SIZE - drawHeight) / 2;

      // Draw and tint
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.globalCompositeOperation = 'source-over';

      // Cache the result
      tintCache.current.set(key, canvas);

      return canvas;
    },
    []
  );

  /**
   * Preload an image
   */
  const preloadImage = useCallback(
    (src: string, onLoad?: () => void): void => {
      const cached = imageCache.current.get(src);
      
      if (cached?.isLoaded) {
        onLoad?.();
        return;
      }

      if (cached && !cached.isLoaded) {
        if (onLoad) cached.callbacks.push(onLoad);
        return;
      }

      loadImage(src).then(() => onLoad?.()).catch(console.error);
    },
    [loadImage]
  );

  /**
   * Get a loaded image or null if not ready
   */
  const getImage = useCallback((src: string): HTMLImageElement | null => {
    const cached = imageCache.current.get(src);
    return cached?.isLoaded ? cached.image : null;
  }, []);

  /**
   * Clear all caches
   */
  const clearCache = useCallback(() => {
    imageCache.current.clear();
    tintCache.current.clear();
  }, []);

  /**
   * Get cache statistics
   */
  const getCacheStats = useCallback(() => {
    return {
      images: {
        total: imageCache.current.size,
        loaded: Array.from(imageCache.current.values()).filter(e => e.isLoaded).length,
      },
      tintedCanvases: tintCache.current.getStats(),
    };
  }, []);

  /**
   * Periodic cleanup
   */
  useEffect(() => {
    const interval = setInterval(() => {
      tintCache.current.cleanup();
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);

  return {
    loadImage,
    preloadImage,
    getImage,
    getTintedCanvas,
    clearCache,
    getCacheStats,
  };
}
