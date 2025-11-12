import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BaseMapChoice =
  | 'default' // follow system setting
  | 'osm'
  | 'openseamap'
  | 'maptiler'
  | `custom:${string}`; // id from admin-configured list

interface UserPreferencesState {
  baseMapProvider: BaseMapChoice;
  maptilerStyle: string; // user's preferred style when using maptiler
  setBaseMapProvider: (p: BaseMapChoice) => void;
  setMaptilerStyle: (s: string) => void;
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      baseMapProvider: 'default',
      maptilerStyle: 'streets',
      setBaseMapProvider: (p) => set({ baseMapProvider: p }),
      setMaptilerStyle: (s) => set({ maptilerStyle: s }),
    }),
    {
      name: 'user-preferences',
      partialize: (state) => ({
        baseMapProvider: state.baseMapProvider,
        maptilerStyle: state.maptilerStyle,
      }),
    },
  ),
);
