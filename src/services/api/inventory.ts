import { apiClient } from './client';
import { API_BASE_URL } from '../../utils/apiBase';
import type { ApiResponse, InventoryItem } from './types';

async function getInventoryItems(params?: { category?: string; lowStock?: boolean; page?: number; limit?: number; search?: string }): Promise<ApiResponse<InventoryItem[]>> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });
  }

  const response = await apiClient.request<InventoryItem[]>(`/inventory?${searchParams.toString()}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getInventoryItem(id: string): Promise<ApiResponse<InventoryItem>> {
  const response = await apiClient.request<InventoryItem>(`/inventory/${id}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function createInventoryItem(itemData: Partial<InventoryItem> & { costStatus?: string; paidAmount?: number }): Promise<ApiResponse<InventoryItem>> {
  const response = await apiClient.request<InventoryItem>('/inventory', {
    method: 'POST',
    body: JSON.stringify(itemData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<ApiResponse<InventoryItem>> {
  const response = await apiClient.request<InventoryItem>(`/inventory/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updateStock(id: string, stockData: {
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  reference?: string;
  price?: number;
  supplier?: string;
  date?: string;
  costStatus?: string;
  paidAmount?: number;
}): Promise<ApiResponse<InventoryItem>> {
  const response = await apiClient.request<InventoryItem>(`/inventory/${id}/stock`, {
    method: 'PUT',
    body: JSON.stringify(stockData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function getLowStockItems(): Promise<ApiResponse<InventoryItem[]>> {
  const response = await apiClient.request<InventoryItem[]>('/inventory/low-stock');
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getItemByBarcode(barcode: string): Promise<ApiResponse<InventoryItem>> {
  const response = await apiClient.request<InventoryItem>(`/inventory/barcode/${barcode}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function getBillingItemByBarcode(barcode: string): Promise<ApiResponse<InventoryItem>> {
  try {
    const token = localStorage.getItem('token');
    const apiUrl = API_BASE_URL + '/api';
    const response = await fetch(`${apiUrl}/inventory/barcode/${barcode}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (data.success && data.data) {
      data.data = apiClient.normalizeData(data.data);
    }
    return data;
  } catch {
    return { success: false, message: 'Network error' };
  }
}


async function deleteInventoryItem(id: string): Promise<ApiResponse> {
  return apiClient.request(`/inventory/${id}`, {
    method: 'DELETE',
  });
}


async function getStockMovements(id: string): Promise<ApiResponse<any[]>> {
  return apiClient.request(`/inventory/${id}/movements`, {
    method: 'GET',
  });
}


export const inventoryApi = {
  getInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  updateStock,
  getLowStockItems,
  getItemByBarcode,
  getBillingItemByBarcode,
  deleteInventoryItem,
  getStockMovements,
};
