import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/apiClient';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  validateToken: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true, // Set to true initially to prevent premature redirects
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        username = username.trim();
        try {
          const data = await api.post('/auth/login', { username, password });

          // Lưu token vào cookies để SSR có thể dùng
          if (typeof window !== 'undefined') {
            document.cookie = `token=${data.access_token}; path=/; max-age=${
              7 * 24 * 60 * 60
            }; SameSite=Lax`;
            console.log('[AuthStore] Token saved to cookies');
          }

          set({
            user: data.user,
            token: data.access_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false,
          });
        }
      },

      logout: () => {
        // Xóa cookie
        if (typeof window !== 'undefined') {
          document.cookie = 'token=; path=/; max-age=0';
          console.log('[AuthStore] Token removed from cookies');
        }

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => {
        set({ error: null });
      },

      validateToken: async () => {
        const state = useAuthStore.getState();

        console.log('[AuthStore] validateToken - token exists:', !!state.token);

        if (!state.token) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
          return;
        }

        try {
          console.log('[AuthStore] Validating token with backend...');
          // Add shorter timeout to profile fetch
          const userData = await Promise.race([
            api.get('/users/profile'),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Profile fetch timeout')), 2000),
            ),
          ]);
          console.log('[AuthStore] ✓ Token valid, user:', userData);
          set({
            user: userData,
            isAuthenticated: true,
          });
        } catch (error) {
          console.warn('[AuthStore] ✗ Token validation failed:', error);
          // Clear invalid token
          if (typeof window !== 'undefined') {
            document.cookie = 'token=; path=/; max-age=0';
          }
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
        }
      },

      initializeAuth: async () => {
        console.log('[AuthStore] initializeAuth starting...');
        set({ isLoading: true });
        const state = useAuthStore.getState();

        try {
          if (state.token) {
            console.log('[AuthStore] Has token, validating...');
            // Do not block on token validation for too long
            await Promise.race([
              state.validateToken(),
              new Promise((resolve) => setTimeout(resolve, 2500)),
            ]);
          } else {
            console.log('[AuthStore] No token found');
            set({
              isLoading: false,
              isAuthenticated: false,
            });
          }
        } catch (e) {
          console.error('[AuthStore] initializeAuth error:', e);
        } finally {
          set({ isLoading: false });
          console.log('[AuthStore] initializeAuth complete');
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
