'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import { useMapStore } from '@/stores/mapStore';
import api from '@/services/apiClient';
import { useWebSocketHandler } from '@/hooks/useWebSocketHandler';

interface AuthContextType {
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType>({ isInitialized: false });

export const useAuthContext = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initializeAuth } = useAuthStore();
  const { setSettings } = useSystemSettingsStore();
  const [isInitialized, setIsInitialized] = useState(false);
  // Initialize websocket listeners globally so alerts always arrive
  useWebSocketHandler();

  useEffect(() => {
    const initializeApp = async () => {
      console.log('[AuthProvider] Starting initialization...');
      const startTime = Date.now();

      try {
        // Timeout protection: force initialize after 10 seconds (increased from 5s to reduce false timeouts)
        const timeoutPromise = new Promise<void>((resolve) => {
          setTimeout(() => {
            console.warn('[AuthProvider] ⚠ Initialization timeout (10s), forcing completion');
            resolve();
          }, 10000);
        });

        const initPromise = (async () => {
          try {
            // Initialize auth first (token đã được sync từ AuthSyncWrapper)
            console.log('[AuthProvider] Step 1: Initializing auth...');
            await Promise.race([
              initializeAuth(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Auth init timeout')), 5000)
              ),
            ]);
            console.log('[AuthProvider] ✓ Auth initialized');

            // Sync map store user and hydrate defaults
            const { user } = useAuthStore.getState();
            const { setCurrentUserId, hydrateFromServer } = useMapStore.getState();
            setCurrentUserId(user ? String(user.id) : 'guest');
            console.log('[AuthProvider] User:', user ? `${user.username} (ID: ${user.id})` : 'Not logged in');

            if (user) {
              try {
                console.log('[AuthProvider] Step 2: Fetching user filters...');
                const list = await Promise.race([
                  api.get('/users/filters'),
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Filters timeout')), 5000)
                  ),
                ]);
                if (Array.isArray(list)) {
                  const def = list.find((it: any) => it?.name === 'default');
                  if (def) {
                    const payload = {
                      activeFilterTab: def.activeFilterTab,
                      aircraftViewMode: def.aircraftViewMode,
                      vesselViewMode: def.vesselViewMode,
                      aircraft:
                        typeof def.aircraft === 'string'
                          ? JSON.parse(def.aircraft)
                          : def.aircraft,
                      vessel:
                        typeof def.vessel === 'string'
                          ? JSON.parse(def.vessel)
                          : def.vessel,
                    } as const;
                    hydrateFromServer(payload);
                    console.log('[AuthProvider] ✓ Filters loaded');
                  }
                }
              } catch (e) {
                console.warn('[AuthProvider] Failed to fetch filters:', e);
              }
            }

            // Fetch system settings (only for ADMIN users)
            if (user && user.role === 'ADMIN') {
              try {
                console.log('[AuthProvider] Step 3: Fetching system settings (user is ADMIN)...');
                const settings = await Promise.race([
                  api.get('/admin/settings'),
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Settings timeout')), 5000)
                  ),
                ]);
                setSettings(settings);
                console.log('[AuthProvider] ✓ Settings loaded');
              } catch (e) {
                console.warn('[AuthProvider] Failed to fetch settings:', e);
              }
            } else {
              console.log('[AuthProvider] Step 3: Skipping settings fetch (user is not ADMIN)');
              // Set default settings for non-admin users
              setSettings({
                clusterEnabled: true,
                minZoom: 4,
                maxZoom: 16,
                signalStaleMinutes: 10,
                vesselFlagColors: {},
                aircraftOperatorColors: {},
                mapProvider: 'osm',
                maptilerApiKey: undefined,
                maptilerStyle: 'streets',
              });
            }
          } catch (e) {
            console.error('[AuthProvider] Initialization error:', e);
          }
        })();

        // Wait for either init to complete or timeout
        await Promise.race([initPromise, timeoutPromise]);

        const elapsed = Date.now() - startTime;
        console.log(`[AuthProvider] ✅ Initialization complete (${elapsed}ms)`);
        setIsInitialized(true);
      } catch (e) {
        console.error('[AuthProvider] Fatal initialization error:', e);
        setIsInitialized(true); // Still mark as initialized to prevent infinite loading
      }
    };

    initializeApp();
  }, [initializeAuth, setSettings]);

  // React to user changes after init (login/logout without full reload)
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {
      const { setCurrentUserId, hydrateFromServer } = useMapStore.getState();
      setCurrentUserId(state.user ? String(state.user.id) : 'guest');
      if (state.user) {
        api
          .get('/users/filters')
          .then((list) => {
            if (Array.isArray(list)) {
              const def = list.find((it: any) => it?.name === 'default');
              if (def) {
                const payload = {
                  activeFilterTab: def.activeFilterTab,
                  aircraftViewMode: def.aircraftViewMode,
                  vesselViewMode: def.vesselViewMode,
                  aircraft:
                    typeof def.aircraft === 'string'
                      ? JSON.parse(def.aircraft)
                      : def.aircraft,
                  vessel:
                    typeof def.vessel === 'string'
                      ? JSON.parse(def.vessel)
                      : def.vessel,
                } as const;
                hydrateFromServer(payload);
              }
            }
          })
          .catch(() => undefined);
      }
    });
    return () => unsub();
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang khởi tạo...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isInitialized }}>
      {children}
    </AuthContext.Provider>
  );
}
