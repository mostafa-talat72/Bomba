import { apiClient } from './client';
import type { ApiResponse, Bill } from './types';

async function getNotifications(options?: { category?: string; unreadOnly?: boolean; limit?: number }): Promise<ApiResponse<any[]>> {
  const params = new URLSearchParams();
  if (options?.category) params.append('category', options.category);
  if (options?.unreadOnly) params.append('unreadOnly', 'true');
  if (options?.limit) params.append('limit', options.limit.toString());

  return apiClient.request(`/notifications?${params.toString()}`);
}


async function getNotificationStats(): Promise<ApiResponse<any>> {
  return apiClient.request('/notifications/stats');
}


async function markNotificationAsRead(notificationId: string): Promise<ApiResponse<any>> {
  return apiClient.request(`/notifications/${notificationId}/read`, {
    method: 'PUT'
  });
}


async function markAllNotificationsAsRead(): Promise<ApiResponse<any>> {
  return apiClient.request('/notifications/read-all', {
    method: 'POST'  // Changed from PUT to POST to match backend route
  });
}


async function deleteNotification(notificationId: string): Promise<ApiResponse<any>> {
  return apiClient.request(`/notifications/${notificationId}`, {
    method: 'DELETE'
  });
}


async function createNotification(notificationData: any): Promise<ApiResponse<any>> {
  return apiClient.request('/notifications', {
    method: 'POST',
    body: JSON.stringify(notificationData)
  });
}


async function sendNotificationToRole(role: string, notificationData: any): Promise<ApiResponse<any>> {
  return apiClient.request(`/notifications/role/${role}`, {
    method: 'POST',
    body: JSON.stringify(notificationData)
  });
}


async function sendNotificationToPermission(permission: string, notificationData: any): Promise<ApiResponse<any>> {
  return apiClient.request(`/notifications/permission/${permission}`, {
    method: 'POST',
    body: JSON.stringify(notificationData)
  });
}


async function broadcastNotification(notificationData: any): Promise<ApiResponse<any>> {
  return apiClient.request('/notifications/broadcast', {
    method: 'POST',
    body: JSON.stringify(notificationData)
  });
}


async function cleanExpiredNotifications(): Promise<ApiResponse<any>> {
  return apiClient.request('/notifications/clean-expired', {
    method: 'DELETE'
  });
}


async function getAvailableBillsForSession(type: 'playstation' | 'computer'): Promise<ApiResponse<Bill[]>> {
  return apiClient.request<Bill[]>(`/bills/available-for-session?type=${type}`);
}


export const notificationsApi = {
  getNotifications,
  getNotificationStats,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  createNotification,
  sendNotificationToRole,
  sendNotificationToPermission,
  broadcastNotification,
  cleanExpiredNotifications,
  getAvailableBillsForSession,
};
