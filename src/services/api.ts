const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
  department?: string;
  position?: string;
  hireDate?: Date;
  salary?: number;
  notes?: string;
  isActive?: boolean;
  profileImage?: string;
  organizationName?: string;
  organization?: {
    _id: string;
    name: string;
    owner: string;
  };
  createdAt: Date;
}

export interface Session {
  _id: string;
  id: string;
  deviceType: string;
  deviceNumber: number;
  deviceName: string;
  deviceId?: string; // إضافة معرف الجهاز
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
  organization?: string; // إضافة حقل المنظمة
  createdBy: User;
  updatedBy?: User;
  createdAt: Date;
  bill?: {
    _id: string;
    id: string;
    billNumber: string;
    customerName?: string;
    total: number;
    status: string;
    billType: string;
  };
}

export interface Order {
  _id: string;
  id: string;
  orderNumber: string;
  table?: {
    _id: string;
    number: string | number;
    name?: string;
  };
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  totalAmount?: number;
  subtotal?: number;
  discount?: number;
  finalAmount?: number;
  totalCost?: number;
  notes?: string;
  preparationTime?: number;
  estimatedReadyTime?: Date;
  actualReadyTime?: Date;
  deliveredTime?: Date;
  createdBy?: User;
  preparedBy?: User;
  deliveredBy?: User;
  organization?: {
    _id: string;
    name: string;
  };
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

export interface ItemPayment {
  _id?: string;
  orderId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  paidQuantity: number;
  remainingQuantity: number;
  pricePerUnit: number;
  totalPrice: number;
  paidAmount: number;
  isPaid: boolean;
  paidAt?: Date;
  paidBy?: string;
  addons?: Array<{
    name: string;
    price: number;
  }>;
  paymentHistory?: Array<{
    quantity: number;
    amount: number;
    paidAt: Date;
    paidBy: string;
    method: 'cash' | 'card' | 'transfer';
  }>;
}

export interface SessionPayment {
  _id?: string;
  sessionId: string;
  sessionCost: number;
  paidAmount: number;
  remainingAmount: number;
  payments: Array<{
    amount: number;
    paidAt: Date;
    paidBy: string;
    method: 'cash' | 'card' | 'transfer';
  }>;
}

export interface Bill {
  _id: string;
  id: string;
  billNumber: string;
  table?: {
    _id: string;
    number: string | number;
    name?: string;
  };
  customerName?: string;
  customerPhone?: string;
  orders: Order[];
  sessions: Session[];
  subtotal: number;
  discount: number;
  discountPercentage: number;
  tax: number;
  total: number;
  paid: number;
  remaining: number;
  status: 'draft' | 'partial' | 'paid' | 'cancelled' | 'overdue';
  paymentMethod: 'cash' | 'card' | 'transfer' | 'mixed';
  billType: 'cafe' | 'playstation' | 'computer';
  payments: Payment[];
  itemPayments?: ItemPayment[];
  sessionPayments?: SessionPayment[];
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
  organization?: {
    _id: string;
    name: string;
  } | string; // يمكن أن يكون object مع populate أو string فقط
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
  paidAmount: number;
  remainingAmount: number;
  currency: string;
  date: Date;
  dueDate?: Date;
  status: 'pending' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
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
  organization?: string; // إضافة حقل المنظمة
  createdAt: Date;
  // إضافة خاصية أسعار البلايستيشن
  playstationRates?: { [controllers: number]: number };
  // إضافة خاصية سعر الساعة للكمبيوتر (موجودة غالباً)
  hourlyRate?: number;
}

export interface MenuSection {
  _id: string;
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  organization?: string;
  createdBy?: User;
  updatedBy?: User;
  createdAt: Date;
  updatedAt?: Date;
}

export interface MenuCategory {
  _id: string;
  id: string;
  name: string;
  description?: string;
  section: string | MenuSection;
  sortOrder: number;
  isActive: boolean;
  organization?: string;
  createdBy?: User;
  updatedBy?: User;
  createdAt: Date;
  updatedAt?: Date;
}

export interface MenuItem {
  _id: string;
  id: string;
  name: string;
  price: number;
  category: string | MenuCategory;
  description?: string;
  isAvailable: boolean;
  orderCount: number;
  imageUrl?: string;
  preparationTime: number;
  calories?: number;
  allergens?: string[];
  ingredients?: {
    item: string; // InventoryItem ID
    quantity: number;
    unit: string;
  }[];
  isPopular: boolean;
  isNew: boolean;
  createdBy: User;
  updatedBy?: User;
  createdAt: Date;
}

export interface TableSection {
  _id: string;
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  organization?: string;
  createdBy?: User;
  updatedBy?: User;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Table {
  _id: string;
  id: string;
  number: string | number;
  section: string | TableSection;
  organization?: string;
  isActive: boolean;
  createdBy?: User;
  updatedBy?: User;
  createdAt: Date;
  updatedAt?: Date;
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
  addons?: { name: string; price: number }[];
  addonsPerPiece?: { name: string; price: number }[][];
  isMainItem?: boolean;
  isAddon?: boolean;
  mainItemName?: string;
  addonName?: string;
}

export interface PayForItemsRequest {
  items: Array<{
    itemId: string;
    quantity: number;
  }>;
  paymentMethod: 'cash' | 'card' | 'transfer';
}

export interface PayForItemsResponse extends Bill {
  itemPayments: ItemPayment[];
}

// API Client class
class ApiClient {
  private baseURL: string;
  private token: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOn401: boolean = true // إضافة متغير للتحكم في إعادة المحاولة بعد التحديث
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
      } catch {
        return {
          success: false,
          message: 'خطأ في تحليل البيانات المستلمة من الخادم'
        };
      }

