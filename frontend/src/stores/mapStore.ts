import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AircraftFilters {
  searchQuery: string;
  operator?: string;
  aircraftType?: string;
  minSpeed?: number;
  maxSpeed?: number;
  minAltitude?: number;
  maxAltitude?: number;
}

export interface VesselFilters {
  searchQuery: string;
  operator?: string;
  vesselType?: string;
  flag?: string;
  minSpeed?: number;
  maxSpeed?: number;
}

export interface MapFilters {
  showAircraft: boolean;
  showVessels: boolean;
  selectedCategories: string[];
  aircraft: AircraftFilters;
  vessel: VesselFilters;
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
  // Persisted per-user filters
  currentUserId: string;
  filtersByUser: Record<string, MapFilters>;
  _updateFilters: (updater: (prev: MapFilters) => MapFilters) => void;
  // Tabs and view modes
  activeFilterTab: 'aircraft' | 'vessel';
  aircraftViewMode: 'all' | 'tracked';
  vesselViewMode: 'all' | 'tracked';
  setActiveFilterTab: (tab: 'aircraft' | 'vessel') => void;
  setAircraftViewMode: (mode: 'all' | 'tracked') => void;
  setVesselViewMode: (mode: 'all' | 'tracked') => void;
  selectedFeature: FeatureData | null;
  popupPosition: [number, number] | null;
  isPopupVisible: boolean;
  // Cross-page focus request
  focusTarget: { type: 'aircraft' | 'vessel'; id: number } | null;

  // Region drawing state
  isDrawingMode: boolean;
  isDeleteMode: boolean;
  drawingTool: 'polygon' | 'circle' | null;
  regionsVisible: boolean;

  // Drawing action popup state
  isDrawingActionPopupVisible: boolean;
  drawingActionPopupPosition: { x: number; y: number } | null;
  drawnGeometry: object | null;

  // Filter actions
  toggleAircraftVisibility: () => void;
  toggleVesselVisibility: () => void;
  // Aircraft-specific
  setAircraftSearchQuery: (query: string) => void;
  setAircraftOperator: (operator: string) => void;
  setAircraftType: (aircraftType: string) => void;
  setAircraftSpeedRange: (min?: number, max?: number) => void;
  setAircraftAltitudeRange: (min?: number, max?: number) => void;
  resetAircraftFilters: () => void;

  // Vessel-specific
  setVesselSearchQuery: (query: string) => void;
  setVesselOperator: (operator: string) => void;
  setVesselType: (vesselType: string) => void;
  setVesselFlag: (flag: string) => void;
  setVesselSpeedRange: (min?: number, max?: number) => void;
  resetVesselFilters: () => void;

  toggleCategory: (category: string) => void;
  resetFilters: () => void;

  // Per-user filter persistence
  setCurrentUserId: (userId: string) => void;
  loadFiltersForCurrentUser: () => void;

  // Popup actions
  showPopup: (feature: FeatureData, position: [number, number]) => void;
  hidePopup: () => void;
  setSelectedFeature: (feature: FeatureData) => void;
  setFocusTarget: (
    target: { type: 'aircraft' | 'vessel'; id: number } | null,
  ) => void;

  // Region drawing actions
  toggleDrawingMode: () => void;
  toggleDeleteMode: () => void;
  setDrawingTool: (tool: 'polygon' | 'circle' | null) => void;
  toggleRegionsVisibility: () => void;

  // Drawing action popup actions
  showDrawingActionPopup: (
    geometry: object,
    position: { x: number; y: number },
  ) => void;
  hideDrawingActionPopup: () => void;
}

