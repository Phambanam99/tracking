'use client';

import { useEffect, useState, useRef } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuthStore } from '@/stores/authStore';
import Header from '@/components/Header';
import api from '@/services/apiClient';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import ColorPicker from '@/components/ColorPicker';

interface FormState {
  clusterEnabled: boolean;
  minZoom: number;
  maxZoom: number;
  signalStaleMinutes: number;
  vesselFlagColors: string;
  aircraftOperatorColors: string;
  mapProvider: 'osm' | 'maptiler';
  maptilerApiKey: string;
  maptilerStyle: string;
  customMapSources: Array<{
    id: string;
    name: string;
    urlTemplate: string;
    attribution?: string;
    maxZoom?: number;
  }>;
}

export default function AdminSettingsPage() {
  const { setSettings } = useSystemSettingsStore();
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerFor, setColorPickerFor] = useState<'vessel' | 'aircraft'>('vessel');
  const vesselTextareaRef = useRef<HTMLTextAreaElement>(null);
  const aircraftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [form, setForm] = useState<FormState>({
    clusterEnabled: false,
    minZoom: 4,
    maxZoom: 16,
    signalStaleMinutes: 10,
    vesselFlagColors: '{}',
    aircraftOperatorColors: '{}',
    mapProvider: 'osm',
    maptilerApiKey: '',
    maptilerStyle: 'streets',
    customMapSources: [],
  });

  const vesselExample = `{
  "VN": "#06b6d4",
  "US": "#2563eb",
  "CN": "#ef4444",
  "JP": "#f59e0b",
  "KR": "#10b981"
}`;

  const aircraftExample = `{
  "VIETNAM AIRLINES": "#2563eb",
  "VIETJET AIR": "#ef4444",
  "BAMBOO AIRWAYS": "#10b981",
  "EMIRATES": "#b91c1c",
  "SINGAPORE AIRLINES": "#f59e0b"
}`;

  useEffect(() => {
    // Only fetch after auth is ready and user is ADMIN
    if (isLoading || !isAuthenticated || user?.role !== 'ADMIN') {
      return;
    }

    (async () => {
      console.log('[Settings] Loading settings...');

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Settings fetch timeout')), 5000);
      });

      try {
        const settingsPromise = api.get('/admin/settings');
        const s = await Promise.race([settingsPromise, timeoutPromise]) as any;

        console.log('[Settings] ✓ Settings loaded:', s);
        setSettings(s);
        setForm({
          clusterEnabled: !!s.clusterEnabled,
          minZoom: s.minZoom ?? 4,
          maxZoom: s.maxZoom ?? 16,
          signalStaleMinutes: s.signalStaleMinutes ?? 10,
          vesselFlagColors: JSON.stringify(s.vesselFlagColors || {}, null, 2),
          aircraftOperatorColors: JSON.stringify(s.aircraftOperatorColors || {}, null, 2),
          mapProvider: (s.mapProvider as 'osm' | 'maptiler') || 'osm',
          maptilerApiKey: s.maptilerApiKey || '',
          maptilerStyle: s.maptilerStyle || 'streets',
          customMapSources: Array.isArray(s.customMapSources) ? s.customMapSources : [],
        });
      } catch (e) {
        console.error('[Settings] Failed to load settings:', e);
        alert('Không thể tải cài đặt hệ thống. Bạn có thể không có quyền truy cập trang này (cần role ADMIN).');
      } finally {
        setLoading(false);
        console.log('[Settings] Loading complete');
      }
    })();
  }, [isLoading, isAuthenticated, user?.role, setSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        clusterEnabled: form.clusterEnabled,
        minZoom: Number(form.minZoom) || 4,
        maxZoom: Number(form.maxZoom) || 16,
        signalStaleMinutes: Number(form.signalStaleMinutes) || 10,
        vesselFlagColors: JSON.parse(form.vesselFlagColors || '{}'),
        aircraftOperatorColors: JSON.parse(form.aircraftOperatorColors || '{}'),
        mapProvider: form.mapProvider,
        maptilerApiKey: form.maptilerApiKey?.trim() || undefined,
        maptilerStyle: form.maptilerStyle || 'streets',
        customMapSources: form.customMapSources,
      };
      const updated = await api.put('/admin/settings', payload);
      setSettings(updated);
      alert('Đã lưu cài đặt hệ thống');
    } catch (e) {
      alert('Lưu cài đặt thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleColorSelect = (color: string) => {
    const textarea = colorPickerFor === 'vessel' ? vesselTextareaRef.current : aircraftTextareaRef.current;
    const fieldName = colorPickerFor === 'vessel' ? 'vesselFlagColors' : 'aircraftOperatorColors';
    
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = form[fieldName];
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + `"${color}"` + after;
      
      setForm((f) => ({ ...f, [fieldName]: newText }));
      
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + color.length + 2;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
    
    setShowColorPicker(false);
  };

  const openColorPicker = (type: 'vessel' | 'aircraft') => {
    setColorPickerFor(type);
    setShowColorPicker(true);
  };

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold mb-4">Cài đặt hệ thống</h1>
          {loading ? (
            <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center justify-center min-h-[300px]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Đang tải cài đặt...</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              {/* Map provider selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-sm text-gray-600">Nhà cung cấp bản đồ</label>
                  <select
                    className="mt-1 w-full border rounded px-2 py-1"
                    value={form.mapProvider}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, mapProvider: e.target.value as 'osm' | 'maptiler' }))
                    }
                  >
                    <option value="osm">OpenStreetMap (miễn phí)</option>
                    <option value="maptiler">MapTiler</option>
                  </select>
                </div>
                {form.mapProvider === 'maptiler' && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-600">MapTiler API key</label>
                      <input
                        type="text"
                        className="mt-1 w-full border rounded px-2 py-1"
                        value={form.maptilerApiKey}
                        onChange={(e) => setForm((f) => ({ ...f, maptilerApiKey: e.target.value }))}
                        placeholder="pk.****************"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600">Kiểu map</label>
                      <select
                        className="mt-1 w-full border rounded px-2 py-1"
                        value={form.maptilerStyle}
                        onChange={(e) => setForm((f) => ({ ...f, maptilerStyle: e.target.value }))}
                      >
                        <option value="streets">Streets</option>
                        <option value="outdoor">Outdoor</option>
                        <option value="satellite">Satellite</option>
                        <option value="topo">Topographic</option>
                        <option value="terrain">Terrain</option>
                        <option value="bright">Bright</option>
                        <option value="basic">Basic</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between">
                <label className="font-medium">Bật clustering</label>
                <input
                  type="checkbox"
                  checked={form.clusterEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, clusterEnabled: e.target.checked }))}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600">Min zoom</label>
                  <input
                    type="number"
                    className="mt-1 w-full border rounded px-2 py-1"
                    value={form.minZoom}
                    onChange={(e) => setForm((f) => ({ ...f, minZoom: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Max zoom</label>
                  <input
                    type="number"
                    className="mt-1 w-full border rounded px-2 py-1"
                    value={form.maxZoom}
                    onChange={(e) => setForm((f) => ({ ...f, maxZoom: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Phút coi là mất tín hiệu</label>
                  <input
                    type="number"
                    className="mt-1 w-full border rounded px-2 py-1"
                    value={form.signalStaleMinutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, signalStaleMinutes: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm text-gray-600">Màu tàu theo quốc gia (JSON)</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={() => openColorPicker('vessel')}
                    >
                      🎨 Chọn màu
                    </button>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-800"
                      onClick={() => setForm((f) => ({ ...f, vesselFlagColors: vesselExample }))}
                    >
                      Dán ví dụ
                    </button>
                  </div>
                </div>
                <textarea
                  ref={vesselTextareaRef}
                  className="mt-1 w-full border rounded px-2 py-1 font-mono text-sm h-40"
                  value={form.vesselFlagColors}
                  onChange={(e) => setForm((f) => ({ ...f, vesselFlagColors: e.target.value }))}
                />
                <p className="mt-1 text-xs text-gray-500">Ví dụ key là mã quốc gia (ISO-2) viết hoa: {`{"VN":"#06b6d4"}`}</p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm text-gray-600">Màu máy bay theo hãng (JSON)</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={() => openColorPicker('aircraft')}
                    >
                      🎨 Chọn màu
                    </button>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-800"
                      onClick={() => setForm((f) => ({ ...f, aircraftOperatorColors: aircraftExample }))}
                    >
                      Dán ví dụ
                    </button>
                  </div>
                </div>
                <textarea
                  ref={aircraftTextareaRef}
                  className="mt-1 w-full border rounded px-2 py-1 font-mono text-sm h-40"
                  value={form.aircraftOperatorColors}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, aircraftOperatorColors: e.target.value }))
                  }
                />
                <p className="mt-1 text-xs text-gray-500">Ví dụ key là tên hãng viết hoa: {`{"VIETNAM AIRLINES":"#2563eb"}`}</p>
              </div>

            {/* Custom Map Sources */}
            <div className="mt-4">
              <h2 className="text-lg font-semibold mb-2">Custom Map Sources</h2>
              <p className="text-sm text-gray-600 mb-2">Thêm nguồn nền bản đồ dạng XYZ để người dùng có thể chọn trong Layers panel.</p>
              <div className="space-y-3">
                {form.customMapSources.map((src, idx) => (
                  <div key={src.id || idx} className="border rounded-lg p-3 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm text-gray-600">ID</label>
                        <input
                          type="text"
                          className="mt-1 w-full border rounded px-2 py-1"
                          value={src.id}
                          onChange={(e) => {
                            const v = e.target.value;
                            setForm((f) => {
                              const arr = [...f.customMapSources];
                              arr[idx] = { ...arr[idx], id: v };
                              return { ...f, customMapSources: arr };
                            });
                          }}
                          placeholder="vd: esri-world"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600">Tên hiển thị</label>
                        <input
                          type="text"
                          className="mt-1 w-full border rounded px-2 py-1"
                          value={src.name}
                          onChange={(e) => {
                            const v = e.target.value;
                            setForm((f) => {
                              const arr = [...f.customMapSources];
                              arr[idx] = { ...arr[idx], name: v };
                              return { ...f, customMapSources: arr };
                            });
                          }}
                          placeholder="vd: Esri World"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600">Max Zoom</label>
                        <input
                          type="number"
                          className="mt-1 w-full border rounded px-2 py-1"
                          value={src.maxZoom ?? ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? undefined : Number(e.target.value);
                            setForm((f) => {
                              const arr = [...f.customMapSources];
                              arr[idx] = { ...arr[idx], maxZoom: v };
                              return { ...f, customMapSources: arr };
                            });
                          }}
                          placeholder="vd: 18"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600">URL Template</label>
                      <input
                        type="text"
                        className="mt-1 w-full border rounded px-2 py-1 font-mono"
                        value={src.urlTemplate}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => {
                            const arr = [...f.customMapSources];
                            arr[idx] = { ...arr[idx], urlTemplate: v };
                            return { ...f, customMapSources: arr };
                          });
                        }}
                        placeholder="https://{s}.example.com/tiles/{z}/{x}/{y}.png"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600">Attribution</label>
                      <input
                        type="text"
                        className="mt-1 w-full border rounded px-2 py-1"
                        value={src.attribution || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => {
                            const arr = [...f.customMapSources];
                            arr[idx] = { ...arr[idx], attribution: v };
                            return { ...f, customMapSources: arr };
                          });
                        }}
                        placeholder="Map data © ..."
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:text-red-800"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            customMapSources: f.customMapSources.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        Xóa nguồn
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 text-sm"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      customMapSources: [
                        ...f.customMapSources,
                        { id: '', name: '', urlTemplate: '', attribution: '', maxZoom: undefined },
                      ],
                    }))
                  }
                >
                  Thêm nguồn
                </button>
              </div>
            </div>

              <div className="pt-2">
                <button
                  disabled={saving}
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
                </button>
              </div>
            </div>
          )}

          {/* Color Picker Modal */}
          {showColorPicker && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              onClick={() => setShowColorPicker(false)}
            >
              <div onClick={(e) => e.stopPropagation()}>
                <ColorPicker onColorSelect={handleColorSelect} />
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
