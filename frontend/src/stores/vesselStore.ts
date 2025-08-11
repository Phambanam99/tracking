import { create } from "zustand";
import api from "../services/apiClient";

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
  loading: boolean;
  error: string | null;
  setVessels: (vessels: Vessel[]) => void;
  updateVessel: (vessel: Vessel) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchVessels: () => Promise<void>;
}

export const useVesselStore = create<VesselStore>((set) => ({
  vessels: [],
  loading: false,
  error: null,
  setVessels: (vessels) => set({ vessels }),
  updateVessel: (updatedVessel) =>
    set((state) => ({
      vessels: state.vessels.map((vessel) =>
        vessel.id === updatedVessel.id ? updatedVessel : vessel
      ),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  fetchVessels: async () => {
    set({ loading: true, error: null });
    try {
      const vessels = await api.get("/vessels/initial");
      set({ vessels, loading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch vessels",
        loading: false,
      });
    }
  },
}));
