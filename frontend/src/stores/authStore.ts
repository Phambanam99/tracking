import { create } from "zustand";
import { persist } from "zustand/middleware";

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
          const response = await fetch("http://localhost:3000/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ username, password }),
          });
          console.log(response);

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Login failed");
          }

          const data = await response.json();

          set({
            user: data.user,
            token: data.access_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Login failed",
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
        console.log("🔍 validateToken called, token exists:", !!state.token);

        if (!state.token) {
          console.log("❌ No token found, clearing auth state");
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
          return;
        }

        try {
          console.log(
            "📞 Making request to /users/profile with token:",
            state.token.substring(0, 20) + "..."
          );
          const response = await fetch("http://localhost:3000/users/profile", {
            headers: {
              Authorization: `Bearer ${state.token}`,
            },
          });

          console.log("📥 Profile response status:", response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.log(
              "❌ Profile request failed:",
              response.status,
              errorText
            );
            throw new Error("Token validation failed");
          }

          const userData = await response.json();
          console.log("✅ Profile data received:", userData);
          console.log("🔧 Setting auth state: isAuthenticated = true");
          set({
            user: userData,
            isAuthenticated: true,
          });
          console.log("✅ Auth state updated successfully");
        } catch (error) {
          console.log("💥 validateToken error:", error);
          console.log("🔧 Clearing auth state due to error");
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
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
