import { apiClient } from './client';
import type { ApiResponse, Cost } from './types';

async function getCosts(params?: { category?: string; status?: string; page?: number; limit?: number; startDate?: string; endDate?: string; vendor?: string }): Promise<ApiResponse<Cost[]>> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });
  }

  const response = await apiClient.request<Cost[]>(`/costs?${searchParams.toString()}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getCost(id: string): Promise<ApiResponse<Cost>> {
  const response = await apiClient.request<Cost>(`/costs/${id}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function createCost(costData: Partial<Cost>): Promise<ApiResponse<Cost>> {
  const response = await apiClient.request<Cost>('/costs', {
    method: 'POST',
    body: JSON.stringify(costData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updateCost(id: string, updates: Partial<Cost>): Promise<ApiResponse<Cost>> {
  const response = await apiClient.request<Cost>(`/costs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function approveCost(id: string): Promise<ApiResponse<Cost>> {
  const response = await apiClient.request<Cost>(`/costs/${id}/approve`, {
    method: 'PUT',
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function deleteCost(id: string): Promise<ApiResponse> {
  return apiClient.request(`/costs/${id}`, {
    method: 'DELETE',
  });
}


async function addCostPayment(id: string, paymentData: {
  paymentAmount: number;
  paymentMethod?: 'cash' | 'card' | 'transfer';
  reference?: string;
}): Promise<ApiResponse<Cost>> {
  const response = await apiClient.request<Cost>(`/costs/${id}/payment`, {
    method: 'POST',
    body: JSON.stringify(paymentData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function getCostsSummary(period?: string): Promise<ApiResponse<any>> {
  const searchParams = new URLSearchParams();
  if (period) {
    searchParams.append('period', period);
  }

  return apiClient.request(`/costs/summary?${searchParams.toString()}`);
}


export const costsApi = {
  getCosts,
  getCost,
  createCost,
  updateCost,
  approveCost,
  deleteCost,
  addCostPayment,
  getCostsSummary,
};
