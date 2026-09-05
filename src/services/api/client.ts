import { API_BASE_URL as RESOLVED_API_BASE_URL, isDesktopApp } from '../../utils/apiBase';
import { getInstanceId } from '../../utils/instanceId';

// Desktop app: use the page origin (127.0.0.1) - Chromium cannot reach
// 'localhost' (resolves to ::1) when the server binds 127.0.0.1
const API_BASE_URL = RESOLVED_API_BASE_URL;

// Health check URL (without /api prefix)
export const HEALTH_CHECK_URL = API_BASE_URL;

// ── Frontend SimpleCache for getBill (10s TTL) ──
const billCache = new Map<string, { data: any; expiry: number }>();
const BILL_CACHE_TTL = 10000;
export function getCachedBill(id: string): any | null {
  const entry = billCache.get(String(id));
  if (entry && Date.now() < entry.expiry) return entry.data;
  if (entry) billCache.delete(String(id));
  return null;
}
export function setCachedBill(id: string, data: any) {
  billCache.set(String(id), { data, expiry: Date.now() + BILL_CACHE_TTL });
}
function invalidateBillCache(id?: string) {
  if (id) billCache.delete(String(id));
  else billCache.clear();
}

import type { ApiResponse } from './types';

// API Client class (core: transport, auth, normalize, generic HTTP)
class ApiClient {
  baseURL: string;
  token: string | null = null;
  refreshPromise: Promise<boolean> | null = null;

  constructor(baseURL: string) {
    this.baseURL = `${baseURL}/api`;
    this.token = localStorage.getItem('token');
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOn401: boolean = true
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const config: RequestInit = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'x-instance-id': getInstanceId(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          ...options.headers,
        },
        cache: 'no-store',
      };

      if (this.getToken()) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${this.getToken()}`,
        };
      }

      const response = await fetch(url, config);
          if (!response.ok && response.status === 0) {
            return { success: false, message: 'خطأ في الاتصال بالخادم، تأكد من أن الخادم يعمل' };
          }
          let data;
          try {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
          } catch {
            return { success: false, message: 'خطأ في تحليل البيانات المستلمة من الخادم' };
          }
          if (!response.ok) {
            if (endpoint === '/auth/login' && response.status === 401) {
              return { success: false, message: data.message || 'بيانات الدخول غير صحيحة' };
            }
            if (response.status === 401 && retryOn401) {
              const refreshToken = localStorage.getItem('refreshToken');
              if (refreshToken && !this.refreshPromise) {
                this.refreshPromise = (async () => {
                  try {
                    const refreshResponse = await this.refreshToken(refreshToken);
                    if (refreshResponse.success && refreshResponse.data?.token) {
                      this.setToken(refreshResponse.data.token);
                      localStorage.setItem('token', refreshResponse.data.token);
                      if (refreshResponse.data.refreshToken) {
                        localStorage.setItem('refreshToken', refreshResponse.data.refreshToken);
                      }
                      return true;
                    } else {
                      this.clearToken();
                      return false;
                    }
                  } catch {
                    this.clearToken();
                    return false;
                  }
                })();
              }
              if (this.refreshPromise) {
                const refreshResult = await this.refreshPromise;
                this.refreshPromise = null;
                if (refreshResult) {
                  return this.request<T>(endpoint, options, false);
                } else {
                  return { success: false, message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى' };
                }
              } else {
                this.clearToken();
                return { success: false, message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى' };
              }
            }
            if (process.env.NODE_ENV === 'development' && response.status >= 500) {
              console.error('API Error Response:', { status: response.status, statusText: response.statusText, data });
            }
            const innerErr = (data as any)?.data ?? data;
            return { success: false, message: data.error || data.message || `خطأ ${response.status}: ${response.statusText}`, errors: data.errors || innerErr?.errors, details: data.details || innerErr?.details, data: innerErr };
          }
          // invalidate bill cache on any billing/order/session mutation — keeps getBill fast but fresh
          try {
            const method = (options.method || 'GET').toUpperCase();
            if ((endpoint.includes('/billing') || endpoint.includes('/orders') || endpoint.includes('/sessions')) && ['POST','PUT','DELETE','PATCH'].includes(method)) {
              invalidateBillCache();
              const match = endpoint.match(/\/billing\/([^\/\?]+)/);
              if (match && match[1]) invalidateBillCache(match[1]);
            }
          } catch {}
          const inner = (data as any)?.data !== undefined ? (data as any).data as T : data as T;
          return { success: true, data: inner, message: data.message };
    } catch (error: unknown) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          success: false,
          message: 'خطأ في الاتصال بالخادم، تأكد من اتصالك بالإنترنت'
        };
      }
      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ في الاتصال بالخادم'
      };
    }
  }

  // دالة للـ API calls العامة (لا تحتاج authentication)
  async publicRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const config: RequestInit = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'x-instance-id': getInstanceId(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          ...options.headers,
        },
        cache: 'no-store',
      };

      const response = await fetch(url, config);

      if (!response.ok && response.status === 0) {
        return {
          success: false,
          message: 'خطأ في الاتصال بالخادم، تأكد من أن الخادم يعمل'
        };
      }

      let data;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (jsonError) {
        return {
          success: false,
          message: 'خطأ في تحليل البيانات المستلمة من الخادم'
        };
      }

      if (!response.ok) {
        return {
          success: false,
          message: data.message || `خطأ ${response.status}: ${response.statusText}`
        };
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          success: false,
          message: 'خطأ في الاتصال بالخادم، تأكد من اتصالك بالإنترنت'
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ في الاتصال بالخادم'
      };
    }
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token); // للكاش عبر التبويبات/إعادة التحميل
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    this.refreshPromise = null;
  }

  getToken(): string | null {
    if (!this.token) this.token = localStorage.getItem('token');
    return this.token;
  }

  // Helper function to normalize data
  normalizeData<T extends { _id?: string; id?: string }>(data: T): T & { id: string } {
    const normalized: any = {
      ...data,
      id: data.id || data._id || ''
    };

    // Convert date strings to Date objects
    if (normalized.startTime && typeof normalized.startTime === 'string') {
      normalized.startTime = new Date(normalized.startTime);
    }
    if (normalized.endTime && typeof normalized.endTime === 'string') {
      normalized.endTime = new Date(normalized.endTime);
    }
    if (normalized.createdAt && typeof normalized.createdAt === 'string') {
      normalized.createdAt = new Date(normalized.createdAt);
    }
    if (normalized.updatedAt && typeof normalized.updatedAt === 'string') {
      normalized.updatedAt = new Date(normalized.updatedAt);
    }

    // Convert controllersHistory dates
    if (normalized.controllersHistory && Array.isArray(normalized.controllersHistory)) {
      normalized.controllersHistory = normalized.controllersHistory.map((period: any) => ({
        ...period,
        from: typeof period.from === 'string' ? new Date(period.from) : period.from,
        to: period.to && typeof period.to === 'string' ? new Date(period.to) : period.to
      }));
    }

    return normalized;
  }

  normalizeArray<T extends { _id?: string; id?: string }>(data: T[]): (T & { id: string })[] {
    return data.map(item => this.normalizeData(item));
  }

  async post<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<{ token: string; refreshToken: string }>> {
    return this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async get<T = any>(endpoint: string, config?: { params?: any }): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (config?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(config.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url = `${endpoint}?${queryString}`;
      }
    }
    return this.request<T>(url);
  }

}

export const apiClient = new ApiClient(API_BASE_URL);
