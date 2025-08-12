'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import api from '@/services/apiClient';

interface AuthContextType {
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType>({ isInitialized: false });

export const useAuthContext = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initializeAuth } = useAuthStore();
  const { setSettings } = useSystemSettingsStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize auth first
        await initializeAuth();
        
        // Then fetch system settings
        try {
          const settings = await api.get('/admin/settings');
          setSettings(settings);
          console.log('✅ System settings loaded:', settings);
        } catch (error) {
          console.warn('⚠️ Failed to load system settings:', error);
          // Continue with default settings
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('❌ Failed to initialize app:', error);
        setIsInitialized(true); // Still mark as initialized to prevent infinite loading
      }
    };

    initializeApp();
  }, [initializeAuth, setSettings]);

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
