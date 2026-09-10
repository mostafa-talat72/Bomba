import { apiClient } from './client';
import type { ApiResponse } from './types';

async function getCurrentShift(): Promise<ApiResponse<any>> {
  return apiClient.request('/shifts/current');
}

async function openShift(data?: { openingCash?: number; notes?: string }): Promise<ApiResponse<any>> {
  return apiClient.request('/shifts/open', {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });
}

async function closeShift(data: { actualCash: number; notes?: string }): Promise<ApiResponse<any>> {
  return apiClient.request('/shifts/close', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function getShifts(params?: { page?: number; limit?: number }): Promise<ApiResponse<any[]>> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.append(key, String(value));
    });
  }
  return apiClient.request(`/shifts?${searchParams.toString()}`);
}

async function getLanUpdateInfo(peerIp: string, peerPort = 5000): Promise<{ ok: boolean; data?: any; message?: string }> {
  try {
    const res = await fetch(`http://${peerIp}:${peerPort}/api/lan/update`);
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, data };
  } catch {
    return { ok: false, message: 'تعذر الوصول للجهاز الآخر' };
  }
}

export const shiftsApi = {
  getCurrentShift,
  openShift,
  closeShift,
  getShifts,
  getLanUpdateInfo,
};
