"use client";

import { useEffect, useState } from "react";
import { useRegionStore } from "@/stores/regionStore";

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationDropdown({
  isOpen,
  onClose,
}: NotificationDropdownProps) {
  const { alerts, fetchAlerts, markAlertAsRead } = useRegionStore();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetchAlerts(false); // Fetch all alerts when dropdown opens
    }
  }, [isOpen, fetchAlerts]);

  useEffect(() => {
    // Count unread alerts
    const unread = alerts.filter((alert) => !alert.isRead).length;
    setUnreadCount(unread);
  }, [alerts]);

  const handleMarkAsRead = async (alertId: number) => {
    await markAlertAsRead(alertId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case "ENTRY":
        return "🔵";
      case "EXIT":
        return "🔴";
      default:
        return "📍";
    }
  };

  const getAlertTypeText = (type: string) => {
    switch (type) {
      case "ENTRY":
        return "Vào vùng";
      case "EXIT":
        return "Rời vùng";
      default:
        return "Cảnh báo";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="origin-top-right absolute right-0 mt-2 w-96 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-[9999]">
      <div className="py-2">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Thông báo</h3>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-600">
              {unreadCount} thông báo chưa đọc
            </p>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-500">
              <div className="text-4xl mb-2">🔔</div>
              <p>Không có thông báo</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                  !alert.isRead ? "bg-blue-50" : ""
                }`}
                onClick={() => handleMarkAsRead(alert.id)}
              >
                <div className="flex items-start space-x-3">
                  <div className="text-lg">
                    {getAlertTypeIcon(alert.alertType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {getAlertTypeText(alert.alertType)}
                      </p>
                      {!alert.isRead && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {alert.objectType === "VESSEL" ? "Tàu thuyền" : "Máy bay"}{" "}
                      ID {alert.objectId} trong vùng{" "}
                      <span className="font-medium">{alert.region?.name}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(alert.createdAt)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Vị trí: {alert.latitude.toFixed(4)},{" "}
                      {alert.longitude.toFixed(4)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full text-center text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
