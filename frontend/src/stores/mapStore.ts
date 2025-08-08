import { create } from "zustand";

export interface MapFilters {
  showAircraft: boolean;
  showVessels: boolean;
  selectedCategories: string[];
  searchQuery: string;
}

interface FeatureData {
  aircraft?: {
    id: number;
    flightId: string;
    callSign?: string;
    registration?: string;
    aircraftType?: string;
    operator?: string;
    lastPosition?: {
      latitude: number;
      longitude: number;
      altitude?: number;
      speed?: number;
      heading?: number;
      timestamp: Date;
    };
  };
  vessel?: {
    id: number;
    mmsi: string;
    vesselName?: string;
    vesselType?: string;
    flag?: string;
    operator?: string;
    length?: number;
    width?: number;
    lastPosition?: {
      latitude: number;
      longitude: number;
      speed?: number;
      course?: number;
      heading?: number;
      status?: string;
      timestamp: Date;
    };
  };
}

interface MapState {
  filters: MapFilters;
  selectedFeature: FeatureData | null;
  popupPosition: [number, number] | null;
  isPopupVisible: boolean;

  // Filter actions
  toggleAircraftVisibility: () => void;
  toggleVesselVisibility: () => void;
  setSearchQuery: (query: string) => void;
  toggleCategory: (category: string) => void;
  resetFilters: () => void;

  // Popup actions
  showPopup: (feature: FeatureData, position: [number, number]) => void;
  hidePopup: () => void;
  setSelectedFeature: (feature: FeatureData) => void;
}

const defaultFilters: MapFilters = {
  showAircraft: true,
  showVessels: true,
  selectedCategories: [],
  searchQuery: "",
};

export const useMapStore = create<MapState>((set) => ({
  filters: defaultFilters,
  selectedFeature: null,
  popupPosition: null,
  isPopupVisible: false,

  // Filter actions
  toggleAircraftVisibility: () =>
    set((state) => ({
      filters: {
        ...state.filters,
        showAircraft: !state.filters.showAircraft,
      },
    })),

  toggleVesselVisibility: () =>
    set((state) => ({
      filters: {
        ...state.filters,
        showVessels: !state.filters.showVessels,
      },
    })),

  setSearchQuery: (query: string) =>
    set((state) => ({
      filters: {
        ...state.filters,
        searchQuery: query,
      },
    })),

  toggleCategory: (category: string) =>
    set((state) => {
      const categories = state.filters.selectedCategories;
      const isSelected = categories.includes(category);

      return {
        filters: {
          ...state.filters,
          selectedCategories: isSelected
            ? categories.filter((c) => c !== category)
            : [...categories, category],
        },
      };
    }),

  resetFilters: () =>
    set({
      filters: defaultFilters,
    }),

  // Popup actions
  showPopup: (feature: FeatureData, position: [number, number]) =>
    set({
      selectedFeature: feature,
      popupPosition: position,
      isPopupVisible: true,
    }),

  hidePopup: () =>
    set({
      selectedFeature: null,
      popupPosition: null,
      isPopupVisible: false,
    }),

  setSelectedFeature: (feature: FeatureData) =>
    set({
      selectedFeature: feature,
    }),
}));
