'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useVesselStore } from '@/stores/vesselStore';

export default function VesselsPage() {
  const { vessels, loading, error, fetchVessels } = useVesselStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchVessels(1, 50);
  }, [fetchVessels]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchTerm.trim()), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  const filteredVessels = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return vessels.filter((vessel) => {
      const matchesSearch =
        vessel.mmsi.toLowerCase().includes(q) ||
        (vessel.vesselName?.toLowerCase().includes(q) ?? false) ||
        (vessel.flag?.toLowerCase().includes(q) ?? false);

      if (filterType === 'all') return matchesSearch;
      if (filterType === 'active') return matchesSearch && !!vessel.lastPosition;
      if (filterType === 'inactive') return matchesSearch && !vessel.lastPosition;
      return matchesSearch;
    });
  }, [vessels, debouncedQuery, filterType]);

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

            {/* Vessels Table */}
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
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-2/5">
                            Tên tàu / MMSI
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-24">
                            Tín hiệu
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-32">
                            Quốc tịch
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-40">
                            Loại tàu
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 w-28">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredVessels.map((vessel) => (
                          <tr key={vessel.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 align-middle">
                              <div className="font-medium text-indigo-600">
                                <Link href={`/vessels/${vessel.id}`}>
                                  {vessel.vesselName || vessel.mmsi}
                                </Link>
                              </div>
                              <div className="text-xs text-gray-500">MMSI: {vessel.mmsi}</div>
                            </td>
                            <td className="px-4 py-2 align-middle">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  vessel.lastPosition
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {vessel.lastPosition ? 'Có tín hiệu' : 'Mất tín hiệu'}
                              </span>
                            </td>
                            <td className="px-4 py-2 align-middle">{vessel.flag || '-'}</td>
                            <td className="px-4 py-2 align-middle">
                              {vessel.vesselType || 'Không xác định'}
                            </td>
                            <td className="px-4 py-2 align-middle text-right">
                              <Link href={`/vessels/${vessel.id}`} className="text-indigo-600 hover:underline">
                                Chi tiết
                              </Link>
                            </td>
                          </tr>
                        ))}
                        {filteredVessels.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                              Không tìm thấy tàu thuyền nào
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 flex items-center justify-between text-sm text-gray-600">
                    <button
                      className="btn"
                      onClick={() => fetchVessels(1, 50, debouncedQuery)}
                    >
                      Làm mới
                    </button>
                    <div>Hiển thị {filteredVessels.length} mục</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
