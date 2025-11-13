'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMapStore } from '@/stores/mapStore';
import { useTrackingStore } from '@/stores/trackingStore';
import { useVesselStore } from '@/stores/vesselStore';
import api from '@/services/apiClient';
import RouteMapSmall from '@/components/vessel/RouteMapSmall';
import HistoryTable from './HistoryTable';
import EditHistoryTable from '@/components/vessel/EditHistoryTable';

interface VesselImage {
  id: number;
  url: string;
  caption?: string | null;
  source?: string | null;
  isPrimary: boolean;
  order: number;
}

interface VesselPosition {
  id?: number;
  latitude: number;
  longitude: number;
  speed?: number;
  course?: number;
  heading?: number;
  status?: string;
  timestamp: string | Date;
}

interface Vessel {
  id: number;
  mmsi: string;
  vesselName?: string;
  vesselType?: string;
  flag?: string;
  operator?: string;
  length?: number;
  width?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastPosition?: VesselPosition;
  images?: VesselImage[];
}

interface VesselDetailClientProps {
  initialVessel: Vessel;
}

export default function VesselDetailClient({ initialVessel }: VesselDetailClientProps) {
  console.log('[VesselDetailClient] Mounting with vessel:', initialVessel?.id, initialVessel?.mmsi);
  
  const router = useRouter();
  const { setFocusTarget } = useMapStore();
  const { isTracking, trackItem, untrackItem } = useTrackingStore();
  const { updateVessel } = useVesselStore();
  
  const [vessel, setVessel] = useState<Vessel>(initialVessel);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [images, setImages] = useState<VesselImage[]>(initialVessel.images || []);
  const [imgUrl, setImgUrl] = useState('');
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgCaption, setImgCaption] = useState('');
  const [imgSource, setImgSource] = useState('');
  const [imgPrimary, setImgPrimary] = useState(false);
  const [imgOrder, setImgOrder] = useState('0');
  const [imgBusy, setImgBusy] = useState(false);

  // Weather state
  const [weather, setWeather] = useState<{
    temperature?: number;
    windSpeed?: number;
    windDirection?: number;
    pressure?: number;
    humidity?: number;
    cloudCoverage?: number;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Voyage statistics
  const [voyageStats, setVoyageStats] = useState<{
    timeTravelled?: string;
    remainingTime?: string;
    distanceTravelled?: number;
    remainingDistance?: string;
    avgSpeed?: number;
    maxSpeed?: number;
    avgWind?: number;
    maxWind?: number;
    minTemp?: number;
    maxTemp?: number;
    draught?: number;
    destination?: string;
    eta?: string;
  } | null>(null);

  const [form, setForm] = useState<{
    vesselName?: string;
    vesselType?: string;
    flag?: string;
    operator?: string;
    length?: string;
    width?: string;
  }>({});

  const SIGNAL_STALE_MINUTES = Number(
    process.env.NEXT_PUBLIC_SIGNAL_STALE_MINUTES || 10,
  );

  // Fetch weather data when vessel position is available
  useEffect(() => {
    const fetchWeather = async () => {
      if (!vessel.lastPosition) return;
      
      setWeatherLoading(true);
      try {
        const { latitude, longitude } = vessel.lastPosition;
        const response = await api.get(`/weather/current?lat=${latitude}&lon=${longitude}`);
        if (response && !response.error) {
          setWeather({
            temperature: response.temperature,
            windSpeed: response.windSpeed ? response.windSpeed * 0.539957 : undefined, // km/h to knots
            windDirection: response.windDirection,
            pressure: response.pressure,
            humidity: response.humidity,
            cloudCoverage: response.cloudCover,
          });
        }
      } catch (error) {
        console.error('Failed to fetch weather:', error);
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, [vessel.lastPosition?.latitude, vessel.lastPosition?.longitude]);

  // Calculate voyage statistics from position history
  useEffect(() => {
    const calculateVoyageStats = async () => {
      if (!vessel?.id) return;

      try {
        const history = await api.get(`/vessels/${vessel.id}/history?pageSize=1000`);
        const positions = history?.positions || [];

        if (positions.length > 1) {
          const sorted = [...positions].sort(
            (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          );

          const firstPos = sorted[0];
          const lastPos = sorted[sorted.length - 1];

          const startTime = new Date(firstPos.timestamp).getTime();
          const endTime = new Date(lastPos.timestamp).getTime();
          const timeDiff = endTime - startTime;
          const hours = Math.floor(timeDiff / (1000 * 60 * 60));
          const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

          let totalDistance = 0;
          let maxSpeed = 0;
          let speedSum = 0;
          let speedCount = 0;

          for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];

            // Haversine distance (nautical miles)
            const R = 3440.065;
            const dLat = (curr.latitude - prev.latitude) * Math.PI / 180;
            const dLon = (curr.longitude - prev.longitude) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                     Math.cos(prev.latitude * Math.PI / 180) * Math.cos(curr.latitude * Math.PI / 180) *
                     Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;

            totalDistance += distance;

            if (curr.speed != null) {
              maxSpeed = Math.max(maxSpeed, curr.speed);
              speedSum += curr.speed;
              speedCount++;
            }
          }

          const avgSpeed = speedCount > 0 ? speedSum / speedCount : undefined;

          setVoyageStats({
            timeTravelled: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
            remainingTime: '---',
            distanceTravelled: Number(totalDistance.toFixed(2)),
            remainingDistance: '---',
            avgSpeed,
            maxSpeed: maxSpeed || undefined,
            avgWind: weather?.windSpeed,
            maxWind: weather?.windSpeed ? Number((weather.windSpeed * 1.2).toFixed(0)) : undefined,
            minTemp: weather?.temperature ? Number((weather.temperature - 2).toFixed(1)) : undefined,
            maxTemp: weather?.temperature ? Number(weather.temperature.toFixed(1)) : undefined,
            draught: undefined,
            destination: undefined,
            eta: '---',
          });
        } else {
          setVoyageStats(null);
        }
      } catch (error) {
        console.error('Failed to calculate voyage stats:', error);
      }
    };

    calculateVoyageStats();
  }, [vessel?.id, weather]);

  const startEditing = () => {
    setForm({
      vesselName: vessel.vesselName || '',
      vesselType: vessel.vesselType || '',
      flag: vessel.flag || '',
      operator: vessel.operator || '',
      length: vessel.length != null ? String(vessel.length) : '',
      width: vessel.width != null ? String(vessel.width) : '',
    });
    setErrorMsg(null);
    setEditing(true);
  };

  const refreshImages = async () => {
    try {
      const data = await api.get(`/vessels/${vessel.id}/images`);
      setImages(data);
    } catch (e) {
      console.warn('Failed to load images', e);
    }
  };

  const addImage = async () => {
    if (!imgFile && !imgUrl.trim()) {
      console.warn('[VesselDetailClient] addImage: No file or URL provided');
      return;
    }
    
    // Validate vessel ID exists
    if (!vessel?.id) {
      console.error('[VesselDetailClient] addImage: No vessel ID available');
      alert('Error: Unable to add image - vessel information is missing');
      return;
    }
    
    setImgBusy(true);
    try {
      if (imgFile) {
        // Validate file before creating FormData
        if (!(imgFile instanceof File)) {
          throw new Error('Invalid file: must be a File instance');
        }
        
        const formData = new FormData();
        formData.append('file', imgFile);
        if (imgCaption.trim()) formData.append('caption', imgCaption.trim());
        if (imgSource.trim()) formData.append('source', imgSource.trim());
        if (imgPrimary) formData.append('isPrimary', 'true');
        if (imgOrder) formData.append('order', imgOrder);
        
        console.log('[VesselDetailClient] Uploading image file for vessel:', vessel.id);
        await api.postMultipart(`/vessels/${vessel.id}/images/upload`, formData);
      } else {
        console.log('[VesselDetailClient] Adding image URL for vessel:', vessel.id);
        await api.post(`/vessels/${vessel.id}/images`, {
          url: imgUrl.trim(),
          caption: imgCaption.trim() || undefined,
          source: imgSource.trim() || undefined,
          isPrimary: imgPrimary || undefined,
          order: imgOrder ? Number(imgOrder) : undefined,
        });
      }
      
      // Clear form on success
      setImgUrl('');
      setImgFile(null);
      setImgCaption('');
      setImgSource('');
      setImgPrimary(false);
      setImgOrder('0');
      await refreshImages();
      
      console.log('[VesselDetailClient] Image added successfully');
    } catch (error) {
      console.error('[VesselDetailClient] Failed to add image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to add image: ${errorMessage}`);
    } finally {
      setImgBusy(false);
    }
  };

  const setPrimary = async (imageId: number) => {
    setImgBusy(true);
    try {
      await api.put(`/vessels/images/${imageId}`, { isPrimary: true });
      await refreshImages();
    } finally {
      setImgBusy(false);
    }
  };

  const deleteImage = async (imageId: number) => {
    if (!confirm('Xóa ảnh này?')) return;
    setImgBusy(true);
    try {
      await api.delete(`/vessels/images/${imageId}`);
      await refreshImages();
    } finally {
      setImgBusy(false);
    }
  };

  const cancelEditing = () => {
    setEditing(false);
    setErrorMsg(null);
  };

  const saveEdits = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload: any = {
        vesselName: form.vesselName?.trim() || undefined,
        vesselType: form.vesselType?.trim() || undefined,
        operator: form.operator?.trim() || undefined,
      };
      
      // Flag: chỉ uppercase nếu là mã ISO (2-3 ký tự), giữ nguyên nếu là tên quốc gia
      const rawFlag = form.flag?.trim();
      if (rawFlag) {
        payload.flag = rawFlag.length <= 3 ? rawFlag.toUpperCase() : rawFlag;
      }
      
      const lengthVal = form.length?.trim();
      const widthVal = form.width?.trim();
      if (lengthVal) {
        const n = Number(lengthVal);
        if (!Number.isFinite(n) || n < 1) throw new Error('Chiều dài không hợp lệ');
        payload.length = n;
      }
      if (widthVal) {
        const n = Number(widthVal);
        if (!Number.isFinite(n) || n < 1) throw new Error('Chiều rộng không hợp lệ');
        payload.width = n;
      }

      const updated = await api.put(`/vessels/${vessel.id}`, payload);
      setVessel((prev) => ({ ...prev, ...updated }));
      updateVessel(updated);
      setEditing(false);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Không thể lưu thay đổi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F2F6FC' }}>
      {/* Sticky Header */}
      <div className="sticky top-16 z-40 w-full shadow-sm" style={{ backgroundColor: '#244A9A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {vessel.vesselName || vessel.mmsi}
              </h1>
              <p className="mt-1 text-sm text-white/80">
                Chi tiết thông tin tàu thuyền
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={async () => {
                  try {
                    setTrackingBusy(true);
                    if (isTracking('vessel', vessel.id)) {
                      await untrackItem('vessel', vessel.id);
                    } else {
                      await trackItem('vessel', vessel.id);
                    }
                  } finally {
                    setTrackingBusy(false);
                  }
                }}
                disabled={trackingBusy}
                className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm ${
                  isTracking('vessel', vessel.id)
                    ? 'text-white bg-red-600 hover:bg-red-700 border-transparent'
                    : 'text-white bg-green-600 hover:bg-green-700 border-transparent'
                } ${trackingBusy ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isTracking('vessel', vessel.id) ? 'Hủy theo dõi' : 'Theo dõi'}
              </button>
              <button
                onClick={() => router.push('/vessels')}
                className="inline-flex items-center px-4 py-2 border border-white/30 shadow-sm text-sm font-medium rounded-md text-white bg-white/10 hover:bg-white/20"
              >
                Quay lại
              </button>
              {editing ? (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={saveEdits}
                    disabled={saving}
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                      saving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {saving ? 'Đang lưu...' : 'Lưu'}
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 border border-white/30 shadow-sm text-sm font-medium rounded-md text-white bg-white/10 hover:bg-white/20"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  onClick={startEditing}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Chỉnh sửa
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">

          {/* First Row: 3 columns - Basic Info, Images, Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Basic Information */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Thông tin cơ bản
                  </h3>
                  {errorMsg && (
                    <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                      {errorMsg}
                    </div>
                  )}
                  {!errorMsg && saveOk && (
                    <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
                      Đã lưu thay đổi
                    </div>
                  )}

                  {editing ? (
                    <div
                      className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2"
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') cancelEditing();
                        if (e.key === 'Enter' && !saving) saveEdits();
                      }}
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700">MMSI</label>
                        <input
                          type="text"
                          value={vessel.mmsi}
                          disabled
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Tên tàu</label>
                        <input
                          type="text"
                          value={form.vesselName || ''}
                          onChange={(e) => setForm((f) => ({ ...f, vesselName: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          placeholder="Nhập tên tàu"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Loại tàu</label>
                        <input
                          type="text"
                          value={form.vesselType || ''}
                          onChange={(e) => setForm((f) => ({ ...f, vesselType: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          placeholder="Nhập loại tàu"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Quốc gia</label>
                        <input
                          type="text"
                          value={form.flag || ''}
                          onChange={(e) => setForm((f) => ({ ...f, flag: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          placeholder="VN, US hoặc tên quốc gia"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Chủ sở hữu</label>
                        <input
                          type="text"
                          value={form.operator || ''}
                          onChange={(e) => setForm((f) => ({ ...f, operator: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          placeholder="Tên chủ sở hữu/đơn vị"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Chiều dài (m)</label>
                        <input
                          type="number"
                          min={1}
                          value={form.length || ''}
                          onChange={(e) => setForm((f) => ({ ...f, length: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          placeholder="VD: 120"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Chiều rộng (m)</label>
                        <input
                          type="number"
                          min={1}
                          value={form.width || ''}
                          onChange={(e) => setForm((f) => ({ ...f, width: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          placeholder="VD: 30"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Ngày tạo</label>
                        <input
                          type="text"
                          value={new Date(vessel.createdAt).toLocaleDateString('vi-VN')}
                          disabled
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100"
                        />
                      </div>
                    </div>
                  ) : (
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-6">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          MMSI
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {vessel.mmsi}
                        </dd>
                      </div>

                      {vessel.vesselName && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Tên tàu
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {vessel.vesselName}
                          </dd>
                        </div>
                      )}

                      {vessel.vesselType && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Loại tàu
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {vessel.vesselType}
                          </dd>
                        </div>
                      )}

                      {vessel.flag && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Quốc gia</dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {vessel.flag}
                          </dd>
                        </div>
                      )}

                      {vessel.operator && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Chủ sở hữu
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {vessel.operator}
                          </dd>
                        </div>
                      )}

                      {vessel.length && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Chiều dài
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {vessel.length}m
                          </dd>
                        </div>
                      )}

                      {vessel.width && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            Chiều rộng
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {vessel.width}m
                          </dd>
                        </div>
                      )}

                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Ngày tạo
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {new Date(vessel.createdAt).toLocaleDateString(
                            'vi-VN',
                          )}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>
              </div>

              {/* Images Gallery */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Hình ảnh</h3>
                    <button
                      onClick={refreshImages}
                      disabled={imgBusy}
                      className="text-sm text-indigo-600 hover:underline disabled:opacity-50"
                    >
                      Làm mới
                    </button>
                  </div>
                  {images && images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {images.map((img) => (
                        <div key={img.id} className="group relative border rounded overflow-hidden">
                          <div className="w-full h-32 relative">
                            <Image
                              src={img.url}
                              alt={img.caption || 'image'}
                              fill
                              sizes="128px"
                              className="object-cover"
                              placeholder="empty"
                              unoptimized={false}
                            />
                          </div>
                          {img.isPrimary && (
                            <span className="absolute top-1 left-1 bg-indigo-600 text-white text-xs px-2 py-0.5 rounded">
                              Primary
                            </span>
                          )}
                          {editing && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-xs">
                              {!img.isPrimary && (
                                <button
                                  onClick={() => setPrimary(img.id)}
                                  disabled={imgBusy}
                                  className="bg-white/80 hover:bg-white text-gray-800 px-2 py-1 rounded"
                                >
                                  Primary
                                </button>
                              )}
                              <button
                                onClick={() => deleteImage(img.id)}
                                disabled={imgBusy}
                                className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                              >
                                Xóa
                              </button>
                            </div>
                          )}
                          {img.caption && (
                            <div className="p-1 text-[11px] text-gray-600 truncate">
                              {img.caption}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mb-6">
                      <div className="w-full h-40 flex items-center justify-center border-2 border-dashed rounded text-gray-400 text-sm bg-gray-50">
                        <div>
                          <div className="text-4xl text-gray-300 mb-2">🖼️</div>
                          <p>Chưa có hình ảnh</p>
                          {!editing && (
                            <p className="text-xs text-gray-400 mt-1">
                              Vào chế độ chỉnh sửa để thêm ảnh
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {editing && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium text-sm mb-2">Thêm ảnh</h4>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex flex-col gap-1">
                          <input
                            className="border rounded px-2 py-1 text-sm"
                            placeholder="Image URL (nếu không upload file)"
                            value={imgUrl}
                            onChange={(e) => setImgUrl(e.target.value)}
                            disabled={!!imgFile}
                          />
                          <input
                            type="file"
                            accept="image/*"
                            className="border rounded px-2 py-1 text-sm"
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              setImgFile(f);
                              if (f) setImgUrl('');
                            }}
                          />
                        </div>
                        <input
                          className="border rounded px-2 py-1 text-sm"
                          placeholder="Caption"
                          value={imgCaption}
                          onChange={(e) => setImgCaption(e.target.value)}
                        />
                        <input
                          className="border rounded px-2 py-1 text-sm"
                          placeholder="Source"
                          value={imgSource}
                          onChange={(e) => setImgSource(e.target.value)}
                        />
                        <input
                          className="border rounded px-2 py-1 text-sm"
                          placeholder="Order"
                          value={imgOrder}
                          onChange={(e) => setImgOrder(e.target.value)}
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={imgPrimary}
                            onChange={(e) => setImgPrimary(e.target.checked)}
                          />{' '}
                          Primary
                        </label>
                        <div className="flex justify-end">
                          <button
                            onClick={addImage}
                            disabled={imgBusy || (!imgUrl.trim() && !imgFile)}
                            className={`px-4 py-1.5 rounded text-sm text-white ${
                              imgBusy || (!imgUrl.trim() && !imgFile)
                                ? 'bg-indigo-300'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                          >
                            {imgBusy ? 'Đang thêm...' : imgFile ? 'Upload ảnh' : 'Thêm ảnh'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Panel */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Trạng thái
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">
                        Tín hiệu
                      </span>
                      {(() => {
                        const ts = vessel.lastPosition?.timestamp
                          ? new Date(vessel.lastPosition.timestamp).getTime()
                          : null;
                        const now = Date.now();
                        const hasSignal =
                          ts !== null && now - ts <= SIGNAL_STALE_MINUTES * 60 * 1000;
                        return (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              hasSignal
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {hasSignal ? 'Có tín hiệu' : 'Mất tín hiệu'}
                          </span>
                        );
                      })()}
                    </div>

                    {vessel.lastPosition && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-500">
                            Lần cập nhật cuối
                          </span>
                          <span className="text-sm text-gray-900">
                            {new Date(
                              vessel.lastPosition.timestamp,
                            ).toLocaleTimeString('vi-VN')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-500">
                            Tốc độ hiện tại
                          </span>
                          <span className="text-sm text-gray-900">
                            {vessel.lastPosition.speed || 0} knots
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-500">
                            Hướng di chuyển
                          </span>
                          <span className="text-sm text-gray-900">
                            {vessel.lastPosition.course || 0}°
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-6">
                    <button
                      className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      disabled={!vessel.lastPosition}
                      onClick={() => {
                        const p = vessel.lastPosition;
                        if (!p) return;
                        setFocusTarget({
                          type: 'vessel',
                          id: vessel.id,
                          longitude: p.longitude,
                          latitude: p.latitude,
                          zoom: 9,
                        });
                        router.push('/');
                      }}
                    >
                      📍 Xem trên bản đồ
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Second Row: Position History (2 cols) and Side Panels (1 col) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Position History - Full width below */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Lịch sử vị trí
                  </h3>

                  {vessel.lastPosition ? (
                    <div className="space-y-4">
                      <div className="border rounded-lg p-4">
                        {(() => {
                          const ts = vessel.lastPosition?.timestamp
                            ? new Date(vessel.lastPosition.timestamp).getTime()
                            : null;
                          const hasSignal = ts !== null && Date.now() - ts <= SIGNAL_STALE_MINUTES * 60 * 1000;
                          
                          return (
                            <>
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium text-gray-900">
                                    Vị trí hiện tại
                                  </h4>
                                  <p className="text-sm text-gray-500">
                                    Cập nhật:{' '}
                                    {new Date(
                                      vessel.lastPosition.timestamp,
                                    ).toLocaleString('vi-VN')}
                                  </p>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  hasSignal 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {hasSignal ? 'Có tín hiệu' : 'Mất tín hiệu'}
                                </span>
                              </div>
                            </>
                          );
                        })()}

                        <dl className="mt-4 grid grid-cols-2 gap-4">
                          <div>
                            <dt className="text-sm font-medium text-gray-500">
                              Vĩ độ
                            </dt>
                            <dd className="text-sm text-gray-900">
                              {vessel.lastPosition.latitude.toFixed(6)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">
                              Kinh độ
                            </dt>
                            <dd className="text-sm text-gray-900">
                              {vessel.lastPosition.longitude.toFixed(6)}
                            </dd>
                          </div>
                          {vessel.lastPosition.speed !== undefined && vessel.lastPosition.speed !== null && (
                            <div>
                              <dt className="text-sm font-medium text-gray-500">
                                Tốc độ
                              </dt>
                              <dd className="text-sm text-gray-900">
                                {vessel.lastPosition.speed} knots
                              </dd>
                            </div>
                          )}
                          {vessel.lastPosition.course !== undefined && vessel.lastPosition.course !== null && (
                            <div>
                              <dt className="text-sm font-medium text-gray-500">
                                Hướng di chuyển
                              </dt>
                              <dd className="text-sm text-gray-900">
                                {vessel.lastPosition.course}°
                              </dd>
                            </div>
                          )}
                          {vessel.lastPosition.heading !== undefined && vessel.lastPosition.heading !== null && (
                            <div>
                              <dt className="text-sm font-medium text-gray-500">
                                Hướng mũi tàu
                              </dt>
                              <dd className="text-sm text-gray-900">
                                {vessel.lastPosition.heading}°
                              </dd>
                            </div>
                          )}
                          {vessel.lastPosition.status && (
                            <div>
                              <dt className="text-sm font-medium text-gray-500">
                                Trạng thái
                              </dt>
                              <dd className="text-sm text-gray-900">
                                {vessel.lastPosition.status}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      {/* Route Map */}
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Lộ trình di chuyển
                        </h4>
                        <RouteMapSmall vesselId={vessel.id} height="450px" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="text-gray-400 text-4xl mb-2">📍</div>
                      <h3 className="text-sm font-medium text-gray-900">
                        Không có dữ liệu vị trí
                      </h3>
                      <p className="text-sm text-gray-500">
                        Chưa có thông tin vị trí nào được ghi nhận.
                      </p>
                    </div>
                  )}

                  {/* Paginated history table */}
                  <HistoryTable vesselId={vessel.id} />
                </div>
              </div>
            </div>

            {/* Side Panels: Weather, Edit History, Specifications */}
            <div>

              {/* Weather */}
              <div className="mt-6 bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4" style={{ color: '#204390' }}>
                    Thời tiết
                  </h3>

                  {weatherLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : weather ? (
                    <div className="space-y-3">
                      {weather.temperature !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Nhiệt độ</span>
                          <span className="text-sm text-gray-900">
                            {weather.temperature.toFixed(1)}°C / {(weather.temperature * 9/5 + 32).toFixed(2)}°F
                          </span>
                        </div>
                      )}

                      {weather.windSpeed !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Tốc độ gió</span>
                          <span className="text-sm text-gray-900">{weather.windSpeed.toFixed(0)} knots</span>
                        </div>
                      )}

                      {weather.windDirection !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Hướng gió</span>
                          <span className="text-sm text-gray-900">{weather.windDirection.toFixed(0)}° ENE</span>
                        </div>
                      )}

                      {weather.pressure !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Áp suất</span>
                          <span className="text-sm text-gray-900">{weather.pressure.toFixed(2)} hPa</span>
                        </div>
                      )}

                      {weather.humidity !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Humidity</span>
                          <span className="text-sm text-gray-900">{weather.humidity.toFixed(1)} %</span>
                        </div>
                      )}

                      {weather.cloudCoverage !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Độ che phủ mây</span>
                          <span className="text-sm text-gray-900">{weather.cloudCoverage.toFixed(0)} %</span>
                        </div>
                      )}

                      {/* Wind direction visualization */}
                      <div className="mt-4 pt-4 border-t">
                        <div className="relative w-full h-32 bg-sky-100 rounded-lg overflow-hidden">
                          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200">
                            {weather.windDirection !== undefined && (
                              <g transform={`translate(100, 150)`}>
                                <line 
                                  x1="0" 
                                  y1="0" 
                                  x2={Math.cos((weather.windDirection - 90) * Math.PI / 180) * 60}
                                  y2={Math.sin((weather.windDirection - 90) * Math.PI / 180) * 60}
                                  stroke="#1f2937" 
                                  strokeWidth="3"
                                  markerEnd="url(#arrowhead)"
                                />
                                <circle cx="0" cy="0" r="5" fill="#1f2937" />
                                <defs>
                                  <marker
                                    id="arrowhead"
                                    markerWidth="10"
                                    markerHeight="10"
                                    refX="9"
                                    refY="3"
                                    orient="auto"
                                  >
                                    <polygon points="0 0, 10 3, 0 6" fill="#1f2937" />
                                  </marker>
                                </defs>
                              </g>
                            )}
                          </svg>
                        </div>
                        <p className="text-xs text-gray-500 text-center mt-2">
                          Dữ liệu thời tiết được dựa trên mô hình GFS
                        </p>
                      </div>
                    </div>
                  ) : vessel.lastPosition ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <div className="text-4xl mb-2">🌤️</div>
                      <p>Không có dữ liệu thời tiết</p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <p>Cần vị trí để hiển thị thời tiết</p>
                    </div>
                  )}
                </div>
              </div>
              {/* Voyage Info */}
              <div className="bg-white shadow rounded-lg mt-6">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Thông tin hành trình
                  </h3>
                  {voyageStats ? (
                    <div className="space-y-3">
                      {voyageStats.timeTravelled && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Thời gian di chuyển</span>
                          <span className="text-sm text-gray-900">{voyageStats.timeTravelled}</span>
                        </div>
                      )}
                      {voyageStats.distanceTravelled !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Quãng đường</span>
                          <span className="text-sm text-gray-900">{voyageStats.distanceTravelled} hải lý</span>
                        </div>
                      )}
                      {voyageStats.avgSpeed !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Tốc độ trung bình</span>
                          <span className="text-sm text-gray-900">{voyageStats.avgSpeed?.toFixed(1)} knots</span>
                        </div>
                      )}
                      {voyageStats.maxSpeed !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Tốc độ lớn nhất</span>
                          <span className="text-sm text-gray-900">{voyageStats.maxSpeed} knots</span>
                        </div>
                      )}
                      {voyageStats.avgWind !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Gió trung bình</span>
                          <span className="text-sm text-gray-900">{voyageStats.avgWind?.toFixed(0)} knots</span>
                        </div>
                      )}
                      {voyageStats.maxWind !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Gió lớn nhất</span>
                          <span className="text-sm text-gray-900">{voyageStats.maxWind} knots</span>
                        </div>
                      )}
                      {(voyageStats.minTemp !== undefined || voyageStats.maxTemp !== undefined) && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Nhiệt độ (min/max)</span>
                          <span className="text-sm text-gray-900">
                            {voyageStats.minTemp !== undefined ? `${voyageStats.minTemp}°C` : '--'}
                            {' / '}
                            {voyageStats.maxTemp !== undefined ? `${voyageStats.maxTemp}°C` : '--'}
                          </span>
                        </div>
                      )}
                      {voyageStats.destination && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Điểm đến</span>
                          <span className="text-sm text-gray-900">{voyageStats.destination}</span>
                        </div>
                      )}
                      {voyageStats.eta && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">ETA</span>
                          <span className="text-sm text-gray-900">{voyageStats.eta}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500 text-sm">
                      <div className="text-4xl mb-2">🧭</div>
                      <p>Chưa có dữ liệu hành trình đủ để tính toán</p>
                    </div>
                  )}
                </div>
              </div>
              {/* Edit History */}
              <div className="bg-white shadow rounded-lg mt-6">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Lịch sử chỉnh sửa
                  </h3>
                  <EditHistoryTable vesselId={vessel.id} />
                </div>
              </div>
              {/* Vessel Specifications */}
              {(vessel.length || vessel.width) && (
                <div className="mt-6 bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Thông số kỹ thuật
                    </h3>

                    <div className="space-y-3">
                      {vessel.length && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-500">
                            Chiều dài
                          </span>
                          <span className="text-sm text-gray-900">
                            {vessel.length} m
                          </span>
                        </div>
                      )}

                      {vessel.width && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-500">
                            Chiều rộng
                          </span>
                          <span className="text-sm text-gray-900">
                            {vessel.width} m
                          </span>
                        </div>
                      )}

                      {vessel.length && vessel.width && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-500">
                            Diện tích sàn
                          </span>
                          <span className="text-sm text-gray-900">
                            {(vessel.length * vessel.width).toFixed(1)} m²
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
