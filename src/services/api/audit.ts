import { apiClient } from './client';
import type { ApiResponse } from './types';

async function getAuditLogs(params?: {
  action?: string; user?: string; collection?: string;
  from?: string; to?: string; page?: number; limit?: number;
}): Promise<ApiResponse<any[]>> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
  }
  return apiClient.request(`/audit?${searchParams.toString()}`);
}

async function getAuditActions(): Promise<ApiResponse<string[]>> {
  return apiClient.request('/audit/actions');
}

export const auditApi = {
  getAuditLogs,
  getAuditActions,
};
