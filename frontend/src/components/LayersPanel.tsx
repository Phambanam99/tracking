'use client';

import React, { useEffect, useState } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { useTrackingStore } from '@/stores/trackingStore';
import { useAuthStore } from '@/stores/authStore';
// import { useVesselStore } from '@/stores/vesselStore';
// import { useAircraftStore } from '@/stores/aircraftStore';
import { usePortsStore } from '@/stores/portsStore';
import MapControls from './MapControls';
import {
  Layers as LayersIcon,
  Filter as FilterIcon,
  Wrench,
  X,
  Plane,
  Ship,
  Search,
  RotateCcw,
  Eye,
  Star,
  CloudRain,
  Thermometer,
  Wind,
  Cloud,
  Droplets,
} from 'lucide-react';
import api from '@/services/apiClient';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';
import { useWeatherStore } from '@/stores/weatherStore';

interface LayersPanelProps {
  aircraftCount: number;
  vesselCount: number;
  trackedAircraftCount: number;
  trackedVesselCount: number;
}

export default function LayersPanel({
  aircraftCount,
  vesselCount,
  trackedAircraftCount,
  trackedVesselCount,
}: LayersPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'layers' | 'filters' | 'tools'>('layers');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState('');
  const { settings } = useSystemSettingsStore();
  const { baseMapProvider, maptilerStyle: userMaptilerStyle, setBaseMapProvider, setMaptilerStyle } = useUserPreferencesStore();

  const {
    filters,
    activeFilterTab,
    aircraftViewMode,
    vesselViewMode,
    applyFilters,
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
    toggleAircraftVisibility,
    toggleVesselVisibility,
    regionsVisible,
    toggleRegionsVisibility,
  } = useMapStore();

  const { user } = useAuthStore();
  const { fetchTrackedItems } = useTrackingStore();
  const { showPorts, setShowPorts } = usePortsStore();
  const {
    activeLayer,
    weatherVisible,
    windArrowsVisible,
    setActiveLayer,
    setWeatherVisible,
    setWindArrowsVisible,
  } = useWeatherStore();
  // These stores are available if we need future per-layer counts
  // const { vessels } = useVesselStore();
  // const { aircrafts } = useAircraftStore();

  useEffect(() => {
    if (user) fetchTrackedItems();
  }, [user, fetchTrackedItems]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (activeFilterTab === 'aircraft') setAircraftSearchQuery(searchDebounce);
      else setVesselSearchQuery(searchDebounce);
    }, 300);
    return () => clearTimeout(t);
  }, [searchDebounce, activeFilterTab, setAircraftSearchQuery, setVesselSearchQuery]);

  useEffect(() => {
    if (activeFilterTab === 'aircraft') setSearchDebounce(filters.aircraft.searchQuery);
    else setSearchDebounce(filters.vessel.searchQuery);
  }, [activeFilterTab, filters]);

  const currentCount = activeFilterTab === 'aircraft' ? aircraftCount : vesselCount;
  const currentTrackedCount = activeFilterTab === 'aircraft' ? trackedAircraftCount : trackedVesselCount;
  const currentViewMode = activeFilterTab === 'aircraft' ? aircraftViewMode : vesselViewMode;

  const handleTabSwitch = (tab: 'aircraft' | 'vessel') => {
    setActiveFilterTab(tab);
    if (tab === 'aircraft') setSearchDebounce(filters.aircraft.searchQuery);
    else setSearchDebounce(filters.vessel.searchQuery);
  };

  const handleViewModeChange = (mode: 'all' | 'tracked') => {
    if (activeFilterTab === 'aircraft') setAircraftViewMode(mode);
    else setVesselViewMode(mode);
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
    <div className="absolute top-4 right-4 z-[2]">
      <div className="flex flex-col items-end gap-2">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="flex items-center justify-center w-10 h-10 bg-white rounded-lg shadow-lg hover:bg-gray-50 border border-gray-200"
          title={isOpen ? 'Ẩn lớp' : 'Hiện lớp'}
        >
          <LayersIcon className="w-5 h-5 text-gray-700" />
        </button>

        {isOpen && (
          <div className="w-[420px] max-w-[90vw] bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex gap-1 bg-white rounded-lg p-1 border border-gray-200">
                <button
                  onClick={() => setActiveSection('layers')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeSection === 'layers' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <LayersIcon className="w-4 h-4" />
                  Lớp
                </button>
                <button
                  onClick={() => setActiveSection('filters')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeSection === 'filters' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FilterIcon className="w-4 h-4" />
                  Bộ lọc
                </button>
                <button
                  onClick={() => setActiveSection('tools')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeSection === 'tools' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Wrench className="w-4 h-4" />
                  Công cụ
                </button>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeSection === 'layers' && (
              <div className="p-4 space-y-4">
                {/* Base map selection */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">Lớp nền bản đồ</div>
                  <div className="grid grid-cols-1 gap-2">
                    <label className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2 border cursor-pointer">
                      <span className="text-sm">Theo hệ thống (mặc định)</span>
                      <input
                        type="radio"
                        name="basemap"
                        checked={baseMapProvider === 'default'}
                        onChange={() => setBaseMapProvider('default')}
                      />
                    </label>
                    <label className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2 border cursor-pointer">
                      <span className="text-sm">OpenStreetMap</span>
                      <input
                        type="radio"
                        name="basemap"
                        checked={baseMapProvider === 'osm'}
                        onChange={() => setBaseMapProvider('osm')}
                      />
                    </label>
                    <div className="bg-gray-50 rounded-md px-3 py-2 border">
                      <div className="flex items-center justify-between">
                        <label className="text-sm">MapTiler</label>
                        <input
                          type="radio"
                          name="basemap"
                          checked={baseMapProvider === 'maptiler'}
                          onChange={() => setBaseMapProvider('maptiler')}
                          disabled={!settings.maptilerApiKey}
                        />
                      </div>
                      {baseMapProvider === 'maptiler' && (
                        <div className="mt-2">
                          <select
                            className="w-full border rounded px-2 py-1 text-sm"
                            value={userMaptilerStyle}
                            onChange={(e) => setMaptilerStyle(e.target.value)}
                          >
                            <option value="streets">Streets</option>
                            <option value="outdoor">Outdoor</option>
                            <option value="satellite">Satellite</option>
                            <option value="topo">Topographic</option>
                            <option value="terrain">Terrain</option>
                            <option value="bright">Bright</option>
                            <option value="basic">Basic</option>
                          </select>
                          {!settings.maptilerApiKey && (
                            <p className="mt-1 text-xs text-red-600">Chưa cấu hình API key MapTiler</p>
                          )}
                        </div>
                      )}
                    </div>
                    {(settings.customMapSources || []).map((src) => (
                      <label key={src.id} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2 border cursor-pointer">
                        <span className="text-sm">{src.name}</span>
                        <input
                          type="radio"
                          name="basemap"
                          checked={baseMapProvider === `custom:${src.id}`}
                          onChange={() => setBaseMapProvider(`custom:${src.id}`)}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2 border">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Plane className="w-4 h-4 text-blue-600" />
                      <span>Hiện máy bay</span>
                    </div>
                    <input type="checkbox" checked={!!filters.showAircraft} onChange={toggleAircraftVisibility} />
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2 border">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Ship className="w-4 h-4 text-green-600" />
                      <span>Hiện tàu thuyền</span>
                    </div>
                    <input type="checkbox" checked={!!filters.showVessels} onChange={toggleVesselVisibility} />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2 border">
                  <span className="text-sm text-gray-700">Hiện vùng cảnh báo</span>
                  <input type="checkbox" checked={regionsVisible} onChange={toggleRegionsVisibility} />
                </div>

                <div className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2 border">
                  <span className="text-sm text-gray-700">Hiển thị cảng biển</span>
                  <input type="checkbox" checked={showPorts} onChange={(e) => setShowPorts(e.target.checked)} />
                </div>

                {/* Weather Layer */}
                <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gradient-to-br from-sky-50 to-blue-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <CloudRain className="w-4 h-4 text-sky-600" />
                      <span>Lớp thời tiết</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={weatherVisible}
                      onChange={(e) => {
                        console.log('[Weather] Toggle clicked:', e.target.checked);
                        setWeatherVisible(e.target.checked);
                        if (!e.target.checked) {
                          setActiveLayer('none');
                        } else if (activeLayer === 'none') {
                          console.log('[Weather] Setting default layer to temperature');
                          setActiveLayer('temperature');
                        }
                      }}
                    />
                  </div>

                  {weatherVisible && (
                    <>
                      <div className="space-y-1.5 pt-2 border-t border-sky-200">
                        <label className="flex items-center justify-between bg-white rounded px-2 py-1.5 cursor-pointer hover:bg-sky-50">
                          <div className="flex items-center gap-2 text-xs">
                            <Thermometer className="w-3.5 h-3.5 text-red-500" />
                            <span>Nhiệt độ</span>
                          </div>
                          <input
                            type="radio"
                            name="weather-layer"
                            checked={activeLayer === 'temperature'}
                            onChange={() => setActiveLayer('temperature')}
                          />
                        </label>
                        <label className="flex items-center justify-between bg-white rounded px-2 py-1.5 cursor-pointer hover:bg-sky-50">
                          <div className="flex items-center gap-2 text-xs">
                            <Droplets className="w-3.5 h-3.5 text-blue-500" />
                            <span>Lượng mưa</span>
                          </div>
                          <input
                            type="radio"
                            name="weather-layer"
                            checked={activeLayer === 'precipitation'}
                            onChange={() => setActiveLayer('precipitation')}
                          />
                        </label>
                        <label className="flex items-center justify-between bg-white rounded px-2 py-1.5 cursor-pointer hover:bg-sky-50">
                          <div className="flex items-center gap-2 text-xs">
                            <Cloud className="w-3.5 h-3.5 text-gray-500" />
                            <span>Độ che phủ mây</span>
                          </div>
                          <input
                            type="radio"
                            name="weather-layer"
                            checked={activeLayer === 'clouds'}
                            onChange={() => setActiveLayer('clouds')}
                          />
                        </label>
                      </div>

                      <div className="flex items-center justify-between bg-white rounded px-2 py-1.5 border-t border-sky-200 pt-2">
                        <div className="flex items-center gap-2 text-xs text-gray-700">
                          <Wind className="w-3.5 h-3.5 text-green-600" />
                          <span>Mũi tên gió</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={windArrowsVisible}
                          onChange={(e) => setWindArrowsVisible(e.target.checked)}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'filters' && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => handleTabSwitch('aircraft')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        activeFilterTab === 'aircraft' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-blue-600'
                      }`}
                    >
                      <Plane className="w-4 h-4" />
                      Máy bay
                    </button>
                    <button
                      onClick={() => handleTabSwitch('vessel')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        activeFilterTab === 'vessel' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-600 hover:text-green-600'
                      }`}
                    >
                      <Ship className="w-4 h-4" />
                      Tàu thuyền
                    </button>
                  </div>
                </div>

                <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
                  <button
                    onClick={() => handleViewModeChange('all')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
                      currentViewMode === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    Tất cả ({currentCount})
                  </button>
                  <button
                    onClick={() => handleViewModeChange('tracked')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
                      currentViewMode === 'tracked' ? 'bg-white text-yellow-600 shadow-sm' : 'text-gray-600 hover:text-yellow-600'
                    }`}
                  >
                    <Star className="w-4 h-4" />
                    Theo dõi ({currentTrackedCount})
                  </button>
                </div>

                <div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder={`Tìm kiếm ${activeFilterTab === 'aircraft' ? 'máy bay' : 'tàu thuyền'}...`}
                      value={searchDebounce}
                      onChange={(e) => setSearchDebounce(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="flex items-center justify-between w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border text-sm"
                  >
                    <span className="text-gray-700">Bộ lọc nâng cao</span>
                    <span className="text-gray-500">{showAdvanced ? 'Ẩn' : 'Hiện'}</span>
                  </button>
                </div>

                {showAdvanced && (
                  <div className="space-y-4 mt-2">
                    {activeFilterTab === 'aircraft' ? (
                      <>
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
                            onChange={(e) => setAircraftSpeedRange(e.target.value === '' ? undefined : Number(e.target.value), filters.aircraft.maxSpeed)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <input
                            type="number"
                            placeholder="Tốc độ tối đa"
                            value={filters.aircraft.maxSpeed ?? ''}
                            onChange={(e) => setAircraftSpeedRange(filters.aircraft.minSpeed, e.target.value === '' ? undefined : Number(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="number"
                            placeholder="Độ cao tối thiểu"
                            value={filters.aircraft.minAltitude ?? ''}
                            onChange={(e) => setAircraftAltitudeRange(e.target.value === '' ? undefined : Number(e.target.value), filters.aircraft.maxAltitude)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <input
                            type="number"
                            placeholder="Độ cao tối đa"
                            value={filters.aircraft.maxAltitude ?? ''}
                            onChange={(e) => setAircraftAltitudeRange(filters.aircraft.minAltitude, e.target.value === '' ? undefined : Number(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </>
                    ) : (
                      <>
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
                            onChange={(e) => setVesselSpeedRange(e.target.value === '' ? undefined : Number(e.target.value), filters.vessel.maxSpeed)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                          <input
                            type="number"
                            placeholder="Tốc độ tối đa"
                            value={filters.vessel.maxSpeed ?? ''}
                            onChange={(e) => setVesselSpeedRange(filters.vessel.minSpeed, e.target.value === '' ? undefined : Number(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2 border-t border-gray-200">
                  <button
                    onClick={handleResetCurrentTab}
                    className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Đặt lại
                  </button>
                  <div className="flex-1" />
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    onClick={() => {
                      applyFilters();
                    }}
                  >
                    <Search className="w-4 h-4" />
                    Tìm kiếm
                  </button>
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    onClick={async () => {
                      try {
                        const payload = {
                          name: 'default',
                          activeFilterTab,
                          aircraftViewMode,
                          vesselViewMode,
                          aircraft: filters.aircraft,
                          vessel: filters.vessel,
                        } as const;
                        await api.post('/users/filters', payload);
                      } catch (e) {
                        console.error('Failed to save filters', e);
                      }
                    }}
                  >
                    Lưu
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'tools' && (
              <div className="p-4">
                <MapControls />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


