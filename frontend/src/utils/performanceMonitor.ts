'use client';

/**
 * Performance monitoring utilities
 * Track API calls, cache hits, and performance metrics
 */

interface PerformanceMetrics {
  apiCalls: number;
  cacheHits: number;
  cacheMisses: number;
  totalResponseTime: number;
  errors: number;
  pageLoadTime?: number;
  largestContentfulPaint?: number;
  firstInputDelay?: number;
  cumulativeLayoutShift?: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    apiCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalResponseTime: 0,
    errors: 0,
  };

  private apiCallLog: Array<{
    endpoint: string;
    timestamp: number;
    duration: number;
    cached: boolean;
    error?: boolean;
  }> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.initWebVitals();
    }
  }

  private initWebVitals() {
    // Observe Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          this.metrics.largestContentfulPaint = lastEntry.renderTime || lastEntry.loadTime;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Observe First Input Delay (FID)
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.metrics.firstInputDelay = entry.processingStart - entry.startTime;
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Observe Cumulative Layout Shift (CLS)
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
              this.metrics.cumulativeLayoutShift = clsValue;
            }
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        console.warn('[PerformanceMonitor] Web Vitals observation failed:', e);
      }
    }

    // Track page load time
    window.addEventListener('load', () => {
      if (performance.timing) {
        this.metrics.pageLoadTime =
          performance.timing.loadEventEnd - performance.timing.navigationStart;
      }
    });
  }

  trackApiCall(endpoint: string, duration: number, cached: boolean, error = false) {
    this.metrics.apiCalls++;
    this.metrics.totalResponseTime += duration;

    if (cached) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }

    if (error) {
      this.metrics.errors++;
    }

    this.apiCallLog.push({
      endpoint,
      timestamp: Date.now(),
      duration,
      cached,
      error,
    });

    // Keep only last 100 calls
    if (this.apiCallLog.length > 100) {
      this.apiCallLog.shift();
    }
  }

  getCacheHitRate(): number {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;
  }

  getAverageResponseTime(): number {
    return this.metrics.apiCalls > 0
      ? this.metrics.totalResponseTime / this.metrics.apiCalls
      : 0;
  }

  getMetrics(): PerformanceMetrics & {
    cacheHitRate: number;
    averageResponseTime: number;
  } {
    return {
      ...this.metrics,
      cacheHitRate: this.getCacheHitRate(),
      averageResponseTime: this.getAverageResponseTime(),
    };
  }

  getRecentCalls(count = 20) {
    return this.apiCallLog.slice(-count);
  }

  logMetrics() {
    const metrics = this.getMetrics();
    console.group('📊 Performance Metrics');
    console.log('API Calls:', metrics.apiCalls);
    console.log('Cache Hit Rate:', `${metrics.cacheHitRate.toFixed(1)}%`);
    console.log('Average Response Time:', `${metrics.averageResponseTime.toFixed(0)}ms`);
    console.log('Errors:', metrics.errors);
    if (metrics.pageLoadTime) {
      console.log('Page Load Time:', `${metrics.pageLoadTime}ms`);
    }
    if (metrics.largestContentfulPaint) {
      console.log('LCP:', `${metrics.largestContentfulPaint.toFixed(0)}ms`);
    }
    if (metrics.firstInputDelay) {
      console.log('FID:', `${metrics.firstInputDelay.toFixed(0)}ms`);
    }
    if (metrics.cumulativeLayoutShift) {
      console.log('CLS:', metrics.cumulativeLayoutShift.toFixed(3));
    }
    console.groupEnd();
  }

  reset() {
    this.metrics = {
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalResponseTime: 0,
      errors: 0,
    };
    this.apiCallLog = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Log metrics every 60 seconds in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  setInterval(() => {
    performanceMonitor.logMetrics();
  }, 60000);
}
