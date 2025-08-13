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
      try {
        // Initialize auth first
        await initializeAuth();

        // Sync map store user and hydrate defaults
        const { user } = useAuthStore.getState();
        const { setCurrentUserId, hydrateFromServer } = useMapStore.getState();
        setCurrentUserId(user ? String(user.id) : 'guest');
        if (user) {
          try {
            const list = await api.get('/users/filters');
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
          } catch {}
        }

        // Then fetch system settings
        try {
          const settings = await api.get('/admin/settings');
          setSettings(settings);
        } catch {}

        setIsInitialized(true);
      } catch {
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
