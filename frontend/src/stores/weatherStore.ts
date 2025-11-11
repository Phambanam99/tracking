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
  | 'none';

interface WeatherState {
  // Weather data
  weatherGrid: WeatherData[];
  currentWeather: WeatherData | null;

  // Layer visibility
  activeLayer: WeatherLayerType;
  weatherVisible: boolean;
  windArrowsVisible: boolean;

  // Loading states
  isLoading: boolean;
  lastUpdated: Date | null;

  // Actions
  setWeatherGrid: (data: WeatherData[]) => void;
  setCurrentWeather: (data: WeatherData | null) => void;
  setActiveLayer: (layer: WeatherLayerType) => void;
  setWeatherVisible: (visible: boolean) => void;
  setWindArrowsVisible: (visible: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setLastUpdated: (date: Date) => void;
}

export const useWeatherStore = create<WeatherState>((set) => ({
  // Initial state
  weatherGrid: [],
  currentWeather: null,
  activeLayer: 'none',
  weatherVisible: false,
  windArrowsVisible: false,
  isLoading: false,
  lastUpdated: null,

  // Actions
  setWeatherGrid: (data) => set({ weatherGrid: data }),
  setCurrentWeather: (data) => set({ currentWeather: data }),
  setActiveLayer: (layer) => set({ activeLayer: layer }),
  setWeatherVisible: (visible) => set({ weatherVisible: visible }),
  setWindArrowsVisible: (visible) => set({ windArrowsVisible: visible }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setLastUpdated: (date) => set({ lastUpdated: date }),
}));
