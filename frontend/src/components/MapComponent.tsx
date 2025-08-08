"use client";

import { useEffect, useRef } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { Icon, Style } from "ol/style";
import { fromLonLat } from "ol/proj";
import { useAircraftStore } from "../stores/aircraftStore";
import { useVesselStore } from "../stores/vesselStore";
import { apiService } from "../services/api";
import { websocketService } from "../services/websocket";

export default function MapComponent() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const aircraftLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const vesselLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

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

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // Create aircraft layer
    const aircraftSource = new VectorSource();
    const aircraftLayer = new VectorLayer({
      source: aircraftSource,
    });

    // Create vessel layer
    const vesselSource = new VectorSource();
    const vesselLayer = new VectorLayer({
      source: vesselSource,
    });

    // Create map
    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        aircraftLayer,
        vesselLayer,
      ],
      view: new View({
        center: fromLonLat([0, 0]), // Center of the world
        zoom: 2,
      }),
    });

    mapInstanceRef.current = map;
    aircraftLayerRef.current = aircraftLayer;
    vesselLayerRef.current = vesselLayer;

    return () => {
      map.setTarget(undefined);
    };
  }, []);

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

    const source = aircraftLayerRef.current.getSource();
    if (!source) return;

    source.clear();

    aircrafts.forEach((aircraft) => {
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

      feature.setStyle(
        new Style({
          image: new Icon({
            src: "/aircraft-icon.svg",
            scale: 1,
            rotation: aircraft.lastPosition.heading
              ? (aircraft.lastPosition.heading * Math.PI) / 180
              : 0,
          }),
        })
      );

      source.addFeature(feature);
    });
  }, [aircrafts]);

  // Update vessels on map
  useEffect(() => {
    if (!vesselLayerRef.current) return;

    const source = vesselLayerRef.current.getSource();
    if (!source) return;

    source.clear();

    vessels.forEach((vessel) => {
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

      feature.setStyle(
        new Style({
          image: new Icon({
            src: "/vessel-icon.svg",
            scale: 1,
            rotation: vessel.lastPosition.heading
              ? (vessel.lastPosition.heading * Math.PI) / 180
              : 0,
          }),
        })
      );

      source.addFeature(feature);
    });
  }, [vessels]);

  // WebSocket connection and real-time updates
  useEffect(() => {
    websocketService.connect();

    const handleAircraftUpdate = (data: unknown) => {
      console.log("Aircraft update:", data);
      // Update aircraft in store
      if (data && typeof data === "object" && "id" in data) {
        updateAircraft(data as any);
      }
    };

    const handleVesselUpdate = (data: unknown) => {
      console.log("Vessel update:", data);
      // Update vessel in store
      if (data && typeof data === "object" && "id" in data) {
        updateVessel(data as any);
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
    <div className="relative w-full h-screen">
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute top-4 left-4 bg-white p-4 rounded shadow">
        <h3 className="font-bold mb-2">Tracking Status</h3>
        <p>Aircraft: {aircrafts.length}</p>
        <p>Vessels: {vessels.length}</p>
      </div>
    </div>
  );
}
