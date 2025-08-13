'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAircraftStore } from '@/stores/aircraftStore';

export default function AircraftPage() {
  const { aircrafts, loading, error, fetchAircrafts, total, page: storePage, pageSize: storePageSize } = useAircraftStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [operator, setOperator] = useState('');
  const [aircraftTypeInput, setAircraftTypeInput] = useState('');
  const [registration, setRegistration] = useState('');
  const [callSign, setCallSign] = useState('');
  const [minSpeed, setMinSpeed] = useState<string>('');
  const [maxSpeed, setMaxSpeed] = useState<string>('');
  const [minAltitude, setMinAltitude] = useState<string>('');
  const [maxAltitude, setMaxAltitude] = useState<string>('');

  const page = storePage ?? 1;
  const pageSize = storePageSize ?? 50;
  const totalItems = total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const filterHasSignal =
    filterType === 'active' ? true : filterType === 'inactive' ? false : undefined;

  useEffect(() => {
    fetchAircrafts(page, pageSize, debouncedQuery, filterHasSignal, {
      operator: operator || undefined,
      aircraftType: aircraftTypeInput || undefined,
      registration: registration || undefined,
      callSign: callSign || undefined,
      minSpeed: minSpeed !== '' ? Number(minSpeed) : undefined,
      maxSpeed: maxSpeed !== '' ? Number(maxSpeed) : undefined,
      minAltitude: minAltitude !== '' ? Number(minAltitude) : undefined,
      maxAltitude: maxAltitude !== '' ? Number(maxAltitude) : undefined,
    });
  }, [
    fetchAircrafts,
    page,
    pageSize,
    debouncedQuery,
    filterHasSignal,
    operator,
    aircraftTypeInput,
    registration,
    callSign,
    minSpeed,
    maxSpeed,
    minAltitude,
    maxAltitude,
  ]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchTerm.trim()), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // Server-side filtering & search are applied; render the fetched page
  const pageItems = aircrafts;

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
                  <button
                    className="btn"
                    onClick={() => setShowAdvanced((v) => !v)}
                  >
                    Bộ lọc nâng cao
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() =>
                      fetchAircrafts(1, pageSize, searchTerm.trim(), filterHasSignal, {
                        operator: operator || undefined,
                        aircraftType: aircraftTypeInput || undefined,
                        registration: registration || undefined,
                        callSign: callSign || undefined,
                        minSpeed: minSpeed !== '' ? Number(minSpeed) : undefined,
                        maxSpeed: maxSpeed !== '' ? Number(maxSpeed) : undefined,
                        minAltitude:
                          minAltitude !== '' ? Number(minAltitude) : undefined,
                        maxAltitude:
                          maxAltitude !== '' ? Number(maxAltitude) : undefined,
                      })
                    }
                  >
                    Tìm kiếm
                  </button>
                </div>
                {showAdvanced && (
                  <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <input
                      className="input"
                      placeholder="Nhà khai thác"
                      value={operator}
                      onChange={(e) => setOperator(e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="Loại máy bay"
                      value={aircraftTypeInput}
                      onChange={(e) => setAircraftTypeInput(e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="Đăng ký"
                      value={registration}
                      onChange={(e) => setRegistration(e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="Callsign"
                      value={callSign}
                      onChange={(e) => setCallSign(e.target.value)}
                    />
                    <input
                      type="number"
                      className="input"
                      placeholder="Tốc độ tối thiểu"
                      value={minSpeed}
                      onChange={(e) => setMinSpeed(e.target.value)}
                    />
                    <input
                      type="number"
                      className="input"
                      placeholder="Tốc độ tối đa"
                      value={maxSpeed}
                      onChange={(e) => setMaxSpeed(e.target.value)}
                    />
                    <input
                      type="number"
                      className="input"
                      placeholder="Độ cao tối thiểu"
                      value={minAltitude}
                      onChange={(e) => setMinAltitude(e.target.value)}
                    />
                    <input
                      type="number"
                      className="input"
                      placeholder="Độ cao tối đa"
                      value={maxAltitude}
                      onChange={(e) => setMaxAltitude(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Aircraft Table */}
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
                            Flight / Callsign
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-24">
                            Tín hiệu
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-40">
                            Đăng ký
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-40">
                            Loại
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 w-28">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {pageItems.map((aircraft) => (
                          <tr key={aircraft.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 align-middle">
                              <div className="font-medium text-indigo-600">
                                <Link href={`/aircraft/${aircraft.id}`}>
                                  {aircraft.callSign || aircraft.flightId}
                                </Link>
                              </div>
                              <div className="text-xs text-gray-500">Flight: {aircraft.flightId}</div>
                            </td>
                            <td className="px-4 py-2 align-middle">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  aircraft.lastPosition
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {aircraft.lastPosition ? 'Có tín hiệu' : 'Mất tín hiệu'}
                              </span>
                            </td>
                            <td className="px-4 py-2 align-middle">{aircraft.registration || '-'}</td>
                            <td className="px-4 py-2 align-middle">
                              {aircraft.aircraftType || 'Không xác định'}
                            </td>
                            <td className="px-4 py-2 align-middle text-right">
                              <Link href={`/aircraft/${aircraft.id}`} className="text-indigo-600 hover:underline">
                                Chi tiết
                              </Link>
                            </td>
                          </tr>
                        ))}
                        {pageItems.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                              Không tìm thấy máy bay nào
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <button
                        className="btn"
                        disabled={page <= 1}
                        onClick={() =>
                          fetchAircrafts(
                            Math.max(1, page - 1),
                            pageSize,
                            debouncedQuery,
                            filterHasSignal,
                            {
                              operator: operator || undefined,
                              aircraftType: aircraftTypeInput || undefined,
                              registration: registration || undefined,
                              callSign: callSign || undefined,
                              minSpeed: minSpeed !== '' ? Number(minSpeed) : undefined,
                              maxSpeed: maxSpeed !== '' ? Number(maxSpeed) : undefined,
                              minAltitude:
                                minAltitude !== '' ? Number(minAltitude) : undefined,
                              maxAltitude:
                                maxAltitude !== '' ? Number(maxAltitude) : undefined,
                            },
                          )
                        }
                      >
                        ← Trước
                      </button>
                      <span>
                        Trang {page} / {totalPages}
                      </span>
                      <button
                        className="btn"
                        disabled={page >= totalPages}
                        onClick={() =>
                          fetchAircrafts(
                            Math.min(totalPages, page + 1),
                            pageSize,
                            debouncedQuery,
                            filterHasSignal,
                            {
                              operator: operator || undefined,
                              aircraftType: aircraftTypeInput || undefined,
                              registration: registration || undefined,
                              callSign: callSign || undefined,
                              minSpeed: minSpeed !== '' ? Number(minSpeed) : undefined,
                              maxSpeed: maxSpeed !== '' ? Number(maxSpeed) : undefined,
                              minAltitude:
                                minAltitude !== '' ? Number(minAltitude) : undefined,
                              maxAltitude:
                                maxAltitude !== '' ? Number(maxAltitude) : undefined,
                            },
                          )
                        }
                      >
                        Sau →
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="pageSize" className="text-gray-600">Số hàng/trang:</label>
                      <select
                        id="pageSize"
                        className="select"
                        value={pageSize}
                        onChange={(e) =>
                          fetchAircrafts(
                            1,
                            Number(e.target.value),
                            debouncedQuery,
                            filterHasSignal,
                            {
                              operator: operator || undefined,
                              aircraftType: aircraftTypeInput || undefined,
                              registration: registration || undefined,
                              callSign: callSign || undefined,
                              minSpeed: minSpeed !== '' ? Number(minSpeed) : undefined,
                              maxSpeed: maxSpeed !== '' ? Number(maxSpeed) : undefined,
                              minAltitude:
                                minAltitude !== '' ? Number(minAltitude) : undefined,
                              maxAltitude:
                                maxAltitude !== '' ? Number(maxAltitude) : undefined,
                            },
                          )
                        }
                      >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <button
                        className="btn"
                        onClick={() =>
                          fetchAircrafts(page, pageSize, debouncedQuery, filterHasSignal, {
                            operator: operator || undefined,
                            aircraftType: aircraftTypeInput || undefined,
                            registration: registration || undefined,
                            callSign: callSign || undefined,
                            minSpeed: minSpeed !== '' ? Number(minSpeed) : undefined,
                            maxSpeed: maxSpeed !== '' ? Number(maxSpeed) : undefined,
                            minAltitude:
                              minAltitude !== '' ? Number(minAltitude) : undefined,
                            maxAltitude:
                              maxAltitude !== '' ? Number(maxAltitude) : undefined,
                          })
                        }
                      >
                        Làm mới
                      </button>
                      <div>Tổng: {totalItems}</div>
                    </div>
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
