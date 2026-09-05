// Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  disabled?: boolean;
  errors?: unknown;
  details?: unknown;
  data?: T;
  count?: number;
  total?: number;
}

export interface User {
  _id: string;
  id: string;
  name: string;
  email: string;
  username?: string;
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
  useCustomPrintSettings?: boolean;
  printSettings?: Record<string, any>;
  organizationName?: string;
  organization?: {
    _id: string;
    name: string;
    owner: string;
    printSettings?: {
      promptOrderPrintSections?: boolean;
      defaultOrderPrintSections?: string[];
      autoPrintOrderSections?: boolean;
      printers?: Array<{ id: string; name: string; printerName: string; printerPath?: string; paperWidthMm?: number }>;
      sectionPrinterMap?: Record<string, string>;
      documentPrinterMap?: Record<string, string>;
    };
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
  status: 'draft' | 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
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
  _id?: string;
  menuItem?: string;
  name: string;
  arabicName?: string;
  price: number;
  variant?: string | null;
  quantity: number;
  preparedCount?: number;
  deliveredCount?: number;
  section?: string;
  notes?: string;
  additionalPrice?: number;
  inventoryItem?: string;
  isService?: boolean;
  showInPrint?: boolean;
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
  totalValue?: number; // Virtual property: calculated based on purchase prices
  warehouseItem?: string;
  lastRestocked?: Date;
  expiryDate?: Date;
  createdAt: Date;
}

export interface WarehouseItem {
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
  totalValue?: number;
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
    printSettings?: {
      openCashDrawer?: boolean;
      openCashDrawerOnPayment?: boolean;
      openCashDrawerShortcut?: boolean;
      autoPrintOnPayment?: boolean;
      charactersPerLine?: number;
      printHeader?: boolean;
      printFooter?: boolean;
      autoCut?: boolean;
      printQRCode?: boolean;
      printers?: Array<{ id: string; name: string; printerName: string; printerPath?: string; paperWidthMm?: number }>;
      sectionPrinterMap?: Record<string, string>;
      documentPrinterMap?: Record<string, string>;
    };
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

export interface MenuVariant {
  size: string;
  price: number;
  sku?: string | null;
  barcode?: string | null;
}

export interface MenuItem {
  _id: string;
  id: string;
  name: string;
  price: number; // legacy / computed: variants[0].price for backward compatibility
  variants?: MenuVariant[];
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