      if (!response.ok) {
        // إذا كان طلب تسجيل الدخول وفشل، أعد الرسالة الأصلية من السيرفر
        if (endpoint === '/auth/login' && response.status === 401) {
          return {
            success: false,
            message: data.message || 'بيانات الدخول غير صحيحة'
          };
        }

        if (response.status === 401 && retryOn401) {
          // Singleton refresh logic
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken && !this.refreshPromise) {
            this.refreshPromise = (async () => {
              try {
                const refreshResponse = await this.refreshToken(refreshToken);
                if (refreshResponse.success && refreshResponse.data?.token) {
                  this.setToken(refreshResponse.data.token);
                  localStorage.setItem('token', refreshResponse.data.token);
                  if (refreshResponse.data.refreshToken) {
                    localStorage.setItem('refreshToken', refreshResponse.data.refreshToken);
                  }
                  return true;
                } else {
                  this.clearToken();
                  return false;
                }
              } catch (error) {
                this.clearToken();
                return false;
              }
            })();
          }

          if (this.refreshPromise) {
            const refreshResult = await this.refreshPromise;
            this.refreshPromise = null;
            if (refreshResult) {
              // إعادة المحاولة مرة واحدة فقط
              return this.request<T>(endpoint, options, false);
            } else {
              return {
                success: false,
                message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى'
              };
            }
          } else {
            this.clearToken();
            return {
              success: false,
              message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى'
            };
          }
        }
        return {
          success: false,
          message: data.message || `خطأ ${response.status}: ${response.statusText}`
        };
      }

