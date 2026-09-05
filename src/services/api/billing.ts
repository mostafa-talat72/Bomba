import { apiClient } from './client';
import { getCachedBill, setCachedBill } from './client';
import type { ApiResponse, Bill, PayForItemsRequest, Payment } from './types';

async function getBills(params?: { status?: string; table?: string; page?: number; limit?: number; customerName?: string; q?: string; all?: boolean; fresh?: boolean }): Promise<ApiResponse<Bill[]>> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && key !== 'fresh') {
        searchParams.append(key, value.toString());
      }
    });
  }
  if (params?.fresh) {
    searchParams.append('_fresh', Date.now().toString());
  }

  const response = await apiClient.request<Bill[]>(`/billing?${searchParams.toString()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    },
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getBill(id: string): Promise<ApiResponse<Bill>> {
  const cached = getCachedBill(id);
  if (cached) {
    return { success: true, data: cached };
  }
  // إذا كان هناك توكن (مستخدم مسجل)، استخدم endpoint الخاص
  const token = apiClient.getToken && apiClient.getToken();
  let response: ApiResponse<Bill>;
  if (token) {
    response = await apiClient.request<Bill>(`/billing/${id}`);
  } else {
    response = await apiClient.publicRequest<Bill>(`/billing/public/${id}`);
  }
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
    setCachedBill(id, response.data);
  }
  return response;
}


async function createBill(billData: {
  table?: string;
  customerName?: string;
  customerPhone?: string;
  orders?: string[];
  sessions?: string[];
  discount?: number;
  tax?: number;
  notes?: string;
  billType?: 'cafe' | 'playstation' | 'computer';
  dueDate?: Date;
}): Promise<ApiResponse<Bill>> {
  const response = await apiClient.request<Bill>('/billing', {
    method: 'POST',
    body: JSON.stringify(billData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updateBill(id: string, updates: Partial<Bill>): Promise<ApiResponse<Bill>> {
  const response = await apiClient.request<Bill>(`/billing/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function recalculateBillTotals(id: string): Promise<ApiResponse<{
  billId: string;
  subtotal: number;
  total: number;
  paid: number;
  remaining: number;
  status: string;
}>> {
  return apiClient.request(`/billing/${id}/recalculate`, {
    method: 'POST',
  });
}


async function addPayment(id: string, paymentData: {
  amount: number;
  method: 'cash' | 'card' | 'transfer';
  reference?: string;
}): Promise<ApiResponse<Bill>> {
  const response = await apiClient.request<Bill>(`/billing/${id}/payment`, {
    method: 'POST',
    body: JSON.stringify(paymentData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updatePayment(id: string, paymentData: {
  paid: number;
  remaining: number;
  status: 'draft' | 'partial' | 'paid' | 'cancelled' | 'overdue';
  paymentAmount: number;
  method?: 'cash' | 'card' | 'transfer';
  reference?: string;
}): Promise<ApiResponse<Bill>> {
  const response = await apiClient.request<Bill>(`/billing/${id}/payment`, {
    method: 'PUT',
    body: JSON.stringify(paymentData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function addOrderToBill(id: string, orderId: string): Promise<ApiResponse<Bill>> {
  const response = await apiClient.request<Bill>(`/billing/${id}/orders`, {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function removeOrderFromBill(billId: string, orderId: string): Promise<ApiResponse<Bill>> {
  const response = await apiClient.request<Bill>(`/billing/${billId}/orders/${orderId}`, {
    method: 'DELETE',
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function addSessionToBill(id: string, sessionId: string): Promise<ApiResponse<Bill>> {
  const response = await apiClient.request<Bill>(`/billing/${id}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function cancelBill(id: string): Promise<ApiResponse<Bill>> {
  const response = await apiClient.request<Bill>(`/billing/${id}/cancel`, {
    method: 'PUT',
  });

  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }

  return response;
}


async function deleteBill(id: string): Promise<ApiResponse<boolean>> {
  const response = await apiClient.request<boolean>(`/billing/${id}`, {
    method: 'DELETE',
  });
  return response;
}


async function getBillItems(id: string): Promise<ApiResponse<any[]>> {
  const response = await apiClient.request<any[]>(`/billing/${id}/items`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function addPartialPayment(id: string, paymentData: {
  items: Array<{
    itemId: string;
    quantity: number;
  }>;
  paymentMethod: 'cash' | 'card' | 'transfer';
}): Promise<ApiResponse<Bill>> {
  const response = await apiClient.request<Bill>(`/billing/${id}/partial-payment`, {
    method: 'POST',
    body: JSON.stringify(paymentData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


/**
 * Get aggregated bill items (Backend processed)
 */
async function getBillAggregatedItems(id: string): Promise<ApiResponse<{
  bill: Bill;
  aggregatedItems: Array<{
    id: string;
    name: string;
    price: number;
    totalQuantity: number;
    paidQuantity: number;
    remainingQuantity: number;
    addons?: Array<{ name: string; price: number }>;
    hasAddons?: boolean;
    orderId: string;
  }>;
}>> {
  const response = await apiClient.request<{
    bill: Bill;
    aggregatedItems: Array<{
      id: string;
      name: string;
      price: number;
      totalQuantity: number;
      paidQuantity: number;
      remainingQuantity: number;
      addons?: Array<{ name: string; price: number }>;
      hasAddons?: boolean;
      orderId: string;
    }>;
  }>(`/billing/${id}/aggregated-items`);
  return response;
}


/**
 * Add partial payment with backend aggregation
 */
async function addPartialPaymentAggregated(id: string, paymentData: {
  items: Array<{
    itemId: string;
    quantity: number;
  }>;
  paymentMethod: 'cash' | 'card' | 'transfer';
}): Promise<ApiResponse<Bill>> {
  const response = await apiClient.request<Bill>(`/billing/${id}/partial-payment-aggregated`, {
    method: 'POST',
    body: JSON.stringify(paymentData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


/**
 * Update bill items aggregated (unified bill edit)
 */
async function updateBillAggregatedItems(id: string, data: {
  items: Array<{
    menuItem?: string;
    name?: string;
    price?: number;
    quantity: number;
    notes?: string | null;
    variant?: string | null;
  }>;
}): Promise<ApiResponse<Bill>> {
  const response = await apiClient.request<Bill>(`/billing/${id}/items-aggregated`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


/**
 * Pay for specific quantities of items in a bill
 * 
 * @param id - Bill ID
 * @param paymentData - Payment data including items with quantities and payment method
 * @returns Updated bill with payment information
 * 
 * @throws {ApiResponse} Possible error messages:
 * - "يجب إدخال كمية صحيحة أكبر من صفر" - Invalid quantity (zero or negative)
 * - "الكمية المطلوبة ({quantity}) أكبر من الكمية المتبقية ({remainingQuantity})" - Quantity exceeds remaining
 * - "الصنف '{itemName}' مدفوع بالكامل" - Item already fully paid
 * - "الصنف غير موجود في الفاتورة" - Item not found in bill
 * - "الفاتورة غير موجودة" - Bill not found
 * - "لا يمكن دفع أصناف من فاتورة مدفوعة بالكامل" - Bill already paid
 * - "لا يمكن دفع أصناف من فاتورة ملغاة" - Bill cancelled
 */
async function payForItems(id: string, paymentData: PayForItemsRequest): Promise<ApiResponse<Bill>> {
  const response = await apiClient.request<Bill>(`/billing/${id}/pay-items`, {
    method: 'POST',
    body: JSON.stringify(paymentData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function paySessionPartial(id: string, paymentData: {
  sessionId: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
}): Promise<ApiResponse<Bill>> {
  const response = await apiClient.request<Bill>(`/billing/${id}/pay-session-partial`, {
    method: 'POST',
    body: JSON.stringify(paymentData),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updateSessionPayment(
  billId: string,
  sessionId: string,
  paymentIndex: number,
  paymentData: {
    amount: number;
    method: 'cash' | 'card' | 'transfer';
    reference?: string;
  }
): Promise<ApiResponse<Bill>> {
  const response = await apiClient.request<Bill>(
    `/billing/${billId}/session-payments/${sessionId}/${paymentIndex}`,
    {
      method: 'PUT',
      body: JSON.stringify(paymentData),
    }
  );
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function updateItemPayment(
  billId: string,
  itemPaymentId: string,
  paymentIndex: number,
  paymentData: {
    quantity: number;
    method: 'cash' | 'card' | 'transfer';
    reference?: string;
  }
): Promise<ApiResponse<Bill>> {
  const response = await apiClient.request<Bill>(
    `/billing/${billId}/item-payments/${itemPaymentId}/${paymentIndex}`,
    {
      method: 'PUT',
      body: JSON.stringify(paymentData),
    }
  );
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


export const billingApi = {
  getBills,
  getBill,
  createBill,
  updateBill,
  recalculateBillTotals,
  addPayment,
  updatePayment,
  addOrderToBill,
  removeOrderFromBill,
  addSessionToBill,
  cancelBill,
  deleteBill,
  getBillItems,
  addPartialPayment,
  getBillAggregatedItems,
  addPartialPaymentAggregated,
  updateBillAggregatedItems,
  payForItems,
  paySessionPartial,
  updateSessionPayment,
  updateItemPayment,
};
