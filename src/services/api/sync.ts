import { apiClient } from './client';
import type { ApiResponse } from './types';

async function runTypeAudit(fix: boolean = true): Promise<ApiResponse<{
  collections: Array<{ collection: string; fixedDocs: number; fixedFields: number; skippedDocs: number; passes: number; resolvedIds: number }>;
  totalFixedDocs: number;
  totalFixedFields: number;
}>> {
  return apiClient.request('/sync/type-audit', {
    method: 'POST',
    body: JSON.stringify({ fix }),
  });
}

async function getSyncOverview(): Promise<ApiResponse<any>> {
  return apiClient.request('/sync/overview');
}

async function syncLanTime(): Promise<ApiResponse<any>> {
  return apiClient.request('/lan/time-sync', { method: 'POST' });
}

async function setLanTimeSource(enabled: boolean): Promise<ApiResponse<any>> {
  return apiClient.request('/lan/time-source', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

async function getLanRole(): Promise<ApiResponse<any>> {
  return apiClient.request('/lan/role');
}

async function setLanRole(patch: { eligible?: boolean; deviceClass?: 'fixed' | 'mobile' }): Promise<ApiResponse<any>> {
  return apiClient.request('/lan/role', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export const syncApi = {
  runTypeAudit,
  getSyncOverview,
  syncLanTime,
  setLanTimeSource,
  getLanRole,
  setLanRole,
};
