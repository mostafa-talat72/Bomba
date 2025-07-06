const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  count?: number;
  total?: number;
}

export interface User {
  _id: string;
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'cashier' | 'kitchen';
  permissions: string[];
  status: 'active' | 'inactive' | 'suspended';
  lastLogin?: Date;
  avatar?: string;
  phone?: string;
  address?: string;
  createdAt: Date;
}

export interface Session {
  _id: string;
  id: string;
  deviceType: string;
  deviceNumber: number;
  deviceName: string;
  customerName?: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  controllers?: number;
  controllersHistory?: Array<{
    controllers: number;
    from: Date;
    to?: Date;
  }>;
  hourlyRate: number;
  totalCost: number;
  discount: number;
  finalCost: number;
  notes?: string;
  createdBy: User;
  updatedBy?: User;
  createdAt: Date;
}

export interface Order {
  _id: string;
  id: string;
  orderNumber: string;
  tableNumber?: number;
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  totalAmount?: number;
  subtotal?: number;
  discount?: number;
  finalAmount?: number;
  notes?: string;
  preparationTime?: number;
  estimatedReadyTime?: Date;
  actualReadyTime?: Date;
  deliveredTime?: Date;
  createdBy?: User;
  preparedBy?: User;
  deliveredBy?: User;
  createdAt: Date;
  bill?: {
    _id: string;
    billNumber: string;
  };
}

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  preparedCount?: number;
  notes?: string;
  additionalPrice?: number;
  inventoryItem?: string;
}

export interface InventoryItem {
  _id: string;
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock?: number;
  unit: string;
  price: number;
  cost: number;
  supplier?: string;
  supplierContact?: string;
  barcode?: string;
  description?: string;
  isActive: boolean;
  isRawMaterial: boolean;
  isLowStock: boolean;
  isOutOfStock: boolean;
  profitMargin: number;
  lastRestocked?: Date;
  expiryDate?: Date;
  createdAt: Date;
}

export interface Bill {
  _id: string;
  id: string;
  billNumber: string;
  tableNumber: number;
  customerName?: string;
  customerPhone?: string;
  orders: Order[];
  sessions: Session[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  remaining: number;
  status: 'draft' | 'partial' | 'paid' | 'cancelled' | 'overdue';
  paymentMethod: 'cash' | 'card' | 'transfer' | 'mixed';
  billType: 'cafe' | 'playstation' | 'computer';
  payments: Payment[];
  partialPayments?: Array<{
    orderId: string;
    orderNumber: string;
    items: Array<{
      itemName: string;
      price: number;
      quantity: number;
      paidAt: string;
      paidBy: string;
      paymentMethod: 'cash' | 'card' | 'transfer';
    }>;
    totalPaid: number;
  }>;
  qrCode?: string;
  qrCodeUrl?: string;
  notes?: string;
  dueDate?: Date;
  createdBy: User;
  createdAt: Date;
}

export interface Payment {
  amount: number;
  method: 'cash' | 'card' | 'transfer';
  reference?: string;
  timestamp: Date;
  user: User;
}

export interface Cost {
  _id: string;
  id: string;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  currency: string;
  date: Date;
  dueDate?: Date;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paymentMethod: string;
  receipt?: string;
  vendor?: string;
  vendorContact?: string;
  isRecurring: boolean;
  recurringPeriod?: string;
  nextDueDate?: Date;
  tags: string[];
  notes?: string;
  createdBy: User;
  createdAt: Date;
}

export interface Device {
  _id: string;
  id: string;
  name: string;
  number: number;
  type: string;
  status: string;
  controllers: number;
  createdAt: Date;
}

export interface MenuItem {
  _id: string;
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  isAvailable: boolean;
  orderCount: number;
  imageUrl?: string;
  preparationTime: number;
  calories?: number;
  allergens?: string[];
  isPopular: boolean;
  isNew: boolean;
  createdBy: User;
  updatedBy?: User;
  createdAt: Date;
}

export interface BillItem {
  orderId: string;
  orderNumber: string;
  itemName: string;
  price: number;
  quantity: number;
  originalQuantity?: number;
  paidQuantity?: number;
  totalPrice: number;
}

// API Client class
class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const config: RequestInit = {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      };

