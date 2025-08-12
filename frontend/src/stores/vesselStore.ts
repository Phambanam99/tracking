import { create } from 'zustand';
import api from '../services/apiClient';

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
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchVessels: (page?: number, pageSize?: number, q?: string) => Promise<void>;
}

export const useVesselStore = create<VesselStore>((set) => ({
  vessels: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  error: null,
  setVessels: (vessels) => set({ vessels }),
  updateVessel: (incoming) =>
    set((state) => {
      const idx = state.vessels.findIndex((v) => v.id === incoming.id);
      if (idx === -1) {
        return { vessels: [...state.vessels, incoming] };
      }
      const next = [...state.vessels];
      next[idx] = { ...next[idx], ...incoming };
      return { vessels: next };
    }),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  fetchVessels: async (page = 1, pageSize = 20, q?: string) => {
    set({ loading: true, error: null });
    try {
      const vessels = await api.get('/vessels/initial');
      set({ vessels, loading: false });

    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to fetch vessels',
        loading: false,
      });
    }
  },
}));
