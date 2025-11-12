/**
 * Quick Start Example - Using the New Map System
 * 
 * This file demonstrates how to use the refactored map initialization
 * system with minimal setup.
 */

import React, { useRef, useEffect } from 'react';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';

// Import the new system
import { useMapInitialization } from './index';

/**
 * Example 1: Basic usage (same as before!)
 */
export function BasicMapExample() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map>(null);
  const aircraftLayerRef = useRef<VectorLayer<any>>(null);
  const vesselLayerRef = useRef<VectorLayer<any>>(null);

  // Just use the hook - that's it!
  useMapInitialization({
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
  });

  return (
    <div 
      ref={mapRef} 
      style={{ width: '100%', height: '600px' }}
    />
  );
}

/**
 * Example 2: With data loading
 */
export function MapWithDataExample() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map>(null);
  const aircraftLayerRef = useRef<VectorLayer<any>>(null);
  const vesselLayerRef = useRef<VectorLayer<any>>(null);

  useMapInitialization({
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
  });

  // Load aircraft data
  useEffect(() => {
    if (!aircraftLayerRef.current) return;

    const source = aircraftLayerRef.current.getSource()?.getSource() as VectorSource;
    if (!source) return;

    // Example: Add some aircraft
    const aircraft = [
      {
        id: 'AC001',
        position: [106.6297, 10.8231], // Ho Chi Minh City
        heading: 45,
        operator: 'VietnamAirlines',
      },
      {
        id: 'AC002',
        position: [105.8542, 21.0285], // Hanoi
        heading: 90,
        operator: 'VietJet',
      },
    ];

    const features = aircraft.map(ac => {
      const feature = new Feature({
        geometry: new Point(fromLonLat(ac.position)),
        aircraft: {
          id: ac.id,
          operator: ac.operator,
          lastPosition: { heading: ac.heading },
        },
      });
      feature.setId(ac.id);
      return feature;
    });

    source.addFeatures(features);
  }, [aircraftLayerRef]);

  return (
    <div 
      ref={mapRef} 
      style={{ width: '100%', height: '600px' }}
    />
  );
}

/**
 * Example 3: With real-time updates
 */
export function MapWithRealTimeExample() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map>(null);
  const aircraftLayerRef = useRef<VectorLayer<any>>(null);
  const vesselLayerRef = useRef<VectorLayer<any>>(null);

  useMapInitialization({
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
  });

  // Simulate real-time updates
  useEffect(() => {
    if (!aircraftLayerRef.current) return;

    const source = aircraftLayerRef.current.getSource()?.getSource() as VectorSource;
    if (!source) return;

    // Update aircraft positions every second
    const interval = setInterval(() => {
      const features = source.getFeatures();
      
      features.forEach(feature => {
        const aircraft = feature.get('aircraft');
        if (!aircraft?.lastPosition) return;

        // Simulate movement
        const geometry = feature.getGeometry() as Point;
        const coords = geometry.getCoordinates();
        const heading = aircraft.lastPosition.heading;
        
        // Move 0.001 degrees in heading direction
        const rad = (heading * Math.PI) / 180;
        coords[0] += Math.cos(rad) * 0.001;
        coords[1] += Math.sin(rad) * 0.001;
        
        geometry.setCoordinates(coords);
      });

      // Trigger re-render
      source.changed();
    }, 1000);

    return () => clearInterval(interval);
  }, [aircraftLayerRef]);

  return (
    <div 
      ref={mapRef} 
      style={{ width: '100%', height: '600px' }}
    />
  );
}

/**
 * Example 4: With controls
 */
