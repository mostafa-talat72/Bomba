import { apiClient } from './client';
import { getInstanceId } from '../../utils/instanceId';
import type { ApiResponse } from './types';

async function getVersion(): Promise<ApiResponse<any>> {
  return apiClient.request('/update/version');
}

async function checkPeerVersions(): Promise<ApiResponse<any>> {
  return apiClient.request('/update/check');
}

async function downloadUpdate(fileName = 'MTE-Systems-Setup.exe'): Promise<{ ok: boolean; message?: string }> {
  // Raw fetch (not apiClient.request) to receive binary + trigger browser download.
  // Same pattern as settingsApi.downloadBackup in settings.ts.
  try {
    const headers: Record<string, string> = { 'x-instance-id': getInstanceId() };
    const token = apiClient.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${(apiClient as any).baseURL}/update/download`, { headers });
    if (!response.ok) {
      let message = 'فشل تنزيل المثبت';
      try {
        const data = await response.json();
        if (data?.message) message = data.message;
      } catch {}
      return { ok: false, message };
    }
    // Prefer the server-sent filename, fall back to the given name.
    let resolvedName = fileName;
    try {
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      if (match && match[1]) resolvedName = decodeURIComponent(match[1].replace(/"/g, '').trim());
    } catch {}
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = resolvedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 5000);
    return { ok: true };
  } catch {
    return { ok: false, message: 'خطأ في الاتصال بالخادم أثناء التنزيل' };
  }
}

export const updateApi = {
  getVersion,
  checkPeerVersions,
  downloadUpdate,
};
