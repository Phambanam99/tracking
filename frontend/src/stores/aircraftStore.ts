import { create } from "zustand";
import api from "../services/apiClient";

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
  loading: boolean;
  error: string | null;
  setAircrafts: (aircrafts: Aircraft[]) => void;
  updateAircraft: (aircraft: Aircraft) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchAircrafts: () => Promise<void>;
}

export const useAircraftStore = create<AircraftStore>((set) => ({
  aircrafts: [],
  loading: false,
  error: null,
  setAircrafts: (aircrafts) => set({ aircrafts }),
  updateAircraft: (updatedAircraft) =>
    set((state) => ({
      aircrafts: state.aircrafts.map((aircraft) =>
        aircraft.id === updatedAircraft.id ? updatedAircraft : aircraft
      ),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  fetchAircrafts: async () => {
    set({ loading: true, error: null });
    try {
      const aircrafts = await api.get("/aircrafts/initial");
      set({ aircrafts, loading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch aircrafts",
        loading: false,
      });
    }
  },
}));
