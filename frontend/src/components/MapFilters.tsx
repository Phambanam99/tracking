"use client";

import { useState } from "react";
import { Search, Plane, Ship, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";

interface MapFiltersProps {
  filters: {
    showAircraft: boolean;
    showVessels: boolean;
    searchQuery: string;
  };
  onToggleAircraft: () => void;
  onToggleVessels: () => void;
  onSearchChange: (query: string) => void;
  onResetFilters: () => void;
  aircraftCount: number;
  vesselCount: number;
}
  onToggleAircraft: () => void;
  onToggleVessels: () => void;
  onSearchChange: (query: string) => void;
  onResetFilters: () => void;
  aircraftCount: number;
  vesselCount: number;
}

export default function MapFilters({
  filters,
  onToggleAircraft,
  onToggleVessels,
  onSearchChange,
  onResetFilters,
  aircraftCount,
  vesselCount,
}: MapFiltersProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="absolute top-4 left-4 z-10">
      {/* Toggle Button */}
      <button
        onClick={toggleCollapse}
        className="mb-2 flex items-center justify-center w-10 h-10 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
        title={isCollapsed ? "Mở bộ lọc" : "Thu gọn bộ lọc"}
      >
        {isCollapsed ? (
          <ChevronRight className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        )}
      </button>

      {/* Filter Panel */}
      <div
        className={`bg-white rounded-lg shadow-lg transition-all duration-300 ${
          isCollapsed ? "w-0 h-0 overflow-hidden opacity-0" : "w-80 opacity-100"
        }`}
      >
        <div className="p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã, tên hoặc nhà khai thác..."
              value={filters.searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Layer Controls */}
          <div className="space-y-3">
            <h3 className="font-medium text-gray-700 text-sm">Hiển thị lớp</h3>
            
            {/* Aircraft Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Plane className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-700">Máy bay</span>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                  {aircraftCount}
                </span>
              </div>
              <button
                onClick={onToggleAircraft}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  filters.showAircraft ? "bg-blue-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    filters.showAircraft ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Vessel Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Ship className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-700">Tàu thuyền</span>
                <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">
                  {vesselCount}
                </span>
              </div>
              <button
                onClick={onToggleVessels}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  filters.showVessels ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    filters.showVessels ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={onResetFilters}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Đặt lại bộ lọc</span>
          </button>

          {/* Summary */}
          <div className="text-xs text-gray-500 pt-2 border-t">
            Tổng: {aircraftCount + vesselCount} đối tượng được hiển thị
          </div>
        </div>
      </div>
    </div>
  );
}
