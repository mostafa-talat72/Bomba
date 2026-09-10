import { apiClient } from './client';
import type { ApiResponse } from './types';

async function getSyncStatus(): Promise<ApiResponse<any>> {
  return apiClient.request('/sync-status');
}

export const syncStatusApi = {
  getSyncStatus,
};
