'use client';
import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import api from '@/services/apiClient';

interface Aircraft {
  id: number;
  flightId: string;
  callSign?: string;
  registration?: string;
  aircraftType?: string;
  operator?: string;
  updatedAt: string;
}

export default function AircraftManagement() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
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
    loadAircraft();
  }, [filters]);

  const loadAircraft = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== '' && val !== undefined) params.append(key, String(val));
      });
      const data = await api.get(`/aircrafts?${params}`);
      setAircraft(data.data || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load aircraft:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === aircraft.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(aircraft.map((a) => a.id));
    }
  };

  const handleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDelete = async (id: number, flightId: string) => {
    if (!confirm(`Delete aircraft "${flightId}"?`)) return;

    try {
      await api.delete(`/aircrafts/${id}`);
      loadAircraft();
    } catch (error) {
      alert('Failed to delete aircraft');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} selected aircraft?`)) return;

    try {
      // Since we don't have bulk delete endpoint exposed yet, delete one by one
      for (const id of selectedIds) {
        await api.delete(`/aircrafts/${id}`);
      }
      setSelectedIds([]);
      loadAircraft();
    } catch (error) {
      alert('Failed to delete aircraft');
    }
  };

  const totalPages = Math.ceil(total / filters.pageSize);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Aircraft Management</h1>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Search flight ID, call sign..."
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
              <option value="">All Aircraft</option>
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
              Total: {total.toLocaleString()} aircraft
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-blue-800">{selectedIds.length} aircraft selected</span>
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
                        checked={selectedIds.length === aircraft.length && aircraft.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Flight ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Call Sign
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Operator
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
                  {aircraft.map((ac) => (
                    <tr
                      key={ac.id}
                      className={selectedIds.includes(ac.id) ? 'bg-blue-50' : ''}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(ac.id)}
                          onChange={() => handleSelect(ac.id)}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{ac.id}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {ac.flightId}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{ac.callSign || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{ac.aircraftType || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{ac.operator || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(ac.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <a
                          href={`/aircraft/${ac.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </a>
                        <button
                          onClick={() => handleDelete(ac.id, ac.flightId)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {aircraft.length === 0 && (
                <div className="text-center py-8 text-gray-500">No aircraft found</div>
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

