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

  // Region drawing state
  isDrawingMode: boolean;
  isDeleteMode: boolean;
  drawingTool: "polygon" | "circle" | null;
  regionsVisible: boolean;

  // Drawing action popup state
  isDrawingActionPopupVisible: boolean;
  drawingActionPopupPosition: { x: number; y: number } | null;
  drawnGeometry: object | null;

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

  // Region drawing actions
  toggleDrawingMode: () => void;
  toggleDeleteMode: () => void;
  setDrawingTool: (tool: "polygon" | "circle" | null) => void;
  toggleRegionsVisibility: () => void;

  // Drawing action popup actions
  showDrawingActionPopup: (
    geometry: object,
    position: { x: number; y: number }
  ) => void;
  hideDrawingActionPopup: () => void;
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

  // Region drawing state
  isDrawingMode: false,
  isDeleteMode: false,
  drawingTool: null,
  regionsVisible: true,

  // Drawing action popup state
  isDrawingActionPopupVisible: false,
  drawingActionPopupPosition: null,
  drawnGeometry: null,

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
  showPopup: (feature: FeatureData, position: [number, number]) => {
    console.log("showPopup called with:", { feature, position });
    set({
      selectedFeature: feature,
      popupPosition: position,
      isPopupVisible: true,
    });
  },

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

  // Region drawing actions
  toggleDrawingMode: () =>
    set((state) => ({
      isDrawingMode: !state.isDrawingMode,
      isDeleteMode: false, // Turn off delete mode when drawing
      drawingTool: !state.isDrawingMode ? "polygon" : null,
    })),

  toggleDeleteMode: () =>
    set((state) => ({
      isDeleteMode: !state.isDeleteMode,
      isDrawingMode: false, // Turn off drawing mode when deleting
      drawingTool: null,
    })),

  setDrawingTool: (tool: "polygon" | "circle" | null) =>
    set({
      drawingTool: tool,
      isDrawingMode: tool !== null,
      isDeleteMode: false,
    }),

  toggleRegionsVisibility: () =>
    set((state) => ({
      regionsVisible: !state.regionsVisible,
    })),

  // Drawing action popup actions
  showDrawingActionPopup: (
    geometry: object,
    position: { x: number; y: number }
  ) =>
    set({
      isDrawingActionPopupVisible: true,
      drawingActionPopupPosition: position,
      drawnGeometry: geometry,
    }),

  hideDrawingActionPopup: () =>
    set({
      isDrawingActionPopupVisible: false,
      drawingActionPopupPosition: null,
      drawnGeometry: null,
    }),
}));
