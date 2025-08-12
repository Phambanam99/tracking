'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Header from '@/components/Header';
import api from '@/services/apiClient';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';

interface FormState {
  clusterEnabled: boolean;
  minZoom: number;
  maxZoom: number;
  signalStaleMinutes: number;
  vesselFlagColors: string;
  aircraftOperatorColors: string;
}

export default function AdminSettingsPage() {
  const { settings, setSettings } = useSystemSettingsStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    clusterEnabled: true,
    minZoom: 4,
    maxZoom: 16,
    signalStaleMinutes: 10,
    vesselFlagColors: '{}',
    aircraftOperatorColors: '{}',
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
    (async () => {
      try {
        const s = await api.get('/admin/settings');
        setSettings(s);
        setForm({
          clusterEnabled: !!s.clusterEnabled,
          minZoom: s.minZoom ?? 4,
          maxZoom: s.maxZoom ?? 16,
          signalStaleMinutes: s.signalStaleMinutes ?? 10,
          vesselFlagColors: JSON.stringify(s.vesselFlagColors || {}, null, 2),
          aircraftOperatorColors: JSON.stringify(s.aircraftOperatorColors || {}, null, 2),
        });
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [setSettings]);

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

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold mb-4">Cài đặt hệ thống</h1>
          {loading ? (
            <div>Đang tải...</div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
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
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-800"
                    onClick={() => setForm((f) => ({ ...f, vesselFlagColors: vesselExample }))}
                  >
                    Dán ví dụ
                  </button>
                </div>
                <textarea
                  className="mt-1 w-full border rounded px-2 py-1 font-mono text-sm h-40"
                  value={form.vesselFlagColors}
                  onChange={(e) => setForm((f) => ({ ...f, vesselFlagColors: e.target.value }))}
                />
                <p className="mt-1 text-xs text-gray-500">Ví dụ key là mã quốc gia (ISO-2) viết hoa: {`{"VN":"#06b6d4"}`}</p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm text-gray-600">Màu máy bay theo hãng (JSON)</label>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-800"
                    onClick={() => setForm((f) => ({ ...f, aircraftOperatorColors: aircraftExample }))}
                  >
                    Dán ví dụ
                  </button>
                </div>
                <textarea
                  className="mt-1 w-full border rounded px-2 py-1 font-mono text-sm h-40"
                  value={form.aircraftOperatorColors}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, aircraftOperatorColors: e.target.value }))
                  }
                />
                <p className="mt-1 text-xs text-gray-500">Ví dụ key là tên hãng viết hoa: {`{"VIETNAM AIRLINES":"#2563eb"}`}</p>
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
        </main>
      </div>
    </ProtectedRoute>
  );
}


