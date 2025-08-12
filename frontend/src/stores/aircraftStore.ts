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
    id: number;
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
  updateAircraft: (updatedAircraft) =>
    set((state) => ({
      aircrafts: state.aircrafts.map((aircraft) =>
        aircraft.id === updatedAircraft.id ? updatedAircraft : aircraft,
      ),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  fetchAircrafts: async (page = 1, pageSize = 20, q?: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (q && q.trim()) params.set('q', q.trim());
      const resp = await api.get(`/aircrafts?${params.toString()}`);
      const data = resp?.data || resp;
      set({
        aircrafts: Array.isArray(data?.data)
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
          error instanceof Error ? error.message : 'Failed to fetch aircrafts',
        loading: false,
      });
    }
  },
}));