const defaultFilters: MapFilters = {
  showAircraft: false,
  showVessels: true,
  selectedCategories: [],
  aircraft: {
    searchQuery: '',
    operator: '',
    aircraftType: '',
  },
  vessel: {
    searchQuery: '',
    operator: '',
    vesselType: '',
    flag: '',
  },
};

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
      filters: defaultFilters,
      currentUserId: 'guest',
      filtersByUser: {},
      activeFilterTab: 'vessel',
      aircraftViewMode: 'all',
      vesselViewMode: 'all',
      selectedFeature: null,
      popupPosition: null,
      isPopupVisible: false,
      // Cross-page focus
      focusTarget: null,

      // Region drawing state
      isDrawingMode: false,
      isDeleteMode: false,
      drawingTool: null,
      regionsVisible: true,

      // Drawing action popup state
      isDrawingActionPopupVisible: false,
      drawingActionPopupPosition: null,
      drawnGeometry: null,

      // Internal helper to update filters and persist per-user
      _updateFilters: (updater: (prev: MapFilters) => MapFilters) => {
        const state = get();
        const newFilters = updater(state.filters);
        const userId = state.currentUserId || 'guest';
        set({
          filters: newFilters,
          filtersByUser: { ...state.filtersByUser, [userId]: newFilters },
        });
      },

      // Filter actions
      toggleAircraftVisibility: () => {
        const state = get();
        const newShow = !state.filters.showAircraft;
        set({
          filters: {
            ...state.filters,
            showAircraft: newShow,
            showVessels: newShow ? false : state.filters.showVessels,
          },
          activeFilterTab: 'aircraft',
        });
      },

      toggleVesselVisibility: () => {
        const state = get();
        const newShow = !state.filters.showVessels;
        set({
          filters: {
            ...state.filters,
            showVessels: newShow,
            showAircraft: newShow ? false : state.filters.showAircraft,
          },
          activeFilterTab: 'vessel',
        });
      },

      setAircraftSearchQuery: (query: string) =>
        get()._updateFilters((prev) => ({
          ...prev,
          aircraft: { ...prev.aircraft, searchQuery: query },
        })),

      setVesselSearchQuery: (query: string) =>
        get()._updateFilters((prev) => ({
          ...prev,
          vessel: { ...prev.vessel, searchQuery: query },
        })),

      toggleCategory: (category: string) =>
        get()._updateFilters((prev) => {
          const categories = prev.selectedCategories;
          const isSelected = categories.includes(category);
          return {
            ...prev,
            selectedCategories: isSelected
              ? categories.filter((c) => c !== category)
              : [...categories, category],
          };
        }),

      setAircraftOperator: (operator: string) =>
        get()._updateFilters((prev) => ({
          ...prev,
          aircraft: { ...prev.aircraft, operator },
        })),

      setAircraftType: (aircraftType: string) =>
        get()._updateFilters((prev) => ({
          ...prev,
          aircraft: { ...prev.aircraft, aircraftType },
        })),

      setAircraftSpeedRange: (min?: number, max?: number) =>
        get()._updateFilters((prev) => ({
          ...prev,
          aircraft: { ...prev.aircraft, minSpeed: min, maxSpeed: max },
        })),

      setAircraftAltitudeRange: (min?: number, max?: number) =>
        get()._updateFilters((prev) => ({
          ...prev,
          aircraft: { ...prev.aircraft, minAltitude: min, maxAltitude: max },
        })),

      resetAircraftFilters: () =>
        get()._updateFilters((prev) => ({
          ...prev,
          aircraft: { ...defaultFilters.aircraft },
        })),

      setVesselOperator: (operator: string) =>
        get()._updateFilters((prev) => ({
          ...prev,
          vessel: { ...prev.vessel, operator },
        })),

      setVesselType: (vesselType: string) =>
        get()._updateFilters((prev) => ({
          ...prev,
          vessel: { ...prev.vessel, vesselType },
        })),

      setVesselFlag: (flag: string) =>
        get()._updateFilters((prev) => ({
          ...prev,
          vessel: { ...prev.vessel, flag },
        })),

      setVesselSpeedRange: (min?: number, max?: number) =>
        get()._updateFilters((prev) => ({
          ...prev,
          vessel: { ...prev.vessel, minSpeed: min, maxSpeed: max },
        })),

      resetVesselFilters: () =>
        get()._updateFilters((prev) => ({
          ...prev,
          vessel: { ...defaultFilters.vessel },
        })),

      resetFilters: () => {
        const state = get();
        const userId = state.currentUserId || 'guest';
        set({
          filters: defaultFilters,
          filtersByUser: { ...state.filtersByUser, [userId]: defaultFilters },
          aircraftViewMode: 'all',
          vesselViewMode: 'all',
        });
      },

      // Tabs and view modes
      setActiveFilterTab: (tab: 'aircraft' | 'vessel') => {
        const state = get();
        set({
          activeFilterTab: tab,
          filters: {
            ...state.filters,
            showAircraft: tab === 'aircraft',
            showVessels: tab === 'vessel',
          },
        });
      },
      setAircraftViewMode: (mode: 'all' | 'tracked') =>
        set({ aircraftViewMode: mode }),
      setVesselViewMode: (mode: 'all' | 'tracked') =>
        set({ vesselViewMode: mode }),

      // Per-user filter persistence
      setCurrentUserId: (userId: string) => {
        set({ currentUserId: userId || 'guest' });
        // Load filters after switching user
        const state = get();
        const stored = state.filtersByUser[userId || 'guest'];
        if (stored) {
          set({ filters: stored });
        } else {
          // Initialize for user
          set({
            filters: defaultFilters,
            filtersByUser: {
              ...state.filtersByUser,
              [userId || 'guest']: defaultFilters,
            },
          });
        }
      },

      loadFiltersForCurrentUser: () => {
        const state = get();
        const userId = state.currentUserId || 'guest';
        const stored = state.filtersByUser[userId];
        if (stored) {
          set({ filters: stored });
        }
      },

      // Popup actions
      showPopup: (feature: FeatureData, position: [number, number]) => {
        console.log('showPopup called with:', { feature, position });
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

      setFocusTarget: (
        target: { type: 'aircraft' | 'vessel'; id: number } | null,
      ) => set({ focusTarget: target }),

      // Region drawing actions
      toggleDrawingMode: () =>
        set((state) => ({
          isDrawingMode: !state.isDrawingMode,
          isDeleteMode: false, // Turn off delete mode when drawing
          drawingTool: !state.isDrawingMode ? 'polygon' : null,
        })),

      toggleDeleteMode: () =>
        set((state) => ({
          isDeleteMode: !state.isDeleteMode,
          isDrawingMode: false, // Turn off drawing mode when deleting
          drawingTool: null,
        })),

      setDrawingTool: (tool: 'polygon' | 'circle' | null) =>
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
        position: { x: number; y: number },
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
    }),
    {
      name: 'map-filters-v1',
      partialize: (state) => ({
        currentUserId: state.currentUserId,
        filtersByUser: state.filtersByUser,
      }),
    },
  ),
);
