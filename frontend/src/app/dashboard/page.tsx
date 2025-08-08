"use client";

import Header from "@/components/Header";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAircraftStore } from "@/stores/aircraftStore";
import { useVesselStore } from "@/stores/vesselStore";
import { useEffect } from "react";

export default function DashboardPage() {
  const { aircrafts, fetchAircrafts } = useAircraftStore();
  const { vessels, fetchVessels } = useVesselStore();

  useEffect(() => {
    fetchAircrafts();
    fetchVessels();
  }, [fetchAircrafts, fetchVessels]);

  const stats = [
    {
      name: "Tổng số máy bay",
      value: aircrafts.length,
      icon: "✈️",
      color: "bg-blue-100 text-blue-800",
    },
    {
      name: "Tổng số tàu thuyền",
      value: vessels.length,
      icon: "🚢",
      color: "bg-green-100 text-green-800",
    },
    {
      name: "Máy bay đang hoạt động",
      value: aircrafts.filter((a) => a.lastPosition).length,
      icon: "🟢",
      color: "bg-emerald-100 text-emerald-800",
    },
    {
      name: "Tàu thuyền đang hoạt động",
      value: vessels.filter((v) => v.lastPosition).length,
      icon: "🟢",
      color: "bg-emerald-100 text-emerald-800",
    },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Header />

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-2 text-gray-600">
                Tổng quan hệ thống theo dõi máy bay và tàu thuyền
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              {stats.map((stat) => (
                <div
                  key={stat.name}
                  className="bg-white overflow-hidden shadow rounded-lg"
                >
                  <div className="p-5">
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
              {/* Recent Aircrafts */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Máy bay gần đây
                  </h3>
                  <div className="space-y-3">
                    {aircrafts.slice(0, 5).map((aircraft) => (
                      <div
                        key={aircraft.id}
                        className="flex items-center justify-between"
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
                              {aircraft.aircraftType || "Unknown Type"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-medium ${
                              aircraft.lastPosition
                                ? "text-green-600"
                                : "text-gray-500"
                            }`}
                          >
                            {aircraft.lastPosition
                              ? "Có tín hiệu"
                              : "Mất tín hiệu"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {aircraft.lastPosition?.altitude || 0}ft
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Vessels */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Tàu thuyền gần đây
                  </h3>
                  <div className="space-y-3">
                    {vessels.slice(0, 5).map((vessel) => (
                      <div
                        key={vessel.id}
                        className="flex items-center justify-between"
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
                              {vessel.vesselType || "Unknown Type"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-medium ${
                              vessel.lastPosition
                                ? "text-green-600"
                                : "text-gray-500"
                            }`}
                          >
                            {vessel.lastPosition
                              ? "Có tín hiệu"
                              : "Mất tín hiệu"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {vessel.lastPosition?.speed || 0} knots
                          </p>
                        </div>
                      </div>
                    ))}
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
