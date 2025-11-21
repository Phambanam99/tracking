'use client';

import Header from '@/components/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAircraftStore } from '@/stores/aircraftStore';
import { useVesselStore } from '@/stores/vesselStore';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/services/apiClient';

export default function DashboardPage() {
  const router = useRouter();
  const { aircrafts, fetchAircrafts } = useAircraftStore();
  const { vessels, fetchVessels } = useVesselStore();
  const [vesselPage, setVesselPage] = useState(1);
  const [aircraftPage, setAircraftPage] = useState(1);
  const [stats, setStats] = useState({
    totalAircrafts: 0,
    totalVessels: 0,
    activeAircrafts: 0,
    activeVessels: 0,
  });
  const itemsPerPage = 5;

  useEffect(() => {
    // Fetch accurate stats from backend
    const fetchStats = async () => {
      try {
        const data = await api.get('/stats');
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    // Fetch active vessels from database and online aircrafts from Redis
    const fetchActiveItems = async () => {
      try {
        await Promise.all([
          fetchVessels(1, 1000, undefined, true),
          fetchAircrafts(1, 1000, undefined, true),
        ]);
      } catch (error) {
        console.error('Failed to fetch active items:', error);
      }
    };

    // Initial fetch
    fetchStats();
    fetchActiveItems();

    // Auto-refresh every 30 seconds to match backend collector interval
    const statsInterval = setInterval(fetchStats, 30000);
    const itemsInterval = setInterval(fetchActiveItems, 30000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(itemsInterval);
    };
  }, [fetchAircrafts, fetchVessels]);

  // Filter active vessels and aircrafts
  const activeVessels = useMemo(
    () => vessels.filter((v) => v.lastPosition),
    [vessels]
  );

  const activeAircrafts = useMemo(
    () => aircrafts.filter((a) => a.lastPosition),
    [aircrafts]
  );

  // Paginate active vessels
  const paginatedVessels = useMemo(() => {
    const start = (vesselPage - 1) * itemsPerPage;
    return activeVessels.slice(start, start + itemsPerPage);
  }, [activeVessels, vesselPage]);

  // Paginate active aircrafts
  const paginatedAircrafts = useMemo(() => {
    const start = (aircraftPage - 1) * itemsPerPage;
    return activeAircrafts.slice(start, start + itemsPerPage);
  }, [activeAircrafts, aircraftPage]);

  const vesselTotalPages = Math.ceil(activeVessels.length / itemsPerPage);
  const aircraftTotalPages = Math.ceil(activeAircrafts.length / itemsPerPage);

  const statCards = [
    {
      name: 'Tổng số máy bay',
      value: stats.totalAircrafts,
      icon: '✈️',
      color: 'bg-blue-100 text-blue-800',
    },
    {
      name: 'Tổng số tàu thuyền',
      value: stats.totalVessels,
      icon: '🚢',
      color: 'bg-green-100 text-green-800',
    },
    {
      name: 'Máy bay đang hoạt động',
      value: stats.activeAircrafts,
      icon: '🟢',
      color: 'bg-emerald-100 text-emerald-800',
    },
    {
      name: 'Tàu thuyền đang hoạt động',
      value: stats.activeVessels,
      icon: '🟢',
      color: 'bg-emerald-100 text-emerald-800',
    },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen">
        <Header />
        <main className="section">
          <div className="">
            <div className="mb-8">
              <h1 className="page-title">Dashboard</h1>
              <p className="page-subtitle">
                Tổng quan hệ thống theo dõi máy bay và tàu thuyền
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              {statCards.map((stat) => (
                <div key={stat.name} className="card">
                  <div className="card-body">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div
                          className={`inline-flex items-center justify-center h-12 w-12 rounded-md ${stat.color}`}
                        >
                          <span className="text-xl">{stat.icon}</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            {stat.name}
                          </dt>
                          <dd className="text-3xl font-semibold text-gray-900">
                            {stat.value}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Aircrafts */}
              <div className="card">
                <div className="card-body">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Máy bay đang hoạt động
                    </h3>
                    <span className="text-sm text-gray-500">
                      {activeAircrafts.length} máy bay
                    </span>
                  </div>
                  <div className="space-y-3">
                    {paginatedAircrafts.length > 0 ? (
                      paginatedAircrafts.map((aircraft, index) => (
                        <div
                          key={`aircraft-${aircraft.id}-${index}`}
                          className="flex items-center justify-between rounded-md p-2 hover:bg-gray-50 cursor-pointer"
                          onClick={() => router.push(`/aircraft/${aircraft.id}`)}
                        >
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 text-sm">✈️</span>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">
                                {aircraft.callSign || aircraft.flightId}
                              </p>
                              <p className="text-sm text-gray-500">
                                {aircraft.aircraftType || 'Unknown Type'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-green-600">
                              Có tín hiệu
                            </p>
                            <p className="text-xs text-gray-500">
                              {aircraft.lastPosition?.altitude || 0}ft
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        Không có máy bay nào đang hoạt động
                      </div>
                    )}
                  </div>
                  {aircraftTotalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-4 pt-4 border-t">
                      <button
                        onClick={() => setAircraftPage((p) => Math.max(1, p - 1))}
                        disabled={aircraftPage === 1}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Trước
                      </button>
                      <span className="text-sm text-gray-600">
                        Trang {aircraftPage} / {aircraftTotalPages}
                      </span>
                      <button
                        onClick={() => setAircraftPage((p) => Math.min(aircraftTotalPages, p + 1))}
                        disabled={aircraftPage === aircraftTotalPages}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Sau
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Active Vessels */}
              <div className="card">
                <div className="card-body">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Tàu thuyền đang hoạt động
                    </h3>
                    <span className="text-sm text-gray-500">
                      {activeVessels.length} tàu
                    </span>
                  </div>
                  <div className="space-y-3">
                    {paginatedVessels.length > 0 ? (
                      paginatedVessels.map((vessel, index) => (
                        <div
                          key={`vessel-${vessel.id}-${index}`}
                          className="flex items-center justify-between rounded-md p-2 hover:bg-gray-50 cursor-pointer"
                          onClick={() => router.push(`/vessels/${vessel.id}`)}
                        >
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                              <span className="text-green-600 text-sm">🚢</span>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">
                                {vessel.vesselName || vessel.mmsi}
                              </p>
                              <p className="text-sm text-gray-500">
                                {vessel.vesselType || 'Unknown Type'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-green-600">
                              Có tín hiệu
                            </p>
                            <p className="text-xs text-gray-500">
                              {vessel.lastPosition?.speed || 0} knots
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        Không có tàu thuyền nào đang hoạt động
                      </div>
                    )}
                  </div>
                  {vesselTotalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-4 pt-4 border-t">
                      <button
                        onClick={() => setVesselPage((p) => Math.max(1, p - 1))}
                        disabled={vesselPage === 1}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Trước
                      </button>
                      <span className="text-sm text-gray-600">
                        Trang {vesselPage} / {vesselTotalPages}
                      </span>
                      <button
                        onClick={() => setVesselPage((p) => Math.min(vesselTotalPages, p + 1))}
                        disabled={vesselPage === vesselTotalPages}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Sau
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