      return data;
    } catch (error: unknown) {
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
        return {
          success: false,
          message: 'خطأ في تحليل البيانات المستلمة من الخادم'
        };
      }

      if (!response.ok) {
        return {
          success: false,
          message: data.message || `خطأ ${response.status}: ${response.statusText}`
        };
      }

      return data;
    } catch (error: unknown) {
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
    localStorage.removeItem('refreshToken');
    // إلغاء جميع الطلبات الجارية
    this.refreshPromise = null;
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

  // Generic HTTP methods

  async post<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string; refreshToken: string }>> {
    const response = await this.request<{ user: User; token: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data?.token) {
      this.setToken(response.data.token);
      if (response.data.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }
      if (response.data.user) {
        response.data.user = this.normalizeData(response.data.user);
      }
    }

    return response;
  }

  async resendVerification(email: string): Promise<ApiResponse> {
    return this.publicRequest('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async forgotPassword(email: string): Promise<ApiResponse> {
    return this.publicRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string, email?: string): Promise<ApiResponse> {
    return this.publicRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password, email }),
    });
  }

  async logout(): Promise<ApiResponse> {
    // تنظيف البيانات المحلية أولاً
    this.clearToken();
    localStorage.removeItem('refreshToken');

    // محاولة إرسال طلب logout للـ backend فقط إذا كان هناك توكن
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: true, message: 'تم تسجيل الخروج' };
    }

    try {
      const response = await this.request('/auth/logout', {
        method: 'POST',
      }, false); // لا تحاول إعادة المحاولة عند 401
      return response;
    } catch (error: unknown) {
      // حتى لو فشل الطلب، نعتبر أن logout نجح
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
  async getSessions(params?: { status?: string; device?: string; page?: number; limit?: number; startDate?: string; endDate?: string }): Promise<ApiResponse<Session[]>> {
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
  }): Promise<ApiResponse<{ session: Session; bill?: Bill }>> {
    const response = await this.request<{ session: Session; bill?: Bill }>('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
    if (response.success && response.data) {
      response.data.session = this.normalizeData(response.data.session);
      if (response.data.bill) {
        response.data.bill = this.normalizeData(response.data.bill);
      }
    }
    return response;
  }

  async createSessionWithExistingBill(sessionData: {
    deviceType: string;
    deviceNumber: number;
    deviceName: string;
    customerName?: string;
    controllers?: number;
    billId: string;
  }): Promise<ApiResponse<{ session: Session; bill?: Bill }>> {
    const response = await this.request<{ session: Session; bill?: Bill }>('/sessions/with-existing-bill', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
    if (response.success && response.data) {
      response.data.session = this.normalizeData(response.data.session);
      if (response.data.bill) {
        response.data.bill = this.normalizeData(response.data.bill);
      }
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

  async endSession(id: string, customerName?: string): Promise<ApiResponse<{ session: Session; bill?: any }>> {
    const response = await this.request<{ session: Session; bill?: any }>(`/sessions/${id}/end`, {
      method: 'PUT',
      body: customerName ? JSON.stringify({ customerName }) : undefined,
    });
    if (response.success && response.data) {
      response.data.session = this.normalizeData(response.data.session);
      if (response.data.bill) {
        response.data.bill = this.normalizeData(response.data.bill);
      }
    }
    return response;
  }

  async unlinkTableFromSession(sessionId: string, customerName?: string): Promise<ApiResponse<{ session: Session; bill: any; unlinkedFromTable: number }>> {
    const response = await this.request<{ session: Session; bill: any; unlinkedFromTable: number }>(`/sessions/${sessionId}/unlink-table`, {
      method: 'PUT',
      body: customerName ? JSON.stringify({ customerName }) : undefined,
    });
    if (response.success && response.data) {
      response.data.session = this.normalizeData(response.data.session);
      if (response.data.bill) {
        response.data.bill = this.normalizeData(response.data.bill);
      }
    }
    return response;
  }

  async linkSessionToTable(sessionId: string, tableId: string): Promise<ApiResponse<{ session: any; bill: any }>> {
    const response = await this.request<{ session: any; bill: any }>(`/sessions/${sessionId}/link-table`, {
      method: 'PUT',
      body: JSON.stringify({ tableId }),
    });
    if (response.success && response.data) {
      if (response.data.session) {
        response.data.session = this.normalizeData(response.data.session);
      }
      if (response.data.bill) {
        response.data.bill = this.normalizeData(response.data.bill);
      }
    }
    return response;
  }

  async changeSessionTable(sessionId: string, newTableId: string): Promise<ApiResponse<{ session: any; bill: any; oldTable: string; newTable: string }>> {
    const response = await this.request<{ session: any; bill: any; oldTable: string; newTable: string }>(`/sessions/${sessionId}/change-table`, {
      method: 'PUT',
      body: JSON.stringify({ newTableId }),
    });
    if (response.success && response.data) {
      if (response.data.session) {
        response.data.session = this.normalizeData(response.data.session);
      }
      if (response.data.bill) {
        response.data.bill = this.normalizeData(response.data.bill);
      }
    }
    return response;
  }

  async cleanupDuplicateSessionReferences(): Promise<ApiResponse<{ cleanedCount: number }>> {
    return this.request<{ cleanedCount: number }>('/sessions/cleanup-duplicates', {
      method: 'POST',
    });
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

  async updateControllersPeriodTime(sessionId: string, periodIndex: number, newStartTime: string, newEndTime?: string, forceUpdate?: boolean): Promise<ApiResponse<Session>> {
    const body: any = { periodIndex, newStartTime };
    if (newEndTime) {
      body.newEndTime = newEndTime;
    }
    if (forceUpdate) {
      body.forceUpdate = forceUpdate;
    }
    
    return this.request<Session>(`/sessions/${sessionId}/controllers-period-time`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async resolveControllersPeriodConflict(sessionId: string, conflictResolution: {
    periodIndex: number;
    newStartTime: string;
    newEndTime?: string;
    resolutionAction: string;
    actionDetails: any;
  }): Promise<ApiResponse<Session>> {
    return this.request<Session>(`/sessions/${sessionId}/resolve-period-conflict`, {
      method: 'PUT',
      body: JSON.stringify(conflictResolution),
    });
  }

  async updateSessionCost(sessionId: string): Promise<ApiResponse<{
    sessionId: string;
    currentCost: number;
    totalCost: number;
    billUpdated: boolean;
    duration: number;
  }>> {
    return this.request(`/sessions/${sessionId}/update-cost`, {
      method: 'PUT'
    });
  }

  async updateSessionStartTime(sessionId: string, data: { startTime: string }): Promise<ApiResponse<Session>> {
    return this.request<Session>(`/sessions/${sessionId}/start-time`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Orders endpoints
  async getOrders(params?: { status?: string; customerName?: string; page?: number; limit?: number; startDate?: string; endDate?: string }): Promise<ApiResponse<Order[]>> {
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

    const response = await this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });

    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }

    return response;
  }

  async calculateOrderRequirements(orderData: {
    customerName: string;
    items: OrderItem[];
    notes?: string;
  }): Promise<ApiResponse<any>> {
    const response = await this.request<any>('/orders/calculate', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });

    return response;
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<ApiResponse<Order>> {
    try {

      const response = await this.request<Order>(`/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
      return response;
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : 'فشل في تحديث الطلب');
    }
  }

  async updateOrderItemPrepared(orderId: string, itemIndex: number, data: { preparedCount: number }): Promise<ApiResponse<Order>> {
    return this.request<Order>(`/orders/${orderId}/items/${itemIndex}/prepared`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deductOrderInventory(orderId: string): Promise<ApiResponse<Order>> {
    return this.request<Order>(`/orders/${orderId}/deduct-inventory`, {
      method: 'POST',
    });
  }

  async updateOrderStatus(orderId: string, status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'): Promise<ApiResponse<Order>> {
    return this.request<Order>(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async deliverItem(orderId: string, itemIndex: number): Promise<ApiResponse<Order>> {
    return this.request<Order>(`/orders/${orderId}/deliver-item/${itemIndex}`, {
      method: 'PUT',
    });
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

  async cancelOrder(orderId: string): Promise<ApiResponse<Order>> {
    return this.request<Order>(`/orders/${orderId}/cancel`, {
      method: 'PATCH',
    });
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

  async createInventoryItem(itemData: Partial<InventoryItem> & { costStatus?: string; paidAmount?: number }): Promise<ApiResponse<InventoryItem>> {
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
    price?: number;
    supplier?: string;
    date?: string;
    costStatus?: string;
    paidAmount?: number;
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
  async getBills(params?: { status?: string; table?: string; page?: number; limit?: number; customerName?: string }): Promise<ApiResponse<Bill[]>> {
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
    // إذا كان هناك توكن (مستخدم مسجل)، استخدم endpoint الخاص
    const token = this.getToken && this.getToken();
    let response: ApiResponse<Bill>;
    if (token) {
      response = await this.request<Bill>(`/billing/${id}`);
    } else {
      response = await this.publicRequest<Bill>(`/billing/public/${id}`);
    }
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async createBill(billData: {
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

  async removeOrderFromBill(billId: string, orderId: string): Promise<ApiResponse<Bill>> {
    const response = await this.request<Bill>(`/billing/${billId}/orders/${orderId}`, {
      method: 'DELETE',
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
    const response = await this.request<Bill>(`/billing/${id}/cancel`, {
      method: 'PUT',
    });

    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }

    return response;
  }

  async deleteBill(id: string): Promise<ApiResponse<boolean>> {
    const response = await this.request<boolean>(`/billing/${id}`, {
      method: 'DELETE',
    });
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
    items: Array<{
      itemId: string;
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

  /**
   * Get aggregated bill items (Backend processed)
   */
  async getBillAggregatedItems(id: string): Promise<ApiResponse<{
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
    const response = await this.request<{
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
  async addPartialPaymentAggregated(id: string, paymentData: {
    items: Array<{
      itemId: string;
      quantity: number;
    }>;
    paymentMethod: 'cash' | 'card' | 'transfer';
  }): Promise<ApiResponse<Bill>> {
    const response = await this.request<Bill>(`/billing/${id}/partial-payment-aggregated`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
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
  async payForItems(id: string, paymentData: PayForItemsRequest): Promise<ApiResponse<Bill>> {
    const response = await this.request<Bill>(`/billing/${id}/pay-items`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async paySessionPartial(id: string, paymentData: {
    sessionId: string;
    amount: number;
    paymentMethod: 'cash' | 'card' | 'transfer';
  }): Promise<ApiResponse<Bill>> {
    const response = await this.request<Bill>(`/billing/${id}/pay-session-partial`, {
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

  async addCostPayment(id: string, paymentData: {
    paymentAmount: number;
    paymentMethod?: 'cash' | 'card' | 'transfer';
    reference?: string;
  }): Promise<ApiResponse<Cost>> {
    const response = await this.request<Cost>(`/costs/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
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

  async getSalesReport(filter: any = {}, groupBy?: string): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (filter && typeof filter === 'object') {
      Object.entries(filter).forEach(([key, value]) => {
        if (value) {
          searchParams.append(key, String(value));
        }
      });
    }
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

  async getFinancialReport(filter: any = {}): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (filter && typeof filter === 'object') {
      Object.entries(filter).forEach(([key, value]) => {
        if (value) {
          searchParams.append(key, String(value));
        }
      });
    }

    // Ensure period is set if no filter is provided
    if (!searchParams.has('period') && !searchParams.has('type')) {
      searchParams.append('period', 'today');
    }

    const response = await this.request<any>(`/reports/financial?${searchParams.toString()}`);
    return response;
  }

  async exportReportToExcel(reportType: string, filter: any = {}): Promise<Blob> {
    const searchParams = new URLSearchParams();
    searchParams.append('reportType', reportType);
    if (filter && typeof filter === 'object') {
      Object.entries(filter).forEach(([key, value]) => {
        if (value) {
          searchParams.append(key, String(value));
        }
      });
    } else if (typeof filter === 'string') {
      searchParams.append('period', filter);
    }

    if (!searchParams.has('period') && !searchParams.has('type')) {
      searchParams.append('period', 'today');
    }

    const response = await fetch(`${this.baseURL}/reports/export/excel?${searchParams.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to export report');
    }

    return response.blob();
  }

  async exportReportToPDF(reportType: string, filter: any = {}): Promise<Blob> {
    const searchParams = new URLSearchParams();
    searchParams.append('reportType', reportType);
    if (filter && typeof filter === 'object') {
      Object.entries(filter).forEach(([key, value]) => {
        if (value) {
          searchParams.append(key, String(value));
        }
      });
    } else if (typeof filter === 'string') {
      searchParams.append('period', filter);
    }

    if (!searchParams.has('period') && !searchParams.has('type')) {
      searchParams.append('period', 'today');
    }

    const response = await fetch(`${this.baseURL}/reports/export/pdf?${searchParams.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to export report');
    }

    return response.blob();
  }

  async getSessionsReport(filter: any = {}, device?: string): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (filter && typeof filter === 'object') {
      Object.entries(filter).forEach(([key, value]) => {
        if (value) {
          searchParams.append(key, String(value));
        }
      });
    }
    if (device) searchParams.append('device', device);

    return this.request(`/reports/sessions?${searchParams.toString()}`);
  }

  async getRecentActivity(limit?: number): Promise<ApiResponse<any[]>> {
    try {
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());

      const response = await this.request<any[]>(`/reports/recent-activity?${params}`);
      return response;
    } catch (error: unknown) {
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
    businessName?: string;
    businessType?: string;
  }): Promise<ApiResponse<User>> {
    const endpoint = userData.role === 'owner' ? '/auth/register' : '/users';
    const response = await this.request<User>(endpoint, {
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

  // User profile methods
  async getUserProfile(): Promise<ApiResponse<User>> {
    return this.request('/settings/profile');
  }

  async updateUserProfile(profileData: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  }): Promise<ApiResponse<User>> {
    const response = await this.request<User>('/settings/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
    
    // Normalize the user data if the request was successful
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    
    return response;
  }

  // Password change method
  async changePassword(passwordData: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/settings/change-password', {
      method: 'PUT',
      body: JSON.stringify(passwordData),
    });
  }

  // Notification settings methods
  async getNotificationSettings(): Promise<ApiResponse<any>> {
    return this.request('/settings/notifications');
  }

  async updateNotificationSettings(settings: any): Promise<ApiResponse<any>> {
    return this.request('/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
  }

  // General settings methods
  async getGeneralSettings(): Promise<ApiResponse<any>> {
    return this.request('/settings/general');
  }

  async updateGeneralSettings(settings: any): Promise<ApiResponse<any>> {
    return this.request('/settings/general', {
      method: 'PUT',
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

  // تحديث حالة الجهاز فقط (status)
  async updateDeviceStatus(id: string, statusData: { status: string }): Promise<ApiResponse<Device>> {
    const response = await this.request<Device>(`/devices/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(statusData),
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
    ingredients?: {
      item: string;
      quantity: number;
      unit: string;
    }[];
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

  // Menu Sections endpoints
  async getMenuSections(): Promise<ApiResponse<MenuSection[]>> {
    const response = await this.request<MenuSection[]>('/menu/sections');
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async getMenuSection(id: string): Promise<ApiResponse<MenuSection>> {
    const response = await this.request<MenuSection>(`/menu/sections/${id}`);
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async createMenuSection(sectionData: {
    name: string;
    description?: string;
    sortOrder?: number;
  }): Promise<ApiResponse<MenuSection>> {
    const response = await this.request<MenuSection>('/menu/sections', {
      method: 'POST',
      body: JSON.stringify(sectionData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async updateMenuSection(id: string, updates: Partial<MenuSection>): Promise<ApiResponse<MenuSection>> {
    const response = await this.request<MenuSection>(`/menu/sections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async deleteMenuSection(id: string): Promise<ApiResponse> {
    return this.request(`/menu/sections/${id}`, {
      method: 'DELETE',
    });
  }

  // Menu Categories endpoints
  async getMenuCategories(params?: { section?: string }): Promise<ApiResponse<MenuCategory[]>> {
    const searchParams = new URLSearchParams();
    if (params?.section) {
      searchParams.append('section', params.section);
    }
    const response = await this.request<MenuCategory[]>(`/menu/categories-all?${searchParams.toString()}`);
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async getMenuCategory(id: string): Promise<ApiResponse<MenuCategory>> {
    const response = await this.request<MenuCategory>(`/menu/categories/${id}`);
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async createMenuCategory(categoryData: {
    name: string;
    description?: string;
    section: string;
    sortOrder?: number;
  }): Promise<ApiResponse<MenuCategory>> {
    const response = await this.request<MenuCategory>('/menu/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async updateMenuCategory(id: string, updates: Partial<MenuCategory>): Promise<ApiResponse<MenuCategory>> {
    const response = await this.request<MenuCategory>(`/menu/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async deleteMenuCategory(id: string): Promise<ApiResponse> {
    return this.request(`/menu/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // Table Sections endpoints
  async getTableSections(): Promise<ApiResponse<TableSection[]>> {
    const response = await this.request<TableSection[]>('/tables/sections');
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async getTableSection(id: string): Promise<ApiResponse<TableSection>> {
    const response = await this.request<TableSection>(`/tables/sections/${id}`);
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async createTableSection(sectionData: {
    name: string;
    description?: string;
    sortOrder?: number;
  }): Promise<ApiResponse<TableSection>> {
    const response = await this.request<TableSection>('/tables/sections', {
      method: 'POST',
      body: JSON.stringify(sectionData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async updateTableSection(id: string, updates: Partial<TableSection>): Promise<ApiResponse<TableSection>> {
    const response = await this.request<TableSection>(`/tables/sections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async deleteTableSection(id: string): Promise<ApiResponse> {
    return this.request(`/tables/sections/${id}`, {
      method: 'DELETE',
    });
  }

  // Tables endpoints
  async getTables(params?: { section?: string }): Promise<ApiResponse<Table[]>> {
    const searchParams = new URLSearchParams();
    if (params?.section) {
      searchParams.append('section', params.section);
    }
    const response = await this.request<Table[]>(`/tables/tables?${searchParams.toString()}`);
    if (response.success && response.data) {
      response.data = this.normalizeArray(response.data);
    }
    return response;
  }

  async getTable(id: string): Promise<ApiResponse<Table>> {
    const response = await this.request<Table>(`/tables/tables/${id}`);
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async getTableStatus(id: string): Promise<ApiResponse<{ table: Table; hasUnpaidOrders: boolean; orders: Order[] }>> {
    const response = await this.request<{ table: Table; hasUnpaidOrders: boolean; orders: Order[] }>(`/tables/tables/${id}/status`);
    if (response.success && response.data) {
      response.data = {
        ...response.data,
        table: this.normalizeData(response.data.table),
        orders: this.normalizeArray(response.data.orders),
      };
    }
    return response;
  }

  async createTable(tableData: {
    number: string | number;
    section: string;
  }): Promise<ApiResponse<Table>> {
    const response = await this.request<Table>('/tables/tables', {
      method: 'POST',
      body: JSON.stringify(tableData),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async updateTable(id: string, updates: Partial<Table>): Promise<ApiResponse<Table>> {
    const response = await this.request<Table>(`/tables/tables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (response.success && response.data) {
      response.data = this.normalizeData(response.data);
    }
    return response;
  }

  async deleteTable(id: string): Promise<ApiResponse> {
    return this.request(`/tables/tables/${id}`, {
      method: 'DELETE',
    });
  }

  async getTodayOrdersStats(): Promise<ApiResponse<any>> {
    return this.request('/orders/today-stats');
  }

  // Notification methods
  async getNotifications(options?: { category?: string; unreadOnly?: boolean; limit?: number }): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.unreadOnly) params.append('unreadOnly', 'true');
    if (options?.limit) params.append('limit', options.limit.toString());

    return this.request(`/notifications?${params.toString()}`);
  }

  async getNotificationStats(): Promise<ApiResponse<any>> {
    return this.request('/notifications/stats');
  }

  async markNotificationAsRead(notificationId: string): Promise<ApiResponse<any>> {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PUT'
    });
  }

  async markAllNotificationsAsRead(): Promise<ApiResponse<any>> {
    return this.request('/notifications/read-all', {
      method: 'POST'  // Changed from PUT to POST to match backend route
    });
  }

  async deleteNotification(notificationId: string): Promise<ApiResponse<any>> {
    return this.request(`/notifications/${notificationId}`, {
      method: 'DELETE'
    });
  }

  // Admin notification methods
  async createNotification(notificationData: any): Promise<ApiResponse<any>> {
    return this.request('/notifications', {
      method: 'POST',
      body: JSON.stringify(notificationData)
    });
  }

  async sendNotificationToRole(role: string, notificationData: any): Promise<ApiResponse<any>> {
    return this.request(`/notifications/role/${role}`, {
      method: 'POST',
      body: JSON.stringify(notificationData)
    });
  }

  async sendNotificationToPermission(permission: string, notificationData: any): Promise<ApiResponse<any>> {
    return this.request(`/notifications/permission/${permission}`, {
      method: 'POST',
      body: JSON.stringify(notificationData)
    });
  }

  async broadcastNotification(notificationData: any): Promise<ApiResponse<any>> {
    return this.request('/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify(notificationData)
    });
  }

  async cleanExpiredNotifications(): Promise<ApiResponse<any>> {
    return this.request('/notifications/clean-expired', {
      method: 'DELETE'
    });
  }

  async getAvailableBillsForSession(type: 'playstation' | 'computer'): Promise<ApiResponse<Bill[]>> {
    return this.request<Bill[]>(`/bills/available-for-session?type=${type}`);
  }

  // Generic HTTP methods
  async get<T = any>(endpoint: string, config?: { params?: any }): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (config?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(config.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url = `${endpoint}?${queryString}`;
      }
    }
    return this.request<T>(url);
  }

  // Organization methods
  async getOrganization(): Promise<ApiResponse<any>> {
    return this.request('/organization');
  }

  async getOrganizationById(id: string): Promise<ApiResponse<any>> {
    return this.request(`/organization/${id}`);
  }

  async updateOrganization(organizationData: {
    name?: string;
    description?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
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
    return this.request('/organization', {
      method: 'PUT',
      body: JSON.stringify(organizationData),
    });
  }

  async updateOrganizationPermissions(permissions: {
    allowManagersToEditOrganization?: boolean;
    authorizedManagers?: string[];
  }): Promise<ApiResponse<any>> {
    return this.request('/organization/permissions', {
      method: 'PUT',
      body: JSON.stringify(permissions),
    });
  }

  async canEditOrganization(): Promise<ApiResponse<any>> {
    return this.request('/organization/can-edit');
  }

  async getAvailableManagers(): Promise<ApiResponse<any>> {
    return this.request('/organization/available-managers');
  }


}

// Create and export API client instance
export const api = new ApiClient(API_BASE_URL);

// Export types and client
export default api;
