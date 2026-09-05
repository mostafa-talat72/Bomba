import { apiClient } from './client';
import type { ApiResponse, User } from './types';

async function login(identifier: string, password: string): Promise<ApiResponse<{ user: User; token: string; refreshToken: string }>> {
  const response = await apiClient.request<{ user: User; token: string; refreshToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });

  if (response.success && response.data?.token) {
    apiClient.setToken(response.data.token);
    if (response.data.refreshToken) {
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    if (response.data.user) {
      response.data.user = apiClient.normalizeData(response.data.user);
    }
  }

  return response;
}


async function resendVerification(email: string): Promise<ApiResponse> {
  return apiClient.publicRequest('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}


async function forgotPassword(email: string): Promise<ApiResponse> {
  return apiClient.publicRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}


async function resetPassword(token: string, password: string, email?: string): Promise<ApiResponse> {
  return apiClient.publicRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password, email }),
  });
}


async function logout(): Promise<ApiResponse> {
  // تنظيف البيانات المحلية أولاً
  apiClient.clearToken();
  localStorage.removeItem('refreshToken');

  // محاولة إرسال طلب logout للـ backend فقط إذا كان هناك توكن
  const token = localStorage.getItem('token');
  if (!token) {
    return { success: true, message: 'تم تسجيل الخروج' };
  }

  try {
    const response = await apiClient.request('/auth/logout', {
      method: 'POST',
    }, false); // لا تحاول إعادة المحاولة عند 401
    return response;
  } catch (error: unknown) {
    // حتى لو فشل الطلب، نعتبر أن logout نجح
    return { success: true, message: 'تم تسجيل الخروج' };
  }
}


async function getMe(): Promise<ApiResponse<{ user: User }>> {
  const response = await apiClient.request<{ user: User }>('/auth/me');
  
  if (response.success && response.data?.user) {
    response.data.user = apiClient.normalizeData(response.data.user);
  }
  return response;
}


export const authApi = {
  login,
  resendVerification,
  forgotPassword,
  resetPassword,
  logout,
  getMe,
};
