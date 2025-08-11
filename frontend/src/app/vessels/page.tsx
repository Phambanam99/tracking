'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useVesselStore } from '@/stores/vesselStore';

export default function VesselsPage() {
  const { vessels, loading, error, fetchVessels } = useVesselStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchVessels();
  }, [fetchVessels]);

  const filteredVessels = vessels.filter((vessel) => {
    const matchesSearch =
      vessel.mmsi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vessel.vesselName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vessel.flag?.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterType === 'all') return matchesSearch;
    if (filterType === 'active') return matchesSearch && vessel.lastPosition;
    if (filterType === 'inactive') return matchesSearch && !vessel.lastPosition;
    return matchesSearch;
  });

  return (
    <ProtectedRoute>
      <div className="min-h-screen">
        <Header />
        <main className="section">
          <div className="">
            <div className="mb-8">
              <h1 className="page-title">Quản lý tàu thuyền</h1>
              <p className="page-subtitle">
                Danh sách và quản lý tất cả tàu thuyền trong hệ thống
              </p>
            </div>

            {/* Search and Filter */}
            <div className="card mb-6">
              <div className="card-body">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Tìm kiếm theo MMSI, tên tàu, hoặc quốc tịch..."
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
                  <Link href="/vessels/new" className="btn-primary">
                    🚢 Thêm tàu thuyền
                  </Link>
                </div>
              </div>
            </div>

            {/* Vessels List */}
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
                  {filteredVessels.map((vessel) => (
                    <li key={vessel.id}>
                      <Link
                        href={`/vessels/${vessel.id}`}
                        className="block hover:bg-gray-50 px-4 py-4 sm:px-6"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                              <span className="text-green-600 font-semibold">
                                🚢
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="flex items-center">
                                <p className="text-sm font-medium text-indigo-600">
                                  {vessel.vesselName || vessel.mmsi}
                                </p>
                                <span
                                  className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    vessel.lastPosition
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {vessel.lastPosition
                                    ? 'Có tín hiệu'
                                    : 'Mất tín hiệu'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500">
                                MMSI: {vessel.mmsi} •{' '}
                                {vessel.vesselType || 'Loại tàu không xác định'}
                              </p>
                              <div className="flex items-center text-sm text-gray-500">
                                {vessel.flag && <span>🏴 {vessel.flag}</span>}
                                {vessel.operator && (
                                  <span className="ml-2">
                                    Vận hành: {vessel.operator}
                                  </span>
                                )}
                                {vessel.length && vessel.width && (
                                  <span className="ml-2">
                                    Kích thước: {vessel.length}m x{' '}
                                    {vessel.width}m
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            {vessel.lastPosition && (
                              <div className="text-sm text-gray-500">
                                <p>
                                  Tốc độ: {vessel.lastPosition.speed || 0} knots
                                </p>
                                <p>Hướng: {vessel.lastPosition.course || 0}°</p>
                                <p className="text-xs">
                                  Cập nhật:{' '}
                                  {new Date(
                                    vessel.lastPosition.timestamp,
                                  ).toLocaleString('vi-VN')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                  {filteredVessels.length === 0 && (
                    <li className="px-4 py-8 text-center text-gray-500">
                      Không tìm thấy tàu thuyền nào
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
