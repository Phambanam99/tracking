import React, { useMemo, useState } from 'react';
import { useAircraftStore } from '@/stores/aircraftStore';
import { useVesselStore } from '@/stores/vesselStore';

interface DrawingActionPopupProps {
  isVisible: boolean;
  geometry: object | null;
  position: { x: number; y: number };
  onCreateAlert: (alertName: string) => void;
  onSearchInRegion: () => void;
  onCancel: () => void;
}

type LonLat = [number, number];

type PolygonBoundary = {
  type: 'Polygon';
  coordinates: LonLat[][]; // [ [ [lon,lat], ... ] ]
};

type CircleBoundary = {
  type: 'Circle';
  center: LonLat; // [lon, lat]
  radius: number; // meters (EPSG:3857 units)
};

type Boundary = PolygonBoundary | CircleBoundary;

function haversineMeters(a: LonLat, b: LonLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

function isPointInPolygon(point: LonLat, polygon: LonLat[]): boolean {
  // Ray casting algorithm; polygon is a ring [ [lon,lat], ... ] (closed or open)
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];
    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const DrawingActionPopup: React.FC<DrawingActionPopupProps> = ({
  isVisible,
  geometry,
  position,
  onCreateAlert,
  onSearchInRegion,
  onCancel,
}) => {
  const { aircrafts } = useAircraftStore();
  const { vessels } = useVesselStore();

  const [step, setStep] = useState<'actions' | 'chooseType' | 'results'>(
    'actions',
  );
  const [entityType, setEntityType] = useState<'aircraft' | 'vessel' | null>(
    null,
  );

  const handleCreateAlert = () => {
    const alertName = `Vùng cảnh báo ${Date.now()}`;
    onCreateAlert(alertName);
  };
  const boundary = (geometry as Boundary) || null;
  const geometryType = boundary?.type;

  const handleSearchClick = () => {
    setStep('chooseType');
  };

  const results = useMemo(() => {
    if (step !== 'results' || !entityType || !boundary) return [] as any[];

    const takePoint = (lon: number, lat: number): LonLat => [lon, lat];
    const inCircle = (pt: LonLat, c: CircleBoundary) =>
      haversineMeters(pt, c.center) <= c.radius;
    const inPolygon = (pt: LonLat, p: PolygonBoundary) =>
      isPointInPolygon(pt, p.coordinates[0]);

    if (entityType === 'aircraft') {
      return aircrafts.filter((a) => {
        const pos = a.lastPosition;
        if (!pos) return false;
        const pt = takePoint(pos.longitude, pos.latitude);
        return boundary.type === 'Circle'
          ? inCircle(pt, boundary)
          : inPolygon(pt, boundary);
      });
    } else {
      return vessels.filter((v) => {
        const pos = v.lastPosition;
        if (!pos) return false;
        const pt = takePoint(pos.longitude, pos.latitude);
        return boundary.type === 'Circle'
          ? inCircle(pt, boundary)
          : inPolygon(pt, boundary);
      });
    }
  }, [step, entityType, boundary, aircrafts, vessels]);

  // Early escape after hooks to preserve hook order
  if (!isVisible || !geometry) return null;

  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-64"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {step === 'actions' && (
        <>
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Bạn muốn làm gì với vùng vừa vẽ?
            </h3>
            <p className="text-sm text-gray-600">
              Chọn hành động cho vùng{' '}
              {geometryType === 'Polygon' ? 'đa giác' : 'tròn'} vừa tạo:
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleCreateAlert}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5C3.312 18.167 4.274 19 5.814 19z"
                />
              </svg>
              <span>Tạo vùng cảnh báo</span>
            </button>

            <button
              onClick={handleSearchClick}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span>Tìm kiếm tàu thuyền & máy bay</span>
            </button>

            <button
              onClick={onCancel}
              className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Hủy bỏ
            </button>
          </div>
        </>
      )}

      {step === 'chooseType' && (
        <>
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Chọn loại đối tượng để tìm kiếm
            </h3>
            <p className="text-sm text-gray-600">
              Vùng {geometryType === 'Polygon' ? 'đa giác' : 'tròn'} sẽ được
              dùng để lọc theo vị trí hiện tại.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => {
                setEntityType('aircraft');
                setStep('results');
              }}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              ✈️ Máy bay trong vùng
            </button>
            <button
              onClick={() => {
                setEntityType('vessel');
                setStep('results');
              }}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              🚢 Tàu thuyền trong vùng
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setStep('actions')}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Quay lại
              </button>
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </>
      )}

      {step === 'results' && entityType && (
        <>
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">
              {entityType === 'aircraft' ? 'Máy bay' : 'Tàu thuyền'} trong vùng
            </h3>
            <p className="text-sm text-gray-600">
              Tìm thấy <span className="font-semibold">{results.length}</span>{' '}
              đối tượng.
            </p>
          </div>
          <div className="max-h-64 overflow-auto divide-y divide-gray-100 border rounded-md">
            {results.length === 0 && (
              <div className="p-4 text-sm text-gray-500">
                Không có đối tượng nào trong vùng.
              </div>
            )}
            {results.length > 0 &&
              results.slice(0, 50).map((item: any) => (
                <div key={`${entityType}-${item.id}`} className="p-3 text-sm">
                  {entityType === 'aircraft' ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {item.callSign || item.flightId}
                        </div>
                        <div className="text-gray-500">
                          {item.operator || 'Không rõ'}
                        </div>
                      </div>
                      <div className="text-gray-400">✈️</div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {item.vesselName || item.mmsi}
                        </div>
                        <div className="text-gray-500">
                          {item.flag || item.operator || 'Không rõ'}
                        </div>
                      </div>
                      <div className="text-gray-400">🚢</div>
                    </div>
                  )}
                </div>
              ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setStep('chooseType')}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Chọn lại loại
            </button>
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Đóng
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default DrawingActionPopup;
