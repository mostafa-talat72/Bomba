import { apiClient } from './client';
import type { ApiResponse } from './types';

async function printBill(data: {
  bill: any;
  organization: any;
  language?: string;
  tableSectionName?: string;
  drawerMode?: 'bill' | 'payment';
}): Promise<ApiResponse<any>> {
  return apiClient.request('/print/bill', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


/**
 * اكتشاف تلقائي وطباعة الفاتورة مباشرة
 * بدون الحاجة لتحديد الطابعة يدوياً
 */
async function autoDetectAndPrintBill(data: {
  bill: any;
  organization: any;
  language?: string;
  tableSectionName?: string;
  drawerMode?: 'bill' | 'payment';
}): Promise<ApiResponse<any>> {
  return apiClient.request('/print/bill/auto-detect', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


async function printOrder(data: {
  order: any;
  organization: any;
  language?: string;
}): Promise<ApiResponse<any>> {
  return apiClient.request('/print/order', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


/**
 * اكتشاف تلقائي وطباعة الطلب مباشرة
 * بدون الحاجة لتحديد الطابعة يدوياً
 */
async function autoDetectAndPrintOrder(data: {
  order: any;
  organization: any;
  language?: string;
}): Promise<ApiResponse<any>> {
  return apiClient.request('/print/order/auto-detect', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


async function autoDetectAndOpenCashDrawer(mode: 'bill' | 'payment' = 'payment', organization?: any): Promise<ApiResponse<any>> {
  return apiClient.request('/print/cash-drawer/auto-detect', {
    method: 'POST',
    body: JSON.stringify({ mode, organization }),
  });
}


async function printConsumptionReport(data: {
  reportData: any;
  organization: any;
  language?: string;
}): Promise<ApiResponse<any>> {
  return apiClient.request('/print/consumption-report', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


async function detectPrinters(printerType: string = 'usb'): Promise<ApiResponse<any>> {
  return apiClient.request(`/print/detect?printerType=${printerType}`);
}


async function testPrinter(data: {
  printerPath: string;
  printerType?: string;
}): Promise<ApiResponse<any>> {
  return apiClient.request('/print/test', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


async function saveDevicePrinter(data: {
  printerPath: string;
  printerName: string;
  deviceId?: string;
}): Promise<ApiResponse<any>> {
  return apiClient.request('/print/device', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


async function getDevicePrinter(deviceId?: string): Promise<ApiResponse<any>> {
  const query = deviceId ? `?deviceId=${deviceId}` : '';
  return apiClient.request(`/print/device${query}`);
}


async function openCashDrawerOnly(organization: any): Promise<ApiResponse<any>> {
  return apiClient.request('/print/open-cash-drawer', {
    method: 'POST',
    body: JSON.stringify({ organization }),
  });
}



export const printApi = {
  printBill,
  autoDetectAndPrintBill,
  printOrder,
  autoDetectAndPrintOrder,
  autoDetectAndOpenCashDrawer,
  printConsumptionReport,
  detectPrinters,
  testPrinter,
  saveDevicePrinter,
  getDevicePrinter,
  openCashDrawerOnly,
};
