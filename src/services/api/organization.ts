import { apiClient } from './client';
import type { ApiResponse } from './types';

async function getOrganization(): Promise<ApiResponse<any>> {
  return apiClient.request('/organization');
}


async function getOrganizationById(id: string): Promise<ApiResponse<any>> {
  return apiClient.request(`/organization/${id}`);
}


async function updateOrganization(organizationData: {
  name?: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  currency?: string;
  timezone?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
    whatsapp?: string;
    telegram?: string;
  };
  workingHours?: any;
  logo?: string;
}): Promise<ApiResponse<any>> {
  return apiClient.request('/organization', {
    method: 'PUT',
    body: JSON.stringify(organizationData),
  });
}


async function updateOrganizationPermissions(permissions: {
  allowManagersToEditOrganization?: boolean;
  authorizedManagers?: string[];
}): Promise<ApiResponse<any>> {
  return apiClient.request('/organization/permissions', {
    method: 'PUT',
    body: JSON.stringify(permissions),
  });
}


async function canEditOrganization(): Promise<ApiResponse<any>> {
  return apiClient.request('/organization/can-edit');
}


async function getAvailableManagers(): Promise<ApiResponse<any>> {
  return apiClient.request('/organization/available-managers');
}


async function getReportSettings(): Promise<ApiResponse<any>> {
  return apiClient.request('/organization/report-settings');
}


async function updateReportSettings(settings: {
  dailyReportEnabled?: boolean;
  dailyReportStartTime?: string;
  dailyReportSendTime?: string;
  dailyReportEmails?: string[];
  authorizedToManageReports?: string[];
}): Promise<ApiResponse<any>> {
  return apiClient.request('/organization/report-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}


async function canManageReports(): Promise<ApiResponse<any>> {
  return apiClient.request('/organization/can-manage-reports');
}


async function sendReportNow(): Promise<ApiResponse<any>> {
  return apiClient.request('/organization/send-report-now', {
    method: 'POST',
  });
}


async function canManagePayroll(): Promise<ApiResponse<any>> {
  return apiClient.request('/organization/can-manage-payroll');
}


async function updatePayrollPermissions(permissions: {
  allowManagersToManagePayroll?: boolean;
  authorizedPayrollManagers?: string[];
}): Promise<ApiResponse<any>> {
  return apiClient.request('/organization/payroll-permissions', {
    method: 'PUT',
    body: JSON.stringify(permissions),
  });
}


export const organizationApi = {
  getOrganization,
  getOrganizationById,
  updateOrganization,
  updateOrganizationPermissions,
  canEditOrganization,
  getAvailableManagers,
  getReportSettings,
  updateReportSettings,
  canManageReports,
  sendReportNow,
  canManagePayroll,
  updatePayrollPermissions,
};
