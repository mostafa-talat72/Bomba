import { apiClient } from './client';
import type { ApiResponse, Order, OrderItem } from './types';

async function getOrders(params?: { status?: string; customerName?: string; page?: number; limit?: number; startDate?: string; endDate?: string; reportEligible?: boolean }): Promise<ApiResponse<Order[]>> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });
  }

  const response = await apiClient.request<Order[]>(`/orders?${searchParams.toString()}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getOrder(id: string): Promise<ApiResponse<Order>> {
  const response = await apiClient.request<Order>(`/orders/${id}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function createOrder(orderData: {
  customerName: string;
  items: OrderItem[];
  notes?: string;
  preparationTime?: number;
}): Promise<ApiResponse<Order>> {
  // Validate order data before sending
  if (!orderData.customerName || !orderData.items || orderData.items.length === 0) {
    return {
      success: false,
      message: 'بيانات الطلب غير مكتملة'
    };
  }

  // Ensure all items have required fields
  for (const item of orderData.items) {
    if (!item.name || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
      return {
        success: false,
        message: 'بيانات العناصر غير مكتملة'
      };
    }
  }

  const response = await apiClient.request<Order>('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });

  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }

  return response;
}


async function calculateOrderRequirements(orderData: {
  customerName: string;
  items: OrderItem[];
  notes?: string;
}): Promise<ApiResponse<any>> {
  const response = await apiClient.request<any>('/orders/calculate', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });

  return response;
}


async function updateOrder(id: string, updates: Partial<Order>): Promise<ApiResponse<Order>> {
  try {

    const response = await apiClient.request<Order>(`/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    return response;
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : 'فشل في تحديث الطلب');
  }
}


async function updateOrderItemPrepared(orderId: string, itemIndex: number, data: { preparedCount: number }): Promise<ApiResponse<Order>> {
  return apiClient.request<Order>(`/orders/${orderId}/items/${itemIndex}/prepared`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}


async function deductOrderInventory(orderId: string): Promise<ApiResponse<Order>> {
  return apiClient.request<Order>(`/orders/${orderId}/deduct-inventory`, {
    method: 'POST',
  });
}


async function updateOrderStatus(orderId: string, status: 'draft' | 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'): Promise<ApiResponse<Order>> {
  return apiClient.request<Order>(`/orders/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}


async function deliverItem(orderId: string, itemIndex: number): Promise<ApiResponse<Order>> {
  return apiClient.request<Order>(`/orders/${orderId}/deliver-item/${itemIndex}`, {
    method: 'PUT',
  });
}


async function deliverOrderSection(orderId: string, sectionId: string): Promise<ApiResponse<Order>> {
  return apiClient.request<Order>(`/orders/${orderId}/deliver-section`, {
    method: 'PUT',
    body: JSON.stringify({ sectionId }),
  });
}


async function deleteOrder(id: string): Promise<ApiResponse> {
  return apiClient.request(`/orders/${id}`, {
    method: 'DELETE',
  });
}


async function getPendingOrders(): Promise<ApiResponse<Order[]>> {
  const response = await apiClient.request<Order[]>('/orders/pending');
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function cancelOrder(orderId: string): Promise<ApiResponse<Order>> {
  return apiClient.request<Order>(`/orders/${orderId}/cancel`, {
    method: 'PATCH',
  });
}


export const ordersApi = {
  getOrders,
  getOrder,
  createOrder,
  calculateOrderRequirements,
  updateOrder,
  updateOrderItemPrepared,
  deductOrderInventory,
  updateOrderStatus,
  deliverItem,
  deliverOrderSection,
  deleteOrder,
  getPendingOrders,
  cancelOrder,
};
