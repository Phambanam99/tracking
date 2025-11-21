import { create } from 'zustand';
import api from '../services/apiClient';

// Vessel stale threshold: 24 hours
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// Prune interval: every 10 minutes
const PRUNE_INTERVAL_MS = 10 * 60 * 1000;

let pruneTimer: ReturnType<typeof setInterval> | null = null;

export interface VesselImage {
  id: number;
  url: string;
  caption?: string | null;
  source?: string | null;
  isPrimary: boolean;
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Vessel {
  id: number;
  mmsi: string;
  vesselName?: string;
  vesselType?: string;
  flag?: string;
  operator?: string;
  length?: number;
  width?: number;
  createdAt: Date;
  updatedAt: Date;
  lastPosition?: {
    id?: number;
    latitude: number;
    longitude: number;
    speed?: number;
    course?: number;
    heading?: number;
    status?: string;
    timestamp: Date;
  };
  images?: VesselImage[]; // Added images relation
  // Thời điểm cuối cùng nhận dữ liệu (tính theo Date.now())
  lastSeen?: number;
  // ✅ Prediction fields
  predicted?: boolean; // Is this position predicted?
  confidence?: number; // 0-1, prediction confidence
  timeSinceLastMeasurement?: number; // seconds since last real measurement
}

interface VesselStore {
  vessels: Vessel[];
  total?: number;
  page?: number;
  pageSize?: number;
  loading: boolean;
  error: string | null;
  setVessels: (vessels: Vessel[]) => void;
  updateVessel: (vessel: Vessel) => void;
  pruneStale: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchVessels: (
    page?: number,
    pageSize?: number,
    q?: string,
    hasSignal?: boolean,
    adv?: {
      operator?: string;
      vesselType?: string;
      flag?: string;
      minSpeed?: number;
      maxSpeed?: number;
    },
  ) => Promise<void>;
}

export const useVesselStore = create<VesselStore>((set, get) => ({
  vessels: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  error: null,
  setVessels: (vessels) => {
    const now = Date.now();
    set({
      vessels: vessels.map((v) => ({
        ...v,
        images: Array.isArray((v as any).images)
          ? (v as any).images
          : undefined,
        lastSeen: now,
        lastPosition: v.lastPosition
          ? { ...v.lastPosition, timestamp: new Date(v.lastPosition.timestamp) }
          : undefined,
      })),
    });
    // Force prune stale data immediately after setting new data
    setTimeout(() => get().pruneStale(), 0);
  },
  updateVessel: (incoming) =>
    set((state) => {
      const idx = state.vessels.findIndex((v) => v.id === incoming.id);
      // console.log('[Store] updateVessel:', incoming.mmsi, 'found:', idx !== -1);
      if (idx === -1) {
        return {
          vessels: [
            ...state.vessels,
            {
              ...incoming,
              images: Array.isArray((incoming as any).images)
                ? (incoming as any).images
                : undefined,
              lastSeen: Date.now(),
              lastPosition: incoming.lastPosition
                ? {
                    ...incoming.lastPosition,
                    timestamp: new Date(incoming.lastPosition.timestamp),
                  }
                : undefined,
            },
          ],
        };
      }
      const next = [...state.vessels];
      next[idx] = {
        ...next[idx],
        ...incoming,
        images: Array.isArray((incoming as any).images)
          ? (incoming as any).images
          : next[idx].images,
        lastSeen: Date.now(),
        lastPosition: incoming.lastPosition
          ? {
              ...incoming.lastPosition,
              timestamp: new Date(incoming.lastPosition.timestamp),
            }
          : next[idx].lastPosition,
      };
      return { vessels: next };
    }),

  pruneStale: () => {
    const now = Date.now();
    const before = get().vessels.length;
    const fresh = get().vessels.filter((v) =>
      v.lastSeen ? now - v.lastSeen <= STALE_THRESHOLD_MS : true,
    );
    if (fresh.length !== before) {
      set({ vessels: fresh });
    }
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  fetchVessels: async (
    page = 1,
    pageSize = 20,
    q?: string,
    hasSignal?: boolean,
    adv?: {
      operator?: string;
      vesselType?: string;
      flag?: string;
      minSpeed?: number;
      maxSpeed?: number;
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
        if (adv.vesselType) params.set('vesselType', adv.vesselType);
        if (adv.flag) params.set('flag', adv.flag);
        if (adv.minSpeed != null) params.set('minSpeed', String(adv.minSpeed));
        if (adv.maxSpeed != null) params.set('maxSpeed', String(adv.maxSpeed));
      }
      const result = await api.get(`/vessels?${params.toString()}`);
      const {
        data,
        total,
        page: currentPage,
        pageSize: currentPageSize,
      } = result ?? {};
      const arr = Array.isArray(data) ? data : [];
      // console.log(`Fetched vessels: ${JSON.stringify(arr, null, 2)}`);
      set({
        vessels: arr.map((v: any) => ({
          ...v,
          images: Array.isArray(v.images) ? v.images : undefined,
          lastSeen: Date.now(),
          lastPosition: v?.lastPosition
            ? {
                ...v.lastPosition,
                timestamp: new Date(v.lastPosition.timestamp),
              }
            : undefined,
        })),
        total: typeof total === 'number' ? total : 0,
        page: typeof currentPage === 'number' ? currentPage : page,
        pageSize:
          typeof currentPageSize === 'number' ? currentPageSize : pageSize,
        loading: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to fetch vessels',
        loading: false,
      });
    }
  },
}));

// Khởi động interval prune một lần khi module được import
if (!pruneTimer) {
  pruneTimer = setInterval(() => {
    try {
      useVesselStore.getState().pruneStale();
    } catch (_) {
      // ignore
    }
  }, PRUNE_INTERVAL_MS);
}

// Tuỳ chọn: expose hàm force prune ngay lập tức
export function forcePruneVessels() {
  useVesselStore.getState().pruneStale();
}
