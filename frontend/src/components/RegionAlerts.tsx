import React, { useEffect } from 'react';
import { useRegionStore, RegionAlert } from '../stores/regionStore';
import { Bell, X, MapPin, Plane, Ship, LogIn, LogOut } from 'lucide-react';

const RegionAlerts: React.FC = () => {
  const {
    alerts,
    unreadAlertCount,
    isLoading,
    error,
    fetchAlerts,
    markAlertAsRead,
    markAllAlertsAsRead,
  } = useRegionStore();

  useEffect(() => {
    fetchAlerts();
    // Refresh alerts every 30 seconds
    const interval = setInterval(() => {
      fetchAlerts();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAlertIcon = (objectType: 'AIRCRAFT' | 'VESSEL') => {
    return objectType === 'AIRCRAFT' ? (
      <Plane className="h-4 w-4 text-blue-500" />
    ) : (
      <Ship className="h-4 w-4 text-green-500" />
    );
  };

  const getAlertTypeIcon = (alertType: 'ENTRY' | 'EXIT') => {
    return alertType === 'ENTRY' ? (
      <LogIn className="h-4 w-4 text-green-600" />
    ) : (
      <LogOut className="h-4 w-4 text-orange-600" />
    );
  };

  const getAlertTypeText = (alertType: 'ENTRY' | 'EXIT') => {
    return alertType === 'ENTRY' ? 'đi vào' : 'rời khỏi';
  };

  const getObjectTypeText = (objectType: 'AIRCRAFT' | 'VESSEL') => {
    return objectType === 'AIRCRAFT' ? 'Máy bay' : 'Tàu thuyền';
  };

  const handleMarkAsRead = async (alertId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    await markAlertAsRead(alertId);
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-700">Cảnh báo vùng</h2>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
          <p className="text-gray-500">Đang tải cảnh báo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-700">Cảnh báo vùng</h2>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={() => fetchAlerts()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (alerts?.length === 0) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-700">Cảnh báo vùng</h2>
        </div>
        <div className="text-center py-8">
          <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Chưa có cảnh báo nào</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold">Cảnh báo vùng</h2>
          {unreadAlertCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {unreadAlertCount}
            </span>
          )}
        </div>
        {unreadAlertCount > 0 && (
          <button
            onClick={markAllAlertsAsRead}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {alerts?.map((alert) => (
          <div
            key={alert.id}
            className={`p-3 rounded-lg border transition-colors ${
              alert.isRead
                ? 'border-gray-200 bg-gray-50'
                : 'border-blue-200 bg-blue-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {getAlertIcon(alert.objectType)}
                  {getAlertTypeIcon(alert.alertType)}
                  <span className="font-medium text-sm">
                    {getObjectTypeText(alert.objectType)}{' '}
                    {getAlertTypeText(alert.alertType)} vùng
                  </span>
                </div>
                <div className="flex items-center gap-1 mb-1">
                  <MapPin className="h-3 w-3 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {alert.region.name}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {formatTime(alert.createdAt)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Vị trí: {alert.latitude.toFixed(4)},{' '}
                  {alert.longitude.toFixed(4)}
                </div>
              </div>
              {!alert.isRead && (
                <button
                  onClick={(e) => handleMarkAsRead(alert.id, e)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Đánh dấu đã đọc"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {alerts && alerts.length > 10 && (
        <div className="mt-3 text-center">
          <button className="text-sm text-blue-600 hover:text-blue-800">
            Xem tất cả cảnh báo
          </button>
        </div>
      )}
    </div>
  );
};

export default RegionAlerts;
