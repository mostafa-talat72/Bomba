import { apiClient } from './client';
import type { ApiResponse, User } from './types';

async function getSettings(category: string): Promise<ApiResponse<any>> {
  return apiClient.request(`/settings/${category}`);
}


async function updateSettings(category: string, settings: any): Promise<ApiResponse<any>> {
  return apiClient.request(`/settings/${category}`, {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  });
}


async function getAllSettings(): Promise<ApiResponse<any[]>> {
  return apiClient.request('/settings');
}


async function resetSettings(category: string): Promise<ApiResponse<any>> {
  return apiClient.request(`/settings/${category}/reset`, {
    method: 'POST',
  });
}


async function exportSettings(): Promise<ApiResponse<any>> {
  return apiClient.request('/settings/export');
}


async function importSettings(settings: any): Promise<ApiResponse<any>> {
  return apiClient.request('/settings/import', {
    method: 'POST',
    body: JSON.stringify({ settings }),
  });
}


async function getUserProfile(): Promise<ApiResponse<User>> {
  return apiClient.request('/settings/profile');
}


async function updateUserProfile(profileData: {
  name: string;
  email: string;
  phone?: string;
  address?: string;
}): Promise<ApiResponse<User>> {
  const response = await apiClient.request<User>('/settings/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
  
  // Normalize the user data if the request was successful
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  
  return response;
}


async function changePassword(passwordData: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ApiResponse<any>> {
  return apiClient.request('/settings/change-password', {
    method: 'PUT',
    body: JSON.stringify(passwordData),
  });
}


async function getNotificationSettings(): Promise<ApiResponse<any>> {
  return apiClient.request('/settings/notifications');
}


async function updateNotificationSettings(settings: any): Promise<ApiResponse<any>> {
  return apiClient.request('/settings/notifications', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  });
}


async function getGeneralSettings(): Promise<ApiResponse<any>> {
  return apiClient.request('/settings/general');
}


async function updateGeneralSettings(settings: { theme?: string; language?: string }): Promise<ApiResponse<any>> {
  return apiClient.request('/settings/general', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}


async function createBackup(backupPath?: string): Promise<ApiResponse<any>> {
  return apiClient.request('/backup/create', {
    method: 'POST',
    body: JSON.stringify({ backupPath }),
  });
}


async function getBackups(): Promise<ApiResponse<any>> {
  return apiClient.request('/backup');
}


async function restoreBackup(fileName: string): Promise<ApiResponse<any>> {
  return apiClient.request(`/backup/restore/${fileName}`, {
    method: 'POST',
  });
}


async function deleteBackup(fileName: string): Promise<ApiResponse<any>> {
  return apiClient.request(`/backup/${fileName}`, {
    method: 'DELETE',
  });
}


export const settingsApi = {
  getSettings,
  updateSettings,
  getAllSettings,
  resetSettings,
  exportSettings,
  importSettings,
  getUserProfile,
  updateUserProfile,
  changePassword,
  getNotificationSettings,
  updateNotificationSettings,
  getGeneralSettings,
  updateGeneralSettings,
  createBackup,
  getBackups,
  restoreBackup,
  deleteBackup,
};
