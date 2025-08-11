'use client';

import React, { useEffect } from 'react';
import { useTrackingStore } from '@/stores/trackingStore';
import { Plane, Ship, Clock, Trash2, Edit3 } from 'lucide-react';
import Header from '@/components/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import RegionManager from '@/components/RegionManager';
import RegionAlerts from '@/components/RegionAlerts';

export default function TrackingPage() {
  const {
    trackedItems,
    loading,
    error,
    fetchTrackedItems,
    untrackItem,
    getTrackingStats,
  } = useTrackingStore();

  const stats = getTrackingStats();

  useEffect(() => {
    fetchTrackedItems();
  }, [fetchTrackedItems]);

  const handleUntrack = async (type: 'aircraft' | 'vessel', id: number) => {
    if (confirm('Bạn có chắc chắn muốn bỏ theo dõi mục này?')) {
      try {
        await untrackItem(type, id);
      } catch (error) {
        console.error('Failed to untrack item:', error);
      }
    }
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(date);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <main className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">
                  Đang tải danh sách theo dõi...
                </p>
              </div>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen">
        <Header />
        <main className="section">
          <div className="mb-8">
            <h1 className="page-title mb-2">Danh sách theo dõi</h1>
            <p className="page-subtitle">
              Quản lý các máy bay và tàu thuyền bạn đang theo dõi
            </p>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                  <Plane className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Máy bay</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.aircraftCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 text-green-600">
                  <Ship className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Tàu thuyền
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.vesselCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                  <Clock className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Tổng cộng</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.total}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-md p-4 mb-6">
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Tracked Items List */}
          {trackedItems.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-gray-400 mb-4">
                <Clock className="h-16 w-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Chưa có mục nào được theo dõi
              </h3>
              <p className="text-gray-600">
                Nhấp vào nút &quot;Theo dõi&quot; trên bản đồ để thêm máy bay
                hoặc tàu thuyền vào danh sách theo dõi.
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="divide-y divide-gray-200">
                {trackedItems.map((item) => (
                  <div
                    key={`${item.type}-${item.data.id}`}
                    className="p-6 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div
                          className={`p-2 rounded-full ${
                            item.type === 'aircraft'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-green-100 text-green-600'
                          }`}
                        >
                          {item.type === 'aircraft' ? (
                            <Plane className="h-5 w-5" />
                          ) : (
                            <Ship className="h-5 w-5" />
                          )}
                        </div>

                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">
                            {item.alias ||
                              (item.type === 'aircraft'
                                ? item.data.callSign || item.data.flightId
                                : item.data.vesselName || item.data.mmsi)}
                          </h3>

                          <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                            <span>
                              {item.type === 'aircraft'
                                ? 'Máy bay'
                                : 'Tàu thuyền'}
                            </span>
                            <span>•</span>
                            <span>
                              ID:{' '}
                              {item.type === 'aircraft'
                                ? item.data.flightId
                                : item.data.mmsi}
                            </span>
                            {item.data.lastPosition && (
                              <>
                                <span>•</span>
                                <span>
                                  Cập nhật:{' '}
                                  {formatDateTime(
                                    new Date(item.data.lastPosition.timestamp),
                                  )}
                                </span>
                              </>
                            )}
                          </div>

                          {item.notes && (
                            <p className="text-sm text-gray-600 mt-2 italic">
                              &quot;{item.notes}&quot;
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            const path =
                              item.type === 'aircraft'
                                ? `/aircraft/${item.data.id}`
                                : `/vessels/${item.data.id}`;
                            window.location.href = path;
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50"
                          title="Xem chi tiết"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleUntrack(item.type, item.data.id)}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50"
                          title="Bỏ theo dõi"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Region Management and Alerts Sidebar */}
        <div className="fixed right-4 top-20 w-96 space-y-4 z-10">
          <RegionAlerts />
          {/* <RegionManager /> */}
        </div>
      </div>
    </ProtectedRoute>
  );
}
