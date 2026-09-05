import { apiClient } from './client';
import type { ApiResponse, Order, Table, TableSection } from './types';

async function getTableSections(): Promise<ApiResponse<TableSection[]>> {
  const response = await apiClient.request<TableSection[]>('/tables/sections');
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getTableSection(id: string): Promise<ApiResponse<TableSection>> {
  const response = await apiClient.request<TableSection>(`/tables/sections/${id}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function createTableSection(sectionData: {
  name: string;
  description?: string;
  sortOrder?: number;
}): Promise<ApiResponse<TableSection>> {
  const response = await apiClient.request<TableSection>('/tables/sections', {
    method: 'POST',
    body: JSON.stringify(sectionData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updateTableSection(id: string, updates: Partial<TableSection>): Promise<ApiResponse<TableSection>> {
  const response = await apiClient.request<TableSection>(`/tables/sections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function deleteTableSection(id: string): Promise<ApiResponse> {
  return apiClient.request(`/tables/sections/${id}`, {
    method: 'DELETE',
  });
}


async function getTables(params?: { section?: string }): Promise<ApiResponse<Table[]>> {
  const searchParams = new URLSearchParams();
  if (params?.section) {
    searchParams.append('section', params.section);
  }
  const response = await apiClient.request<Table[]>(`/tables/tables?${searchParams.toString()}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getTable(id: string): Promise<ApiResponse<Table>> {
  const response = await apiClient.request<Table>(`/tables/tables/${id}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function getTableStatus(id: string): Promise<ApiResponse<{ table: Table; hasUnpaidOrders: boolean; orders: Order[] }>> {
  const response = await apiClient.request<{ table: Table; hasUnpaidOrders: boolean; orders: Order[] }>(`/tables/tables/${id}/status`);
  if (response.success && response.data) {
    response.data = {
      ...response.data,
      table: apiClient.normalizeData(response.data.table),
      orders: apiClient.normalizeArray(response.data.orders),
    };
  }
  return response;
}


async function syncTableStatus(id: string): Promise<ApiResponse<{ tableId: string; status: string }>> {
  return apiClient.request(`/tables/tables/${id}/status/sync`, { method: 'POST' });
}


async function createTable(tableData: {
  number: string | number;
  section: string;
}): Promise<ApiResponse<Table>> {
  const response = await apiClient.request<Table>('/tables/tables', {
    method: 'POST',
    body: JSON.stringify(tableData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updateTable(id: string, updates: Partial<Table>): Promise<ApiResponse<Table>> {
  const response = await apiClient.request<Table>(`/tables/tables/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function deleteTable(id: string): Promise<ApiResponse> {
  return apiClient.request(`/tables/tables/${id}`, {
    method: 'DELETE',
  });
}


async function getTodayOrdersStats(): Promise<ApiResponse<any>> {
  return apiClient.request('/orders/today-stats');
}


export const tablesApi = {
  getTableSections,
  getTableSection,
  createTableSection,
  updateTableSection,
  deleteTableSection,
  getTables,
  getTable,
  getTableStatus,
  syncTableStatus,
  createTable,
  updateTable,
  deleteTable,
  getTodayOrdersStats,
};
