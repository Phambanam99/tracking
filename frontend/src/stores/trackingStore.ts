import { create } from 'zustand';
import { useAuthStore } from './authStore';
import api from '../services/apiClient';

export interface TrackedItem {
  id: number;
  type: 'aircraft' | 'vessel';
  alias?: string | null;
  notes?: string | null;
  createdAt: Date;
  data: any;
}

export interface TrackingItem {
  id: number;
  type: 'aircraft' | 'vessel';
  alias?: string | null;
  notes?: string | null;
  createdAt: Date;
  data: any; // Aircraft or Vessel data
}

interface TrackingState {
  trackedItems: TrackingItem[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null; // Timestamp của lần fetch cuối

  // Actions
  fetchTrackedItems: (force?: boolean) => Promise<void>;
  trackItem: (
    type: 'aircraft' | 'vessel',
    id: number | string,
    alias?: string,
    notes?: string,
  ) => Promise<void>;
  untrackItem: (type: 'aircraft' | 'vessel', id: number | string) => Promise<void>;
  isTracking: (type: 'aircraft' | 'vessel', id: number | string) => boolean;
  getTrackingStats: () => {
    total: number;
    aircraftCount: number;
    vesselCount: number;
  };
}

const CACHE_DURATION_MS = 2 * 60 * 1000; // 2 minutes

export const useTrackingStore = create<TrackingState>((set, get) => ({
  trackedItems: [],
  loading: false,
  error: null,
  lastFetched: null,

  fetchTrackedItems: async (force = false) => {
    const { lastFetched, loading } = get();
    
    // Nếu đang loading, bỏ qua
    if (loading) return;
    
    // Nếu có cache còn mới và không force, bỏ qua
    if (!force && lastFetched && Date.now() - lastFetched < CACHE_DURATION_MS) {
      console.log('[TrackingStore] Using cached data');
      return;
    }

    set({ loading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      if (!authState.token) {
        throw new Error('No authentication token found');
      }

      const data = await api.get('/tracking');
      set({
        trackedItems: data.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
        })),
        loading: false,
        lastFetched: Date.now(),
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch tracked items',
        loading: false,
      });
    }
  },

  trackItem: async (
    type: 'aircraft' | 'vessel',
    id: number | string,
    alias?: string,
    notes?: string,
  ) => {
    try {
      const authState = useAuthStore.getState();
      if (!authState.token) {
        throw new Error('No authentication token found');
      }

      const endpoint = type === 'aircraft' ? `aircraft/${id}` : `vessel/${id}`;
      await api.post(`/tracking/${endpoint}`, { alias, notes });

      // Force refresh để có data mới nhất
      await get().fetchTrackedItems(true);
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : `Failed to track ${type}`,
      });
      throw error;
    }
  },

  untrackItem: async (type: 'aircraft' | 'vessel', id: number | string) => {
    try {
      const authState = useAuthStore.getState();
      if (!authState.token) {
        throw new Error('No authentication token found');
      }

      const endpoint = type === 'aircraft' ? `aircraft/${id}` : `vessel/${id}`;
      await api.delete(`/tracking/${endpoint}`);

      // Force refresh để có data mới nhất
      await get().fetchTrackedItems(true);
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : `Failed to untrack ${type}`,
      });
      throw error;
    }
  },

  isTracking: (type: 'aircraft' | 'vessel', id: number | string) => {
    const { trackedItems } = get();
    const idStr = String(id);
    const idNum = typeof id === 'number' ? id : parseInt(idStr, 10);

    return trackedItems.some((item) => {
      if (item.type !== type) return false;

      // Check by database ID
      if (item.data.id === idNum) return true;

      // For vessels, also check by MMSI
      if (type === 'vessel' && item.data.mmsi === idStr) return true;

      // For aircraft, also check by flightId
      if (type === 'aircraft' && item.data.flightId === idStr) return true;

      return false;
    });
  },

  getTrackingStats: () => {
    const { trackedItems } = get();
    const aircraftCount = trackedItems.filter(
      (item) => item.type === 'aircraft',
    ).length;
    const vesselCount = trackedItems.filter(
      (item) => item.type === 'vessel',
    ).length;

    return {
      total: trackedItems.length,
      aircraftCount,
      vesselCount,
    };
  },
}));
