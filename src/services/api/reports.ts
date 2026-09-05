import { apiClient } from './client';
import type { ApiResponse } from './types';

async function getDashboardStats(period?: string): Promise<ApiResponse<any>> {
  const searchParams = new URLSearchParams();
  if (period) {
    searchParams.append('period', period);
  }

  return apiClient.request(`/reports/dashboard?${searchParams.toString()}`);
}


async function getSalesReport(filter: any = {}, groupBy?: string): Promise<ApiResponse<any>> {
  const searchParams = new URLSearchParams();
  if (filter && typeof filter === 'object') {
    Object.entries(filter).forEach(([key, value]) => {
      if (value) {
        searchParams.append(key, String(value));
      }
    });
  }
  if (groupBy) searchParams.append('groupBy', groupBy);

  return apiClient.request(`/reports/sales?${searchParams.toString()}`);
}


async function getInventoryReport(category?: string): Promise<ApiResponse<any>> {
  const searchParams = new URLSearchParams();
  if (category) {
    searchParams.append('category', category);
  }

  return apiClient.request(`/reports/inventory?${searchParams.toString()}`);
}


async function getFinancialReport(filter: any = {}): Promise<ApiResponse<any>> {
  const searchParams = new URLSearchParams();
  if (filter && typeof filter === 'object') {
    Object.entries(filter).forEach(([key, value]) => {
      if (value) {
        searchParams.append(key, String(value));
      }
    });
  }

  // Ensure period is set if no filter is provided
  if (!searchParams.has('period') && !searchParams.has('type')) {
    searchParams.append('period', 'today');
  }

  const response = await apiClient.request<any>(`/reports/financial?${searchParams.toString()}`);
  return response;
}


async function exportReportToExcel(reportType: string, filter: any = {}): Promise<Blob> {
  const searchParams = new URLSearchParams();
  searchParams.append('reportType', reportType);
  if (filter && typeof filter === 'object') {
    Object.entries(filter).forEach(([key, value]) => {
      if (value) {
        searchParams.append(key, String(value));
      }
    });
  } else if (typeof filter === 'string') {
    searchParams.append('period', filter);
  }

  if (!searchParams.has('period') && !searchParams.has('type')) {
    searchParams.append('period', 'today');
  }

  const response = await fetch(`${apiClient.baseURL}/reports/export/excel?${searchParams.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiClient.getToken()}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to export report');
  }

  return response.blob();
}


async function exportReportToPDF(reportType: string, filter: any = {}): Promise<Blob> {
  const searchParams = new URLSearchParams();
  searchParams.append('reportType', reportType);
  if (filter && typeof filter === 'object') {
    Object.entries(filter).forEach(([key, value]) => {
      if (value) {
        searchParams.append(key, String(value));
      }
    });
  } else if (typeof filter === 'string') {
    searchParams.append('period', filter);
  }

  if (!searchParams.has('period') && !searchParams.has('type')) {
    searchParams.append('period', 'today');
  }

  const response = await fetch(`${apiClient.baseURL}/reports/export/pdf?${searchParams.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiClient.getToken()}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to export report');
  }

  return response.blob();
}


async function getSessionsReport(filter: any = {}, device?: string): Promise<ApiResponse<any>> {
  const searchParams = new URLSearchParams();
  if (filter && typeof filter === 'object') {
    Object.entries(filter).forEach(([key, value]) => {
      if (value) {
        searchParams.append(key, String(value));
      }
    });
  }
  if (device) searchParams.append('device', device);

  return apiClient.request(`/reports/sessions?${searchParams.toString()}`);
}


async function getRecentActivity(limit?: number): Promise<ApiResponse<any[]>> {
  try {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());

    const response = await apiClient.request<any[]>(`/reports/recent-activity?${params}`);
    return response;
  } catch (error: unknown) {
    // Let the error propagate with its original message
    throw error;
  }
}


async function getSoldItems(dateFilter?: string, startDate?: string, endDate?: string): Promise<ApiResponse<any[]>> {
  try {
    const params = new URLSearchParams();
    if (dateFilter) params.append('dateFilter', dateFilter);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await apiClient.request<any[]>(`/reports/sold-items?${params}`);
    return response;
  } catch (error: unknown) {
    throw error;
  }
}


export const reportsApi = {
  getDashboardStats,
  getSalesReport,
  getInventoryReport,
  getFinancialReport,
  exportReportToExcel,
  exportReportToPDF,
  getSessionsReport,
  getRecentActivity,
  getSoldItems,
};
