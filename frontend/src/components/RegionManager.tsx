import React, { useState, useEffect } from "react";
import { useRegionStore, Region } from "../stores/regionStore";
import {
  Plus,
  MapPin,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";

const RegionManager: React.FC = () => {
  const {
    regions,
    isLoading,
    error,
    selectedRegion,
    drawingMode,
    fetchRegions,
    deleteRegion,
    setSelectedRegion,
    setDrawingMode,
  } = useRegionStore();

  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  const handleDeleteRegion = async (regionId: number) => {
    if (window.confirm("Bạn có chắc muốn xóa vùng này?")) {
      try {
        await deleteRegion(regionId);
      } catch (error) {
        console.error("Error deleting region:", error);
      }
    }
  };

  const handleToggleActive = async (region: Region) => {
    // Will implement update functionality
    console.log("Toggle active for region:", region.id);
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-500" />
          Quản lý vùng theo dõi
        </h2>
        <button
          onClick={() => setDrawingMode(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Tạo vùng mới
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {regions.length === 0 ? (
        <div className="text-center py-8">
          <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">Chưa có vùng theo dõi nào</p>
          <button
            onClick={() => setDrawingMode(true)}
            className="text-blue-500 hover:text-blue-600"
          >
            Tạo vùng đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {regions.map((region) => (
            <div
              key={region.id}
              className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                selectedRegion?.id === region.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900">{region.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        region.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {region.isActive ? "Hoạt động" : "Tạm dừng"}
                    </span>
                    {region.regionType === "CIRCLE" && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                        Hình tròn
                      </span>
                    )}
                    {region.regionType === "POLYGON" && (
                      <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                        Đa giác
                      </span>
                    )}
                  </div>
                  {region.description && (
                    <p className="text-sm text-gray-600 mb-2">
                      {region.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Vào: {region.alertOnEntry ? "Bật" : "Tắt"}
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Ra: {region.alertOnExit ? "Bật" : "Tắt"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedRegion(region)}
                    className="p-2 text-blue-500 hover:bg-blue-50 rounded"
                    title="Xem trên bản đồ"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(region)}
                    className={`p-2 rounded ${
                      region.isActive
                        ? "text-orange-500 hover:bg-orange-50"
                        : "text-green-500 hover:bg-green-50"
                    }`}
                    title={region.isActive ? "Tạm dừng" : "Kích hoạt"}
                  >
                    {region.isActive ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => console.log("Edit region:", region.id)}
                    className="p-2 text-gray-500 hover:bg-gray-50 rounded"
                    title="Chỉnh sửa"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteRegion(region.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                    title="Xóa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {drawingMode && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-700 text-sm">
            Chế độ vẽ vùng đang được bật. Sử dụng các công cụ trên bản đồ để tạo
            vùng mới.
          </p>
          <button
            onClick={() => setDrawingMode(false)}
            className="mt-2 text-blue-600 hover:text-blue-800 text-sm underline"
          >
            Hủy chế độ vẽ
          </button>
        </div>
      )}
    </div>
  );
};

export default RegionManager;
