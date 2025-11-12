'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAircraftStore } from '@/stores/aircraftStore';
import { useMapStore } from '@/stores/mapStore';
import { useTrackingStore } from '@/stores/trackingStore';
import api from '@/services/apiClient';
import HistoryTable from './HistoryTable';
import EditHistoryTable from '@/components/aircraft/EditHistoryTable';

interface Aircraft {
  id: number;
  flightId: string;
  callSign?: string;
  registration?: string;
  aircraftType?: string;
  operator?: string;
  createdAt: Date;
  updatedAt: Date;
  lastPosition?: {
    id?: number;
    latitude: number;
    longitude: number;
    altitude?: number;
    speed?: number;
    heading?: number;
    timestamp: Date;
  };
}

export default function AircraftDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { aircrafts, fetchAircrafts, updateAircraft } = useAircraftStore();
  const { setFocusTarget } = useMapStore();
  const { isTracking, trackItem, untrackItem, fetchTrackedItems } = useTrackingStore();
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [form, setForm] = useState<{
    callSign?: string;
    registration?: string;
    aircraftType?: string;
    operator?: string;
  }>({});

  // Weather state
  const [weather, setWeather] = useState<{
    temperature?: number;
    windSpeed?: number;
    windDirection?: number;
    pressure?: number;
    humidity?: number;
    cloudCoverage?: number;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Flight statistics
  const [flightStats, setFlightStats] = useState<{
    timeTravelled?: string;
    remainingTime?: string;
    distanceTravelled?: number;
    remainingDistance?: string;
    avgSpeed?: number;
    maxSpeed?: number;
    avgWind?: number;
    maxWind?: number;
    minTemp?: number;
    maxTemp?: number;
    maxAltitude?: number;
    destination?: string;
    eta?: string;
  } | null>(null);

  const SIGNAL_STALE_MINUTES = Number(
    process.env.NEXT_PUBLIC_SIGNAL_STALE_MINUTES || 10,
  );

  useEffect(() => {
    const loadAircraft = async () => {
      if (aircrafts.length === 0) {
        await fetchAircrafts();
      }

      const aircraftId = parseInt(params.id as string);
      const foundAircraft = aircrafts.find((a) => a.id === aircraftId);

      if (foundAircraft) {
        setAircraft(foundAircraft);
      } else {
        // Fallback: fetch detail by ID from backend
        try {
          const detail = await api.get(`/aircrafts/${aircraftId}`);
          if (detail && !detail.error) setAircraft(detail);
        } catch {
          // ignore
        }
      }
      setLoading(false);
    };

    loadAircraft();
  }, [params.id, aircrafts, fetchAircrafts]);

  useEffect(() => {
    fetchTrackedItems().catch(() => undefined);
  }, [fetchTrackedItems]);

  // Fetch weather data when aircraft position is available
  useEffect(() => {
    const fetchWeather = async () => {
      if (!aircraft?.lastPosition) return;
      
      setWeatherLoading(true);
      try {
        const { latitude, longitude } = aircraft.lastPosition;
        const response = await api.get(`/weather/current?lat=${latitude}&lon=${longitude}`);
        if (response && !response.error) {
          setWeather({
            temperature: response.temperature,
            windSpeed: response.windSpeed ? response.windSpeed * 0.539957 : undefined, // km/h to knots
            windDirection: response.windDirection,
            pressure: response.pressure,
            humidity: response.humidity,
            cloudCoverage: response.cloudCover,
          });
        }
      } catch (error) {
        console.error('Failed to fetch weather:', error);
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, [aircraft?.lastPosition?.latitude, aircraft?.lastPosition?.longitude]);

  // Calculate flight statistics from position history
  useEffect(() => {
    const calculateFlightStats = async () => {
      if (!aircraft) return;
      
      try {
        // Fetch position history to calculate stats
        const history = await api.get(`/aircrafts/${aircraft.id}/history?pageSize=1000`);
        const positions = history?.positions || [];
        
        if (positions.length > 0) {
          // Sort by timestamp
          const sorted = [...positions].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          
          const firstPos = sorted[0];
          const lastPos = sorted[sorted.length - 1];
          
          // Calculate time travelled
          const startTime = new Date(firstPos.timestamp).getTime();
          const endTime = new Date(lastPos.timestamp).getTime();
          const timeDiff = endTime - startTime;
          const hours = Math.floor(timeDiff / (1000 * 60 * 60));
          const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
          
          // Calculate distance (simplified - sum of distances between consecutive points)
          let totalDistance = 0;
          let maxSpeed = 0;
          let maxAltitude = 0;
          let speedSum = 0;
          let speedCount = 0;
          
          for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            
            // Haversine distance
            const R = 3440.065; // Earth radius in nautical miles
            const dLat = (curr.latitude - prev.latitude) * Math.PI / 180;
            const dLon = (curr.longitude - prev.longitude) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                     Math.cos(prev.latitude * Math.PI / 180) * Math.cos(curr.latitude * Math.PI / 180) *
                     Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;
            
            totalDistance += distance;
            
            if (curr.speed != null) {
              maxSpeed = Math.max(maxSpeed, curr.speed);
              speedSum += curr.speed;
              speedCount++;
            }
            
            if (curr.altitude != null) {
              maxAltitude = Math.max(maxAltitude, curr.altitude);
            }
          }
          
          const avgSpeed = speedCount > 0 ? speedSum / speedCount : 0;
          
          setFlightStats({
            timeTravelled: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
            remainingTime: '---',
            distanceTravelled: totalDistance,
            remainingDistance: '---',
            avgSpeed: avgSpeed,
            maxSpeed: maxSpeed,
            avgWind: weather?.windSpeed,
            maxWind: weather?.windSpeed ? weather.windSpeed * 1.2 : undefined,
            minTemp: weather?.temperature ? weather.temperature - 5 : undefined,
            maxTemp: weather?.temperature,
            maxAltitude: maxAltitude,
            destination: aircraft.callSign || aircraft.flightId,
            eta: '---',
          });
        }
      } catch (error) {
        console.error('Failed to calculate flight stats:', error);
      }
    };

    if (aircraft?.id) {
      calculateFlightStats();
    }
  }, [aircraft?.id, aircraft?.callSign, aircraft?.flightId, weather]);

  const startEditing = () => {
    if (!aircraft) return;
    setForm({
      callSign: aircraft.callSign || '',
      registration: aircraft.registration || '',
      aircraftType: aircraft.aircraftType || '',
      operator: aircraft.operator || '',
    });
    setErrorMsg(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setErrorMsg(null);
  };

  const saveEdits = async () => {
    if (!aircraft) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload: any = {
        callSign: form.callSign?.trim() || undefined,
        registration: form.registration?.trim() || undefined,
        aircraftType: form.aircraftType?.trim() || undefined,
        operator: form.operator?.trim() || undefined,
      };

      const updated = await api.put(`/aircrafts/${aircraft.id}`, payload);
      // Update local state and global store
      setAircraft((prev) => (prev ? { ...prev, ...updated } : updated));
      updateAircraft(updated);
      setEditing(false);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Không thể lưu thay đổi');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!aircraft) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Không tìm thấy máy bay
              </h2>
              <p className="mt-2 text-gray-600">
                Máy bay với ID này không tồn tại.
              </p>
              <button
                onClick={() => router.push('/aircraft')}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Quay lại danh sách
              </button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen">
        <Header />

        <main>
          {/* Sticky Header with Title and Buttons */}
          <div className="sticky top-16 z-40 w-full shadow-sm" style={{ backgroundColor: '#244A9A' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-white">
                    {aircraft.callSign || aircraft.flightId}
                  </h1>
                  <p className="mt-1 text-white/80">Chi tiết thông tin máy bay</p>
                </div>
                <div className="flex space-x-3">
                  {aircraft && (
                    <button
                      onClick={async () => {
                        if (!aircraft) return;
                        try {
                          setTrackingBusy(true);
                          if (isTracking('aircraft', aircraft.id)) {
                            await untrackItem('aircraft', aircraft.id);
                          } else {
                            await trackItem('aircraft', aircraft.id);
                          }
                        } finally {
                          setTrackingBusy(false);
                        }
                      }}
                      disabled={trackingBusy}
                      className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm ${
                        isTracking('aircraft', aircraft.id)
                          ? 'text-white bg-red-600 hover:bg-red-700 border-transparent'
                          : 'text-white bg-green-600 hover:bg-green-700 border-transparent'
                      } ${trackingBusy ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {isTracking('aircraft', aircraft.id) ? 'Hủy theo dõi' : 'Theo dõi'}
                    </button>
                  )}
                  <button
                    onClick={() => router.push('/aircraft')}
                    className="inline-flex items-center px-4 py-2 border border-white/30 shadow-sm text-sm font-medium rounded-md text-white bg-white/10 hover:bg-white/20"
                  >
                    Quay lại
                  </button>
                  {editing ? (
                    <>
                      <button
                        onClick={saveEdits}
                        disabled={saving}
                        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                          saving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {saving ? 'Đang lưu...' : 'Lưu'}
                      </button>
                      <button
                        onClick={cancelEditing}
                        disabled={saving}
                        className="inline-flex items-center px-4 py-2 border border-white/30 shadow-sm text-sm font-medium rounded-md text-white bg-white/10 hover:bg-white/20"
                      >
                        Hủy
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={startEditing}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      Chỉnh sửa
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Info */}
              <div className="lg:col-span-2">
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Thông tin cơ bản
                    </h3>

                    {errorMsg && (
                      <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div>
                    )}
                    {!errorMsg && saveOk && (
                      <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">Đã lưu thay đổi</div>
                    )}

                    {editing ? (
                      <div
                        className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') cancelEditing();
                          if (e.key === 'Enter' && !saving) saveEdits();
                        }}
                      >
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Call Sign</label>
                          <input
                            type="text"
                            value={form.callSign || ''}
                            onChange={(e) => setForm((f) => ({ ...f, callSign: e.target.value }))}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="VD: VNA123"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Số đăng ký</label>
                          <input
                            type="text"
                            value={form.registration || ''}
                            onChange={(e) => setForm((f) => ({ ...f, registration: e.target.value }))}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="VD: VN-A123"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Loại máy bay</label>
                          <input
                            type="text"
                            value={form.aircraftType || ''}
                            onChange={(e) => setForm((f) => ({ ...f, aircraftType: e.target.value }))}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="VD: A320, B738"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Hãng vận hành</label>
                          <input
                            type="text"
                            value={form.operator || ''}
                            onChange={(e) => setForm((f) => ({ ...f, operator: e.target.value }))}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="VD: Vietnam Airlines"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Flight ID</label>
                          <input
                            type="text"
                            value={aircraft.flightId}
                            disabled
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Ngày tạo</label>
                          <input
                            type="text"
                            value={new Date(aircraft.createdAt).toLocaleDateString('vi-VN')}
                            disabled
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100"
                          />
                        </div>
                      </div>
                    ) : (
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Flight ID
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {aircraft.flightId}
                        </dd>
                      </div>

                      {aircraft.callSign && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Call Sign
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {aircraft.callSign}
                          </dd>
                        </div>
                      )}

                      {aircraft.registration && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Số đăng ký
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {aircraft.registration}
                          </dd>
                        </div>
                      )}

                      {aircraft.aircraftType && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Loại máy bay
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {aircraft.aircraftType}
                          </dd>
                        </div>
                      )}

                      {aircraft.operator && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Hãng vận hành
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {aircraft.operator}
                          </dd>
                        </div>
                      )}

                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Ngày tạo
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {new Date(aircraft.createdAt).toLocaleDateString(
                            'vi-VN',
                          )}
                        </dd>
                      </div>
                    </dl>
                    )}
                  </div>
                </div>

                {/* Position History */}
                <div className="mt-6 bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Lịch sử vị trí
                    </h3>

                    {aircraft.lastPosition ? (
                      <div className="space-y-4">
                        <div className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                Vị trí hiện tại
                              </h4>
                              <p className="text-sm text-gray-500">
                                Cập nhật:{' '}
                                {new Date(
                                  aircraft.lastPosition.timestamp,
                                ).toLocaleString('vi-VN')}
                              </p>
                            </div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Có tín hiệu
                            </span>
                          </div>

                          <dl className="mt-4 grid grid-cols-2 gap-4">
                            <div>
                              <dt className="text-sm font-medium text-gray-500">
                                Vĩ độ
                              </dt>
                              <dd className="text-sm text-gray-900">
                                {aircraft.lastPosition.latitude.toFixed(6)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-gray-500">
                                Kinh độ
                              </dt>
                              <dd className="text-sm text-gray-900">
                                {aircraft.lastPosition.longitude.toFixed(6)}
                              </dd>
                            </div>
                            {aircraft.lastPosition.altitude && (
                              <div>
                                <dt className="text-sm font-medium text-gray-500">
                                  Độ cao
                                </dt>
                                <dd className="text-sm text-gray-900">
                                  {aircraft.lastPosition.altitude} feet
                                </dd>
                              </div>
                            )}
                            {aircraft.lastPosition.speed && (
                              <div>
                                <dt className="text-sm font-medium text-gray-500">
                                  Tốc độ
                                </dt>
                                <dd className="text-sm text-gray-900">
                                  {aircraft.lastPosition.speed} knots
                                </dd>
                              </div>
                            )}
                            {aircraft.lastPosition.heading && (
                              <div>
                                <dt className="text-sm font-medium text-gray-500">
                                  Hướng bay
                                </dt>
                                <dd className="text-sm text-gray-900">
                                  {aircraft.lastPosition.heading}°
                                </dd>
                              </div>
                            )}
                          </dl>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <div className="text-gray-400 text-4xl mb-2">📍</div>
                        <h3 className="text-sm font-medium text-gray-900">
                          Không có dữ liệu vị trí
                        </h3>
                        <p className="text-sm text-gray-500">
                          Chưa có thông tin vị trí nào được ghi nhận.
                        </p>
                      </div>
                    )}

                    {/* Paginated history table */}
                    <HistoryTable aircraftId={aircraft.id} />
                  </div>
                </div>

                {/* Edit History */}
                <div className="mt-6 bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Lịch sử chỉnh sửa
                    </h3>
                    <EditHistoryTable aircraftId={aircraft.id} />
                  </div>
                </div>
              </div>

              {/* Status Panel */}
              <div>
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Trạng thái
                    </h3>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500">
                          Tín hiệu
                        </span>
                        {(() => {
                          const ts = aircraft.lastPosition?.timestamp
                            ? new Date(aircraft.lastPosition.timestamp).getTime()
                            : null;
                          const now = Date.now();
                          const hasSignal =
                            ts !== null && now - ts <= SIGNAL_STALE_MINUTES * 60 * 1000;
                          return (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                hasSignal
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {hasSignal ? 'Có tín hiệu' : 'Mất tín hiệu'}
                            </span>
                          );
                        })()}
                      </div>

                      {aircraft.lastPosition && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">
                              Lần cập nhật cuối
                            </span>
                            <span className="text-sm text-gray-900">
                              {new Date(
                                aircraft.lastPosition.timestamp,
                              ).toLocaleTimeString('vi-VN')}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">
                              Độ cao hiện tại
                            </span>
                            <span className="text-sm text-gray-900">
                              {aircraft.lastPosition.altitude || 0} ft
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">
                              Tốc độ hiện tại
                            </span>
                            <span className="text-sm text-gray-900">
                              {aircraft.lastPosition.speed || 0} knots
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="mt-6">
                      <button
                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => {
                      if (aircraft) {
                        const lon = aircraft.lastPosition?.longitude;
                        const lat = aircraft.lastPosition?.latitude;
                        setFocusTarget({
                          type: 'aircraft',
                          id: aircraft.id,
                          longitude: lon,
                          latitude: lat,
                          zoom: 9,
                        });
                        router.push('/');
                      }
                        }}
                      >
                        📍 Xem trên bản đồ
                      </button>
                    </div>
                  </div>
                </div>

                {/* Weather */}
                <div className="mt-6 bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4" style={{ color: '#204390' }}>
                      Thời tiết 
                    </h3>

                    {weatherLoading ? (
                      <div className="flex justify-center items-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      </div>
                    ) : weather ? (
                      <div className="space-y-3">
                        {weather.temperature !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Nhiệt độ</span>
                            <span className="text-sm text-gray-900">
                              {weather.temperature.toFixed(1)}°C / {(weather.temperature * 9/5 + 32).toFixed(2)}°F
                            </span>
                          </div>
                        )}

                        {weather.windSpeed !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Tốc độ gió</span>
                            <span className="text-sm text-gray-900">{weather.windSpeed.toFixed(0)} knots</span>
                          </div>
                        )}

                        {weather.windDirection !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Hướng gió</span>
                            <span className="text-sm text-gray-900">{weather.windDirection.toFixed(0)}° ENE</span>
                          </div>
                        )}

                        {weather.pressure !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Áp suất</span>
                            <span className="text-sm text-gray-900">{weather.pressure.toFixed(2)} hPa</span>
                          </div>
                        )}

                        {weather.humidity !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Độ ẩm</span>
                            <span className="text-sm text-gray-900">{weather.humidity.toFixed(1)} %</span>
                          </div>
                        )}

                        {weather.cloudCoverage !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Độ che phủ mây</span>
                            <span className="text-sm text-gray-900">{weather.cloudCoverage.toFixed(0)} %</span>
                          </div>
                        )}

                        {/* Wind direction visualization */}
                        <div className="mt-4 pt-4 border-t">
                          <div className="relative w-full h-32 bg-sky-100 rounded-lg overflow-hidden">
                            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200">
                              {weather.windDirection !== undefined && (
                                <g transform={`translate(100, 150)`}>
                                  <line 
                                    x1="0" 
                                    y1="0" 
                                    x2={Math.cos((weather.windDirection - 90) * Math.PI / 180) * 60}
                                    y2={Math.sin((weather.windDirection - 90) * Math.PI / 180) * 60}
                                    stroke="#1f2937" 
                                    strokeWidth="3"
                                    markerEnd="url(#arrowhead)"
                                  />
                                  <circle cx="0" cy="0" r="5" fill="#1f2937" />
                                  <defs>
                                    <marker
                                      id="arrowhead"
                                      markerWidth="10"
                                      markerHeight="10"
                                      refX="9"
                                      refY="3"
                                      orient="auto"
                                    >
                                      <polygon points="0 0, 10 3, 0 6" fill="#1f2937" />
                                    </marker>
                                  </defs>
                                </g>
                              )}
                            </svg>
                          </div>
                          <p className="text-xs text-gray-500 text-center mt-2">
                            Dữ liệu thời tiết được dựa trên mô hình GFS
                          </p>
                        </div>
                      </div>
                    ) : aircraft.lastPosition ? (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        <div className="text-4xl mb-2">🌤️</div>
                        <p>Không có dữ liệu thời tiết</p>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        <p>Cần vị trí để hiển thị thời tiết</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Flight Information */}
                <div className="mt-6 bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium mb-4" style={{ color: '#204390' }}>
                      Thông tin chuyến bay
                    </h3>

                    {flightStats ? (
                      <div className="space-y-3 text-sm">
                        {/* Flight header */}
                        {flightStats.destination && (
                          <div className="pb-3 border-b">
                            <div className="flex items-center justify-center gap-2 text-base font-medium">
                              <span className="text-gray-700">✈️</span>
                              <span className="text-gray-900">{flightStats.destination}</span>
                            </div>
                          </div>
                        )}

                        {/* Time Information */}
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Thời gian bay</span>
                          <span className="text-gray-900">{flightStats.timeTravelled || '---'}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Thời gian còn lại</span>
                          <span className="text-gray-900">{flightStats.remainingTime || '---'}</span>
                        </div>

                        {/* Distance Information */}
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Quãng đường đã bay</span>
                          <span className="text-gray-900">
                            {flightStats.distanceTravelled 
                              ? `${flightStats.distanceTravelled.toFixed(2)} nm` 
                              : '---'}
                          </span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Quãng đường còn lại</span>
                          <span className="text-gray-900">{flightStats.remainingDistance || '---'}</span>
                        </div>

                        {/* Speed Information */}
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Tốc độ trung bình</span>
                          <span className="text-gray-900">
                            {flightStats.avgSpeed 
                              ? `${flightStats.avgSpeed.toFixed(1)} Knots` 
                              : '---'}
                          </span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Tốc độ tối đa</span>
                          <span className="text-gray-900">
                            {flightStats.maxSpeed 
                              ? `${flightStats.maxSpeed.toFixed(1)} Knots` 
                              : '---'}
                          </span>
                        </div>

                        {/* Altitude */}
                        {flightStats.maxAltitude && (
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">Độ cao tối đa</span>
                            <span className="text-gray-900">{flightStats.maxAltitude.toFixed(0)} ft</span>
                          </div>
                        )}

                        {/* Wind Information */}
                        {(flightStats.avgWind || flightStats.maxWind) && (
                          <>
                            <div className="flex justify-between">
                              <span className="font-medium text-gray-700">Gió trung bình</span>
                              <span className="text-gray-900">
                                {flightStats.avgWind 
                                  ? `${flightStats.avgWind.toFixed(0)} knots` 
                                  : '---'}
                              </span>
                            </div>
                            
                            <div className="flex justify-between">
                              <span className="font-medium text-gray-700">Gió tối đa</span>
                              <span className="text-gray-900">
                                {flightStats.maxWind 
                                  ? `${flightStats.maxWind.toFixed(1)} knots` 
                                  : '---'}
                              </span>
                            </div>
                          </>
                        )}

                        {/* Temperature Information */}
                        {(flightStats.minTemp || flightStats.maxTemp) && (
                          <>
                            <div className="flex justify-between">
                              <span className="font-medium text-gray-700">Nhiệt độ thấp nhất</span>
                              <span className="text-gray-900">
                                {flightStats.minTemp 
                                  ? `${flightStats.minTemp.toFixed(1)}°C / ${(flightStats.minTemp * 9/5 + 32).toFixed(2)}°F` 
                                  : '---'}
                              </span>
                            </div>
                            
                            <div className="flex justify-between">
                              <span className="font-medium text-gray-700">Nhiệt độ cao nhất</span>
                              <span className="text-gray-900">
                                {flightStats.maxTemp 
                                  ? `${flightStats.maxTemp.toFixed(1)}°C / ${(flightStats.maxTemp * 9/5 + 32).toFixed(2)}°F` 
                                  : '---'}
                              </span>
                            </div>
                          </>
                        )}

                        {/* ETA */}
                        {flightStats.eta && (
                          <div className="flex justify-between pt-3 border-t">
                            <span className="font-medium text-gray-700">Thời gian dự kiến đến</span>
                            <span className="text-gray-900">{flightStats.eta}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        <div className="text-4xl mb-2">✈️</div>
                        <p>Đang tính toán thông tin chuyến bay...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
