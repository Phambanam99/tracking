export default function Loading() {
  return (
    <div className="min-h-screen">
      <main>
        {/* Title section skeleton */}
        <div className="w-full py-6" style={{ backgroundColor: '#244A9A' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-8 w-64 bg-white/20 rounded animate-pulse" />
            <div className="mt-2 h-5 w-96 bg-white/20 rounded animate-pulse" />
          </div>
        </div>

        {/* Sticky search skeleton */}
        <div className="sticky top-16 z-40 w-full shadow-sm" style={{ backgroundColor: '#244A9A' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="w-48 h-10 bg-gray-200 rounded animate-pulse" />
                <div className="w-40 h-10 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Table skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-2/5">
                    Flight / Callsign
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-24">
                    Tín hiệu
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-40">
                    Đăng ký
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-40">
                    Loại
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
                      <div className="mt-2 h-3 w-32 bg-gray-200 rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-6 w-24 bg-gray-200 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-28 bg-gray-200 rounded" />
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
            <div className="h-8 w-24 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-200 rounded" />
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}


