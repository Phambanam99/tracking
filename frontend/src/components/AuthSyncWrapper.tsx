'use client';

import { useMemo } from 'react';
import { syncAuthFromCookies } from '@/utils/syncAuthFromCookies';

/**
 * Component tự động sync auth từ cookies sang store khi app mount
 * Đảm bảo SSR cookies được đồng bộ sang client-side stores TRƯỚC KHI render children
 */
export function AuthSyncWrapper({ children }: { children: React.ReactNode }) {
  // Sync NGAY trong render phase (trước khi children mount)
  // useMemo đảm bảo chỉ chạy 1 lần
  useMemo(() => {
    syncAuthFromCookies();
    return true;
  }, []);

  return <>{children}</>;
}
