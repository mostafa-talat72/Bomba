import { apiClient } from './client';
import type { ApiResponse, MenuCategory, MenuItem, MenuSection, MenuVariant } from './types';

async function getMenuItems(params?: {
  category?: string;
  search?: string;
  isAvailable?: boolean;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
  checkStock?: boolean; // معامل جديد للتحقق من توفر المخزون
}): Promise<ApiResponse<MenuItem[]>> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });
  }

  const response = await apiClient.request<MenuItem[]>(`/menu/items?${searchParams.toString()}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getMenuItem(id: string): Promise<ApiResponse<MenuItem>> {
  const response = await apiClient.request<MenuItem>(`/menu/items/${id}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function createMenuItem(itemData: {
  name: string;
  price?: number;
  variants?: MenuVariant[];
  category: string;
  description?: string;
  isAvailable?: boolean;
  preparationTime?: number;
  calories?: number;
  allergens?: string[];
  isPopular?: boolean;
  ingredients?: {
    item: string;
    quantity: number;
    unit: string;
  }[];
}): Promise<ApiResponse<MenuItem>> {
  const response = await apiClient.request<MenuItem>('/menu/items', {
    method: 'POST',
    body: JSON.stringify(itemData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updateMenuItem(id: string, updates: Partial<MenuItem>): Promise<ApiResponse<MenuItem>> {
  const response = await apiClient.request<MenuItem>(`/menu/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function deleteMenuItem(id: string): Promise<ApiResponse> {
  return apiClient.request(`/menu/items/${id}`, {
    method: 'DELETE',
  });
}


async function mergeMenuItems(itemIds: string[], name?: string): Promise<ApiResponse<MenuItem>> {
  const body: any = { itemIds };
  if (name !== undefined && name !== null && String(name).trim() !== '') {
    body.name = String(name).trim();
  }
  const response = await apiClient.request<MenuItem>('/menu/merge', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function getMenuItemsByCategory(category: string): Promise<ApiResponse<MenuItem[]>> {
  const response = await apiClient.request<MenuItem[]>(`/menu/category/${encodeURIComponent(category)}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getPopularMenuItems(limit?: number): Promise<ApiResponse<MenuItem[]>> {
  const searchParams = new URLSearchParams();
  if (limit) {
    searchParams.append('limit', limit.toString());
  }

  const response = await apiClient.request<MenuItem[]>(`/menu/items/popular?${searchParams.toString()}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getMenuStats(): Promise<ApiResponse<any>> {
  return apiClient.request('/menu/stats');
}


async function incrementMenuItemOrderCount(id: string): Promise<ApiResponse<any>> {
  return apiClient.request(`/menu/items/${id}/increment-order`, {
    method: 'POST',
  });
}


async function getMenuSections(): Promise<ApiResponse<MenuSection[]>> {
  const response = await apiClient.request<MenuSection[]>('/menu/sections');
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getMenuSection(id: string): Promise<ApiResponse<MenuSection>> {
  const response = await apiClient.request<MenuSection>(`/menu/sections/${id}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function createMenuSection(sectionData: {
  name: string;
  description?: string;
  sortOrder?: number;
}): Promise<ApiResponse<MenuSection>> {
  const response = await apiClient.request<MenuSection>('/menu/sections', {
    method: 'POST',
    body: JSON.stringify(sectionData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updateMenuSection(id: string, updates: Partial<MenuSection>): Promise<ApiResponse<MenuSection>> {
  const response = await apiClient.request<MenuSection>(`/menu/sections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function deleteMenuSection(id: string): Promise<ApiResponse> {
  return apiClient.request(`/menu/sections/${id}`, {
    method: 'DELETE',
  });
}


async function getMenuCategories(params?: { section?: string }): Promise<ApiResponse<MenuCategory[]>> {
  const searchParams = new URLSearchParams();
  if (params?.section) {
    searchParams.append('section', params.section);
  }
  const response = await apiClient.request<MenuCategory[]>(`/menu/categories-all?${searchParams.toString()}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getMenuCategory(id: string): Promise<ApiResponse<MenuCategory>> {
  const response = await apiClient.request<MenuCategory>(`/menu/categories/${id}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function createMenuCategory(categoryData: {
  name: string;
  description?: string;
  section: string;
  sortOrder?: number;
}): Promise<ApiResponse<MenuCategory>> {
  const response = await apiClient.request<MenuCategory>('/menu/categories', {
    method: 'POST',
    body: JSON.stringify(categoryData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updateMenuCategory(id: string, updates: Partial<MenuCategory>): Promise<ApiResponse<MenuCategory>> {
  const response = await apiClient.request<MenuCategory>(`/menu/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function deleteMenuCategory(id: string): Promise<ApiResponse> {
  return apiClient.request(`/menu/categories/${id}`, {
    method: 'DELETE',
  });
}


export const menuApi = {
  getMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  mergeMenuItems,
  getMenuItemsByCategory,
  getPopularMenuItems,
  getMenuStats,
  incrementMenuItemOrderCount,
  getMenuSections,
  getMenuSection,
  createMenuSection,
  updateMenuSection,
  deleteMenuSection,
  getMenuCategories,
  getMenuCategory,
  createMenuCategory,
  updateMenuCategory,
  deleteMenuCategory,
};
