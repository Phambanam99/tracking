"use client";

import dynamic from "next/dynamic";
import Header from "@/components/Header";
import ProtectedRoute from "@/components/ProtectedRoute";

// Dynamically import MapComponent to avoid SSR issues with OpenLayers
const MapComponent = dynamic(
  () => import("../components/MapComponentClustered"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen">
        Loading map...
      </div>
    ),
  }
);

export default function Home() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="w-full" style={{ height: "calc(100vh - 64px)" }}>
          <MapComponent />
        </main>
      </div>
    </ProtectedRoute>
  );
}
