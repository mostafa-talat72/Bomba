import { apiClient } from './client';
import type { ApiResponse, InventoryItem, WarehouseItem } from './types';

async function getWarehouseItems(params?: { category?: string; lowStock?: string; search?: string; page?: number; limit?: number }): Promise<ApiResponse<WarehouseItem[]>> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.append(key, value.toString());
    });
  }
  const qs = searchParams.toString();
  const response = await apiClient.request<WarehouseItem[]>(`/warehouse${qs ? `?${qs}` : ''}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getWarehouseItem(id: string): Promise<ApiResponse<WarehouseItem>> {
  const response = await apiClient.request<WarehouseItem>(`/warehouse/${id}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function createWarehouseItem(itemData: Partial<WarehouseItem> & { costStatus?: string; paidAmount?: number }): Promise<ApiResponse<WarehouseItem>> {
  const response = await apiClient.request<WarehouseItem>('/warehouse', {
    method: 'POST',
    body: JSON.stringify(itemData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updateWarehouseItem(id: string, updates: Partial<WarehouseItem>): Promise<ApiResponse<WarehouseItem>> {
  const response = await apiClient.request<WarehouseItem>(`/warehouse/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updateWarehouseStock(id: string, stockData: {
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  reference?: string;
  price?: number;
  supplier?: string;
  date?: string;
  costStatus?: string;
  paidAmount?: number;
}): Promise<ApiResponse<WarehouseItem>> {
  const response = await apiClient.request<WarehouseItem>(`/warehouse/${id}/stock`, {
    method: 'PUT',
    body: JSON.stringify(stockData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function getWarehouseStockMovements(id: string): Promise<ApiResponse<any[]>> {
  return apiClient.request(`/warehouse/${id}/movements`, {
    method: 'GET',
  });
}


async function deleteWarehouseItem(id: string): Promise<ApiResponse> {
  return apiClient.request(`/warehouse/${id}`, {
    method: 'DELETE',
  });
}


async function transferToInventory(data: {
  warehouseItemId: string;
  inventoryItemId?: string;
  quantity: number;
  price?: number;
  date?: string;
  reason?: string;
}): Promise<ApiResponse<{ warehouseItem: WarehouseItem; inventoryItem: InventoryItem }>> {
  return apiClient.request('/warehouse/transfer-to-inventory', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


async function returnToWarehouse(data: {
  inventoryItemId: string;
  warehouseItemId: string;
  quantity: number;
  price?: number;
  date?: string;
  reason?: string;
}): Promise<ApiResponse<{ warehouseItem: WarehouseItem; inventoryItem: InventoryItem }>> {
  return apiClient.request('/warehouse/return-to-warehouse', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


export const warehouseApi = {
  getWarehouseItems,
  getWarehouseItem,
  createWarehouseItem,
  updateWarehouseItem,
  updateWarehouseStock,
  getWarehouseStockMovements,
  deleteWarehouseItem,
  transferToInventory,
  returnToWarehouse,
};
