'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAircraftStore } from '@/stores/aircraftStore';
import { useMapStore } from '@/stores/mapStore';

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
    id: number;
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
  const { aircrafts, fetchAircrafts } = useAircraftStore();
  const { setFocusTarget } = useMapStore();
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAircraft = async () => {
      if (aircrafts.length === 0) {
        await fetchAircrafts();
      }

      const aircraftId = parseInt(params.id as string);
      const foundAircraft = aircrafts.find((a) => a.id === aircraftId);

      if (foundAircraft) {
        setAircraft(foundAircraft);
      }
      setLoading(false);
    };

    loadAircraft();
  }, [params.id, aircrafts, fetchAircrafts]);

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
      <div className="min-h-screen bg-gray-50">
        <Header />

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {/* Header */}
            <div className="mb-8 flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {aircraft.callSign || aircraft.flightId}
                </h1>
                <p className="mt-2 text-gray-600">Chi tiết thông tin máy bay</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => router.push('/aircraft')}
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
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            aircraft.lastPosition
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {aircraft.lastPosition
                            ? 'Có tín hiệu'
                            : 'Mất tín hiệu'}
                        </span>
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
                            setFocusTarget({
                              type: 'aircraft',
                              id: aircraft.id,
                            });
                            // Điều hướng tới trang map (trang chủ)
                            router.push('/');
                          }
                        }}
                      >
                        📍 Xem trên bản đồ
                      </button>
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
