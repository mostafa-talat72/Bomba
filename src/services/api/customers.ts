import { apiClient } from './client';
import type { ApiResponse } from './types';

export interface CustomerStats {
  orders: number;
  totalSpent: number;
  avg: number;
  lastOrderAt: string | null;
}

export interface DirectoryCustomer {
  _id: string;
  phone: string;
  phoneDigits: string;
  customerName: string | null;
  address: string | null;
  orderCount: number;
  updatedAt: string;
  createdAt: string;
  stats: CustomerStats;
}

export interface DirectorySummary {
  customers: number;
  orders: number;
  revenue: number;
  avg: number;
}

export interface DirectoryResponse {
  data: DirectoryCustomer[];
  total: number;
  page: number;
  pages: number;
  summary: DirectorySummary;
}

async function getDirectory(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<ApiResponse<DirectoryResponse>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append('page', String(params.page));
  if (params.limit) searchParams.append('limit', String(params.limit));
  if (params.search) searchParams.append('search', params.search);

  return apiClient.request(`/delivery-customers/directory?${searchParams.toString()}`);
}

async function createCustomer(data: {
  phone: string;
  customerName?: string;
  address?: string;
}): Promise<ApiResponse<DirectoryCustomer>> {
  return apiClient.request('/delivery-customers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function updateCustomer(
  id: string,
  data: { phone?: string; customerName?: string; address?: string }
): Promise<ApiResponse<DirectoryCustomer>> {
  return apiClient.request(`/delivery-customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function deleteCustomer(id: string): Promise<ApiResponse<null>> {
  return apiClient.request(`/delivery-customers/${id}`, {
    method: 'DELETE',
  });
}

export const customersApi = {
  getDirectory,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
