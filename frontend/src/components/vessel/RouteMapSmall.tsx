'use client';

import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import { fromLonLat } from 'ol/proj';
import Overlay from 'ol/Overlay';
import api from '@/services/apiClient';
import 'ol/ol.css';

interface Position {
  id: number;
  latitude: number;
  longitude: number;
  speed?: number | null;
  course?: number | null;
  heading?: number | null;
  status?: string | null;
  timestamp: string;
}

interface RouteMapSmallProps {
  vesselId: number;
  height?: string;
}

export default function RouteMapSmall({ vesselId, height = '400px' }: RouteMapSmallProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  // Fetch position history
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.get(`/vessels/${vesselId}/history?page=1&pageSize=100`);
        const positionsList = Array.isArray(data.positions) ? data.positions : [];
        setPositions(positionsList);
      } catch (e) {
        console.error('Failed to load position history:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [vesselId]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: fromLonLat([106.0, 16.0]), // Default center (Vietnam)
        zoom: 6,
      }),
      controls: [],
    });

    mapInstanceRef.current = map;

    // Create popup overlay
    if (popupRef.current) {
      const overlay = new Overlay({
        element: popupRef.current,
        positioning: 'bottom-center',
        stopEvent: false,
        offset: [0, -10],
      });
      map.addOverlay(overlay);
      overlayRef.current = overlay;
    }

    // Handle click on features
    map.on('click', (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
      if (feature && feature.get('position')) {
        const pos = feature.get('position') as Position;
        setSelectedPosition(pos);
        if (overlayRef.current) {
          overlayRef.current.setPosition(evt.coordinate);
        }
      } else {
        setSelectedPosition(null);
        if (overlayRef.current) {
          overlayRef.current.setPosition(undefined);
        }
      }
    });

    // Change cursor on hover
    map.on('pointermove', (evt) => {
      const pixel = map.getEventPixel(evt.originalEvent);
      const hit = map.hasFeatureAtPixel(pixel);
      map.getTargetElement().style.cursor = hit ? 'pointer' : '';
    });

    return () => {
      map.setTarget(undefined);
      mapInstanceRef.current = null;
    };
  }, []);

  // Update route when positions change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || positions.length === 0) return;

    // Create route line layer
    const lineLayer = new VectorLayer({
      source: new VectorSource(),
      style: new Style({
        stroke: new Stroke({
          color: '#3b82f6',
          width: 3,
        }),
      }),
      zIndex: 1000,
    });

    // Create points layer
    const pointsLayer = new VectorLayer({
      source: new VectorSource(),
      zIndex: 1001,
    });

    map.addLayer(lineLayer);
    map.addLayer(pointsLayer);

    const lineSource = lineLayer.getSource();
    const pointsSource = pointsLayer.getSource();
    if (!lineSource || !pointsSource) return;

    // Add route line
    const projected = positions.map((p) =>
      fromLonLat([p.longitude, p.latitude])
    );
    const line = new LineString(projected);
    lineSource.addFeature(new Feature({ geometry: line }));

    // Add start and end markers
    const formatTime = (timestamp: string) => {
      const d = new Date(timestamp);
      return d.toLocaleString('vi-VN', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    // Start marker (blue)
    const startFeature = new Feature({ 
      geometry: new Point(projected[0]),
      position: positions[0],
    });
    startFeature.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: '#3b82f6' }),
          stroke: new Stroke({ color: '#1e40af', width: 2 }),
        }),
        text: new Text({
          text: `Kết thúc ${formatTime(positions[0].timestamp)}`,
          offsetY: -18,
          font: '11px sans-serif',
          fill: new Fill({ color: '#1f2937' }),
          stroke: new Stroke({ color: 'white', width: 3 }),
          textAlign: 'center',
        }),
      })
    );
    pointsSource.addFeature(startFeature);

    // End marker (red)
    const endPos = positions[positions.length - 1];
    const endFeature = new Feature({ 
      geometry: new Point(projected[projected.length - 1]),
      position: endPos,
    });
    endFeature.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: '#ef4444' }),
          stroke: new Stroke({ color: '#991b1b', width: 2 }),
        }),
        text: new Text({
          text: `Bắt đầu ${formatTime(endPos.timestamp)}`,
          offsetY: -18,
          font: '11px sans-serif',
          fill: new Fill({ color: '#1f2937' }),
          stroke: new Stroke({ color: 'white', width: 3 }),
          textAlign: 'center',
        }),
      })
    );
    pointsSource.addFeature(endFeature);

    // Add intermediate points (smaller, clickable)
    for (let i = 1; i < positions.length - 1; i++) {
      const pos = positions[i];
      const feature = new Feature({
        geometry: new Point(projected[i]),
        position: pos,
      });
      feature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 3,
            fill: new Fill({ color: '#60a5fa' }),
            stroke: new Stroke({ color: '#2563eb', width: 1 }),
          }),
        })
      );
      pointsSource.addFeature(feature);
    }

    // Fit map to route
    const extent = line.getExtent();
    map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });

    return () => {
      map.removeLayer(lineLayer);
      map.removeLayer(pointsLayer);
    };
  }, [positions]);

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}
      
      <div 
        ref={mapRef} 
        style={{ width: '100%', height }}
        className="rounded-lg overflow-hidden border border-gray-200"
      />

      {/* Popup */}
      <div
        ref={popupRef}
        className={`absolute bg-white rounded-lg shadow-lg p-3 text-xs border border-gray-200 ${
          selectedPosition ? 'block' : 'hidden'
        }`}
        style={{ minWidth: '200px' }}
      >
        {selectedPosition && (
          <div className="space-y-1">
            <div className="font-semibold text-gray-900 border-b pb-1 mb-1">
              Thông tin vị trí
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-gray-600">Thời gian:</span>
              <span className="text-gray-900 font-medium">
                {new Date(selectedPosition.timestamp).toLocaleString('vi-VN')}
              </span>
              
              <span className="text-gray-600">Vĩ độ:</span>
              <span className="text-gray-900">{selectedPosition.latitude.toFixed(6)}</span>
              
              <span className="text-gray-600">Kinh độ:</span>
              <span className="text-gray-900">{selectedPosition.longitude.toFixed(6)}</span>
              
              {selectedPosition.speed !== null && selectedPosition.speed !== undefined && (
                <>
                  <span className="text-gray-600">Tốc độ:</span>
                  <span className="text-gray-900">{selectedPosition.speed} knots</span>
                </>
              )}
              
              {selectedPosition.course !== null && selectedPosition.course !== undefined && (
                <>
                  <span className="text-gray-600">Hướng:</span>
                  <span className="text-gray-900">{selectedPosition.course}°</span>
                </>
              )}
              
              {selectedPosition.status && (
                <>
                  <span className="text-gray-600">Trạng thái:</span>
                  <span className="text-gray-900">{selectedPosition.status}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {positions.length === 0 && !loading && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          <div className="text-center">
            <div className="text-4xl mb-2">🗺️</div>
            <p>Không có dữ liệu lịch sử</p>
          </div>
        </div>
      )}
    </div>
  );
}
