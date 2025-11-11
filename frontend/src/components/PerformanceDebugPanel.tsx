'use client';

import { useEffect, useState } from 'react';
import { performanceMonitor } from '@/utils/performanceMonitor';

export function PerformanceDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [metrics, setMetrics] = useState(performanceMonitor.getMetrics());

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-[9999] bg-purple-600 text-white px-3 py-2 rounded-full shadow-lg hover:bg-purple-700 text-xs font-mono"
        title="Performance Metrics"
      >
        📊 {metrics.apiCalls}
      </button>

      {/* Metrics panel */}
      {isOpen && (
        <div className="fixed bottom-16 right-4 z-[9999] bg-gray-900 text-white p-4 rounded-lg shadow-2xl w-80 max-h-96 overflow-y-auto font-mono text-xs">
          <div className="flex justify-between items-center mb-3 border-b border-gray-700 pb-2">
            <h3 className="font-bold text-sm">Performance Metrics</h3>
            <button
              onClick={() => {
                performanceMonitor.reset();
                setMetrics(performanceMonitor.getMetrics());
              }}
              className="text-gray-400 hover:text-white"
            >
              Reset
            </button>
          </div>

          <div className="space-y-2">
            <MetricRow label="API Calls" value={metrics.apiCalls} />
            <MetricRow
              label="Cache Hit Rate"
              value={`${metrics.cacheHitRate.toFixed(1)}%`}
              color={metrics.cacheHitRate > 50 ? 'green' : 'yellow'}
            />
            <MetricRow
              label="Avg Response"
              value={`${metrics.averageResponseTime.toFixed(0)}ms`}
              color={metrics.averageResponseTime < 200 ? 'green' : metrics.averageResponseTime < 500 ? 'yellow' : 'red'}
            />
            <MetricRow label="Errors" value={metrics.errors} color={metrics.errors > 0 ? 'red' : 'green'} />

            {metrics.pageLoadTime && (
              <MetricRow
                label="Page Load"
                value={`${metrics.pageLoadTime}ms`}
                color={metrics.pageLoadTime < 2000 ? 'green' : metrics.pageLoadTime < 4000 ? 'yellow' : 'red'}
              />
            )}

            {metrics.largestContentfulPaint && (
              <MetricRow
                label="LCP"
                value={`${metrics.largestContentfulPaint.toFixed(0)}ms`}
                color={metrics.largestContentfulPaint < 2500 ? 'green' : metrics.largestContentfulPaint < 4000 ? 'yellow' : 'red'}
              />
            )}

            {metrics.firstInputDelay && (
              <MetricRow
                label="FID"
                value={`${metrics.firstInputDelay.toFixed(0)}ms`}
                color={metrics.firstInputDelay < 100 ? 'green' : metrics.firstInputDelay < 300 ? 'yellow' : 'red'}
              />
            )}

            {metrics.cumulativeLayoutShift !== undefined && (
              <MetricRow
                label="CLS"
                value={metrics.cumulativeLayoutShift.toFixed(3)}
                color={metrics.cumulativeLayoutShift < 0.1 ? 'green' : metrics.cumulativeLayoutShift < 0.25 ? 'yellow' : 'red'}
              />
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="text-gray-400 mb-2">Recent API Calls</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {performanceMonitor.getRecentCalls(5).reverse().map((call, i) => (
                <div key={i} className="text-[10px] flex justify-between">
                  <span className="truncate flex-1" title={call.endpoint}>
                    {call.endpoint.split('?')[0]}
                  </span>
                  <span className={call.error ? 'text-red-400' : call.cached ? 'text-green-400' : 'text-gray-400'}>
                    {call.duration.toFixed(0)}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MetricRow({
  label,
  value,
  color = 'gray',
}: {
  label: string;
  value: string | number;
  color?: 'green' | 'yellow' | 'red' | 'gray';
}) {
  const colorMap = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    gray: 'text-gray-400',
  };

  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}:</span>
      <span className={colorMap[color]}>{value}</span>
    </div>
  );
}