      if (this.getToken()) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${this.getToken()}`,
        };
      }

      console.log('🌐 API Request:', {
        url,
        method: config.method || 'GET',
        headers: config.headers,
        body: config.body ? (() => {
          try {
            return JSON.parse(config.body as string);
          } catch {
            return 'Invalid JSON';
          }
        })() : undefined
      });

      const response = await fetch(url, config);

      if (!response.ok && response.status === 0) {
        return {
          success: false,
          message: 'خطأ في الاتصال بالخادم، تأكد من أن الخادم يعمل'
        };
      }

      let data;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (jsonError) {
        console.error('❌ JSON parsing error:', jsonError);
        return {
          success: false,
          message: 'خطأ في تحليل البيانات المستلمة من الخادم'
        };
      }

      console.log('📥 API Response:', {
        url,
        status: response.status,
        success: data.success,
        message: data.message
      });

      if (!response.ok) {
        console.error('❌ API Error:', {
          status: response.status,
          statusText: response.statusText,
          data
        });

        if (response.status === 401) {
          this.clearToken();
          return {
            success: false,
            message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى'
          };
        }

        return {
          success: false,
          message: data.message || `خطأ ${response.status}: ${response.statusText}`
        };
      }

      return data;
    } catch (error) {
      console.error('❌ API Request failed:', error);

      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          success: false,
          message: 'خطأ في الاتصال بالخادم، تأكد من اتصالك بالإنترنت'
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ في الاتصال بالخادم'
      };
    }
  }

  // دالة للـ API calls العامة (لا تحتاج authentication)
  private async publicRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const config: RequestInit = {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      };

      console.log('🌐 Public API Request:', {
        url,
        method: config.method || 'GET',
        headers: config.headers,
        body: config.body ? (() => {
          try {
            return JSON.parse(config.body as string);
          } catch {
            return 'Invalid JSON';
          }
        })() : undefined
      });

      const response = await fetch(url, config);

      if (!response.ok && response.status === 0) {
        return {
          success: false,
          message: 'خطأ في الاتصال بالخادم، تأكد من أن الخادم يعمل'
        };
      }

      let data;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (jsonError) {
        console.error('❌ JSON parsing error:', jsonError);
        return {
          success: false,
          message: 'خطأ في تحليل البيانات المستلمة من الخادم'
        };
      }

      console.log('📥 Public API Response:', {
        url,
        status: response.status,
        success: data.success,
        message: data.message
      });

      if (!response.ok) {
        console.error('❌ Public API Error:', {
          status: response.status,
          statusText: response.statusText,
          data
        });

        return {
          success: false,
          message: data.message || `خطأ ${response.status}: ${response.statusText}`
        };
      }

      return data;
    } catch (error) {
      console.error('❌ Public API Request failed:', error);

      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          success: false,
          message: 'خطأ في الاتصال بالخادم، تأكد من اتصالك بالإنترنت'
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ في الاتصال بالخادم'
      };
    }
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  private getToken(): string | null {
    // تحديث التوكن من localStorage دائمًا
    this.token = localStorage.getItem('token');
    return this.token;
  }

  // Helper function to normalize data
  private normalizeData<T extends { _id?: string; id?: string }>(data: T): T & { id: string } {
    const normalized: any = {
      ...data,
      id: data.id || data._id || ''
    };

    // Convert date strings to Date objects
    if (normalized.startTime && typeof normalized.startTime === 'string') {
      normalized.startTime = new Date(normalized.startTime);
    }
    if (normalized.endTime && typeof normalized.endTime === 'string') {
      normalized.endTime = new Date(normalized.endTime);
    }
    if (normalized.createdAt && typeof normalized.createdAt === 'string') {
      normalized.createdAt = new Date(normalized.createdAt);
    }
    if (normalized.updatedAt && typeof normalized.updatedAt === 'string') {
      normalized.updatedAt = new Date(normalized.updatedAt);
    }

    // Convert controllersHistory dates
    if (normalized.controllersHistory && Array.isArray(normalized.controllersHistory)) {
      normalized.controllersHistory = normalized.controllersHistory.map((period: any) => ({
        ...period,
        from: typeof period.from === 'string' ? new Date(period.from) : period.from,
        to: period.to && typeof period.to === 'string' ? new Date(period.to) : period.to
      }));
    }

    return normalized;
  }

  private normalizeArray<T extends { _id?: string; id?: string }>(data: T[]): (T & { id: string })[] {
    return data.map(item => this.normalizeData(item));
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string; refreshToken: string }>> {
    const response = await this.request<{ user: User; token: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data?.token) {
      this.setToken(response.data.token);
      if (response.data.user) {
        response.data.user = this.normalizeData(response.data.user);
      }
    }

    return response;
  }

  async logout(): Promise<ApiResponse> {
    try {
      const response = await this.request('/auth/logout', {
        method: 'POST',
      });
      this.clearToken();
      return response;
    } catch (error) {
      this.clearToken();
      return { success: true, message: 'تم تسجيل الخروج' };
    }
  }

  async getMe(): Promise<ApiResponse<{ user: User }>> {
    const response = await this.request<{ user: User }>('/auth/me');
    if (response.success && response.data?.user) {
      response.data.user = this.normalizeData(response.data.user);
    }
    return response;
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<{ token: string; refreshToken: string }>> {
    return this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  // Sessions endpoints
  async getSessions(params?: { status?: string; device?: string; page?: number; limit?: number }): Promise<ApiResponse<Session[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const response = await this.request<Session[]>(`/sessions?${searchParams.toString()}`);
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async getSession(id: string): Promise<ApiResponse<Session>> {
    const response = await this.request<Session>(`/sessions/${id}`);
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async createSession(sessionData: {
    deviceType: string;
    deviceNumber: number;
    deviceName: string;
    customerName?: string;
    controllers?: number;
  }): Promise<ApiResponse<Session>> {
    const response = await this.request<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<ApiResponse<Session>> {
    const response = await this.request<Session>(`/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async endSession(id: string): Promise<ApiResponse<{ session: Session; bill?: any }>> {
    const response = await this.request<{ session: Session; bill?: any }>(`/sessions/${id}/end`, {
      method: 'PUT',
    });
    if (response.success && response.data) {
      response.data.session = this.normalizeData(response.data.session);
      if (response.data.bill) {
        response.data.bill = this.normalizeData(response.data.bill);
      }
    }
    return response;
  }

