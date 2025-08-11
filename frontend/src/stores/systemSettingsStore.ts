import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SystemSettings = {
  clusterEnabled: boolean;
  minZoom: number;
  maxZoom: number;
  signalStaleMinutes: number;
  vesselFlagColors: Record<string, string>;
  aircraftOperatorColors: Record<string, string>;
};

const defaultSettings: SystemSettings = {
  clusterEnabled: true,
  minZoom: 4,
  maxZoom: 16,
  signalStaleMinutes: 10,
  vesselFlagColors: {},
  aircraftOperatorColors: {},
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
