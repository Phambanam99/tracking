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
    id: number;
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
  updateVessel: (updatedVessel) =>
    set((state) => ({
      vessels: state.vessels.map((vessel) =>
        vessel.id === updatedVessel.id ? updatedVessel : vessel,
      ),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  fetchVessels: async (page = 1, pageSize = 20, q?: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (q && q.trim()) params.set('q', q.trim());
      const resp = await api.get(`/vessels?${params.toString()}`);
      const data = resp?.data || resp;
      set({
        vessels: Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
          ? data
          : [],
        total: data?.total ?? 0,
        page: data?.page ?? page,
        pageSize: data?.pageSize ?? pageSize,
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
