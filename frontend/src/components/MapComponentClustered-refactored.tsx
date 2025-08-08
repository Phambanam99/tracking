"use client";

import { useRef, useMemo, useState } from "react";
import Map from "ol/Map";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import { Cluster } from "ol/source";
import { Draw } from "ol/interaction";
import { useAircraftStore } from "../stores/aircraftStore";
import { useVesselStore } from "../stores/vesselStore";
import { useMapStore } from "../stores/mapStore";
import { useRegionStore } from "../stores/regionStore";
import DrawingActionPopup from "./DrawingActionPopup";
import MapPopup from "./MapPopup";
import MapFilters from "./MapFiltersCollapsible";
import MapControls from "./MapControls";
import {
  useDataLoader,
  useMapInitialization,
  useMapClickHandler,
  useDrawingMode,
  useRegionsRendering,
  useWebSocketHandler,
  useFeatureUpdater,
} from "../hooks";

export default function MapComponentClustered() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const aircraftLayerRef = useRef<VectorLayer<Cluster> | null>(null);
  const vesselLayerRef = useRef<VectorLayer<Cluster> | null>(null);
  const regionLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const drawInteractionRef = useRef<Draw | null>(null);
  const lastDrawnFeatureRef = useRef<Feature | null>(null);

  const { aircrafts } = useAircraftStore();
  const { vessels } = useVesselStore();
  const {
    filters,
    selectedFeature,
    popupPosition,
    isPopupVisible,
    drawingTool,
    isDrawingActionPopupVisible,
    drawingActionPopupPosition,
    drawnGeometry,
    toggleAircraftVisibility,
    toggleVesselVisibility,
    setSearchQuery,
    resetFilters,
    hidePopup,
    hideDrawingActionPopup,
  } = useMapStore();

  const { createRegion } = useRegionStore();

  // State để control việc hiện/ẩn MapControls
  const [showMapControls, setShowMapControls] = useState(false);

  // Use custom hooks for all functionality
  useDataLoader();
  useWebSocketHandler();
  useMapInitialization({ mapRef, mapInstanceRef });
  useMapClickHandler({ mapInstanceRef, mapRef });
  useDrawingMode({ mapInstanceRef, regionLayerRef });
  useRegionsRendering({ regionLayerRef });
  useFeatureUpdater({ aircraftLayerRef, vesselLayerRef });

  // Filter data based on search query and visibility settings
  const filteredAircrafts = useMemo(() => {
    if (!filters.showAircraft) return [];

    return aircrafts.filter((aircraft) => {
      if (!filters.searchQuery) return true;

      const searchLower = filters.searchQuery.toLowerCase();
      return (
        aircraft.flightId.toLowerCase().includes(searchLower) ||
        aircraft.callSign?.toLowerCase().includes(searchLower) ||
        aircraft.registration?.toLowerCase().includes(searchLower) ||
        aircraft.operator?.toLowerCase().includes(searchLower)
      );
    });
  }, [aircrafts, filters.showAircraft, filters.searchQuery]);

  const filteredVessels = useMemo(() => {
    if (!filters.showVessels) return [];

    return vessels.filter((vessel) => {
      if (!filters.searchQuery) return true;

      const searchLower = filters.searchQuery.toLowerCase();
      return (
        vessel.mmsi.toLowerCase().includes(searchLower) ||
        vessel.vesselName?.toLowerCase().includes(searchLower) ||
        vessel.operator?.toLowerCase().includes(searchLower) ||
        vessel.flag?.toLowerCase().includes(searchLower)
      );
    });
  }, [vessels, filters.showVessels, filters.searchQuery]);

  // Handle creating region with name
  const handleCreateRegion = async (regionName: string) => {
    if (!drawnGeometry) return;

    try {
      await createRegion({
        name: regionName,
        boundary: drawnGeometry,
        regionType: drawingTool?.toUpperCase() as "POLYGON" | "CIRCLE",
      });
      // Reset drawing
      handleCancelDrawing();
    } catch (error) {
      console.error("Failed to create region:", error);
    }
  };

  // Handle creating alert
  const handleCreateAlert = (alertName: string) => {
    handleCreateRegion(alertName);
  };

  // Handle search in region
  const handleSearchInRegion = () => {
    console.log("Search in region functionality not implemented yet");
    handleCancelDrawing();
  };

  // Cancel drawing
  const handleCancelDrawing = () => {
    if (lastDrawnFeatureRef.current && regionLayerRef.current) {
      const regionSource = regionLayerRef.current.getSource();
      if (regionSource) {
        regionSource.removeFeature(lastDrawnFeatureRef.current);
      }
    }
    hideDrawingActionPopup();
  };

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Toggle for Map Controls */}
      <button
        onClick={() => setShowMapControls(!showMapControls)}
        className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-2 hover:bg-gray-50 transition-colors z-[1000]"
        title={showMapControls ? "Ẩn điều khiển" : "Hiện điều khiển"}
      >
        <svg
          className="w-5 h-5 text-gray-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Map Controls - Conditionally rendered */}
      {showMapControls && (
        <div className="absolute top-16 left-4 z-[1000]">
          <MapControls />
        </div>
      )}

      {/* Map Filters */}
      <div className="absolute top-4 right-4 z-[1000]">
        <MapFilters
          filters={filters}
          onToggleAircraft={toggleAircraftVisibility}
          onToggleVessels={toggleVesselVisibility}
          onSearchChange={setSearchQuery}
          onResetFilters={resetFilters}
          aircraftCount={filteredAircrafts.length}
          vesselCount={filteredVessels.length}
        />
      </div>

      {/* Feature popup */}
      <MapPopup
        isVisible={isPopupVisible}
        feature={selectedFeature}
        position={popupPosition}
        onClose={hidePopup}
      />

      {/* Drawing Action Popup */}
      <DrawingActionPopup
        isVisible={isDrawingActionPopupVisible}
        geometry={drawnGeometry}
        position={drawingActionPopupPosition || { x: 0, y: 0 }}
        onCreateAlert={handleCreateAlert}
        onSearchInRegion={handleSearchInRegion}
        onCancel={handleCancelDrawing}
      />
    </div>
  );
}
