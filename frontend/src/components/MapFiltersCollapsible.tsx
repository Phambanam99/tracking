'use client';

import { useState } from 'react';
import { useMapStore } from '@/stores/mapStore';
import {
  Search,
  Plane,
  Ship,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface MapFiltersProps {
  filters: {
    showAircraft: boolean;
    showVessels: boolean;
    selectedCategories?: string[];
    aircraft: {
      searchQuery: string;
      operator?: string;
      aircraftType?: string;
      minSpeed?: number;
      maxSpeed?: number;
      minAltitude?: number;
      maxAltitude?: number;
    };
    vessel: {
      searchQuery: string;
      operator?: string;
      vesselType?: string;
      flag?: string;
      minSpeed?: number;
      maxSpeed?: number;
    };
  };
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
  const {
    setAircraftOperator,
    setAircraftType,
    setAircraftSpeedRange,
    setAircraftAltitudeRange,
    setVesselOperator: _setVesselOperator,
    setVesselType,
    setVesselFlag,
    setVesselSpeedRange,
    activeFilterTab,
    setActiveFilterTab,
    aircraftViewMode,
    vesselViewMode,
    setAircraftViewMode,
    setVesselViewMode,
  } = useMapStore();

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="absolute top-4 left-4 z-10">
      {/* Toggle Button */}
      <button
        onClick={toggleCollapse}
        className="mb-2 flex items-center justify-center w-10 h-10 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
        title={isCollapsed ? 'Mở bộ lọc' : 'Thu gọn bộ lọc'}
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
          isCollapsed ? 'w-0 h-0 overflow-hidden opacity-0' : 'w-80 opacity-100'
        }`}
      >
        <div className="p-4 space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-2">
            <button
              onClick={() => setActiveFilterTab('aircraft')}
              className={`px-3 py-2 text-sm ${
                activeFilterTab === 'aircraft'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600'
              }`}
            >
              Máy bay
            </button>
            <button
              onClick={() => setActiveFilterTab('vessel')}
              className={`ml-4 px-3 py-2 text-sm ${
                activeFilterTab === 'vessel'
                  ? 'border-b-2 border-green-500 text-green-600'
                  : 'text-gray-600'
              }`}
            >
              Tàu thuyền
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã, tên hoặc nhà khai thác..."
              value={
                activeFilterTab === 'aircraft'
                  ? filters.aircraft.searchQuery
                  : filters.vessel.searchQuery
              }
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
              <div className="flex items-center space-x-2">
                <button
                  onClick={onToggleAircraft}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    filters.showAircraft ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      filters.showAircraft ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div className="text-xs">
                  <label className="mr-2">
                    <input
                      type="radio"
                      className="mr-1"
                      checked={aircraftViewMode === 'all'}
                      onChange={() => setAircraftViewMode('all')}
                    />
                    Tất cả máy bay
                  </label>
                  <label>
                    <input
                      type="radio"
                      className="mr-1"
                      checked={aircraftViewMode === 'tracked'}
                      onChange={() => setAircraftViewMode('tracked')}
                    />
                    Máy bay đang theo dõi
                  </label>
                </div>
              </div>
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
              <div className="flex items-center space-x-2">
                <button
                  onClick={onToggleVessels}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    filters.showVessels ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      filters.showVessels ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div className="text-xs">
                  <label className="mr-2">
                    <input
                      type="radio"
                      className="mr-1"
                      checked={vesselViewMode === 'all'}
                      onChange={() => setVesselViewMode('all')}
                    />
                    Tất cả tàu thuyền
                  </label>
                  <label>
                    <input
                      type="radio"
                      className="mr-1"
                      checked={vesselViewMode === 'tracked'}
                      onChange={() => setVesselViewMode('tracked')}
                    />
                    Tàu đang theo dõi
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="space-y-3">
            <h3 className="font-medium text-gray-700 text-sm">
              Bộ lọc nâng cao
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {activeFilterTab === 'aircraft' && (
                <input
                  type="text"
                  value={filters.aircraft?.operator || ''}
                  onChange={(e) => setAircraftOperator(e.target.value)}
                  placeholder="Nhà khai thác (máy bay)"
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                />
              )}
              {activeFilterTab === 'aircraft' && (
                <input
                  type="text"
                  value={filters.aircraft?.aircraftType || ''}
                  onChange={(e) => setAircraftType(e.target.value)}
                  placeholder="Loại máy bay"
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                />
              )}
              {activeFilterTab === 'vessel' && (
                <input
                  type="text"
                  value={filters.vessel?.vesselType || ''}
                  onChange={(e) => setVesselType(e.target.value)}
                  placeholder="Loại tàu"
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                />
              )}
              {activeFilterTab === 'vessel' && (
                <input
                  type="text"
                  value={filters.vessel?.flag || ''}
                  onChange={(e) => setVesselFlag(e.target.value)}
                  placeholder="Quốc kỳ"
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {activeFilterTab === 'aircraft' && (
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    placeholder="Tốc độ min (máy bay)"
                    value={filters.aircraft?.minSpeed ?? ''}
                    onChange={(e) =>
                      setAircraftSpeedRange(
                        e.target.value === ''
                          ? undefined
                          : Number(e.target.value),
                        filters.aircraft?.maxSpeed,
                      )
                    }
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Tốc độ max (máy bay)"
                    value={filters.aircraft?.maxSpeed ?? ''}
                    onChange={(e) =>
                      setAircraftSpeedRange(
                        filters.aircraft?.minSpeed,
                        e.target.value === ''
                          ? undefined
                          : Number(e.target.value),
                      )
                    }
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              )}
              <div className="flex items-center space-x-2">
                {activeFilterTab === 'aircraft' && (
                  <>
                    <input
                      type="number"
                      placeholder="Độ cao min"
                      value={filters.aircraft?.minAltitude ?? ''}
                      onChange={(e) =>
                        setAircraftAltitudeRange(
                          e.target.value === ''
                            ? undefined
                            : Number(e.target.value),
                          filters.aircraft?.maxAltitude,
                        )
                      }
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Độ cao max"
                      value={filters.aircraft?.maxAltitude ?? ''}
                      onChange={(e) =>
                        setAircraftAltitudeRange(
                          filters.aircraft?.minAltitude,
                          e.target.value === ''
                            ? undefined
                            : Number(e.target.value),
                        )
                      }
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </>
                )}
              </div>
              {activeFilterTab === 'vessel' && (
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    placeholder="Tốc độ min (tàu)"
                    value={filters.vessel?.minSpeed ?? ''}
                    onChange={(e) =>
                      setVesselSpeedRange(
                        e.target.value === ''
                          ? undefined
                          : Number(e.target.value),
                        filters.vessel?.maxSpeed,
                      )
                    }
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Tốc độ max (tàu)"
                    value={filters.vessel?.maxSpeed ?? ''}
                    onChange={(e) =>
                      setVesselSpeedRange(
                        filters.vessel?.minSpeed,
                        e.target.value === ''
                          ? undefined
                          : Number(e.target.value),
                      )
                    }
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              )}
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
