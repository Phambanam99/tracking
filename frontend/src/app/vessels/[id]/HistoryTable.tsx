'use client';

import { useEffect, useState } from 'react';
import api from '@/services/apiClient';

interface PositionRow {
  id: number;
  latitude: number;
  longitude: number;
  speed?: number | null;
  course?: number | null;
  heading?: number | null;
  status?: string | null;
  timestamp: string;
}

export default function HistoryTable({ vesselId }: { vesselId: number }) {
  const [rows, setRows] = useState<PositionRow[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState<string>(() =>
    new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  );
  const [to, setTo] = useState<string>(() => new Date().toISOString());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        params.append('limit', String(pageSize));
        params.append('offset', String(page * pageSize));
        const data = await api.get(
          `/vessels/${vesselId}/history?${params.toString()}`,
        );
        const positions = Array.isArray(data.positions) ? data.positions : [];
        setRows(positions);
        // Backend chưa trả total, tạm thời tính tổng xấp xỉ theo số trang đã xem
        setTotal(
          total == null
            ? positions.length
            : Math.max(total, (page + 1) * pageSize),
        );
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [vesselId, page, pageSize, from, to]);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <label className="text-sm text-gray-600">Từ:</label>
        <input
          type="datetime-local"
          className="border rounded px-2 py-1 text-sm"
          value={from.slice(0, 16)}
          onChange={(e) => setFrom(new Date(e.target.value).toISOString())}
        />
        <label className="text-sm text-gray-600">Đến:</label>
        <input
          type="datetime-local"
          className="border rounded px-2 py-1 text-sm"
          value={to.slice(0, 16)}
          onChange={(e) => setTo(new Date(e.target.value).toISOString())}
        />
      </div>
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
                Tốc độ
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Hướng
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Trạng thái
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
                <td className="px-3 py-2">{r.speed ?? ''}</td>
                <td className="px-3 py-2">{r.course ?? ''}</td>
                <td className="px-3 py-2">{r.status ?? ''}</td>
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
          {total != null ? '' : ''}
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
            disabled={rows.length < pageSize || loading}
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
