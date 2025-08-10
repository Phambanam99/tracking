'use client';

import { useState, useEffect } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { useTrackingStore } from '@/stores/trackingStore';
import { useAuthStore } from '@/stores/authStore';
import {
  Search,
  Plane,
  Ship,
  RotateCcw,
  Filter,
  X,
  Settings,
  Eye,
  EyeOff,
  Star,
  Database,
} from 'lucide-react';

interface MapFiltersProps {
  aircraftCount: number;
  vesselCount: number;
  trackedAircraftCount: number;
  trackedVesselCount: number;
}

export default function MapFiltersRedesigned({
  aircraftCount,
  vesselCount,
  trackedAircraftCount,
  trackedVesselCount,
}: MapFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState('');

  const {
    filters,
    activeFilterTab,
    aircraftViewMode,
    vesselViewMode,
    setActiveFilterTab,
    setAircraftViewMode,
    setVesselViewMode,
    setAircraftSearchQuery,
    setVesselSearchQuery,
    setAircraftOperator,
    setAircraftType,
    setAircraftSpeedRange,
    setAircraftAltitudeRange,
    setVesselOperator,
    setVesselType,
    setVesselFlag,
    setVesselSpeedRange,
    resetAircraftFilters,
    resetVesselFilters,
    resetFilters,
  } = useMapStore();

  const { user } = useAuthStore();
  const { fetchTrackedItems } = useTrackingStore();

  // Load tracking data when component mounts
  useEffect(() => {
    if (user) {
      fetchTrackedItems();
    }
  }, [user, fetchTrackedItems]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeFilterTab === 'aircraft') {
        setAircraftSearchQuery(searchDebounce);
      } else {
        setVesselSearchQuery(searchDebounce);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    searchDebounce,
    activeFilterTab,
    setAircraftSearchQuery,
    setVesselSearchQuery,
  ]);

  // Initialize search from store
  useEffect(() => {
    if (activeFilterTab === 'aircraft') {
      setSearchDebounce(filters.aircraft.searchQuery);
    } else {
      setSearchDebounce(filters.vessel.searchQuery);
    }
  }, [activeFilterTab, filters]);

  const currentCount =
    activeFilterTab === 'aircraft' ? aircraftCount : vesselCount;
  const currentTrackedCount =
    activeFilterTab === 'aircraft' ? trackedAircraftCount : trackedVesselCount;
  const currentViewMode =
    activeFilterTab === 'aircraft' ? aircraftViewMode : vesselViewMode;

  const handleTabSwitch = (tab: 'aircraft' | 'vessel') => {
    setActiveFilterTab(tab);
    if (tab === 'aircraft') {
      setSearchDebounce(filters.aircraft.searchQuery);
    } else {
      setSearchDebounce(filters.vessel.searchQuery);
    }
  };

  const handleViewModeChange = (mode: 'all' | 'tracked') => {
    if (activeFilterTab === 'aircraft') {
      setAircraftViewMode(mode);
    } else {
      setVesselViewMode(mode);
    }
  };

  const handleResetCurrentTab = () => {
    if (activeFilterTab === 'aircraft') {
      resetAircraftFilters();
      setSearchDebounce('');
    } else {
      resetVesselFilters();
      setSearchDebounce('');
    }
  };

  return (
    <div className="fixed top-30 right-4 z-2">
      {/* Compact Toggle Button */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200">
        <button
          onClick={() => setIsOpen(!isOpen)}
           className="flex items-center justify-center w-10 h-10 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
        >
          <Filter className="w-5 h-5 text-gray-600" />
        </button>

        {/* Filter Panel */}
        {isOpen && (
          <div className="absolute top-full right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 p-6">
            {/* Header with Tabs */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleTabSwitch('aircraft')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeFilterTab === 'aircraft'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  <Plane className="w-4 h-4" />
                  <span>Máy bay</span>
                  <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs">
                    {aircraftCount}
                  </span>
                </button>
                <button
                  onClick={() => handleTabSwitch('vessel')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeFilterTab === 'vessel'
                      ? 'bg-white text-green-600 shadow-sm'
                      : 'text-gray-600 hover:text-green-600'
                  }`}
                >
                  <Ship className="w-4 h-4" />
                  <span>Tàu thuyền</span>
                  <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-xs">
                    {vesselCount}
                  </span>
                </button>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View Mode Selection */}
            <div className="mb-4">
              <div className="flex space-x-1 bg-gray-50 rounded-lg p-1">
                <button
                  onClick={() => handleViewModeChange('all')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
                    currentViewMode === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>Tất cả ({currentCount})</span>
                </button>
                <button
                  onClick={() => handleViewModeChange('tracked')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
                    currentViewMode === 'tracked'
                      ? 'bg-white text-yellow-600 shadow-sm'
                      : 'text-gray-600 hover:text-yellow-600'
                  }`}
                >
                  <Star className="w-4 h-4" />
                  <span>Theo dõi ({currentTrackedCount})</span>
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder={`Tìm kiếm ${
                    activeFilterTab === 'aircraft' ? 'máy bay' : 'tàu thuyền'
                  }...`}
                  value={searchDebounce}
                  onChange={(e) => setSearchDebounce(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Advanced Filters */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Bộ lọc nâng cao</span>
              </h4>

              {activeFilterTab === 'aircraft' ? (
                <>
                  {/* Aircraft Filters */}
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Nhà khai thác"
                      value={filters.aircraft.operator || ''}
                      onChange={(e) => setAircraftOperator(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Loại máy bay"
                      value={filters.aircraft.aircraftType || ''}
                      onChange={(e) => setAircraftType(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Tốc độ tối thiểu"
                      value={filters.aircraft.minSpeed ?? ''}
                      onChange={(e) =>
                        setAircraftSpeedRange(
                          e.target.value === ''
                            ? undefined
                            : Number(e.target.value),
                          filters.aircraft.maxSpeed,
                        )
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Tốc độ tối đa"
                      value={filters.aircraft.maxSpeed ?? ''}
                      onChange={(e) =>
                        setAircraftSpeedRange(
                          filters.aircraft.minSpeed,
                          e.target.value === ''
                            ? undefined
                            : Number(e.target.value),
                        )
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Độ cao tối thiểu"
                      value={filters.aircraft.minAltitude ?? ''}
                      onChange={(e) =>
                        setAircraftAltitudeRange(
                          e.target.value === ''
                            ? undefined
                            : Number(e.target.value),
                          filters.aircraft.maxAltitude,
                        )
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Độ cao tối đa"
                      value={filters.aircraft.maxAltitude ?? ''}
                      onChange={(e) =>
                        setAircraftAltitudeRange(
                          filters.aircraft.minAltitude,
                          e.target.value === ''
                            ? undefined
                            : Number(e.target.value),
                        )
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Vessel Filters */}
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Nhà khai thác"
                      value={filters.vessel.operator || ''}
                      onChange={(e) => setVesselOperator(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <input
                      type="text"
                      placeholder="Loại tàu"
                      value={filters.vessel.vesselType || ''}
                      onChange={(e) => setVesselType(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Quốc kỳ"
                      value={filters.vessel.flag || ''}
                      onChange={(e) => setVesselFlag(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <div></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Tốc độ tối thiểu"
                      value={filters.vessel.minSpeed ?? ''}
                      onChange={(e) =>
                        setVesselSpeedRange(
                          e.target.value === ''
                            ? undefined
                            : Number(e.target.value),
                          filters.vessel.maxSpeed,
                        )
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <input
                      type="number"
                      placeholder="Tốc độ tối đa"
                      value={filters.vessel.maxSpeed ?? ''}
                      onChange={(e) =>
                        setVesselSpeedRange(
                          filters.vessel.minSpeed,
                          e.target.value === ''
                            ? undefined
                            : Number(e.target.value),
                        )
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleResetCurrentTab}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Đặt lại</span>
              </button>
              <button
                onClick={resetFilters}
                className="flex items-center space-x-2 px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors text-sm"
              >
                <EyeOff className="w-4 h-4" />
                <span>Xóa tất cả</span>
              </button>
              <div className="flex-1"></div>
              <button
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                onClick={() => {
                  // TODO: Save to database
                  console.log('Save filters to database');
                }}
              >
                <Database className="w-4 h-4" />
                <span>Lưu</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
