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

        if (!state.token) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
          return;
        }

        try {
          const userData = await api.get('/users/profile');
          set({
            user: userData,
            isAuthenticated: true,
          });
        } catch (error) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
        }
      },

      initializeAuth: async () => {
        set({ isLoading: true });
        const state = useAuthStore.getState();

        if (state.token) {
          await state.validateToken();
        } else {
          set({
            isLoading: false,
            isAuthenticated: false,
          });
        }

        set({ isLoading: false });
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
