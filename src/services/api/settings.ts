import { apiClient } from './client';
import { getInstanceId } from '../../utils/instanceId';
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


async function createBackup(backupPath?: string, password?: string): Promise<ApiResponse<any>> {
  return apiClient.request('/backup/create', {
    method: 'POST',
    body: JSON.stringify({ backupPath, password: password || undefined }),
  });
}


async function getBackups(): Promise<ApiResponse<any>> {
  return apiClient.request('/backup');
}


async function restoreBackup(fileName: string, password?: string): Promise<ApiResponse<any>> {
  return apiClient.request(`/backup/restore/${fileName}`, {
    method: 'POST',
    body: JSON.stringify({ password: password || undefined }),
  });
}


async function verifyBackup(fileName: string, password?: string): Promise<ApiResponse<any>> {
  return apiClient.request(`/backup/verify/${fileName}`, {
    method: 'POST',
    body: JSON.stringify({ password: password || undefined }),
  });
}


async function downloadBackup(fileName: string): Promise<{ ok: boolean; blob?: Blob; message?: string }> {
  // Raw fetch (not apiClient.request) to receive binary + trigger browser download.
  try {
    const headers: Record<string, string> = { 'x-instance-id': getInstanceId() };
    const token = apiClient.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${(apiClient as any).baseURL}/backup/download/${encodeURIComponent(fileName)}`, { headers });
    if (!response.ok) {
      let message = 'فشل تنزيل النسخة الاحتياطية';
      try {
        const data = await response.json();
        if (data?.message) message = data.message;
      } catch {}
      return { ok: false, message };
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 5000);
    return { ok: true };
  } catch {
    return { ok: false, message: 'خطأ في الاتصال بالخادم أثناء التنزيل' };
  }
}


async function deleteBackup(fileName: string): Promise<ApiResponse<any>> {
  return apiClient.request(`/backup/${fileName}`, {
    method: 'DELETE',
  });
}


async function importBackup(file: File): Promise<ApiResponse<any>> {
  // Multipart upload — must NOT set Content-Type (browser sets the boundary).
  try {
    const form = new FormData();
    form.append('file', file, file.name);
    const headers: Record<string, string> = { 'x-instance-id': getInstanceId() };
    const token = apiClient.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${(apiClient as any).baseURL}/backup/import`, {
      method: 'POST',
      headers,
      body: form,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      return { success: false, message: data.message || 'فشل استيراد النسخة الاحتياطية' };
    }
    return { success: true, message: data.message, data: data.data };
  } catch {
    return { success: false, message: 'خطأ في الاتصال بالخادم أثناء الاستيراد' };
  }
}


async function getBackupSettings(): Promise<ApiResponse<any>> {
  return apiClient.request('/backup/settings');
}


async function saveBackupSettings(dir: string): Promise<ApiResponse<any>> {
  return apiClient.request('/backup/settings', {
    method: 'PUT',
    body: JSON.stringify({ dir }),
  });
}


async function getDeliveryZones(): Promise<ApiResponse<any[]>> {
  return apiClient.request('/delivery-zones');
}


async function createDeliveryZone(data: { name: string; fee: number }): Promise<ApiResponse<any>> {
  return apiClient.request('/delivery-zones', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


async function deleteDeliveryZone(id: string): Promise<ApiResponse<any>> {
  return apiClient.request(`/delivery-zones/${id}`, {
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
  importBackup,
  verifyBackup,
  downloadBackup,
  getBackupSettings,
  saveBackupSettings,
  getDeliveryZones,
  createDeliveryZone,
  deleteDeliveryZone,
};
