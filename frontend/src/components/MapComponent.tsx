'use client';

import 'ol/ol.css';
import { useRef, useMemo, useEffect } from 'react';
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
// import MapFiltersRedesigned from './MapFilters';
import { useTrackingStore } from '../stores/trackingStore';
// import MapControls from './MapControls';
import LayersPanel from './LayersPanel';
import {
  useMapInitialization,
  useMapClickHandler,
  useDrawingMode,
  useRegionsRendering,
  useWebSocketHandler,
  useFeatureUpdater,
} from '../hooks';
import { useAircraftViewportLoader } from '@/hooks/useAircraftViewportLoader';
import { useVesselViewportLoader } from '@/hooks/useVesselViewportLoader';
import { useWeatherData } from '@/hooks/useWeatherData';
import { useWeatherLayer } from '@/hooks/useWeatherLayer';

export default function MapComponentClustered() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const aircraftLayerRef = useRef<VectorLayer<Cluster> | null>(null);
  const vesselLayerRef = useRef<VectorLayer<Cluster> | null>(null);
  const regionLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const historyLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const historyPointsLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const focusHighlightLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const lastDrawnFeatureRef = useRef<Feature | null>(null);

  const { aircrafts } = useAircraftStore();
  const { vessels } = useVesselStore();
  const { trackedItems } = useTrackingStore();
  const {
    filters,
    appliedFilters,
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
    showPopup,
    hidePopup,
    hideDrawingActionPopup,
    setActiveFilterTab,
    setFocusTarget,
    focusTarget,
  } = useMapStore();

  const { createRegion } = useRegionStore();

  // Controls now live inside LayersPanel

  // Use custom hooks for all functionality
  useWebSocketHandler();
  // Initialize map first so mapInstanceRef is ready
  useMapInitialization({
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
    regionLayerRef,
  });
  // Then attach viewport loaders (only for active tab to save bandwidth)
  // Both hooks are called unconditionally, but each checks if it should be active internally
  // This follows React's Rules of Hooks (hooks must be called in same order every render)
  useAircraftViewportLoader({ mapInstanceRef, isActive: activeFilterTab === 'aircraft' });
  useVesselViewportLoader({ mapInstanceRef, isActive: activeFilterTab === 'vessel' });
  useMapClickHandler({ mapInstanceRef, mapRef });
  useDrawingMode({ mapInstanceRef, regionLayerRef });
  useRegionsRendering({ regionLayerRef, mapInstanceRef });
  useFeatureUpdater({ aircraftLayerRef, vesselLayerRef });
  // Weather layer hooks
  useWeatherData({ mapInstanceRef });
  useWeatherLayer({ mapInstanceRef });

  // Viewport bbox updates handled inside split loaders

  // Respond to focusTarget by centering map and switching the tab/layer visibility
  useEffect(() => {
    if (!focusTarget || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const ensureHighlightLayer = () => {
      if (!focusHighlightLayerRef.current) {
        focusHighlightLayerRef.current = new VectorLayer({
          source: new VectorSource(),
          zIndex: 2002,
        });
        map.addLayer(focusHighlightLayerRef.current);
      }
      return focusHighlightLayerRef.current;
    };

    const animateFocus = (lon: number, lat: number) => {
      const layer = ensureHighlightLayer();
      const src = layer.getSource();
      if (!src) return;
      const feature = new Feature({
        geometry: new Point(fromLonLat([lon, lat])),
      });
      src.addFeature(feature);

      const totalCycles = 3;
      const cycleMs = 1000;
      const baseRadius = 10;
      const growRadius = 16;
      const startTs = performance.now();
      let raf = 0;

      const tick = () => {
        const now = performance.now();
        const elapsed = now - startTs;
        const progressAll = elapsed / (totalCycles * cycleMs);
        const cycleT = (elapsed % cycleMs) / cycleMs; // 0..1
        const radius = baseRadius + growRadius * cycleT;
        const opacity = 1 - cycleT; // fade out during cycle

        feature.setStyle(
          new Style({
            image: new CircleStyle({
              radius,
              fill: new Fill({ color: `rgba(220,38,38,${0.18 * opacity})` }),
              stroke: new Stroke({
                color: `rgba(220,38,38,${0.9 * Math.max(opacity, 0.25)})`,
                width: 2,
              }),
            }),
          }),
        );

        // Force re-render for smooth animation
        map.render();

        if (progressAll < 1) {
          raf = requestAnimationFrame(tick);
        } else {
          src.removeFeature(feature);
          if (raf) cancelAnimationFrame(raf);
        }
      };
      raf = requestAnimationFrame(tick);
    };

    const tryOpenPopupForTarget = (attemptsLeft: number) => {
      if (!mapRef.current || !mapInstanceRef.current) return;
      const mapEl = mapRef.current;
      const instance = mapInstanceRef.current;

      const openFor = (
        layerRef: React.RefObject<any>,
        attrKey: 'aircraft' | 'vessel',
      ) => {
        const layer = layerRef.current;
        if (!layer) return false;
        const src: any = layer.getSource();
        if (!src) return false;

        // Helper to open popup at coordinate
        const openAt = (coord: [number, number], featureData: any) => {
          const pixel = instance.getPixelFromCoordinate(coord);
          const rect = mapEl.getBoundingClientRect();
          const viewportX = rect.left + pixel[0];
          const viewportY = rect.top + pixel[1];
          showPopup(featureData, [viewportX, viewportY]);
          return true;
        };

        // Clustered source
        if (typeof src.getSource === 'function') {
          const clusterFeatures = src.getFeatures() as any[];
          for (const c of clusterFeatures) {
            const members = c.get('features') as any[] | undefined;
            if (!members || !Array.isArray(members)) continue;
            for (const m of members) {
              const data = m.get(attrKey);
              if (data && data.id === focusTarget.id) {
                const geom = c.getGeometry();
                if (!geom) continue;
                const coord = geom.getCoordinates();
                const featureData = attrKey === 'aircraft' ? { aircraft: data } : { vessel: data };
                return openAt(coord, featureData);
              }
            }
          }
          return false;
        }

        // Non-cluster vector source
        const features = src.getFeatures() as any[];
        for (const f of features) {
          const data = f.get(attrKey);
          if (data && data.id === focusTarget.id) {
            const geom = f.getGeometry();
            if (!geom) continue;
            const coord = geom.getCoordinates();
            const featureData = attrKey === 'aircraft' ? { aircraft: data } : { vessel: data };
            return openAt(coord, featureData);
          }
        }
        return false;
      };

      const ok =
        (focusTarget.type === 'aircraft'
          ? openFor(aircraftLayerRef as any, 'aircraft')
          : openFor(vesselLayerRef as any, 'vessel')) || false;

      if (!ok && attemptsLeft > 0) {
        // Retry shortly; features may not be ready yet
        setTimeout(() => tryOpenPopupForTarget(attemptsLeft - 1), 200);
      }
    };

    if (focusTarget.type === 'vessel') {
      if (activeFilterTab !== 'vessel') setActiveFilterTab('vessel');
      const vessel = vessels.find((v) => v.id === focusTarget.id);
      const lon = focusTarget.longitude ?? vessel?.lastPosition?.longitude;
      const lat = focusTarget.latitude ?? vessel?.lastPosition?.latitude;
      if (lon != null && lat != null) {
        animateFocus(lon, lat);
        const view = map.getView();
        view.animate({
          center: fromLonLat([lon, lat]),
          zoom: focusTarget.zoom ?? 9,
          duration: 400,
        });
        setTimeout(() => tryOpenPopupForTarget(8), 420);
      }
    } else if (focusTarget.type === 'aircraft') {
      if (activeFilterTab !== 'aircraft') setActiveFilterTab('aircraft');
      const aircraft = aircrafts.find((a) => a.id === focusTarget.id);
      const lon = focusTarget.longitude ?? aircraft?.lastPosition?.longitude;
      const lat = focusTarget.latitude ?? aircraft?.lastPosition?.latitude;
      if (lon != null && lat != null) {
        animateFocus(lon, lat);
        const view = map.getView();
        view.animate({
          center: fromLonLat([lon, lat]),
          zoom: focusTarget.zoom ?? 9,
          duration: 400,
        });
        setTimeout(() => tryOpenPopupForTarget(8), 420);
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
    showPopup,
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
        { hitTolerance: 18 },
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

    // Disable hit detection on low zoom to reduce readbacks
    const updatePointerListener = () => {
      const z = map.getView().getZoom() ?? 8;
      map.un('pointermove', onPointerMove as any);
      // Enable hover at lower zoom levels to make time labels easier to discover
      if (z >= 5) map.on('pointermove', onPointerMove);
    };
    updatePointerListener();
    map.getView().on('change:resolution', updatePointerListener);

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
  const activeFilters = appliedFilters ?? filters;

  const filteredAircrafts = useMemo(() => {
    const active = activeFilters;
    if (!active.showAircraft) return [];

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
        !active.aircraft.searchQuery &&
        !active.aircraft.operator &&
        !active.aircraft.aircraftType &&
        active.aircraft.minAltitude == null &&
        active.aircraft.maxAltitude == null &&
        active.aircraft.minSpeed == null &&
        active.aircraft.maxSpeed == null
      ) {
        return true;
      }

      const searchLower = (active.aircraft.searchQuery || '').toLowerCase();
      const matchesSearch =
        !searchLower ||
        aircraft.flightId.toLowerCase().includes(searchLower) ||
        aircraft.callSign?.toLowerCase().includes(searchLower) ||
        aircraft.registration?.toLowerCase().includes(searchLower) ||
        aircraft.operator?.toLowerCase().includes(searchLower) ||
        aircraft.aircraftType?.toLowerCase().includes(searchLower);

      const matchesOperator =
        !active.aircraft.operator ||
        (aircraft.operator || '')
          .toLowerCase()
          .includes(active.aircraft.operator.toLowerCase());
      const matchesType =
        !active.aircraft.aircraftType ||
        (aircraft.aircraftType || '')
          .toLowerCase()
          .includes(active.aircraft.aircraftType.toLowerCase());

      const speed = aircraft.lastPosition?.speed ?? null;
      const altitude = aircraft.lastPosition?.altitude ?? null;
      const matchesSpeedMin =
        active.aircraft.minSpeed == null ||
        (speed != null && speed >= active.aircraft.minSpeed);
      const matchesSpeedMax =
        active.aircraft.maxSpeed == null ||
        (speed != null && speed <= active.aircraft.maxSpeed);
      const matchesAltMin =
        active.aircraft.minAltitude == null ||
        (altitude != null && altitude >= active.aircraft.minAltitude);
      const matchesAltMax =
        active.aircraft.maxAltitude == null ||
        (altitude != null && altitude <= active.aircraft.maxAltitude);

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

    return result;
  }, [aircrafts, activeFilters, aircraftViewMode, trackedItems]);

  const filteredVessels = useMemo(() => {
    const active = activeFilters;
    if (!active.showVessels) return [];

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
        !active.vessel.searchQuery &&
        !active.vessel.operator &&
        !active.vessel.vesselType &&
        !active.vessel.flag &&
        active.vessel.minSpeed == null &&
        active.vessel.maxSpeed == null
      ) {
        return true;
      }

      const searchLower = (active.vessel.searchQuery || '').toLowerCase();
      const matchesSearch =
        !searchLower ||
        vessel.mmsi.toLowerCase().includes(searchLower) ||
        vessel.vesselName?.toLowerCase().includes(searchLower) ||
        vessel.operator?.toLowerCase().includes(searchLower) ||
        vessel.flag?.toLowerCase().includes(searchLower) ||
        vessel.vesselType?.toLowerCase().includes(searchLower);

      const matchesOperator =
        !active.vessel.operator ||
        (vessel.operator || '')
          .toLowerCase()
          .includes(active.vessel.operator.toLowerCase());
      const matchesType =
        !active.vessel.vesselType ||
        (vessel.vesselType || '')
          .toLowerCase()
          .includes(active.vessel.vesselType.toLowerCase());
      const matchesFlag =
        !active.vessel.flag ||
        (vessel.flag || '')
          .toLowerCase()
          .includes(active.vessel.flag.toLowerCase());

      const speed = vessel.lastPosition?.speed ?? null;
      const matchesSpeedMin =
        active.vessel.minSpeed == null ||
        (speed != null && speed >= active.vessel.minSpeed);
      const matchesSpeedMax =
        active.vessel.maxSpeed == null ||
        (speed != null && speed <= active.vessel.maxSpeed);

      return (
        matchesSearch &&
        matchesOperator &&
        matchesType &&
        matchesFlag &&
        matchesSpeedMin &&
        matchesSpeedMax
      );
    });
    return result;
  }, [vessels, activeFilters, vesselViewMode, trackedItems]);

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

      {/* Unified Layers Panel (replaces old controls + filters) */}
      <LayersPanel
        aircraftCount={filteredAircrafts.length}
        vesselCount={filteredVessels.length}
        trackedAircraftCount={trackedItems.filter((item) => item.type === 'aircraft').length}
        trackedVesselCount={trackedItems.filter((item) => item.type === 'vessel').length}
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
