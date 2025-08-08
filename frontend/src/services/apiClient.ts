// Enhanced API service for handling HTTP requests with authentication
import { useAuthStore } from "../stores/authStore";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

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
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Network error" }));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response;
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
