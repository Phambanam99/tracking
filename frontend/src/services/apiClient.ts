// Enhanced API service for handling HTTP requests with authentication
import { useAuthStore } from '../stores/authStore';
import { performanceMonitor } from '../utils/performanceMonitor';


const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || '1.0.0';

class ApiService {
  /**
   * Validates and constructs the full API URL
   * @param endpoint - The API endpoint (should start with /)
   * @returns The full URL string
   * @throws Error if URL construction fails
   */
  private buildUrl(endpoint: string): string {
    if (!endpoint || typeof endpoint !== 'string') {
      throw new Error(`Invalid endpoint: endpoint must be a non-empty string, received: ${typeof endpoint}`);
    }

    const baseUrl = API_BASE_URL || '/api';
    
    // Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    const fullUrl = `${baseUrl}${normalizedEndpoint}`;
    
    // Validate the constructed URL
    if (!fullUrl || fullUrl.trim() === '') {
      throw new Error(`Failed to construct valid URL. Base: "${baseUrl}", Endpoint: "${endpoint}"`);
    }
    
    return fullUrl;
  }

  private getAuthToken(): string | null {
    // Get token from auth store
    const { token } = useAuthStore.getState();
    return token;
  }

  private async request(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const startTime = performance.now();
    const token = this.getAuthToken();

    // Validate and build the full URL
    const fullUrl = this.buildUrl(endpoint);

    const config: RequestInit = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        'X-API-Version': API_VERSION,
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(fullUrl, config);
      console.log('[ApiClient] Request:', response);
      const text = await response.text();
      let payload: any = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = { raw: text };
      }

      const duration = performance.now() - startTime;

      if (!response.ok) {
        performanceMonitor.trackApiCall(endpoint, duration, false, true);

        // Handle 401 Unauthorized - token expired or invalid
        if (response.status === 401) {
          console.warn('[ApiClient] 401 Unauthorized - Auto logout');

          // Clear auth state and redirect to login
          const { logout } = useAuthStore.getState();
          logout();

          // Redirect to login page if not already there
          if (
            typeof window !== 'undefined' &&
            !window.location.pathname.includes('/login')
          ) {
            console.log('[ApiClient] Redirecting to login page...');
            window.location.href = '/login?expired=true';
          }
        }

        const errorMessage =
          (payload && (payload.error?.message || payload.message)) ||
          response.statusText ||
          `HTTP ${response.status}`;
        const error = new Error(errorMessage) as Error & {
          status?: number;
          body?: any;
        };
        error.status = response.status;
        (error as any).body = payload;
        throw error;
      }

      performanceMonitor.trackApiCall(endpoint, duration, false, false);

      if (payload && typeof payload === 'object' && 'success' in payload) {
        return new Response(JSON.stringify(payload.data), {
          status: response.status,
          headers: response.headers,
        });
      }
      return new Response(JSON.stringify(payload), {
        status: response.status,
        headers: response.headers,
      });
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.trackApiCall(endpoint, duration, false, true);
      throw error;
    }
  }

  async get(endpoint: string): Promise<any> {
    const response = await this.request(endpoint, { method: 'GET' });
    return response.json();
  }

  async post(endpoint: string, data?: any): Promise<any> {
    const response = await this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
    return response.json();
  }

  async postMultipart(endpoint: string, formData: FormData): Promise<any> {
    const startTime = performance.now();
    const token = this.getAuthToken();
    
    // Validate endpoint and build URL
    if (!endpoint || typeof endpoint !== 'string') {
      throw new Error(`Invalid endpoint for postMultipart: endpoint must be a non-empty string, received: ${typeof endpoint}`);
    }
    
    // Validate formData
    if (!formData || !(formData instanceof FormData)) {
      throw new Error(`Invalid formData: must be an instance of FormData, received: ${typeof formData}`);
    }
    
    const fullUrl = this.buildUrl(endpoint);
    
    const headers: Record<string, string> = {
      'X-API-Version': API_VERSION,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    
    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        credentials: 'include',
        body: formData,
        headers, // DO NOT set Content-Type; browser will set multipart boundary
      });
      
      const duration = performance.now() - startTime;
      
      const payload = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        performanceMonitor.trackApiCall(endpoint, duration, false, true);
        
        // Handle 401 Unauthorized
        if (response.status === 401) {
          console.warn('[ApiClient] 401 Unauthorized (multipart) - Auto logout');
          const { logout } = useAuthStore.getState();
          logout();
          if (
            typeof window !== 'undefined' &&
            !window.location.pathname.includes('/login')
          ) {
            window.location.href = '/login?expired=true';
          }
        }

        const errorMessage =
          (payload && (payload.error?.message || payload.message)) ||
          `HTTP ${response.status}`;
        const error = new Error(errorMessage) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }
      
      performanceMonitor.trackApiCall(endpoint, duration, false, false);
      
      if (payload && typeof payload === 'object' && 'success' in payload) {
        return payload.data;
      }
      return payload;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.trackApiCall(endpoint, duration, false, true);
      
      // Add more context to the error
      if (error instanceof Error) {
        error.message = `[postMultipart] ${error.message} (URL: ${fullUrl})`;
      }
      throw error;
    }
  }

  async put(endpoint: string, data?: any): Promise<any> {
    const response = await this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
    return response.json();
  }

  async patch(endpoint: string, data?: any): Promise<any> {
    const response = await this.request(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
    return response.json();
  }

  async delete(endpoint: string): Promise<any> {
    const response = await this.request(endpoint, { method: 'DELETE' });
    return response.json();
  }
}

// Create a singleton instance
const api = new ApiService();

export default api;
