"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  console.log(
    "🛡️ ProtectedRoute - isAuthenticated:",
    isAuthenticated,
    "isLoading:",
    isLoading
  );

  useEffect(() => {
    console.log(
      "🛡️ ProtectedRoute useEffect - isLoading:",
      isLoading,
      "isAuthenticated:",
      isAuthenticated
    );
    if (!isLoading && !isAuthenticated) {
      console.log("🚫 Redirecting to login - not authenticated");
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    console.log("⏳ ProtectedRoute showing loading spinner");
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log("🚫 ProtectedRoute returning null - not authenticated");
    return null;
  }

  console.log("✅ ProtectedRoute rendering children - authenticated");
  return <>{children}</>;
}
