import { apiClient } from './client';
import type { ApiResponse } from './types';

async function createInvite(data: { email?: string; role?: string; expiresInDays?: number }): Promise<ApiResponse<any>> {
  return apiClient.request('/invites', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


async function getInvites(): Promise<ApiResponse<any[]>> {
  return apiClient.request('/invites');
}


async function deleteInvite(id: string): Promise<ApiResponse> {
  return apiClient.request(`/invites/${id}`, {
    method: 'DELETE',
  });
}


export const invitesApi = {
  createInvite,
  getInvites,
  deleteInvite,
};
