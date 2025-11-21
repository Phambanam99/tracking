import { create } from 'zustand';

export interface WeatherData {
  latitude: number;
  longitude: number;
  timestamp: string;
  temperature: number; // °C
  windSpeed: number; // km/h
  windDirection: number; // degrees
  precipitation: number; // mm
  visibility: number; // meters
  cloudCover: number; // %
  pressure: number; // hPa
}

export type WeatherLayerType =
  | 'temperature'
  | 'wind'
  | 'precipitation'
  | 'clouds'
  | 'pressure'
  | 'none';

interface WeatherState {
  // Weather data
  weatherGrid: WeatherData[];
  currentWeather: WeatherData | null;

  // Layer visibility
  activeLayer: WeatherLayerType;
  weatherVisible: boolean;

  // Loading states
  isLoading: boolean;
  lastUpdated: Date | null;

  // Actions
  setWeatherGrid: (data: WeatherData[]) => void;
  setCurrentWeather: (data: WeatherData | null) => void;
  setActiveLayer: (layer: WeatherLayerType) => void;
  setWeatherVisible: (visible: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setLastUpdated: (date: Date) => void;
}

export const useWeatherStore = create<WeatherState>((set) => ({
  // Initial state
  weatherGrid: [],
  currentWeather: null,
  activeLayer: 'none',
  weatherVisible: false,
  isLoading: false,
  lastUpdated: null,

  // Actions
  setWeatherGrid: (data) => set({ weatherGrid: data }),
  setCurrentWeather: (data) => set({ currentWeather: data }),
  setActiveLayer: (layer) => set({ activeLayer: layer }),
  setWeatherVisible: (visible: boolean) =>
    set((state) => {
      // When turning on weather, if no layer is selected, default to 'wind'
      if (visible && state.activeLayer === 'none') {
        return { weatherVisible: visible, activeLayer: 'wind' };
      }
      return { weatherVisible: visible };
    }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setLastUpdated: (date) => set({ lastUpdated: date }),
}));
