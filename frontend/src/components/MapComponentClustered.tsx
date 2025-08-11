'use client';

import 'ol/ol.css';
import { useRef, useMemo, useState, useEffect } from 'react';
import Map from 'ol/Map';
import { fromLonLat } from 'ol/proj';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Cluster } from 'ol/source';
import { useAircraftStore } from '../stores/aircraftStore';
import { useVesselStore } from '../stores/vesselStore';
import { useMapStore } from '../stores/mapStore';
import { useRegionStore } from '../stores/regionStore';
import DrawingActionPopup from './DrawingActionPopup';
import MapPopup from './MapPopup';
import MapFiltersRedesigned from './MapFiltersRedesigned';
import { useTrackingStore } from '../stores/trackingStore';
import MapControls from './MapControls';
import {
  useDataLoader,
  useMapInitialization,
  useMapClickHandler,
  useDrawingMode,
  useRegionsRendering,
  useWebSocketHandler,
  useFeatureUpdater,
} from '../hooks';

export default function MapComponentClustered() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const aircraftLayerRef = useRef<VectorLayer<Cluster> | null>(null);
  const vesselLayerRef = useRef<VectorLayer<Cluster> | null>(null);
  const regionLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const lastDrawnFeatureRef = useRef<Feature | null>(null);

  const { aircrafts } = useAircraftStore();
  const { vessels } = useVesselStore();
  const { trackedItems } = useTrackingStore();
  const {
    filters,
    selectedFeature,
    popupPosition,
    isPopupVisible,
    drawingTool,
    isDrawingActionPopupVisible,
    drawingActionPopupPosition,
    drawnGeometry,
    aircraftViewMode,
    vesselViewMode,
    activeFilterTab,
    hidePopup,
    hideDrawingActionPopup,
    setActiveFilterTab,
    setFocusTarget,
    focusTarget,
  } = useMapStore();

  const { createRegion } = useRegionStore();

  // State để control việc hiện/ẩn MapControls
  const [showMapControls, setShowMapControls] = useState(false);

  // Use custom hooks for all functionality
  useDataLoader();
  useWebSocketHandler();
  useMapInitialization({
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
    regionLayerRef,
  });
  useMapClickHandler({ mapInstanceRef, mapRef });
  useDrawingMode({ mapInstanceRef, regionLayerRef });
  useRegionsRendering({ regionLayerRef });
  useFeatureUpdater({ aircraftLayerRef, vesselLayerRef });

  // Respond to focusTarget by centering map and switching the tab/layer visibility
  useEffect(() => {
    if (!focusTarget || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (focusTarget.type === 'vessel') {
      if (activeFilterTab !== 'vessel') setActiveFilterTab('vessel');
      const vessel = vessels.find((v) => v.id === focusTarget.id);
      if (vessel?.lastPosition) {
        const { longitude, latitude } = vessel.lastPosition;
        const view = map.getView();
        view.animate({
          center: fromLonLat([longitude, latitude]),
          zoom: 9,
          duration: 400,
        });
      }
    } else if (focusTarget.type === 'aircraft') {
      if (activeFilterTab !== 'aircraft') setActiveFilterTab('aircraft');
      const aircraft = aircrafts.find((a) => a.id === focusTarget.id);
      if (aircraft?.lastPosition) {
        const { longitude, latitude } = aircraft.lastPosition;
        const view = map.getView();
        view.animate({
          center: fromLonLat([longitude, latitude]),
          zoom: 9,
          duration: 400,
        });
      }
    }

    // Clear the focus request after acting on it
    setFocusTarget(null);
  }, [
    focusTarget,
    mapInstanceRef,
    aircrafts,
    vessels,
    activeFilterTab,
    setActiveFilterTab,
    setFocusTarget,
  ]);

  // Filter data based on search query and visibility settings
  const filteredAircrafts = useMemo(() => {
    if (!filters.showAircraft) return [];

    let targetAircrafts = aircrafts;

    // Apply view mode filter first
    if (aircraftViewMode === 'tracked') {
      const trackedAircraftIds = trackedItems
        .filter((item) => item.type === 'aircraft')
        .map((item) => item.data.id);
      targetAircrafts = aircrafts.filter((aircraft) =>
        trackedAircraftIds.includes(aircraft.id),
      );
    }

    const result = targetAircrafts.filter((aircraft) => {
      if (
        !filters.aircraft.searchQuery &&
        !filters.aircraft.operator &&
        !filters.aircraft.aircraftType &&
        filters.aircraft.minAltitude == null &&
        filters.aircraft.maxAltitude == null &&
        filters.aircraft.minSpeed == null &&
        filters.aircraft.maxSpeed == null
      ) {
        return true;
      }

      const searchLower = (filters.aircraft.searchQuery || '').toLowerCase();
      const matchesSearch =
        !searchLower ||
        aircraft.flightId.toLowerCase().includes(searchLower) ||
        aircraft.callSign?.toLowerCase().includes(searchLower) ||
        aircraft.registration?.toLowerCase().includes(searchLower) ||
        aircraft.operator?.toLowerCase().includes(searchLower) ||
        aircraft.aircraftType?.toLowerCase().includes(searchLower);

      const matchesOperator =
        !filters.aircraft.operator ||
        (aircraft.operator || '')
          .toLowerCase()
          .includes(filters.aircraft.operator.toLowerCase());
      const matchesType =
        !filters.aircraft.aircraftType ||
        (aircraft.aircraftType || '')
          .toLowerCase()
          .includes(filters.aircraft.aircraftType.toLowerCase());

      const speed = aircraft.lastPosition?.speed ?? null;
      const altitude = aircraft.lastPosition?.altitude ?? null;
      const matchesSpeedMin =
        filters.aircraft.minSpeed == null ||
        (speed != null && speed >= filters.aircraft.minSpeed);
      const matchesSpeedMax =
        filters.aircraft.maxSpeed == null ||
        (speed != null && speed <= filters.aircraft.maxSpeed);
      const matchesAltMin =
        filters.aircraft.minAltitude == null ||
        (altitude != null && altitude >= filters.aircraft.minAltitude);
      const matchesAltMax =
        filters.aircraft.maxAltitude == null ||
        (altitude != null && altitude <= filters.aircraft.maxAltitude);

      return (
        matchesSearch &&
        matchesOperator &&
        matchesType &&
        matchesSpeedMin &&
        matchesSpeedMax &&
        matchesAltMin &&
        matchesAltMax
      );
    });

    console.log(
      'Filtered aircrafts:',
      result.length,
      'from total:',
      aircrafts.length,
    );
    return result;
  }, [
    aircrafts,
    filters.showAircraft,
    filters.aircraft,
    aircraftViewMode,
    trackedItems,
  ]);

  const filteredVessels = useMemo(() => {
    if (!filters.showVessels) return [];

    let targetVessels = vessels;

    // Apply view mode filter first
    if (vesselViewMode === 'tracked') {
      const trackedVesselIds = trackedItems
        .filter((item) => item.type === 'vessel')
        .map((item) => item.data.id);
      targetVessels = vessels.filter((vessel) =>
        trackedVesselIds.includes(vessel.id),
      );
    }

    const result = targetVessels.filter((vessel) => {
      if (
        !filters.vessel.searchQuery &&
        !filters.vessel.operator &&
        !filters.vessel.vesselType &&
        !filters.vessel.flag &&
        filters.vessel.minSpeed == null &&
        filters.vessel.maxSpeed == null
      ) {
        return true;
      }

      const searchLower = (filters.vessel.searchQuery || '').toLowerCase();
      const matchesSearch =
        !searchLower ||
        vessel.mmsi.toLowerCase().includes(searchLower) ||
        vessel.vesselName?.toLowerCase().includes(searchLower) ||
        vessel.operator?.toLowerCase().includes(searchLower) ||
        vessel.flag?.toLowerCase().includes(searchLower) ||
        vessel.vesselType?.toLowerCase().includes(searchLower);

      const matchesOperator =
        !filters.vessel.operator ||
        (vessel.operator || '')
          .toLowerCase()
          .includes(filters.vessel.operator.toLowerCase());
      const matchesType =
        !filters.vessel.vesselType ||
        (vessel.vesselType || '')
          .toLowerCase()
          .includes(filters.vessel.vesselType.toLowerCase());
      const matchesFlag =
        !filters.vessel.flag ||
        (vessel.flag || '')
          .toLowerCase()
          .includes(filters.vessel.flag.toLowerCase());

      const speed = vessel.lastPosition?.speed ?? null;
      const matchesSpeedMin =
        filters.vessel.minSpeed == null ||
        (speed != null && speed >= filters.vessel.minSpeed);
      const matchesSpeedMax =
        filters.vessel.maxSpeed == null ||
        (speed != null && speed <= filters.vessel.maxSpeed);

      return (
        matchesSearch &&
        matchesOperator &&
        matchesType &&
        matchesFlag &&
        matchesSpeedMin &&
        matchesSpeedMax
      );
    });

    console.log(
      'Filtered vessels:',
      result.length,
      'from total:',
      vessels.length,
    );
    return result;
  }, [
    vessels,
    filters.showVessels,
    filters.vessel,
    vesselViewMode,
    trackedItems,
  ]);

  // Handle creating region with name
  const handleCreateRegion = async (regionName: string) => {
    if (!drawnGeometry) return;

    try {
      await createRegion({
        name: regionName,
        boundary: drawnGeometry,
        regionType: drawingTool?.toUpperCase() as 'POLYGON' | 'CIRCLE',
      });
      // Reset drawing
      handleCancelDrawing();
    } catch (error) {
      console.error('Failed to create region:', error);
    }
  };

  // Handle creating alert
  const handleCreateAlert = (alertName: string) => {
    handleCreateRegion(alertName);
  };

  // Handle search in region
  const handleSearchInRegion = () => {
    console.log('Search in region functionality not implemented yet');
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
    <div className="relative w-full h-full" style={{ minHeight: '400px' }}>
      {/* Map container */}
      {/* Map container */}
      <div
        ref={mapRef}
        className="w-full h-full z-[2]"
        style={{
          minHeight: '400px',
          width: '100%',
          height: '100%',
          position: 'relative',
          pointerEvents: 'auto', // Ensure map can receive clicks
        }}
      />

      {/* Toggle for Map Controls */}
      <button
        onClick={() => setShowMapControls(!showMapControls)}
        className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-2 hover:bg-gray-50 transition-colors z-[2]"
        title={showMapControls ? 'Ẩn điều khiển' : 'Hiện điều khiển'}
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
        <div className="absolute top-16 right-4 z-[2]">
          <MapControls />
        </div>
      )}

      {/* Map Filters */}
      <MapFiltersRedesigned
        aircraftCount={filteredAircrafts.length}
        vesselCount={filteredVessels.length}
        trackedAircraftCount={
          trackedItems.filter((item) => item.type === 'aircraft').length
        }
        trackedVesselCount={
          trackedItems.filter((item) => item.type === 'vessel').length
        }
      />

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
