'use client';
import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import api from '@/services/apiClient';

interface Vessel {
  id: number;
  mmsi: string;
  vesselName?: string;
  vesselType?: string;
  flag?: string;
  operator?: string;
  updatedAt: string;
}

export default function VesselsManagement() {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: '',
    hasSignal: '' as '' | 'true' | 'false',
    page: 1,
    pageSize: 50,
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    loadVessels();
  }, [filters]);

  const loadVessels = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== '' && val !== undefined) params.append(key, String(val));
      });
      const data = await api.get(`/vessels?${params}`);
      setVessels(data.data || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load vessels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === vessels.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(vessels.map((v) => v.id));
    }
  };

  const handleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDelete = async (id: number, mmsi: string) => {
    if (!confirm(`Delete vessel "${mmsi}"?`)) return;

    try {
      await api.delete(`/vessels/${id}`);
      loadVessels();
    } catch (error) {
      alert('Failed to delete vessel');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} selected vessels?`)) return;

    try {
      for (const id of selectedIds) {
        await api.delete(`/vessels/${id}`);
      }
      setSelectedIds([]);
      loadVessels();
    } catch (error) {
      alert('Failed to delete vessels');
    }
  };

  const totalPages = Math.ceil(total / filters.pageSize);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Vessel Management</h1>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Search MMSI, name..."
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value, page: 1 })}
              className="border rounded px-3 py-2"
            />
            <select
              value={filters.hasSignal}
              onChange={(e) =>
                setFilters({ ...filters, hasSignal: e.target.value as any, page: 1 })
              }
              className="border rounded px-3 py-2"
            >
              <option value="">All Vessels</option>
              <option value="true">With Signal</option>
              <option value="false">No Signal</option>
            </select>
            <select
              value={filters.pageSize}
              onChange={(e) =>
                setFilters({ ...filters, pageSize: Number(e.target.value), page: 1 })
              }
              className="border rounded px-3 py-2"
            >
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
              <option value="200">200 per page</option>
            </select>
            <div className="text-sm text-gray-600 flex items-center">
              Total: {total.toLocaleString()} vessels
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-blue-800">{selectedIds.length} vessels selected</span>
            <div className="space-x-2">
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">Loading...</div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === vessels.length && vessels.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      MMSI
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vessel Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Flag
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Update
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vessels.map((vessel) => (
                    <tr
                      key={vessel.id}
                      className={selectedIds.includes(vessel.id) ? 'bg-blue-50' : ''}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(vessel.id)}
                          onChange={() => handleSelect(vessel.id)}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{vessel.id}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {vessel.mmsi}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {vessel.vesselName || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {vessel.vesselType || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{vessel.flag || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(vessel.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <a
                          href={`/vessel/${vessel.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </a>
                        <button
                          onClick={() => handleDelete(vessel.id, vessel.mmsi)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {vessels.length === 0 && (
                <div className="text-center py-8 text-gray-500">No vessels found</div>
              )}

              {/* Pagination */}
              <div className="bg-gray-50 px-6 py-3 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">{(filters.page - 1) * filters.pageSize + 1}</span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(filters.page * filters.pageSize, total)}
                  </span>{' '}
                  of <span className="font-medium">{total}</span> results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                    disabled={filters.page === 1}
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      Page {filters.page} of {totalPages}
                    </span>
                  </div>
                  <button
                    onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                    disabled={filters.page >= totalPages}
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

