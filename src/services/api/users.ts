import { apiClient } from './client';
import type { ApiResponse, User } from './types';

async function getUsers(params?: { page?: number; limit?: number; role?: string; status?: string; search?: string }): Promise<ApiResponse<User[]>> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });
  }

  const response = await apiClient.request<User[]>(`/users?${searchParams.toString()}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getUser(id: string): Promise<ApiResponse<User>> {
  const response = await apiClient.request<User>(`/users/${id}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function createUser(userData: {
  name: string;
  email: string;
  password: string;
  role: string;
  status: string;
  phone?: string;
  username?: string;
  address?: string;
  permissions: string[];
  businessName?: string;
  businessType?: string;
}): Promise<ApiResponse<User>> {
  const endpoint = userData.role === 'owner' ? '/auth/register' : '/users';
  const response = await apiClient.request<User>(endpoint, {
    method: 'POST',
    body: JSON.stringify(userData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updateUser(id: string, updates: Partial<User>): Promise<ApiResponse<User>> {
  const response = await apiClient.request<User>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function deleteUser(id: string): Promise<ApiResponse> {
  return apiClient.request(`/users/${id}`, {
    method: 'DELETE',
  });
}


async function getUserStats(): Promise<ApiResponse<any>> {
  return apiClient.request('/users/stats/overview');
}


async function getMyPrintSettings(): Promise<ApiResponse<{
  useCustomPrintSettings: boolean;
  printSettings: Record<string, any>;
  effective: Record<string, any>;
  organizationDefaults: Record<string, any>;
}>> {
  return apiClient.request('/users/me/print-settings');
}

async function updateMyPrintSettings(data: {
  useCustomPrintSettings?: boolean;
  printSettings?: Record<string, any>;
}): Promise<ApiResponse<{
  useCustomPrintSettings: boolean;
  printSettings: Record<string, any>;
}>> {
  return apiClient.request('/users/me/print-settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export const usersApi = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
  getMyPrintSettings,
  updateMyPrintSettings,
};
