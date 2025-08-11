import { create } from "zustand";
import { useAuthStore } from "./authStore";
import api from "../services/apiClient";

export interface TrackedItem {
  id: number;
  type: "aircraft" | "vessel";
  alias?: string | null;
  notes?: string | null;
  createdAt: Date;
  data: any;
}

export interface TrackingItem {
  id: number;
  type: "aircraft" | "vessel";
  alias?: string | null;
  notes?: string | null;
  createdAt: Date;
  data: any; // Aircraft or Vessel data
}

interface TrackingState {
  trackedItems: TrackingItem[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchTrackedItems: () => Promise<void>;
  trackItem: (
    type: "aircraft" | "vessel",
    id: number,
    alias?: string,
    notes?: string
  ) => Promise<void>;
  untrackItem: (type: "aircraft" | "vessel", id: number) => Promise<void>;
  isTracking: (type: "aircraft" | "vessel", id: number) => boolean;
  getTrackingStats: () => {
    total: number;
    aircraftCount: number;
    vesselCount: number;
  };
}

export const useTrackingStore = create<TrackingState>((set, get) => ({
  trackedItems: [],
  loading: false,
  error: null,

  fetchTrackedItems: async () => {
    set({ loading: true, error: null });
    try {
      const authState = useAuthStore.getState();
      if (!authState.token) {
        throw new Error("No authentication token found");
      }

      const data = await api.get("/tracking");
      set({
        trackedItems: data.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
        })),
        loading: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch tracked items",
        loading: false,
      });
    }
  },

  trackItem: async (
    type: "aircraft" | "vessel",
    id: number,
    alias?: string,
    notes?: string
  ) => {
    try {
      const authState = useAuthStore.getState();
      if (!authState.token) {
        throw new Error("No authentication token found");
      }

      const endpoint = type === "aircraft" ? `aircraft/${id}` : `vessel/${id}`;
      await api.post(`/tracking/${endpoint}`, { alias, notes });

      // Refresh the tracked items list
      await get().fetchTrackedItems();
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : `Failed to track ${type}`,
      });
      throw error;
    }
  },

  untrackItem: async (type: "aircraft" | "vessel", id: number) => {
    try {
      const authState = useAuthStore.getState();
      if (!authState.token) {
        throw new Error("No authentication token found");
      }

      const endpoint = type === "aircraft" ? `aircraft/${id}` : `vessel/${id}`;
      await api.delete(`/tracking/${endpoint}`);

      // Remove from local state
      set((state) => ({
        trackedItems: state.trackedItems.filter(
          (item) => !(item.type === type && item.data.id === id)
        ),
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : `Failed to untrack ${type}`,
      });
      throw error;
    }
  },

  isTracking: (type: "aircraft" | "vessel", id: number) => {
    const { trackedItems } = get();
    return trackedItems.some(
      (item) => item.type === type && item.data.id === id
    );
  },

  getTrackingStats: () => {
    const { trackedItems } = get();
    const aircraftCount = trackedItems.filter(
      (item) => item.type === "aircraft"
    ).length;
    const vesselCount = trackedItems.filter(
      (item) => item.type === "vessel"
    ).length;

    return {
      total: trackedItems.length,
      aircraftCount,
      vesselCount,
    };
  },
}));
