export function VesselDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header skeleton */}
          <div className="mb-8 flex justify-between items-start">
            <div className="space-y-3">
              <div className="h-9 bg-gray-200 rounded w-64"></div>
              <div className="h-5 bg-gray-200 rounded w-48"></div>
            </div>
            <div className="flex space-x-3">
              <div className="h-10 w-24 bg-gray-200 rounded"></div>
              <div className="h-10 w-24 bg-gray-200 rounded"></div>
              <div className="h-10 w-28 bg-gray-200 rounded"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info skeleton */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6 space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-40"></div>
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                        <div className="h-5 bg-gray-200 rounded w-full"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Position history skeleton */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6 space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-32"></div>
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="h-5 bg-gray-200 rounded w-40"></div>
                    <div className="grid grid-cols-2 gap-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-20"></div>
                          <div className="h-4 bg-gray-200 rounded w-32"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar skeleton */}
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6 space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-28"></div>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                      <div className="h-4 bg-gray-200 rounded w-20"></div>
                    </div>
                  ))}
                  <div className="h-10 bg-gray-200 rounded w-full mt-4"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function VesselListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-white shadow rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2 flex-1">
              <div className="h-5 bg-gray-200 rounded w-48"></div>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
            </div>
            <div className="h-6 bg-gray-200 rounded-full w-20"></div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
