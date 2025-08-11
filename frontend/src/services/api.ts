const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "/api";
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || "1.0.0";

export interface Aircraft {
  id: number;
  flightId: string;
  callSign?: string;
  registration?: string;
  aircraftType?: string;
  operator?: string;
  createdAt: string;
  updatedAt: string;
  lastPosition?: {
    id: number;
    latitude: number;
    longitude: number;
    altitude?: number;
    speed?: number;
    heading?: number;
    timestamp: string;
  };
}

export interface Vessel {
  id: number;
  mmsi: string;
  vesselName?: string;
  vesselType?: string;
  flag?: string;
  operator?: string;
  length?: number;
  width?: number;
  createdAt: string;
  updatedAt: string;
  lastPosition?: {
    id: number;
    latitude: number;
    longitude: number;
    speed?: number;
    course?: number;
    heading?: number;
    status?: string;
    timestamp: string;
  };
}

export const apiService = {
  async fetchAircrafts(): Promise<Aircraft[]> {
    const response = await fetch(`${API_BASE_URL}/aircrafts/initial`, {
      headers: { "X-API-Version": API_VERSION },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch aircrafts");
    }
    return response.json();
  },

  async fetchVessels(): Promise<Vessel[]> {
    const response = await fetch(`${API_BASE_URL}/vessels/initial`, {
      headers: { "X-API-Version": API_VERSION },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch vessels");
    }
    return response.json();
  },

  async fetchAircraftHistory(id: number, from?: string): Promise<Aircraft> {
    const params = new URLSearchParams();
    if (from) params.append("from", from);

    const response = await fetch(
      `${API_BASE_URL}/aircrafts/${id}/history?${params}`,
      { headers: { "X-API-Version": API_VERSION } }
    );
    if (!response.ok) {
      throw new Error("Failed to fetch aircraft history");
    }
    return response.json();
  },

  async fetchVesselHistory(id: number, from?: string): Promise<Vessel> {
    const params = new URLSearchParams();
    if (from) params.append("from", from);

    const response = await fetch(
      `${API_BASE_URL}/vessels/${id}/history?${params}`,
      { headers: { "X-API-Version": API_VERSION } }
    );
    if (!response.ok) {
      throw new Error("Failed to fetch vessel history");
    }
    return response.json();
  },
};

export default apiService;
