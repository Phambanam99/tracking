'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAircraftStore } from '@/stores/aircraftStore';

export default function AircraftPage() {
  const { aircrafts, loading, error, fetchAircrafts } = useAircraftStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchAircrafts();
  }, [fetchAircrafts]);

  const filteredAircrafts = aircrafts.filter((aircraft) => {
    const matchesSearch =
      aircraft.flightId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      aircraft.callSign?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      aircraft.registration?.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterType === 'all') return matchesSearch;
    if (filterType === 'active') return matchesSearch && aircraft.lastPosition;
    if (filterType === 'inactive')
      return matchesSearch && !aircraft.lastPosition;
    return matchesSearch;
  });

  return (
    <ProtectedRoute>
      <div className="min-h-screen">
        <Header />
        <main className="section">
          <div className="">
            <div className="mb-8">
              <h1 className="page-title">Quản lý máy bay</h1>
              <p className="page-subtitle">
                Danh sách và quản lý tất cả máy bay trong hệ thống
              </p>
            </div>

            {/* Search and Filter */}
            <div className="card mb-6">
              <div className="card-body">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Tìm kiếm theo Flight ID, Call Sign, hoặc Registration..."
                      className="input"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div>
                    <select
                      className="select"
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                    >
                      <option value="all">Tất cả</option>
                      <option value="active">Có tín hiệu</option>
                      <option value="inactive">Mất tín hiệu</option>
                    </select>
                  </div>
                  <Link href="/aircraft/new" className="btn-primary">
                    ✈️ Thêm máy bay
                  </Link>
                </div>
              </div>
            </div>

            {/* Aircraft List */}
            <div className="card overflow-hidden sm:rounded-md">
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : error ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-md p-4">
                  <div className="text-red-700 dark:text-red-300">{error}</div>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {filteredAircrafts.map((aircraft) => (
                    <li key={aircraft.id}>
                      <Link
                        href={`/aircraft/${aircraft.id}`}
                        className="block hover:bg-gray-50 px-4 py-4 sm:px-6"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-semibold">
                                ✈️
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="flex items-center">
                                <p className="text-sm font-medium text-indigo-600">
                                  {aircraft.callSign || aircraft.flightId}
                                </p>
                                <span
                                  className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    aircraft.lastPosition
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {aircraft.lastPosition
                                    ? 'Có tín hiệu'
                                    : 'Mất tín hiệu'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500">
                                {aircraft.registration &&
                                  `Đăng ký: ${aircraft.registration} • `}
                                {aircraft.aircraftType ||
                                  'Loại máy bay không xác định'}
                              </p>
                              {aircraft.operator && (
                                <p className="text-sm text-gray-500">
                                  Vận hành: {aircraft.operator}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {aircraft.lastPosition && (
                              <div className="text-sm text-gray-500">
                                <p>
                                  Độ cao: {aircraft.lastPosition.altitude || 0}
                                  ft
                                </p>
                                <p>
                                  Tốc độ: {aircraft.lastPosition.speed || 0}{' '}
                                  knots
                                </p>
                                <p className="text-xs">
                                  Cập nhật:{' '}
                                  {new Date(
                                    aircraft.lastPosition.timestamp,
                                  ).toLocaleString('vi-VN')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                  {filteredAircrafts.length === 0 && (
                    <li className="px-4 py-8 text-center text-gray-500">
                      Không tìm thấy máy bay nào
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
