import { cookies } from 'next/headers';

// Server-side cần absolute URL đến backend
// Client-side rewrites sẽ proxy /api -> http://localhost:3001/api
const getServerApiUrl = () => {
  // Trong production có thể dùng internal service URL
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }
  // Development: gọi trực tiếp backend
  return process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:3001/api';
};

const API_BASE_URL = getServerApiUrl();

export interface ServerFetchOptions extends RequestInit {
  requireAuth?: boolean;
}

export async function serverFetch<T>(
  endpoint: string,
  options: ServerFetchOptions = {}
): Promise<T> {
  const { requireAuth = true, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Version': process.env.NEXT_PUBLIC_API_VERSION || '1.0.0',
  };

  // Get auth token from cookies
  if (requireAuth) {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Merge custom headers
  if (fetchOptions.headers) {
    Object.assign(headers, fetchOptions.headers);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  console.log('[ServerFetch] Fetching:', url);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      cache: options.cache || 'no-store', // Default to no cache for dynamic data
    });

    console.log('[ServerFetch] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error?.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Handle wrapped response format
    if (data && typeof data === 'object' && 'success' in data) {
      return data.data as T;
    }
    
    return data as T;
  } catch (error) {
    console.error(`[ServerFetch] Error fetching ${endpoint}:`, error);
    throw error;
  }
}

export async function serverFetchVessel(vesselId: number): Promise<any> {
  return serverFetch(`/vessels/${vesselId}`);
}

export async function serverFetchTrackedItems() {
  return serverFetch('/tracking');
}
