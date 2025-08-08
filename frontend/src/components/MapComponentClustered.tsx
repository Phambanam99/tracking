"use client";

import { useEffect, useRef, useMemo } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { Cluster } from "ol/source";
import { Icon, Style, Text, Fill, Stroke, Circle } from "ol/style";
import { fromLonLat } from "ol/proj";
import { useAircraftStore, Aircraft } from "../stores/aircraftStore";
import { useVesselStore, Vessel } from "../stores/vesselStore";
import { useMapStore } from "../stores/mapStore";
import { apiService } from "../services/api";
import { websocketService } from "../services/websocket";
import MapPopup from "./MapPopup";
import MapFilters from "./MapFiltersCollapsible";

export default function MapComponentClustered() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const aircraftLayerRef = useRef<VectorLayer<Cluster> | null>(null);
  const vesselLayerRef = useRef<VectorLayer<Cluster> | null>(null);

  const {
    aircrafts,
    setAircrafts,
    updateAircraft,
    setLoading: setAircraftLoading,
    setError: setAircraftError,
  } = useAircraftStore();

  const {
    vessels,
    setVessels,
    updateVessel,
    setLoading: setVesselLoading,
    setError: setVesselError,
  } = useVesselStore();

  const {
    filters,
    selectedFeature,
    popupPosition,
    isPopupVisible,
    toggleAircraftVisibility,
    toggleVesselVisibility,
    setSearchQuery,
    resetFilters,
    showPopup,
    hidePopup,
  } = useMapStore();

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

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // Create aircraft source and cluster
    const aircraftSource = new VectorSource();
    const aircraftCluster = new Cluster({
      source: aircraftSource,
      distance: 50, // pixels
    });
    const aircraftLayer = new VectorLayer({
      source: aircraftCluster,
      style: (feature) => {
        const features = feature.get("features");
        const size = features.length;

        if (size > 1) {
          // Cluster style
          return new Style({
            image: new Circle({
              radius: Math.min(15 + size * 2, 30),
              fill: new Fill({ color: "rgba(59, 130, 246, 0.8)" }),
              stroke: new Stroke({ color: "white", width: 2 }),
            }),
            text: new Text({
              text: size.toString(),
              fill: new Fill({ color: "white" }),
              font: "bold 12px sans-serif",
            }),
          });
        }

        // Single aircraft style
        const aircraft = features[0].get("aircraft");
        return new Style({
          image: new Icon({
            src: "/aircraft-icon.svg",
            scale: 0.8,
            rotation: aircraft?.lastPosition?.heading
              ? (aircraft.lastPosition.heading * Math.PI) / 180
              : 0,
          }),
        });
      },
    });

    // Create vessel source and cluster
    const vesselSource = new VectorSource();
    const vesselCluster = new Cluster({
      source: vesselSource,
      distance: 50, // pixels
    });
    const vesselLayer = new VectorLayer({
      source: vesselCluster,
      style: (feature) => {
        const features = feature.get("features");
        const size = features.length;

        if (size > 1) {
          // Cluster style
          return new Style({
            image: new Circle({
              radius: Math.min(15 + size * 2, 30),
              fill: new Fill({ color: "rgba(34, 197, 94, 0.8)" }),
              stroke: new Stroke({ color: "white", width: 2 }),
            }),
            text: new Text({
              text: size.toString(),
              fill: new Fill({ color: "white" }),
              font: "bold 12px sans-serif",
            }),
          });
        }

        // Single vessel style
        const vessel = features[0].get("vessel");
        return new Style({
          image: new Icon({
            src: "/vessel-icon.svg",
            scale: 0.8,
            rotation: vessel?.lastPosition?.heading
              ? (vessel.lastPosition.heading * Math.PI) / 180
              : 0,
          }),
        });
      },
    });

    // Create map
    const map = new Map({
      target: mapRef.current,
      controls: [], // Remove all default controls including attribution
      layers: [
        new TileLayer({
          source: new OSM({
            attributions: [], // Remove OSM attribution
          }),
        }),
        aircraftLayer,
        vesselLayer,
      ],
      view: new View({
        center: fromLonLat([108.2194, 16.0544]), // Vietnam center
        zoom: 6,
      }),
    });

    // Add click handler
    map.on("singleclick", (event) => {
      const features = map.getFeaturesAtPixel(event.pixel);

      if (features.length > 0) {
        const clusterFeature = features[0];
        const clusteredFeatures = clusterFeature.get("features");

        if (clusteredFeatures.length === 1) {
          // Single feature clicked
          const feature = clusteredFeatures[0];
          const aircraft = feature.get("aircraft");
          const vessel = feature.get("vessel");

          const featureData = aircraft ? { aircraft } : { vessel };

          // Convert map pixel coordinates to viewport coordinates
          const mapElement = mapRef.current;
          if (mapElement) {
            const mapRect = mapElement.getBoundingClientRect();
            const viewportX = mapRect.left + event.pixel[0];
            const viewportY = mapRect.top + event.pixel[1];
            showPopup(featureData, [viewportX, viewportY]);
          }
        } else {
          // Cluster clicked - zoom in
          const extent = clusterFeature.getGeometry()?.getExtent();
          if (extent) {
            map.getView().fit(extent, {
              duration: 300,
              padding: [50, 50, 50, 50],
              maxZoom: 15,
            });
          }
        }
      } else {
        hidePopup();
      }
    });

    mapInstanceRef.current = map;
    aircraftLayerRef.current = aircraftLayer;
    vesselLayerRef.current = vesselLayer;

    return () => {
      map.setTarget(undefined);
    };
  }, [showPopup, hidePopup]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setAircraftLoading(true);
        setVesselLoading(true);

        const [aircraftData, vesselData] = await Promise.all([
          apiService.fetchAircrafts(),
          apiService.fetchVessels(),
        ]);

        setAircrafts(
          aircraftData.map((aircraft) => ({
            ...aircraft,
            createdAt: new Date(aircraft.createdAt),
            updatedAt: new Date(aircraft.updatedAt),
            lastPosition: aircraft.lastPosition
              ? {
                  ...aircraft.lastPosition,
                  timestamp: new Date(aircraft.lastPosition.timestamp),
                }
              : undefined,
          }))
        );

        setVessels(
          vesselData.map((vessel) => ({
            ...vessel,
            createdAt: new Date(vessel.createdAt),
            updatedAt: new Date(vessel.updatedAt),
            lastPosition: vessel.lastPosition
              ? {
                  ...vessel.lastPosition,
                  timestamp: new Date(vessel.lastPosition.timestamp),
                }
              : undefined,
          }))
        );
      } catch (error) {
        setAircraftError(
          error instanceof Error
            ? error.message
            : "Failed to load aircraft data"
        );
        setVesselError(
          error instanceof Error ? error.message : "Failed to load vessel data"
        );
      } finally {
        setAircraftLoading(false);
        setVesselLoading(false);
      }
    };

    loadData();
  }, [
    setAircrafts,
    setVessels,
    setAircraftLoading,
    setVesselLoading,
    setAircraftError,
    setVesselError,
  ]);

  // Update aircraft on map
  useEffect(() => {
    if (!aircraftLayerRef.current) return;

    const clusterSource = aircraftLayerRef.current.getSource();
    const source = clusterSource?.getSource() as VectorSource;
    if (!source) return;

    source.clear();

    filteredAircrafts.forEach((aircraft) => {
      if (!aircraft.lastPosition) return;

      const feature = new Feature({
        geometry: new Point(
          fromLonLat([
            aircraft.lastPosition.longitude,
            aircraft.lastPosition.latitude,
          ])
        ),
        aircraft,
      });

      source.addFeature(feature);
    });
  }, [filteredAircrafts]);

  // Update vessels on map
  useEffect(() => {
    if (!vesselLayerRef.current) return;

    const clusterSource = vesselLayerRef.current.getSource();
    const source = clusterSource?.getSource() as VectorSource;
    if (!source) return;

    source.clear();

    filteredVessels.forEach((vessel) => {
      if (!vessel.lastPosition) return;

      const feature = new Feature({
        geometry: new Point(
          fromLonLat([
            vessel.lastPosition.longitude,
            vessel.lastPosition.latitude,
          ])
        ),
        vessel,
      });

      source.addFeature(feature);
    });
  }, [filteredVessels]);

  // WebSocket connection and real-time updates
  useEffect(() => {
    websocketService.connect();

    const handleAircraftUpdate = (data: unknown) => {
      console.log("Aircraft update:", data);
      if (data && typeof data === "object" && "id" in data) {
        updateAircraft(data as Aircraft);
      }
    };

    const handleVesselUpdate = (data: unknown) => {
      console.log("Vessel update:", data);
      if (data && typeof data === "object" && "id" in data) {
        updateVessel(data as Vessel);
      }
    };

    websocketService.onAircraftUpdate(handleAircraftUpdate);
    websocketService.onVesselUpdate(handleVesselUpdate);

    return () => {
      websocketService.offAircraftUpdate(handleAircraftUpdate);
      websocketService.offVesselUpdate(handleVesselUpdate);
      websocketService.disconnect();
    };
  }, [updateAircraft, updateVessel]);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />

      {/* Map Controls */}
      <MapFilters
        filters={filters}
        onToggleAircraft={toggleAircraftVisibility}
        onToggleVessels={toggleVesselVisibility}
        onSearchChange={setSearchQuery}
        onResetFilters={resetFilters}
        aircraftCount={filteredAircrafts.length}
        vesselCount={filteredVessels.length}
      />

      {/* Popup */}
      <MapPopup
        feature={selectedFeature}
        position={popupPosition}
        onClose={hidePopup}
        isVisible={isPopupVisible}
      />
    </div>
  );
}