  async getActiveSessions(): Promise<ApiResponse<Session[]>> {
    const response = await this.request<Session[]>('/sessions/status/active');
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async updateSessionControllers(sessionId: string, controllers: number): Promise<ApiResponse<Session>> {
    return this.request<Session>(`/sessions/${sessionId}/controllers`, {
      method: 'PUT',
      body: JSON.stringify({ controllers }),
    });
  }

  // Orders endpoints
  async getOrders(params?: { status?: string; customerName?: string; page?: number; limit?: number }): Promise<ApiResponse<Order[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const response = await this.request<Order[]>(`/orders?${searchParams.toString()}`);
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async getOrder(id: string): Promise<ApiResponse<Order>> {
    const response = await this.request<Order>(`/orders/${id}`);
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async createOrder(orderData: {
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

    console.log('📤 API: Sending order data:', orderData);

    const response = await this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });

    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }

    console.log('📥 API: Order response:', response);
    return response;
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<ApiResponse<Order>> {
    try {
      const response = await this.request<Order>(`/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
      return response;
    } catch (error: any) {
      throw new Error(error.message || 'فشل في تحديث الطلب');
    }
  }

  async updateOrderItemPrepared(orderId: string, itemIndex: number, data: { preparedCount: number }): Promise<ApiResponse<Order>> {
    try {
      const response = await this.request<Order>(`/orders/${orderId}/item/${itemIndex}/prepared`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      return response;
    } catch (error: any) {
      throw new Error(error.message || 'فشل في تحديث حالة التجهيز');
    }
  }

  async deleteOrder(id: string): Promise<ApiResponse> {
    return this.request(`/orders/${id}`, {
      method: 'DELETE',
    });
  }

  async getPendingOrders(): Promise<ApiResponse<Order[]>> {
    const response = await this.request<Order[]>('/orders/pending');
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  // Inventory endpoints
  async getInventoryItems(params?: { category?: string; lowStock?: boolean; page?: number; limit?: number; search?: string }): Promise<ApiResponse<InventoryItem[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const response = await this.request<InventoryItem[]>(`/inventory?${searchParams.toString()}`);
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async getInventoryItem(id: string): Promise<ApiResponse<InventoryItem>> {
    const response = await this.request<InventoryItem>(`/inventory/${id}`);
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async createInventoryItem(itemData: Partial<InventoryItem>): Promise<ApiResponse<InventoryItem>> {
    const response = await this.request<InventoryItem>('/inventory', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<ApiResponse<InventoryItem>> {
    const response = await this.request<InventoryItem>(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async updateStock(id: string, stockData: {
    type: 'in' | 'out' | 'adjustment';
    quantity: number;
    reason: string;
    reference?: string;
  }): Promise<ApiResponse<InventoryItem>> {
    const response = await this.request<InventoryItem>(`/inventory/${id}/stock`, {
      method: 'PUT',
      body: JSON.stringify(stockData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async getLowStockItems(): Promise<ApiResponse<InventoryItem[]>> {
    const response = await this.request<InventoryItem[]>('/inventory/low-stock');
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async deleteInventoryItem(id: string): Promise<ApiResponse> {
    return this.request(`/inventory/${id}`, {
      method: 'DELETE',
    });
  }

  // Bills endpoints
  async getBills(params?: { status?: string; tableNumber?: number; page?: number; limit?: number; date?: string; customerName?: string }): Promise<ApiResponse<Bill[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const response = await this.request<Bill[]>(`/billing?${searchParams.toString()}`);
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async getBill(id: string): Promise<ApiResponse<Bill>> {
    const response = await this.publicRequest<Bill>(`/billing/public/${id}`);
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async createBill(billData: {
    tableNumber: number;
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
    const response = await this.request<Bill>('/billing', {
      method: 'POST',
      body: JSON.stringify(billData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async updateBill(id: string, updates: Partial<Bill>): Promise<ApiResponse<Bill>> {
    const response = await this.request<Bill>(`/billing/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async addPayment(id: string, paymentData: {
    amount: number;
    method: 'cash' | 'card' | 'transfer';
    reference?: string;
  }): Promise<ApiResponse<Bill>> {
    const response = await this.request<Bill>(`/billing/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async updatePayment(id: string, paymentData: {
    paid: number;
    remaining: number;
    status: 'draft' | 'partial' | 'paid' | 'cancelled' | 'overdue';
    paymentAmount: number;
    method?: 'cash' | 'card' | 'transfer';
    reference?: string;
  }): Promise<ApiResponse<Bill>> {
    const response = await this.request<Bill>(`/billing/${id}/payment`, {
      method: 'PUT',
      body: JSON.stringify(paymentData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async addOrderToBill(id: string, orderId: string): Promise<ApiResponse<Bill>> {
    const response = await this.request<Bill>(`/billing/${id}/orders`, {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async addSessionToBill(id: string, sessionId: string): Promise<ApiResponse<Bill>> {
    const response = await this.request<Bill>(`/billing/${id}/sessions`, {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async cancelBill(id: string): Promise<ApiResponse<Bill>> {
    console.log('🔄 API: cancelBill called with ID:', id);
    console.log('🔄 API: Making request to:', `/billing/${id}/cancel`);
    console.log('🔄 API: Request method: PUT');

    const response = await this.request<Bill>(`/billing/${id}/cancel`, {
      method: 'PUT',
    });

    console.log('📥 API: cancelBill response received:', response);

    if (response.success && response.data) {
      console.log('✅ API: Normalizing response data');
      response.data = this.normalizeData(response.data);
    }

    console.log('🔄 API: cancelBill returning:', response);
    return response;
  }

  async getBillItems(id: string): Promise<ApiResponse<any[]>> {
    const response = await this.request<any[]>(`/billing/${id}/items`);
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async addPartialPayment(id: string, paymentData: {
    orderId: string;
    items: Array<{
      itemName: string;
      price: number;
      quantity: number;
    }>;
    paymentMethod: 'cash' | 'card' | 'transfer';
  }): Promise<ApiResponse<Bill>> {
    const response = await this.request<Bill>(`/billing/${id}/partial-payment`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  // Costs endpoints
  async getCosts(params?: { category?: string; status?: string; page?: number; limit?: number; startDate?: string; endDate?: string; vendor?: string }): Promise<ApiResponse<Cost[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const response = await this.request<Cost[]>(`/costs?${searchParams.toString()}`);
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async getCost(id: string): Promise<ApiResponse<Cost>> {
    const response = await this.request<Cost>(`/costs/${id}`);
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async createCost(costData: Partial<Cost>): Promise<ApiResponse<Cost>> {
    const response = await this.request<Cost>('/costs', {
      method: 'POST',
      body: JSON.stringify(costData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async updateCost(id: string, updates: Partial<Cost>): Promise<ApiResponse<Cost>> {
    const response = await this.request<Cost>(`/costs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async approveCost(id: string): Promise<ApiResponse<Cost>> {
    const response = await this.request<Cost>(`/costs/${id}/approve`, {
      method: 'PUT',
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async deleteCost(id: string): Promise<ApiResponse> {
    return this.request(`/costs/${id}`, {
      method: 'DELETE',
    });
  }

  async getCostsSummary(period?: string): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (period) {
      searchParams.append('period', period);
    }

    return this.request(`/costs/summary?${searchParams.toString()}`);
  }

  // Reports endpoints
  async getDashboardStats(period?: string): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (period) {
      searchParams.append('period', period);
    }

    return this.request(`/reports/dashboard?${searchParams.toString()}`);
  }

  async getSalesReport(period?: string, groupBy?: string): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (period) searchParams.append('period', period);
    if (groupBy) searchParams.append('groupBy', groupBy);

    return this.request(`/reports/sales?${searchParams.toString()}`);
  }

  async getInventoryReport(category?: string): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (category) {
      searchParams.append('category', category);
    }

    return this.request(`/reports/inventory?${searchParams.toString()}`);
  }

  async getFinancialReport(period?: string): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (period) {
      searchParams.append('period', period);
    }

    return this.request(`/reports/financial?${searchParams.toString()}`);
  }

  async getSessionsReport(period?: string, device?: string): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (period) searchParams.append('period', period);
    if (device) searchParams.append('device', device);

    return this.request(`/reports/sessions?${searchParams.toString()}`);
  }

  async getRecentActivity(limit?: number): Promise<ApiResponse<any[]>> {
    try {
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());

      const response = await this.request<any[]>(`/reports/recent-activity?${params}`);
      return response;
    } catch (error) {
      throw new Error('فشل في جلب النشاط الأخير');
    }
  }

  // Users endpoints
  async getUsers(params?: { page?: number; limit?: number; role?: string; status?: string; search?: string }): Promise<ApiResponse<User[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const response = await this.request<User[]>(`/users?${searchParams.toString()}`);
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async getUser(id: string): Promise<ApiResponse<User>> {
    const response = await this.request<User>(`/users/${id}`);
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async createUser(userData: {
    name: string;
    email: string;
    password: string;
    role: string;
    status: string;
    phone?: string;
    address?: string;
    permissions: string[];
  }): Promise<ApiResponse<User>> {
    const response = await this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<ApiResponse<User>> {
    const response = await this.request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async deleteUser(id: string): Promise<ApiResponse> {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async getUserStats(): Promise<ApiResponse<any>> {
    return this.request('/users/stats/overview');
  }

  // Settings endpoints
  async getSettings(category: string): Promise<ApiResponse<any>> {
    return this.request(`/settings/${category}`);
  }

  async updateSettings(category: string, settings: any): Promise<ApiResponse<any>> {
    return this.request(`/settings/${category}`, {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
  }

  async getAllSettings(): Promise<ApiResponse<any[]>> {
    return this.request('/settings');
  }

  async resetSettings(category: string): Promise<ApiResponse<any>> {
    return this.request(`/settings/${category}/reset`, {
      method: 'POST',
    });
  }

  async exportSettings(): Promise<ApiResponse<any>> {
    return this.request('/settings/export');
  }

  async importSettings(settings: any): Promise<ApiResponse<any>> {
    return this.request('/settings/import', {
      method: 'POST',
      body: JSON.stringify({ settings }),
    });
  }

  // Device endpoints
  async getDevices(params?: {
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<ApiResponse<Device[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const response = await this.request<Device[]>(`/devices?${searchParams.toString()}`);
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async getDevice(id: string): Promise<ApiResponse<Device>> {
    const response = await this.request<Device>(`/devices/${id}`);
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async createDevice(deviceData: Partial<Device>): Promise<ApiResponse<Device>> {
    const response = await this.request<Device>('/devices', {
      method: 'POST',
      body: JSON.stringify(deviceData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async updateDevice(id: string, updates: Partial<Device>): Promise<ApiResponse<Device>> {
    const response = await this.request<Device>(`/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async updateDeviceStatus(id: string, status: string): Promise<ApiResponse<Device>> {
    const response = await this.request<Device>(`/devices/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async deleteDevice(id: string): Promise<ApiResponse> {
    return this.request(`/devices/${id}`, {
      method: 'DELETE',
    });
  }

  async getDeviceStats(): Promise<ApiResponse<any>> {
    return this.request('/devices/stats');
  }

  async bulkUpdateDevices(deviceIds: string[], updates: Partial<Device>): Promise<ApiResponse<any>> {
    return this.request('/devices/bulk/update', {
      method: 'PUT',
      body: JSON.stringify({ deviceIds, updates }),
    });
  }

  // Menu endpoints
  async getMenuItems(params?: {
    category?: string;
    search?: string;
    isAvailable?: boolean;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<MenuItem[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const response = await this.request<MenuItem[]>(`/menu/items?${searchParams.toString()}`);
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async getMenuItem(id: string): Promise<ApiResponse<MenuItem>> {
    const response = await this.request<MenuItem>(`/menu/items/${id}`);
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async createMenuItem(itemData: {
    name: string;
    price: number;
    category: string;
    description?: string;
    isAvailable?: boolean;
    preparationTime?: number;
    calories?: number;
    allergens?: string[];
    isPopular?: boolean;
  }): Promise<ApiResponse<MenuItem>> {
    const response = await this.request<MenuItem>('/menu/items', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async updateMenuItem(id: string, updates: Partial<MenuItem>): Promise<ApiResponse<MenuItem>> {
    const response = await this.request<MenuItem>(`/menu/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async deleteMenuItem(id: string): Promise<ApiResponse> {
    return this.request(`/menu/items/${id}`, {
      method: 'DELETE',
    });
  }

  async getMenuItemsByCategory(category: string): Promise<ApiResponse<MenuItem[]>> {
    const response = await this.request<MenuItem[]>(`/menu/category/${encodeURIComponent(category)}`);
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async getPopularMenuItems(limit?: number): Promise<ApiResponse<MenuItem[]>> {
    const searchParams = new URLSearchParams();
    if (limit) {
      searchParams.append('limit', limit.toString());
    }

    const response = await this.request<MenuItem[]>(`/menu/items/popular?${searchParams.toString()}`);
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async getMenuStats(): Promise<ApiResponse<any>> {
    return this.request('/menu/stats');
  }

  async incrementMenuItemOrderCount(id: string): Promise<ApiResponse<any>> {
    return this.request(`/menu/items/${id}/increment-order`, {
      method: 'POST',
    });
  }

  async getTodayOrdersStats(): Promise<ApiResponse<any>> {
    return this.request('/orders/today-stats');
  }
}

// Create and export API client instance
export const api = new ApiClient(API_BASE_URL);

// Export types and client
export default api;
