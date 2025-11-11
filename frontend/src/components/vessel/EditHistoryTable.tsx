'use client';

import { useEffect, useState } from 'react';
import api from '@/services/apiClient';

interface EditHistory {
  id: number;
  vesselId: number;
  userId: number;
  userName: string;
  changes: Record<string, any>;
  editedAt: Date;
}

interface EditHistoryTableProps {
  vesselId: number;
}

export default function EditHistoryTable({ vesselId }: EditHistoryTableProps) {
  const [history, setHistory] = useState<EditHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const offset = (page - 1) * pageSize;
        const data = await api.get(
          `/vessels/${vesselId}/edit-history?limit=${pageSize}&offset=${offset}`,
        );
        setHistory(data.data || []);
        setTotal(data.total || 0);
      } catch (err) {
        console.error('Failed to load edit history:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [vesselId, page]);

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-500">Không có lịch sử chỉnh sửa</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Người chỉnh sửa
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Thay đổi
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Thời gian
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {history.map((record) => (
              <tr key={record.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {record.userName}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  <div className="space-y-1">
                    {Object.entries(record.changes).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="font-medium">{formatFieldName(key)}:</span>
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                          {typeof value === 'object'
                            ? JSON.stringify(value)
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(record.editedAt).toLocaleString('vi-VN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between bg-gray-50 px-6 py-3 rounded-lg">
          <div className="text-sm text-gray-700">
            Trang <span className="font-medium">{page}</span> / 
            <span className="font-medium"> {Math.ceil(total / pageSize)}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
            >
              Trước
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / pageSize)}
              className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatFieldName(field: string): string {
  const mapping: Record<string, string> = {
    callSign: 'Call Sign',
    registration: 'Số đăng ký',
    aircraftType: 'Loại máy bay',
    operator: 'Hãng vận hành',
    vesselName: 'Tên tàu',
    vesselType: 'Loại tàu',
    flag: 'Quốc kỳ',
    length: 'Chiều dài',
    width: 'Chiều rộng',
  };
  return mapping[field] || field;
}

