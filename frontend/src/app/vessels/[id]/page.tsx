'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useVesselStore } from '@/stores/vesselStore';
import { useMapStore } from '@/stores/mapStore';
import { useTrackingStore } from '@/stores/trackingStore';
import api from '@/services/apiClient';
import HistoryTable from './HistoryTable';

interface Vessel {
  id: number;
  mmsi: string;
  vesselName?: string;
  vesselType?: string;
  flag?: string;
  operator?: string;
  length?: number;
  width?: number;
  createdAt: Date;
  updatedAt: Date;
  lastPosition?: {
    id: number;
    latitude: number;
    longitude: number;
    speed?: number;
    course?: number;
    heading?: number;
    status?: string;
    timestamp: Date;
  };
}

export default function VesselDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { vessels, fetchVessels } = useVesselStore();
  const { setFocusTarget } = useMapStore();
  const { isTracking, trackItem, untrackItem, fetchTrackedItems } = useTrackingStore();
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackingBusy, setTrackingBusy] = useState(false);

  const SIGNAL_STALE_MINUTES = Number(
    process.env.NEXT_PUBLIC_SIGNAL_STALE_MINUTES || 10,
  );

  useEffect(() => {
    const loadVessel = async () => {
      if (vessels.length === 0) {
        await fetchVessels();
      }

      const vesselId = parseInt(params.id as string);
      let foundVessel = vessels.find((v) => v.id === vesselId);

      if (foundVessel) {
        setVessel(foundVessel);
      } else {
        // Fallback: fetch detail by ID from backend
        try {
          const detail = await api.get(`/vessels/${vesselId}`);
          if (detail && !detail.error) setVessel(detail);
        } catch {
          // ignore
        }
      }
      setLoading(false);
    };

    loadVessel();
  }, [params.id, vessels, fetchVessels]);

  useEffect(() => {
    fetchTrackedItems().catch(() => undefined);
  }, [fetchTrackedItems]);

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

  if (!vessel) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Không tìm thấy tàu thuyền
              </h2>
              <p className="mt-2 text-gray-600">
                Tàu thuyền với ID này không tồn tại.
              </p>
              <button
                onClick={() => router.push('/vessels')}
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
      <div className="min-h-screen bg-gray-50">
        <Header />

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {/* Header */}
            <div className="mb-8 flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {vessel.vesselName || vessel.mmsi}
                </h1>
                <p className="mt-2 text-gray-600">
                  Chi tiết thông tin tàu thuyền
                </p>
              </div>
              <div className="flex space-x-3">
                {vessel && (
                  <button
                    onClick={async () => {
                      if (!vessel) return;
                      try {
                        setTrackingBusy(true);
                        if (isTracking('vessel', vessel.id)) {
                          await untrackItem('vessel', vessel.id);
                        } else {
                          await trackItem('vessel', vessel.id);
                        }
                      } finally {
                        setTrackingBusy(false);
                      }
                    }}
                    disabled={trackingBusy}
                    className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm ${
                      isTracking('vessel', vessel.id)
                        ? 'text-white bg-red-600 hover:bg-red-700 border-transparent'
                        : 'text-white bg-green-600 hover:bg-green-700 border-transparent'
                    } ${trackingBusy ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isTracking('vessel', vessel.id) ? 'Hủy theo dõi' : 'Theo dõi'}
                  </button>
                )}
                <button
                  onClick={() => router.push('/vessels')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Quay lại
                </button>
                <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                  Chỉnh sửa
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Info */}
              <div className="lg:col-span-2">
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Thông tin cơ bản
                    </h3>

                    <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          MMSI
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {vessel.mmsi}
                        </dd>
                      </div>

                      {vessel.vesselName && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Tên tàu
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {vessel.vesselName}
                          </dd>
                        </div>
                      )}

                      {vessel.vesselType && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Loại tàu
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {vessel.vesselType}
                          </dd>
                        </div>
                      )}

                      {vessel.flag && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Cờ hiệu
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {vessel.flag}
                          </dd>
                        </div>
                      )}

                      {vessel.operator && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Chủ sở hữu
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {vessel.operator}
                          </dd>
                        </div>
                      )}

                      {vessel.length && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Chiều dài
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {vessel.length}m
                          </dd>
                        </div>
                      )}

                      {vessel.width && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Chiều rộng
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {vessel.width}m
                          </dd>
                        </div>
                      )}

                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Ngày tạo
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {new Date(vessel.createdAt).toLocaleDateString(
                            'vi-VN',
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Position History */}
                <div className="mt-6 bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Lịch sử vị trí
                    </h3>

                    {vessel.lastPosition ? (
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
                                  vessel.lastPosition.timestamp,
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
                                {vessel.lastPosition.latitude.toFixed(6)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-gray-500">
                                Kinh độ
                              </dt>
                              <dd className="text-sm text-gray-900">
                                {vessel.lastPosition.longitude.toFixed(6)}
                              </dd>
                            </div>
                            {vessel.lastPosition.speed && (
                              <div>
                                <dt className="text-sm font-medium text-gray-500">
                                  Tốc độ
                                </dt>
                                <dd className="text-sm text-gray-900">
                                  {vessel.lastPosition.speed} knots
                                </dd>
                              </div>
                            )}
                            {vessel.lastPosition.course && (
                              <div>
                                <dt className="text-sm font-medium text-gray-500">
                                  Hướng di chuyển
                                </dt>
                                <dd className="text-sm text-gray-900">
                                  {vessel.lastPosition.course}°
                                </dd>
                              </div>
                            )}
                            {vessel.lastPosition.heading && (
                              <div>
                                <dt className="text-sm font-medium text-gray-500">
                                  Hướng mũi tàu
                                </dt>
                                <dd className="text-sm text-gray-900">
                                  {vessel.lastPosition.heading}°
                                </dd>
                              </div>
                            )}
                            {vessel.lastPosition.status && (
                              <div>
                                <dt className="text-sm font-medium text-gray-500">
                                  Trạng thái
                                </dt>
                                <dd className="text-sm text-gray-900">
                                  {vessel.lastPosition.status}
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
                    <HistoryTable vesselId={vessel.id} />
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
                          const ts = vessel.lastPosition?.timestamp
                            ? new Date(vessel.lastPosition.timestamp).getTime()
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

                      {vessel.lastPosition && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">
                              Lần cập nhật cuối
                            </span>
                            <span className="text-sm text-gray-900">
                              {new Date(
                                vessel.lastPosition.timestamp,
                              ).toLocaleTimeString('vi-VN')}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">
                              Tốc độ hiện tại
                            </span>
                            <span className="text-sm text-gray-900">
                              {vessel.lastPosition.speed || 0} knots
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">
                              Hướng di chuyển
                            </span>
                            <span className="text-sm text-gray-900">
                              {vessel.lastPosition.course || 0}°
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="mt-6">
                      <button
                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => {
                      if (vessel) {
                        const lon = vessel.lastPosition?.longitude;
                        const lat = vessel.lastPosition?.latitude;
                        setFocusTarget({
                          type: 'vessel',
                          id: vessel.id,
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

                {/* Vessel Specifications */}
                {(vessel.length || vessel.width) && (
                  <div className="mt-6 bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Thông số kỹ thuật
                      </h3>

                      <div className="space-y-3">
                        {vessel.length && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-500">
                              Chiều dài
                            </span>
                            <span className="text-sm text-gray-900">
                              {vessel.length} m
                            </span>
                          </div>
                        )}

                        {vessel.width && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-500">
                              Chiều rộng
                            </span>
                            <span className="text-sm text-gray-900">
                              {vessel.width} m
                            </span>
                          </div>
                        )}

                        {vessel.length && vessel.width && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-500">
                              Diện tích sàn
                            </span>
                            <span className="text-sm text-gray-900">
                              {(vessel.length * vessel.width).toFixed(1)} m²
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
