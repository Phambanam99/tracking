'use client';

import { useEffect } from 'react';
import { useTrackingStore } from '@/stores/trackingStore';

/**
 * Provider component to prefetch critical data at app level
 * This runs once when app mounts, not on every page navigation
 */
export function DataPrefetchProvider({ children }: { children: React.ReactNode }) {
  const { fetchTrackedItems } = useTrackingStore();

  useEffect(() => {
    // Fetch tracked items once on app mount
    // Will use cache if data is still fresh (< 2 minutes old)
    fetchTrackedItems().catch(() => {
      console.warn('[DataPrefetch] Failed to prefetch tracked items');
    });
  }, [fetchTrackedItems]);

  return <>{children}</>;
}
