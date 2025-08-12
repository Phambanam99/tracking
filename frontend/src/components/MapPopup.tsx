import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plane, Ship, MapPin, Clock, Move } from 'lucide-react';
import { useTrackingStore } from '@/stores/trackingStore';
import api from '@/services/apiClient';
import { useMapStore } from '@/stores/mapStore';

interface Aircraft {
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
}

interface Vessel {
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
}

interface MapPopupProps {
  feature: {
    aircraft?: Aircraft;
    vessel?: Vessel;
  } | null;
  position: [number, number] | null;
  onClose: () => void;
  isVisible: boolean;
}

const MapPopup: React.FC<MapPopupProps> = ({
  feature,
  position,
  onClose,
  isVisible,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [currentPosition, setCurrentPosition] = useState<
    [number, number] | null
  >(null);
  const [historyHours, setHistoryHours] = useState(24);
  const popupRef = useRef<HTMLDivElement>(null);

  // Tracking functionality
  const {
    isTracking,
    trackItem,
    untrackItem,
    loading: trackingLoading,
  } = useTrackingStore();

  const { setHistoryLoading, setHistoryError, setHistoryPath, clearHistory } =
    useMapStore();

  // Update current position when position prop changes - center the popup instead of using click position
  useEffect(() => {
    if (position) {
      // Always center the popup regardless of click position
      const [centerX, centerY] = getMapCenter();
      setCurrentPosition([centerX, centerY]);
      setDragOffset({ x: 0, y: 0 });
    }
  }, [position]);

  // Function to get map center coordinates
  const getMapCenter = () => {
    if (!popupRef.current) return [0, 0];

    const popup = popupRef.current;
    const mapContainer =
      popup.closest('.relative.w-full.h-full') || popup.closest('main');
    if (!mapContainer) return [0, 0];

    const mapRect = mapContainer.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();

    // Calculate center position within map container
    const centerX = (mapRect.width - popupRect.width) / 2;
    const centerY = (mapRect.height - popupRect.height) / 2;

    // Apply header offset
    const HEADER_HEIGHT = 80;
    const adjustedCenterY = Math.max(HEADER_HEIGHT, centerY);

    return [centerX, adjustedCenterY];
  };

  // Function to constrain popup within map bounds
  const constrainPosition = (x: number, y: number) => {
    if (!popupRef.current) return [x, y];

    const popup = popupRef.current;
    const mapContainer =
      popup.closest('.relative.w-full.h-full') || popup.closest('main');
    if (!mapContainer) return [x, y];

    const mapRect = mapContainer.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();

    // Header height is 64px (4rem), add some padding
    const HEADER_HEIGHT = 80;
    const PADDING = 20;

    // For dragging, x and y are already in viewport coordinates
    // Convert to relative coordinates within map container
    const relativeX = x - mapRect.left;
    const relativeY = y - mapRect.top;

    let constrainedX = relativeX;
    let constrainedY = relativeY;

    // Constrain X to map boundaries
    constrainedX = Math.min(
      Math.max(PADDING, relativeX),
      mapRect.width - popupRect.width - PADDING,
    );

    // Constrain Y to map boundaries
    constrainedY = Math.min(
      Math.max(HEADER_HEIGHT, relativeY),
      mapRect.height - popupRect.height - PADDING,
    );

    return [constrainedX, constrainedY];
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!currentPosition) return;

    setIsDragging(true);
    const rect = popupRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
    e.preventDefault();
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !currentPosition) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Constrain position within map bounds
      const [constrainedX, constrainedY] = constrainPosition(newX, newY);
      setCurrentPosition([constrainedX, constrainedY]);
    },
    [isDragging, currentPosition, dragOffset.x, dragOffset.y],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global mouse event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!isVisible || !feature || !currentPosition) return null;

  const isAircraft = feature.aircraft !== undefined;
  const data = isAircraft ? feature.aircraft! : feature.vessel!;
  const itemType = isAircraft ? 'aircraft' : 'vessel';
  const itemId = data.id;
  const isCurrentlyTracked = isTracking(itemType, itemId);

  const handleTrackToggle = async () => {
    try {
      if (isCurrentlyTracked) {
        await untrackItem(itemType, itemId);
      } else {
        await trackItem(itemType, itemId);
      }
    } catch (error) {
      console.error('Failed to toggle tracking:', error);
      // Show user-friendly error message
      const status = (error as any)?.status as number | undefined;
      const message = error instanceof Error ? error.message : '';
      if (status === 401 || status === 403 || message.toLowerCase().includes('forbidden') || message.toLowerCase().includes('unauthorized')) {
        alert(
          'Bạn cần đăng nhập để sử dụng tính năng theo dõi. Vui lòng đăng nhập và thử lại.',
        );
      } else {
        alert(
          'Có lỗi xảy ra khi thay đổi trạng thái theo dõi. Vui lòng thử lại.',
        );
      }
    }
  };

  const formatDateTime = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;

      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return 'Invalid date';
      }

      return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(dateObj);
    } catch (error) {
      console.error('Error formatting date:', error, date);
      return 'Invalid date';
    }
  };

  const formatCoordinate = (coord: number, isLongitude = false) => {
    const direction = isLongitude
      ? coord >= 0
        ? 'E'
        : 'W'
      : coord >= 0
        ? 'N'
        : 'S';
    return `${Math.abs(coord).toFixed(6)}° ${direction}`;
  };

  const loadHistory = async () => {
    if (!feature) return;
    const isAircraft = !!feature.aircraft;
    const id = isAircraft ? feature.aircraft!.id : feature.vessel!.id;
    const fromISO = new Date(
      Date.now() - historyHours * 3600 * 1000,
    ).toISOString();
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const endpoint = isAircraft
        ? `/aircrafts/${id}/history?from=${encodeURIComponent(fromISO)}`
        : `/vessels/${id}/history?from=${encodeURIComponent(fromISO)}`;
      const data = await api.get(endpoint);
      const positions = Array.isArray(data.positions) ? data.positions : [];
      setHistoryPath({
        type: isAircraft ? 'aircraft' : 'vessel',
        id,
        from: fromISO,
        positions: positions.map((p: any) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: p.timestamp,
        })),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Fetch history failed';
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div
      ref={popupRef}
      className={`absolute z-[2000] bg-white rounded-lg shadow-xl border border-gray-200 min-w-80 max-w-96 ${
        isDragging ? 'cursor-grabbing select-none' : 'cursor-default'
      }`}
      style={{
        left: currentPosition[0],
        top: currentPosition[1],
        transform: 'none',
      }}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 rounded-t-lg ${
          isAircraft
            ? 'bg-blue-50 border-b border-blue-100'
            : 'bg-green-50 border-b border-green-100'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isAircraft ? (
              <Plane className="h-5 w-5 text-blue-600" />
            ) : (
              <Ship className="h-5 w-5 text-green-600" />
            )}
            <h3 className="font-semibold text-gray-900">
              {isAircraft
                ? (data as Aircraft).callSign || (data as Aircraft).flightId
                : (data as Vessel).vesselName || (data as Vessel).mmsi}
            </h3>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onMouseDown={handleMouseDown}
              className={`text-gray-500 hover:text-gray-700 p-1 rounded ${
                isDragging ? 'bg-gray-200' : 'hover:bg-gray-100'
              }`}
              title="Kéo để di chuyển popup"
            >
              <Move className="h-4 w-4 cursor-grab" />
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Basic Info */}
        <div className="space-y-2">
          {isAircraft ? (
            <>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Số hiệu:</span>
                <span className="text-sm font-medium">
                  {(data as Aircraft).registration || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Loại máy bay:</span>
                <span className="text-sm font-medium">
                  {(data as Aircraft).aircraftType || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Hãng hàng không:</span>
                <span className="text-sm font-medium">
                  {(data as Aircraft).operator || 'N/A'}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">MMSI:</span>
                <span className="text-sm font-medium">
                  {(data as Vessel).mmsi}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Loại tàu:</span>
                <span className="text-sm font-medium">
                  {(data as Vessel).vesselType || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Quốc tịch:</span>
                <span className="text-sm font-medium">
                  {(data as Vessel).flag || 'N/A'}
                </span>
              </div>
              {(data as Vessel).length && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Kích thước:</span>
                  <span className="text-sm font-medium">
                    {(data as Vessel).length}m × {(data as Vessel).width}m
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Position Info */}
        {data.lastPosition && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center space-x-1 text-sm font-medium text-gray-700">
              <MapPin className="h-4 w-4" />
              <span>Vị trí hiện tại</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">Vĩ độ:</span>
                <div className="font-medium">
                  {formatCoordinate(data.lastPosition.latitude)}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Kinh độ:</span>
                <div className="font-medium">
                  {formatCoordinate(data.lastPosition.longitude, true)}
                </div>
              </div>
            </div>

            {/* Speed and additional info */}
            <div className="space-y-1">
              {data.lastPosition.speed && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tốc độ:</span>
                  <span className="font-medium">
                    {data.lastPosition.speed.toFixed(1)}{' '}
                    {isAircraft ? 'knots' : 'knots'}
                  </span>
                </div>
              )}

              {isAircraft &&
                (data.lastPosition as Aircraft['lastPosition'])?.altitude && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Độ cao:</span>
                    <span className="font-medium">
                      {(data.lastPosition as Aircraft['lastPosition'])!.altitude!.toLocaleString()}{' '}
                      ft
                    </span>
                  </div>
                )}

              {data.lastPosition.heading && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Hướng:</span>
                  <span className="font-medium">
                    {data.lastPosition.heading.toFixed(0)}°
                  </span>
                </div>
              )}

              {!isAircraft &&
                (data.lastPosition as Vessel['lastPosition'])?.status && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Trạng thái:</span>
                    <span className="font-medium">
                      {(data.lastPosition as Vessel['lastPosition'])!.status}
                    </span>
                  </div>
                )}
            </div>

            {/* Last update */}
            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>Cập nhật lần cuối:</span>
              </div>
              <span>{formatDateTime(data.lastPosition.timestamp)}</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex space-x-2 pt-3 border-t">
          <button
            onClick={() => {
              const id = isAircraft
                ? (data as Aircraft).id
                : (data as Vessel).id;
              const path = isAircraft ? `/aircraft/${id}` : `/vessels/${id}`;
              window.location.href = path;
            }}
            className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
          >
            Xem chi tiết
          </button>
          <button
            onClick={handleTrackToggle}
            disabled={trackingLoading}
            className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
              isCurrentlyTracked
                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            } ${trackingLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {trackingLoading
              ? 'Đang xử lý...'
              : isCurrentlyTracked
                ? 'Bỏ theo dõi'
                : 'Theo dõi'}
          </button>
        </div>

        {/* History controls */}
        <div className="pt-3 border-t space-y-2">
          <div className="flex flex-col items-center justify-between">
            <label className=" flex justify-between text-sm text-gray-600 flex items-center space-x-2">
              <span>Khoảng thời gian (giờ):</span>
              <input
                type="number"
                min={1}
                max={2400}
                value={historyHours}
                onChange={(e) =>
                  setHistoryHours(
                    Math.max(1, Math.min(2400, Number(e.target.value) || 1)),
                  )
                }
                className="w-20 border rounded px-2 py-1 text-sm"
              />
            </label>
            <div className="flex justify-between space-x-2">
              <button
                onClick={loadHistory}
                className="px-3 py-2 text-sm bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition-colors"
              >
                Hiển thị lịch sử
              </button>
              <button
                onClick={clearHistory}
                className="px-3 py-2 text-sm bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              >
                Xóa lịch sử
              </button>
            </div>
          </div>
          {/* <p className="text-xs text-gray-500">Lịch sử sẽ vẽ đường đi trên bản đồ cho đối tượng được chọn.</p> */}
        </div>
      </div>
    </div>
  );
};

export default MapPopup;
