import { apiClient } from './client';
import type { ApiResponse } from './types';

export interface ConnectedDevice {
  instanceId: string;
  label: string;
  deviceType: 'desktop' | 'mobile' | 'browser';
  platform: string;
  browser: string;
  ip: string;
  user: { username: string } | null;
  canPrint: boolean;
  lastSeen: string;
  online: boolean;
}

async function listConnectedDevices(): Promise<ApiResponse<ConnectedDevice[]>> {
  return apiClient.request<ConnectedDevice[]>('/connected-devices');
}

async function updateConnectedDevice(
  instanceId: string,
  patch: { canPrint?: boolean; label?: string }
): Promise<ApiResponse<ConnectedDevice>> {
  return apiClient.request<ConnectedDevice>(`/connected-devices/${encodeURIComponent(instanceId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

async function forgetConnectedDevice(instanceId: string): Promise<ApiResponse<any>> {
  return apiClient.request(`/connected-devices/${encodeURIComponent(instanceId)}`, {
    method: 'DELETE',
  });
}

export const connectedDevicesApi = {
  listConnectedDevices,
  updateConnectedDevice,
  forgetConnectedDevice,
};
