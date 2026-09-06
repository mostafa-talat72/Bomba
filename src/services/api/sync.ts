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

export const syncApi = {
  runTypeAudit,
};
