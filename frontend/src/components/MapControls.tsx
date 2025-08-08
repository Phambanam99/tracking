"use client";

import { useMapStore } from "@/stores/mapStore";

export default function MapControls() {
  const {
    isDrawingMode,
    isDeleteMode,
    drawingTool,
    regionsVisible,
    toggleDrawingMode,
    toggleDeleteMode,
    setDrawingTool,
    toggleRegionsVisibility,
  } = useMapStore();

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 space-y-2 min-w-64">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">
        Điều khiển bản đồ
      </h3>

      {/* Region Drawing Controls */}
      <div className="space-y-2 border-b border-gray-200 pb-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Vẽ vùng cảnh báo</span>
          <button
            onClick={toggleDrawingMode}
            className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
              isDrawingMode
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            {isDrawingMode ? "Tắt vẽ" : "Bật vẽ"}
          </button>
        </div>

        {/* Delete Mode Button */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Xóa vùng cảnh báo</span>
          <button
            onClick={toggleDeleteMode}
            className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
              isDeleteMode
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-orange-500 text-white hover:bg-orange-600"
            }`}
          >
            {isDeleteMode ? "Tắt xóa" : "Bật xóa"}
          </button>
        </div>

        {isDrawingMode && (
          <div className="space-y-1">
            <div className="flex gap-1">
              <button
                onClick={() => setDrawingTool("polygon")}
                className={`flex-1 px-2 py-1 text-xs rounded font-medium transition-colors ${
                  drawingTool === "polygon"
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                📐 Đa giác
              </button>
              <button
                onClick={() => setDrawingTool("circle")}
                className={`flex-1 px-2 py-1 text-xs rounded font-medium transition-colors ${
                  drawingTool === "circle"
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                ⭕ Hình tròn
              </button>
            </div>
            <p className="text-xs text-gray-500 italic">
              {drawingTool === "polygon" &&
                "Click để tạo các điểm, double-click để hoàn thành"}
              {drawingTool === "circle" && "Click và kéo để tạo hình tròn"}
            </p>
          </div>
        )}
      </div>

      {/* Region Visibility Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">Hiện vùng cảnh báo</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={regionsVisible}
            onChange={toggleRegionsVisibility}
            className="sr-only peer"
          />
          <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
        </label>
      </div>

      {/* Drawing/Delete Status */}
      {isDrawingMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-yellow-800 font-medium">
              Chế độ vẽ đang bật
            </span>
          </div>
          <p className="text-xs text-yellow-700 mt-1">
            Chọn công cụ và bắt đầu vẽ vùng trên bản đồ
          </p>
        </div>
      )}

      {isDeleteMode && (
        <div className="bg-red-50 border border-red-200 rounded p-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-red-800 font-medium">
              Chế độ xóa đang bật
            </span>
          </div>
          <p className="text-xs text-red-700 mt-1">
            Click vào vùng trên bản đồ để xóa
          </p>
        </div>
      )}
    </div>
  );
}
