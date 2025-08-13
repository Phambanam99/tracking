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
        aircrafts: Array.isArray(data) ? data : [],
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
