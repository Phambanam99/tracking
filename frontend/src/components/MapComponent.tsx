'use client';

import 'ol/ol.css';
import { useRef, useMemo, useState, useEffect } from 'react';
import Map from 'ol/Map';
import { fromLonLat } from 'ol/proj';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import type { FeatureLike } from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { Stroke, Style, Circle as CircleStyle, Fill, Text } from 'ol/style';
import { Cluster } from 'ol/source';
import { useAircraftStore } from '../stores/aircraftStore';
import { useVesselStore } from '../stores/vesselStore';
import { useMapStore } from '../stores/mapStore';
import { useRegionStore } from '../stores/regionStore';
import DrawingActionPopup from './DrawingActionPopup';
import MapPopup from './MapPopup';
import MapFiltersRedesigned from './MapFilters';
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
  useViewportDataLoader,
} from '../hooks';

export default function MapComponentClustered() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const aircraftLayerRef = useRef<VectorLayer<Cluster> | null>(null);
  const vesselLayerRef = useRef<VectorLayer<Cluster> | null>(null);
  const regionLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const historyLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const historyPointsLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
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
  useViewportDataLoader({ mapInstanceRef });
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

  // Push viewport bbox to server for realtime filtering
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const toLonLatAny = (window as any)?.ol?.proj?.toLonLat;
    const sendBbox = () => {
      const size = map.getSize();
      if (!size) return;
      const extent = map.getView().calculateExtent(size);
      if (!toLonLatAny) return;
      const bl = toLonLatAny([extent[0], extent[1]]);
      const tr = toLonLatAny([extent[2], extent[3]]);
      if (bl && tr) {
        const bbox: [number, number, number, number] = [
          bl[0],
          bl[1],
          tr[0],
          tr[1],
        ];
        import('../services/websocket').then(({ websocketService }) => {
          if (websocketService.socket) {
            websocketService.updateViewport(bbox);
          } else {
            websocketService.connect();
            setTimeout(() => websocketService.subscribeViewport(bbox), 200);
          }
        });
      }
    };
    // initial send
    setTimeout(sendBbox, 200);
    // update on moveend
    map.on('moveend', sendBbox);
    return () => {
      (map as any).un('moveend', sendBbox);
    };
  }, [mapInstanceRef]);

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

  // History path rendering
  const { historyPath } = useMapStore();
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Create layers once
    if (!historyLayerRef.current) {
      historyLayerRef.current = new VectorLayer({
        source: new VectorSource(),
        style: new Style({
          stroke: new Stroke({ color: 'rgba(34,197,94,0.9)', width: 3 }),
        }),
        zIndex: 1000,
      });
      map.addLayer(historyLayerRef.current);
    }
    if (!historyPointsLayerRef.current) {
      historyPointsLayerRef.current = new VectorLayer({
        source: new VectorSource(),
        zIndex: 1001,
      });
      map.addLayer(historyPointsLayerRef.current);
    }

    const lineSource = historyLayerRef.current.getSource();
    const pointsSource = historyPointsLayerRef.current.getSource();
    if (!lineSource || !pointsSource) return;

    const rebuild = () => {
      lineSource.clear();
      pointsSource.clear();

      if (!historyPath || historyPath.positions.length < 2) return;

      const positions = historyPath.positions;
      const projected = positions.map((p) =>
        fromLonLat([p.longitude, p.latitude]),
      );
      const line = new LineString(projected);
      lineSource.addFeature(new Feature({ geometry: line }));

      // Always add start and end markers
      const startTime = new Date(positions[0].timestamp);
      const endTime = new Date(positions[positions.length - 1].timestamp);
      const formatTime = (d: Date) =>
        d.toLocaleString('vi-VN', {
          year: '2-digit',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });

      const startFeature = new Feature({ geometry: new Point(projected[0]) });
      startFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color: '#3b82f6' }),
            stroke: new Stroke({ color: '#1e40af', width: 1 }),
          }),
          text: new Text({
            text: `Bắt đầu ${formatTime(startTime)}`,
            offsetY: -14,
            font: '12px sans-serif',
            fill: new Fill({ color: '#1f2937' }),
            stroke: new Stroke({ color: 'white', width: 3 }),
          }),
        }),
      );
      pointsSource.addFeature(startFeature);

      const endFeature = new Feature({
        geometry: new Point(projected[projected.length - 1]),
      });
      endFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color: '#ef4444' }),
            stroke: new Stroke({ color: '#991b1b', width: 1 }),
          }),
          text: new Text({
            text: `Kết thúc ${formatTime(endTime)}`,
            offsetY: -14,
            font: '12px sans-serif',
            fill: new Fill({ color: '#1f2937' }),
            stroke: new Stroke({ color: 'white', width: 3 }),
          }),
        }),
      );
      pointsSource.addFeature(endFeature);

      // Intelligent sampling for intermediate points
      const zoom = map.getView().getZoom() ?? 8;
      const minPixelDistance = zoom < 7 ? 120 : zoom < 10 ? 80 : 40;
      let lastKeptPixel: [number, number] | null = null;
      const maxPoints = 200;
      let kept = 0;

      for (let i = 1; i < projected.length - 1; i++) {
        const coord = projected[i];
        const pixel = map.getPixelFromCoordinate(coord) as [number, number];
        if (!lastKeptPixel) {
          lastKeptPixel = pixel;
        } else {
          const dx = pixel[0] - lastKeptPixel[0];
          const dy = pixel[1] - lastKeptPixel[1];
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minPixelDistance) continue;
          lastKeptPixel = pixel;
        }
        if (kept >= maxPoints) break;
        kept++;

        const t = new Date(positions[i].timestamp);
        const feature = new Feature({ geometry: new Point(coord) });
        feature.set('timeLabel', formatTime(t));
        feature.setStyle(
          new Style({
            image: new CircleStyle({
              radius: 3,
              fill: new Fill({ color: '#10b981' }),
              stroke: new Stroke({ color: '#047857', width: 1 }),
            }),
          }),
        );
        pointsSource.addFeature(feature);
      }

      // Do not auto-zoom when showing history (keep user's current view)
    };

    // Initial build
    rebuild();

    // Hover interaction to show time labels on demand (throttled)
    const hoverOverlayStyle = (feature: FeatureLike) => {
      const label = feature.get('timeLabel');
      if (!label) return undefined;
      return new Style({
        image: new CircleStyle({
          radius: 4,
          fill: new Fill({ color: '#0ea5e9' }),
          stroke: new Stroke({ color: '#0369a1', width: 1 }),
        }),
        text: new Text({
          text: label,
          offsetY: -12,
          font: '12px sans-serif',
          fill: new Fill({ color: '#111827' }),
          stroke: new Stroke({ color: 'white', width: 3 }),
        }),
      });
    };

    let lastHover: Feature | null = null;
    let hoverRaf = 0;
    let pendingEvt: any = null;
    const processHover = (evt: any) => {
      if (!historyPointsLayerRef.current) return;
      const layer = historyPointsLayerRef.current;
      // Skip expensive hit detection if layer empty
      const src = layer.getSource();
      if (!src || src.getFeatures().length === 0) return;

      const pixel = evt.pixel;
      let hovered: Feature | null = null;
      map.forEachFeatureAtPixel(
        pixel,
        (f: FeatureLike, lyr) => {
          if (lyr === layer) {
            hovered = f as Feature;
            return true;
          }
          return undefined;
        },
        { hitTolerance: 10 },
      );

      if (lastHover && lastHover !== hovered) {
        // reset previous feature style
        lastHover.setStyle(
          new Style({
            image: new CircleStyle({
              radius: 3,
              fill: new Fill({ color: '#10b981' }),
              stroke: new Stroke({ color: '#047857', width: 1 }),
            }),
          }),
        );
      }

      if (hovered) {
        const style = hoverOverlayStyle(hovered as FeatureLike);
        if (style) (hovered as Feature).setStyle(style);
      }
      lastHover = hovered;
    };

    const onPointerMove = (evt: any) => {
      if (hoverRaf) {
        pendingEvt = evt;
        return;
      }
      hoverRaf = requestAnimationFrame(() => {
        const e = pendingEvt || evt;
        pendingEvt = null;
        hoverRaf = 0;
        processHover(e);
      });
    };

    map.on('pointermove', onPointerMove);

    // Rebuild on zoom/pan to adapt sampling density
    const onMoveEnd = () => {
      if (historyPath) rebuild();
    };
    map.on('moveend', onMoveEnd);

    return () => {
      map.un('pointermove', onPointerMove);
      map.un('moveend', onMoveEnd);
    };
  }, [historyPath, mapInstanceRef]);

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
