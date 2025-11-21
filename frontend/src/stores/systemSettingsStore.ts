import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SystemSettings = {
  minZoom: number;
  maxZoom: number;
  signalStaleMinutes: number;
  vesselFlagColors: Record<string, string>;
  aircraftOperatorColors: Record<string, string>;
  mapProvider: 'osm' | 'maptiler' | 'openseamap';
  maptilerApiKey?: string;
  maptilerStyle: string;
  // Optional admin-configured custom XYZ sources
  customMapSources?: Array<{
    id: string; // e.g. 'esri-world', 'here-streets'
    name: string; // label for UI
    urlTemplate: string; // e.g. 'https://.../{z}/{x}/{y}.png'
    maxZoom?: number;
    attribution?: string;
  }>;
};

const defaultSettings: SystemSettings = {
  minZoom: 4,
  maxZoom: 16,
  signalStaleMinutes: 10,
  vesselFlagColors: {},
  aircraftOperatorColors: {},
  mapProvider: 'osm',
  maptilerStyle: 'streets',
  customMapSources: [],
};

interface SystemSettingsState {
  settings: SystemSettings;
  setSettings: (s: Partial<SystemSettings>) => void;
}

export const useSystemSettingsStore = create<SystemSettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      setSettings: (s) => set({ settings: { ...get().settings, ...s } }),
    }),
    {
      name: 'system-settings',
      partialize: (state) => ({ settings: state.settings }),
    },
  ),
);
