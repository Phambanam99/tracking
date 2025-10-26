'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useVesselStore } from '@/stores/vesselStore';
import { useMapStore } from '@/stores/mapStore';
import { useTrackingStore } from '@/stores/trackingStore';
import api from '@/services/apiClient';
import HistoryTable from './HistoryTable';

interface Vessel {
  id: number;
  mmsi: string;
  vesselName?: string;
  vesselType?: string;
  flag?: string;
  operator?: string;
  length?: number;
  width?: number;
  createdAt: Date;
  updatedAt: Date;
  lastPosition?: {
    id?: number;
    latitude: number;
    longitude: number;
    speed?: number;
    course?: number;
    heading?: number;
    status?: string;
    timestamp: Date;
  };
  images?: Array<{
    id: number;
    url: string;
    caption?: string | null;
    source?: string | null;
    isPrimary: boolean;
    order: number;
  }>;
}

export default function VesselDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { vessels, fetchVessels, updateVessel } = useVesselStore();
  const { setFocusTarget } = useMapStore();
  const { isTracking, trackItem, untrackItem, fetchTrackedItems } = useTrackingStore();
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [images, setImages] = useState<Vessel['images']>([]);
  const [imgUrl, setImgUrl] = useState('');
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgCaption, setImgCaption] = useState('');
  const [imgSource, setImgSource] = useState('');
  const [imgPrimary, setImgPrimary] = useState(false);
  const [imgOrder, setImgOrder] = useState('0');
  const [imgBusy, setImgBusy] = useState(false);

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

  useEffect(() => {
    const loadVessel = async () => {
      if (vessels.length === 0) {
        await fetchVessels();
      }

      const vesselId = parseInt(params.id as string);
      const foundVessel = vessels.find((v) => v.id === vesselId);

      if (foundVessel) {
        setVessel(foundVessel);
        setImages(foundVessel.images || []);
      } else {
        // Fallback: fetch detail by ID from backend
        try {
          const detail = await api.get(`/vessels/${vesselId}`);
          if (detail && !detail.error) {
            setVessel(detail);
            setImages(detail.images || []);
          }
        } catch {
          // ignore
        }
      }
      setLoading(false);
    };

    loadVessel();
  }, [params.id, vessels, fetchVessels]);

  useEffect(() => {
    fetchTrackedItems().catch(() => undefined);
  }, [fetchTrackedItems]);

  const startEditing = () => {
    if (!vessel) return;
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
    if (!vessel) return;
    try {
      const data = await api.get(`/vessels/${vessel.id}/images`);
      setImages(data);
    } catch (e) {
      console.warn('Failed to load images', e);
    }
  };

  const addImage = async () => {
    if (!vessel) return;
    if (!imgFile && !imgUrl.trim()) return; // require either file or manual URL
    setImgBusy(true);
    try {
      if (imgFile) {
        const formData = new FormData();
        formData.append('file', imgFile);
        if (imgCaption.trim()) formData.append('caption', imgCaption.trim());
        if (imgSource.trim()) formData.append('source', imgSource.trim());
        if (imgPrimary) formData.append('isPrimary', 'true');
        if (imgOrder) formData.append('order', imgOrder);
        await api.postMultipart(`/vessels/${vessel.id}/images/upload`, formData);
      } else {
        await api.post(`/vessels/${vessel.id}/images`, {
          url: imgUrl.trim(),
          caption: imgCaption.trim() || undefined,
          source: imgSource.trim() || undefined,
          isPrimary: imgPrimary || undefined,
          order: imgOrder ? Number(imgOrder) : undefined,
        });
      }
      setImgUrl('');
      setImgFile(null);
      setImgCaption('');
      setImgSource('');
      setImgPrimary(false);
      setImgOrder('0');
      await refreshImages();
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
    if (!vessel) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload: any = {
        vesselName: form.vesselName?.trim() || undefined,
        vesselType: form.vesselType?.trim() || undefined,
        flag: form.flag?.trim() ? form.flag.trim().toUpperCase() : undefined,
        operator: form.operator?.trim() || undefined,
      };
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
      // Update local state and global store
      setVessel((prev) => (prev ? { ...prev, ...updated } : updated));
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

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!vessel) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Không tìm thấy tàu thuyền
              </h2>
              <p className="mt-2 text-gray-600">
                Tàu thuyền với ID này không tồn tại.
              </p>
              <button
                onClick={() => router.push('/vessels')}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Quay lại danh sách
              </button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Header />

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {/* Header */}
            <div className="mb-8 flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {vessel.vesselName || vessel.mmsi}
                </h1>
                <p className="mt-2 text-gray-600">
                  Chi tiết thông tin tàu thuyền
                </p>
              </div>
              <div className="flex space-x-3">
                {vessel && (
                  <button
                    onClick={async () => {
                      if (!vessel) return;
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
                )}
                <button
                  onClick={() => router.push('/vessels')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
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
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Info */}
              <div className="lg:col-span-2">
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
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
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

                {/* Position History */}
                <div className="mt-6 bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Lịch sử vị trí
                    </h3>

                    {vessel.lastPosition ? (
                      <div className="space-y-4">
                        <div className="border rounded-lg p-4">
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
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Có tín hiệu
                            </span>
                          </div>

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
                            {vessel.lastPosition.speed && (
                              <div>
                                <dt className="text-sm font-medium text-gray-500">
                                  Tốc độ
                                </dt>
                                <dd className="text-sm text-gray-900">
                                  {vessel.lastPosition.speed} knots
                                </dd>
                              </div>
                            )}
                            {vessel.lastPosition.course && (
                              <div>
                                <dt className="text-sm font-medium text-gray-500">
                                  Hướng di chuyển
                                </dt>
                                <dd className="text-sm text-gray-900">
                                  {vessel.lastPosition.course}°
                                </dd>
                              </div>
                            )}
                            {vessel.lastPosition.heading && (
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
                {/* Images Gallery */}
                <div className="bg-white shadow rounded-lg mt-6">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900">Hình ảnh</h3>
                      <button
                        onClick={refreshImages}
                        disabled={imgBusy}
                        className="text-sm text-indigo-600 hover:underline disabled:opacity-50"
                      >Làm mới</button>
                    </div>
                    {images && images.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                        {images.map(img => (
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
                              <span className="absolute top-1 left-1 bg-indigo-600 text-white text-xs px-2 py-0.5 rounded">Primary</span>
                            )}
                            {editing && (
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-xs">
                                {!img.isPrimary && (
                                  <button onClick={() => setPrimary(img.id)} disabled={imgBusy} className="bg-white/80 hover:bg-white text-gray-800 px-2 py-1 rounded">Primary</button>
                                )}
                                <button onClick={() => deleteImage(img.id)} disabled={imgBusy} className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700">Xóa</button>
                              </div>
                            )}
                            {img.caption && <div className="p-1 text-[11px] text-gray-600 truncate">{img.caption}</div>}
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
                              <p className="text-xs text-gray-400 mt-1">Vào chế độ chỉnh sửa để thêm ảnh</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {editing && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium text-sm mb-2">Thêm ảnh</h4>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                          <div className="md:col-span-2 flex flex-col gap-1">
                            <input
                              className="border rounded px-2 py-1 text-sm"
                              placeholder="Image URL (nếu không upload file)"
                              value={imgUrl}
                              onChange={e => setImgUrl(e.target.value)}
                              disabled={!!imgFile}
                            />
                            <input
                              type="file"
                              accept="image/*"
                              className="border rounded px-2 py-1 text-sm"
                              onChange={e => {
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
                            onChange={e => setImgCaption(e.target.value)}
                          />
                          <input
                            className="border rounded px-2 py-1 text-sm"
                            placeholder="Source"
                            value={imgSource}
                            onChange={e => setImgSource(e.target.value)}
                          />
                          <input
                            className="border rounded px-2 py-1 text-sm"
                            placeholder="Order"
                            value={imgOrder}
                            onChange={e => setImgOrder(e.target.value)}
                          />
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={imgPrimary} onChange={e => setImgPrimary(e.target.checked)} /> Primary
                          </label>
                          <div className="md:col-span-5 flex justify-end">
                            <button
                              onClick={addImage}
                              disabled={imgBusy || (!imgUrl.trim() && !imgFile)}
                              className={`px-4 py-1.5 rounded text-sm text-white ${imgBusy || (!imgUrl.trim() && !imgFile) ? 'bg-indigo-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            >{imgBusy ? 'Đang thêm...' : imgFile ? 'Upload ảnh' : 'Thêm ảnh'}</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Panel */}
              <div>
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
                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => {
                      if (vessel) {
                        const lon = vessel.lastPosition?.longitude;
                        const lat = vessel.lastPosition?.latitude;
                        setFocusTarget({
                          type: 'vessel',
                          id: vessel.id,
                          longitude: lon,
                          latitude: lat,
                          zoom: 9,
                        });
                        router.push('/');
                      }
                        }}
                      >
                        📍 Xem trên bản đồ
                      </button>
                    </div>
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
    </ProtectedRoute>
  );
}
