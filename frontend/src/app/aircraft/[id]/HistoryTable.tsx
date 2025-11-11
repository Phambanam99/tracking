'use client';

import { useEffect, useState } from 'react';
import api from '@/services/apiClient';

interface PositionRow {
  id: number;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp: string;
}

export default function HistoryTable({ aircraftId }: { aircraftId: number }) {
  const [rows, setRows] = useState<PositionRow[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  // Remove time filter; rely on backend defaults

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append('page', String(page + 1));
        params.append('pageSize', String(pageSize));
        const data = await api.get(
          `/aircrafts/${aircraftId}/history?${params.toString()}`,
        );
        const positions = Array.isArray(data.positions) ? data.positions : [];
        setRows(positions);
        setTotal(typeof data.total === 'number' ? data.total : positions.length);
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [aircraftId, page, pageSize]);

  return (
    <div className="mt-4">
      {/* Time filter removed; paging will fetch from backend defaults */}
      <div className="overflow-auto border rounded">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Thời gian
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Vĩ độ
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Kinh độ
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Độ cao
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Tốc độ
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Hướng
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 text-sm">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(r.timestamp).toLocaleString('vi-VN')}
                </td>
                <td className="px-3 py-2">{r.latitude.toFixed(6)}</td>
                <td className="px-3 py-2">{r.longitude.toFixed(6)}</td>
                <td className="px-3 py-2">{r.altitude ?? ''}</td>
                <td className="px-3 py-2">{r.speed ?? ''}</td>
                <td className="px-3 py-2">{r.heading ?? ''}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={6}>
                  Không có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="text-sm text-gray-600">
          Trang {page + 1}
          {total != null ? ` / ${Math.max(1, Math.ceil(total / pageSize))}` : ''}
        </div>
        <div className="space-x-2">
          <button
            disabled={page === 0 || loading}
            onClick={() => setPage(Math.max(0, page - 1))}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Trước
          </button>
          <button
            disabled={loading || (total != null ? (page + 1) * pageSize >= total : rows.length < pageSize)}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Sau
          </button>
          <select
            value={pageSize}
            onChange={(e) => {
              setPage(0);
              setPageSize(Number(e.target.value));
            }}
            className="ml-2 border rounded px-2 py-1 text-sm"
          >
            {[25, 50, 100, 200].map((s) => (
              <option key={s} value={s}>
                {s}/trang
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
