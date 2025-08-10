// Enhanced API service for handling HTTP requests with authentication
import { useAuthStore } from "../stores/authStore";

// Prefer same-origin proxy via Next.js to backend
// Default base path is '/api' which next.config.ts rewrites to backend '/api'
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:3000/api";
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || "1.0.0";

class ApiService {
  private getAuthToken(): string | null {
    // Get token from auth store
    const { token } = useAuthStore.getState();
    return token;
  }

  private async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = this.getAuthToken();

    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        "X-API-Version": API_VERSION,
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    // Try to parse JSON body for both success and error
    const payload = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      // Standardized error envelope: { success: false, error: { message } }
      const errorMessage =
        (payload && (payload.error?.message || payload.message)) ||
        `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    // Standardized success envelope: { success: true, data }
    if (payload && typeof payload === "object" && "success" in payload) {
      return new Response(JSON.stringify(payload.data), {
        status: response.status,
        headers: response.headers,
      });
    }

    // Fallback: return original payload
    return new Response(JSON.stringify(payload), {
      status: response.status,
      headers: response.headers,
    });
  }

  async get(endpoint: string): Promise<any> {
    const response = await this.request(endpoint, { method: "GET" });
    return response.json();
  }

  async post(endpoint: string, data?: any): Promise<any> {
    const response = await this.request(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
    return response.json();
  }

  async put(endpoint: string, data?: any): Promise<any> {
    const response = await this.request(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
    return response.json();
  }

  async delete(endpoint: string): Promise<any> {
    const response = await this.request(endpoint, { method: "DELETE" });
    return response.json();
  }
}

// Create a singleton instance
const api = new ApiService();

export default api;
