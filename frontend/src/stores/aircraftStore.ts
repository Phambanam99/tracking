import { create } from 'zustand';
import api from '../services/apiClient';

export interface Aircraft {
  id: number;
  flightId: string;
  callSign?: string;
  registration?: string;
  aircraftType?: string;
  operator?: string;
  createdAt: Date;
  updatedAt: Date;
  lastPosition?: {
    id?: number;
    latitude: number;
    longitude: number;
    altitude?: number;
    speed?: number;
    heading?: number;
    timestamp: Date;
  };
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
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchAircrafts: (
    page?: number,
    pageSize?: number,
    q?: string,
  ) => Promise<void>;
}

export const useAircraftStore = create<AircraftStore>((set) => ({
  aircrafts: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  error: null,
  setAircrafts: (aircrafts) => set({ aircrafts }),
  updateAircraft: (incoming) =>
    set((state) => {
      const idx = state.aircrafts.findIndex((a) => a.id === incoming.id);
      if (idx === -1) {
        return { aircrafts: [...state.aircrafts, incoming] };
      }
      const next = [...state.aircrafts];
      next[idx] = { ...next[idx], ...incoming };
      return { aircrafts: next };
    }),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  fetchAircrafts: async (page = 1, pageSize = 20, q?: string) => {
    set({ loading: true, error: null });
    try {
      const aircrafts = await api.get('/aircrafts/initial');
      set({ aircrafts, loading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to fetch aircrafts',
        loading: false,
      });
    }
  },
}));
