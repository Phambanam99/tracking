/**
 * LRU Cache implementation for managing styles and images
 * Provides automatic cleanup based on usage patterns
 */

import { CacheConfig, StyleCacheEntry } from './types';

export class LRUCache<T> {
  private cache = new Map<string, { value: T; lastUsed: number; usageCount: number }>();
  private maxSize: number;
  private ttl?: number;

  constructor(config: CacheConfig) {
    this.maxSize = config.maxSize;
    this.ttl = config.ttl;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL if configured
    if (this.ttl && Date.now() - entry.lastUsed > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access time and count
    entry.lastUsed = Date.now();
    entry.usageCount++;
    
    return entry.value;
  }

  set(key: string, value: T): void {
    // Evict least recently used if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      lastUsed: Date.now(),
      usageCount: 1,
    });
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalUsage: entries.reduce((sum, e) => sum + e.usageCount, 0),
      averageUsage: entries.length > 0 
        ? entries.reduce((sum, e) => sum + e.usageCount, 0) / entries.length 
        : 0,
    };
  }

  /**
   * Cleanup expired entries based on TTL
   */
  cleanup(): number {
    if (!this.ttl) return 0;

    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastUsed > this.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/**
 * Create a cache key from parameters
 */
export function createCacheKey(...params: (string | number | boolean | undefined)[]): string {
  return params
    .filter(p => p !== undefined)
    .map(p => String(p))
    .join('|');
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let lastRan = 0;

  return function executedFunction(...args: Parameters<T>) {
    const now = Date.now();

    if (!lastRan) {
      func(...args);
      lastRan = now;
    } else {
      if (timeout) clearTimeout(timeout);
      
      timeout = setTimeout(
        () => {
          if (now - lastRan >= wait) {
            func(...args);
            lastRan = Date.now();
          }
        },
        wait - (now - lastRan)
      );
    }
  };
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}
