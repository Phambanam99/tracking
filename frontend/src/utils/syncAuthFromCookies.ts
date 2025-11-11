/**
 * Đồng bộ auth token từ cookies sang client-side store
 * Dùng khi SSR set cookies nhưng client store chưa có token
 */

import { useAuthStore } from '@/stores/authStore';

export function syncAuthFromCookies() {
  if (typeof window === 'undefined') return; // Server-side only

  // Lấy token từ cookies
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const cookieToken = cookies['token'];
  const { token: storeToken, validateToken } = useAuthStore.getState();

  console.log('[SyncAuth] Checking cookies...', {
    hasCookieToken: !!cookieToken,
    hasStoreToken: !!storeToken,
    cookieToken: cookieToken ? `${cookieToken.substring(0, 20)}...` : 'null',
    storeToken: storeToken ? `${storeToken.substring(0, 20)}...` : 'null'
  });

  // Case 1: Store có token nhưng cookie không có → Sync store → cookie
  if (storeToken && !cookieToken) {
    console.log('[SyncAuth] Store has token but cookie missing, syncing store → cookie...');
    document.cookie = `token=${storeToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    console.log('[SyncAuth] Token synced to cookie from store');
    return;
  }

  // Case 2: Cookie có token nhưng store không có → Sync cookie → store
  if (cookieToken && !storeToken) {
    console.log('[SyncAuth] Found token in cookies, syncing to store...');
    
    useAuthStore.setState({ 
      token: cookieToken,
      isAuthenticated: true,
      isLoading: false
    });

    validateToken().then(() => {
      console.log('[SyncAuth] Token validated and user info fetched');
    }).catch((err) => {
      console.error('[SyncAuth] Token validation failed:', err);
    });
    return;
  }
  
  // Case 3: Không có token nào → Logout
  if (!cookieToken && !storeToken) {
    console.log('[SyncAuth] No token in cookies or store');
    return;
  }

  // Case 4: Cả 2 đều có → OK
  console.log('[SyncAuth] Token already synced in both places');
}