export function MapWithControlsExample() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map>(null);
  const aircraftLayerRef = useRef<VectorLayer<any>>(null);
  const vesselLayerRef = useRef<VectorLayer<any>>(null);

  useMapInitialization({
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
  });

  const toggleAircraft = () => {
    if (aircraftLayerRef.current) {
      const visible = aircraftLayerRef.current.getVisible();
      aircraftLayerRef.current.setVisible(!visible);
    }
  };

  const toggleVessels = () => {
    if (vesselLayerRef.current) {
      const visible = vesselLayerRef.current.getVisible();
      vesselLayerRef.current.setVisible(!visible);
    }
  };

  const zoomToVietnam = () => {
    if (mapInstanceRef.current) {
      const view = mapInstanceRef.current.getView();
      view.animate({
        center: fromLonLat([108.2194, 16.0544]),
        zoom: 6,
        duration: 1000,
      });
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div 
        ref={mapRef} 
        style={{ width: '100%', height: '600px' }}
      />
      
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        background: 'white',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}>
        <button onClick={toggleAircraft}>Toggle Aircraft</button>
        <button onClick={toggleVessels}>Toggle Vessels</button>
        <button onClick={zoomToVietnam}>Zoom to Vietnam</button>
      </div>
    </div>
  );
}

/**
 * Example 5: With cache monitoring (development only)
 */
export function MapWithMonitoringExample() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map>(null);
  const aircraftLayerRef = useRef<VectorLayer<any>>(null);
  const vesselLayerRef = useRef<VectorLayer<any>>(null);

  useMapInitialization({
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
  });

  // Monitor performance (development only)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const interval = setInterval(() => {
      // In production, you'd import getCacheStats from your style factory
      console.log('[Map Performance]', {
        timestamp: new Date().toISOString(),
        memory: (performance as any).memory 
          ? `${((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`
          : 'N/A',
        features: {
          aircraft: aircraftLayerRef.current?.getSource()?.getSource()?.getFeatures().length ?? 0,
          vessels: vesselLayerRef.current?.getSource()?.getSource()?.getFeatures().length ?? 0,
        },
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      ref={mapRef} 
      style={{ width: '100%', height: '600px' }}
    />
  );
}

/**
 * Example 6: Complete production-ready component
 */
interface MapComponentProps {
  onMapReady?: (map: Map) => void;
  onAircraftClick?: (aircraftId: string) => void;
  onVesselClick?: (vesselId: string) => void;
}

export function ProductionMapComponent({
  onMapReady,
  onAircraftClick,
  onVesselClick,
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map>(null);
  const aircraftLayerRef = useRef<VectorLayer<any>>(null);
  const vesselLayerRef = useRef<VectorLayer<any>>(null);

  useMapInitialization({
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
  });

  // Notify parent when map is ready
  useEffect(() => {
    if (mapInstanceRef.current && onMapReady) {
      onMapReady(mapInstanceRef.current);
    }
  }, [onMapReady]);

  // Handle click events
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleClick = (evt: any) => {
      map.forEachFeatureAtPixel(evt.pixel, (feature) => {
        const aircraft = feature.get('aircraft');
        const vessel = feature.get('vessel');

        if (aircraft && onAircraftClick) {
          onAircraftClick(aircraft.id);
          return true;
        }

        if (vessel && onVesselClick) {
          onVesselClick(vessel.id);
          return true;
        }

        return false;
      });
    };

    map.on('click', handleClick);

    return () => {
      map.un('click', handleClick);
    };
  }, [onAircraftClick, onVesselClick]);

  return (
    <div 
      ref={mapRef} 
      style={{ width: '100%', height: '100%' }}
    />
  );
}

/**
 * Example usage in a parent component:
 */
export function App() {
  const handleMapReady = (map: Map) => {
    console.log('Map is ready!', map);
  };

  const handleAircraftClick = (id: string) => {
    console.log('Aircraft clicked:', id);
    // Show details panel, etc.
  };

  const handleVesselClick = (id: string) => {
    console.log('Vessel clicked:', id);
    // Show details panel, etc.
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ProductionMapComponent
        onMapReady={handleMapReady}
        onAircraftClick={handleAircraftClick}
        onVesselClick={handleVesselClick}
      />
    </div>
  );
}
