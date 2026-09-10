import { apiClient } from './client';
import type { ApiResponse } from './types';

export interface HealthCheckItem {
  key: 'mongo' | 'disk' | 'backup' | 'memory';
  ok: boolean;
  message: string;
  detail?: unknown;
}

export interface HealthStatus {
  ok: boolean;
  checks: HealthCheckItem[];
}

async function getHealth(): Promise<ApiResponse<HealthStatus>> {
  return apiClient.request('/health');
}

export const healthApi = {
  getHealth,
};
