import { create } from 'zustand';
import api from '../services/apiClient';

// Batch update mechanism to reduce re-renders
let updateQueue: Aircraft[] = [];
let batchTimer: NodeJS.Timeout | null = null;

// Stale aircraft threshold: 2 hours
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

// Prune interval: every 5 minutes
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;

let pruneTimer: ReturnType<typeof setInterval> | null = null;

export interface Aircraft {
  id: number;
  flightId: string;
  callSign?: string;
  registration?: string;
  aircraftType?: string;
  operator?: string;
  createdAt: Date;
  updatedAt: Date;
  lastSeen?: number; // Client-side timestamp for pruning stale data
  lastPosition?: {
    id?: number;
    latitude: number;
    longitude: number;
    altitude?: number;
    speed?: number;
    heading?: number;
    timestamp: Date;
  };
  images?: Array<{
    id: number;
    url: string;
    caption?: string | null;
    source?: string | null;
    isPrimary: boolean;
    order: number;
  }>;
}

interface AircraftStore {
  aircrafts: Aircraft[];
  total?: number;
  page?: number;
  pageSize?: number;
  loading: boolean;
  error: string | null;
  setAircrafts: (aircrafts: Aircraft[]) => void;
  updateAircraft: (aircraft: Aircraft) => void;
  pruneStale: () => void; // Remove aircraft without signal in last 10 minutes
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchAircrafts: (
    page?: number,
    pageSize?: number,
    q?: string,
    hasSignal?: boolean,
    adv?: {
      operator?: string;
      aircraftType?: string;
      registration?: string;
      callSign?: string;
      minSpeed?: number;
      maxSpeed?: number;
      minAltitude?: number;
      maxAltitude?: number;
    },
  ) => Promise<void>;
}

export const useAircraftStore = create<AircraftStore>((set, get) => ({
  aircrafts: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  error: null,
  setAircrafts: (aircrafts) => {
    const now = Date.now();
    set({
      aircrafts: aircrafts.map((a: any) => ({
        ...a,
        images: Array.isArray(a.images) ? a.images : undefined,
        lastSeen: now,
      })),
    });
    // Force prune stale data immediately after setting new data
    setTimeout(() => get().pruneStale(), 0);
  },
  updateAircraft: (incoming) =>
    set((state) => {
      const idx = state.aircrafts.findIndex((a) => a.id === incoming.id);
      // console.log('[Store] updateAircraft:', incoming.flightId, 'found:', idx !== -1);
      if (idx === -1) {
        return {
          aircrafts: [
            ...state.aircrafts,
            {
              ...incoming,
              images: Array.isArray((incoming as any).images)
                ? (incoming as any).images
                : undefined,
              lastSeen: Date.now(),
            },
          ],
        };
      }
      const next = [...state.aircrafts];
      next[idx] = {
        ...next[idx],
        ...incoming,
        images: Array.isArray((incoming as any).images)
          ? (incoming as any).images
          : next[idx].images,
        lastSeen: Date.now(),
      };
      return { aircrafts: next };
    }),

  pruneStale: () => {
    const now = Date.now();
    const before = get().aircrafts.length;
    const fresh = get().aircrafts.filter((a) =>
      a.lastSeen ? now - a.lastSeen <= STALE_THRESHOLD_MS : true,
    );
    if (fresh.length !== before) {
      set({ aircrafts: fresh });
    }
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  fetchAircrafts: async (
    page = 1,
    pageSize = 20,
    q?: string,
    hasSignal?: boolean,
    adv?: {
      operator?: string;
      aircraftType?: string;
      registration?: string;
      callSign?: string;
      minSpeed?: number;
      maxSpeed?: number;
      minAltitude?: number;
      maxAltitude?: number;
    },
  ) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (q && q.trim()) params.set('q', q.trim());
      if (typeof hasSignal === 'boolean')
        params.set('hasSignal', String(hasSignal));
      if (adv) {
        if (adv.operator) params.set('operator', adv.operator);
        if (adv.aircraftType) params.set('aircraftType', adv.aircraftType);
        if (adv.registration) params.set('registration', adv.registration);
        if (adv.callSign) params.set('callSign', adv.callSign);
        if (adv.minSpeed != null) params.set('minSpeed', String(adv.minSpeed));
        if (adv.maxSpeed != null) params.set('maxSpeed', String(adv.maxSpeed));
        if (adv.minAltitude != null)
          params.set('minAltitude', String(adv.minAltitude));
        if (adv.maxAltitude != null)
          params.set('maxAltitude', String(adv.maxAltitude));
      }
      const result = await api.get(`/aircrafts?${params.toString()}`);
      const {
        data,
        total,
        page: currentPage,
        pageSize: currentPageSize,
      } = result ?? {};
      set({
        aircrafts: Array.isArray(data)
          ? data.map((a: any) => ({
              ...a,
              images: Array.isArray(a.images) ? a.images : undefined,
            }))
          : [],
        total: typeof total === 'number' ? total : 0,
        page: typeof currentPage === 'number' ? currentPage : page,
        pageSize:
          typeof currentPageSize === 'number' ? currentPageSize : pageSize,
        loading: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to fetch aircrafts',
        loading: false,
      });
    }
  },
}));

// Start pruning interval once when module is imported
if (!pruneTimer) {
  pruneTimer = setInterval(() => {
    try {
      useAircraftStore.getState().pruneStale();
    } catch (_) {
      // ignore
    }
  }, PRUNE_INTERVAL_MS);
}

// Optional: expose force prune function
export function forcePruneAircrafts() {
  useAircraftStore.getState().pruneStale();
}
