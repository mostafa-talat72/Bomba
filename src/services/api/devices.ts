import { apiClient } from './client';
import type { ApiResponse, Device } from './types';

async function getDevices(params?: {
  type?: string;
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<ApiResponse<Device[]>> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });
  }

  const response = await apiClient.request<Device[]>(`/devices?${searchParams.toString()}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getDevice(id: string): Promise<ApiResponse<Device>> {
  const response = await apiClient.request<Device>(`/devices/${id}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function createDevice(deviceData: Partial<Device>): Promise<ApiResponse<Device>> {
  const response = await apiClient.request<Device>('/devices', {
    method: 'POST',
    body: JSON.stringify(deviceData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updateDevice(id: string, updates: Partial<Device>): Promise<ApiResponse<Device>> {
  const response = await apiClient.request<Device>(`/devices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


// تحديث حالة الجهاز فقط (status)
async function updateDeviceStatus(id: string, statusData: { status: string }): Promise<ApiResponse<Device>> {
  const response = await apiClient.request<Device>(`/devices/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(statusData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function deleteDevice(id: string): Promise<ApiResponse> {
  return apiClient.request(`/devices/${id}`, {
    method: 'DELETE',
  });
}


async function getDeviceStats(): Promise<ApiResponse<any>> {
  return apiClient.request('/devices/stats');
}


async function bulkUpdateDevices(deviceIds: string[], updates: Partial<Device>): Promise<ApiResponse<any>> {
  return apiClient.request('/devices/bulk/update', {
    method: 'PUT',
    body: JSON.stringify({ deviceIds, updates }),
  });
}


export const devicesApi = {
  getDevices,
  getDevice,
  createDevice,
  updateDevice,
  updateDeviceStatus,
  deleteDevice,
  getDeviceStats,
  bulkUpdateDevices,
};
