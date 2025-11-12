export default function Loading() {
  return (
    <div className="min-h-screen">
      {/* Title Section Skeleton */}
      <div className="w-full py-6" style={{ backgroundColor: '#244A9A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-9 w-56 bg-white/20 rounded animate-pulse" />
          <div className="mt-2 h-5 w-96 bg-white/20 rounded animate-pulse" />
        </div>
      </div>

      {/* Search Section Skeleton */}
      <div className="sticky top-16 z-40 w-full shadow-sm" style={{ backgroundColor: '#244A9A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="card">
            <div className="card-body">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="w-48 h-10 bg-gray-200 rounded animate-pulse" />
                <div className="w-40 h-10 bg-gray-200 rounded animate-pulse" />
                <div className="w-32 h-10 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="card overflow-hidden sm:rounded-md">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-2/5">
                    Tên tàu / MMSI
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-24">
                    Tín hiệu
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-32">
                    Quốc tịch
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-40">
                    Loại tàu
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 w-28">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="h-4 w-56 bg-gray-200 rounded" />
                      <div className="mt-2 h-3 w-40 bg-gray-200 rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-6 w-24 bg-gray-200 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-20 bg-gray-200 rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-36 bg-gray-200 rounded" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="h-4 w-16 bg-gray-200 rounded ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="h-10 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


