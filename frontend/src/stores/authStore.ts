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
        console.log(username + password);
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
        console.log('🔍 validateToken called, token exists:', !!state.token);

        if (!state.token) {
          console.log('❌ No token found, clearing auth state');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
          return;
        }

        try {
          console.log(
            '📞 Making request to /users/profile with token:',
            state.token.substring(0, 20) + '...',
          );
          const userData = await api.get('/users/profile');
          console.log('✅ Profile data received:', userData);
          console.log('🔧 Setting auth state: isAuthenticated = true');
          set({
            user: userData,
            isAuthenticated: true,
          });
          console.log('✅ Auth state updated successfully');
        } catch (error) {
          console.log('💥 validateToken error:', error);
          console.log('🔧 Clearing auth state due to error');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
        }
      },

      initializeAuth: async () => {
        // console.log("🚀 initializeAuth called");
        set({ isLoading: true });
        const state = useAuthStore.getState();

        if (state.token) {
          // console.log("🔑 Token found in state, validating...");
          await state.validateToken();
        } else {
          // console.log("🚫 No token found in state");
          // Ensure we set loading to false even when no token
          set({
            isLoading: false,
            isAuthenticated: false,
          });
        }

        set({ isLoading: false });
        // console.log("✅ initializeAuth completed");
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
