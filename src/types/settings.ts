// أنواع الصلاحيات
export type Permission =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'staff'
  | 'cashier'
  | 'kitchen'
  | 'all'
  | 'settings'
  | 'dashboard'
  | 'playstation'
  | 'computer'
  | 'cafe'
  | 'menu'
  | 'billing'
  | 'reports'
  | 'inventory'
  | 'users'
  | 'costs';

// واجهة الإعدادات العامة
export interface GeneralSettings {
  cafeName: string;
  currency: string;
  timezone: string;
  language: string;
  address: string;
  phone: string;
  email: string;
  taxRate: number;
  taxInclusive: boolean;
  logo?: string;
  website?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
}

// واجهة إعدادات الأعمال
export interface BusinessSettings {
  billNumberFormat: string;
  autoGenerateBillNumber: boolean;
  defaultPaymentMethod: string;
  allowPartialPayments: boolean;
  maxDiscountPercentage: number;
  sessionTimeout: number;
  tableNumbering: 'sequential' | 'custom';
  maxTables: number;
  workingHours: {
    start: string;
    end: string;
    daysOff: string[];
  };
  deliverySettings: {
    enabled: boolean;
    radius: number;
    fee: number;
  };
  loyaltyProgram: {
    enabled: boolean;
    pointsPerCurrency: number;
    redemptionRate: number;
  };
}

// واجهة إعدادات المخزون
export interface InventorySettings {
  lowStockThreshold: number;
  criticalStockThreshold: number;
  autoReorderEnabled: boolean;
  reorderThreshold: number;
  defaultSupplier: string;
  unitConversions: Record<string, Record<string, number>>;
  expiryWarningDays: number;
  barcodeEnabled: boolean;
  autoDeductStock: boolean;
  allowNegativeStock: boolean;
  stockMovementLogging: boolean;
  suppliers: Array<{
    id: string;
    name: string;
    contact: string;
    email: string;
    phone: string;
  }>;
}

// واجهة إعدادات الإشعارات
export interface NotificationSettings {
  sessions: {
    sessionEnd: boolean;
    sessionStart: boolean;
    sessionPause: boolean;
  };
  orders: {
    newOrder: boolean;
    orderReady: boolean;
    orderCancelled: boolean;
    orderDelivered: boolean;
  };
  inventory: {
    lowStock: boolean;
    outOfStock: boolean;
    expiryWarning: boolean;
    reorderReminder: boolean;
  };
  billing: {
    newBill: boolean;
    paymentReceived: boolean;
    partialPayment: boolean;
    overduePayment: boolean;
  };
  sound: {
    enabled: boolean;
    volume: number;
    defaultTone: string;
    priorityTones: boolean;
    customTones: Record<string, string>;
  };
  display: {
    showCount: boolean;
    autoMarkRead: boolean;
    displayDuration: number;
    position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  };
  email: {
    enabled: boolean;
    smtpSettings: {
      host: string;
      port: number;
      username: string;
      password: string;
      secure: boolean;
    };
    templates: Record<string, string>;
  };
}

// واجهة إعدادات المظهر
export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'auto';
  primaryColor: string;
  secondaryColor: string;
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: string;
  sidebarVisible: boolean;
  userInfoVisible: boolean;
  fullscreenMode: boolean;
  rtlEnabled: boolean;
  animations: {
    enabled: boolean;
    duration: number;
  };
  customCSS?: string;
}

// واجهة إعدادات الأمان
export interface SecuritySettings {
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    expiryDays: number;
    preventReuse: number;
  };
  session: {
    timeout: number;
    maxConcurrent: number;
    forceLogout: boolean;
    rememberMe: boolean;
    ipRestriction: boolean;
    allowedIPs: string[];
  };
  audit: {
    enabled: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    retentionDays: number;
    logActions: string[];
  };
  permissions: {
    allowMultiLogin: boolean;
    requireApproval: boolean;
    dataEncryption: boolean;
    twoFactorAuth: boolean;
    loginAttempts: number;
    lockoutDuration: number;
  };
  api: {
    rateLimit: number;
    apiKeyExpiry: number;
    corsEnabled: boolean;
    allowedOrigins: string[];
  };
}

// واجهة إعدادات النسخ الاحتياطي
export interface BackupSettings {
  autoBackup: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    keepCount: number;
    time: string;
    compression: boolean;
    encryption: boolean;
  };
  manualBackup: {
    lastBackup: string;
    backupSize: string;
    backupLocation: string;
  };
  restore: {
    allowRestore: boolean;
    requireConfirmation: boolean;
    validateBackup: boolean;
  };
  cloud: {
    enabled: boolean;
    provider: 'google' | 'aws' | 'azure' | 'dropbox';
    credentials: Record<string, string>;
    syncFrequency: number;
  };
}

// واجهة الإعدادات المتقدمة
export interface AdvancedSettings {
  performance: {
    cacheEnabled: boolean;
    cacheDuration: number;
    maxCacheSize: number;
    autoRefresh: boolean;
    refreshInterval: number;
    compression: boolean;
    minification: boolean;
  };
  dataRetention: {
    logs: number;
    backups: number;
    tempFiles: number;
    userSessions: number;
    auditLogs: number;
  };
  system: {
    debugMode: boolean;
    maintenanceMode: boolean;
    autoUpdate: boolean;
    errorReporting: boolean;
    analytics: boolean;
  };
  integrations: {
    paymentGateways: Record<string, {
      enabled: boolean;
      credentials: Record<string, string>;
      testMode: boolean;
    }>;
    sms: {
      enabled: boolean;
      provider: string;
      apiKey: string;
      senderId: string;
    };
    printer: {
      enabled: boolean;
      type: 'thermal' | 'laser' | 'inkjet';
      connection: 'usb' | 'network' | 'bluetooth';
      settings: Record<string, any>;
    };
  };
}

// واجهة إعدادات التقارير
export interface ReportSettings {
  defaultPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly';
  autoGenerate: boolean;
  emailReports: boolean;
  reportFormat: 'pdf' | 'excel' | 'csv';
  customReports: Array<{
    id: string;
    name: string;
    type: string;
    schedule: string;
    recipients: string[];
  }>;
  charts: {
    defaultType: 'line' | 'bar' | 'pie' | 'doughnut';
    colors: string[];
    animations: boolean;
  };
}

// واجهة إعدادات المستخدمين والصلاحيات
export interface UserSettings {
  roles: Array<{
    id: string;
    name: string;
    permissions: Permission[];
    description: string;
  }>;
  defaultPermissions: Record<string, Permission[]>;
  userManagement: {
    allowRegistration: boolean;
    requireEmailVerification: boolean;
    requirePhoneVerification: boolean;
    maxUsers: number;
    inactiveUserTimeout: number;
  };
  profile: {
    allowAvatar: boolean;
    allowCustomFields: boolean;
    requiredFields: string[];
  };
}

// واجهة الإعدادات الرئيسية
export interface SettingsData {
  general: GeneralSettings;
  business: BusinessSettings;
  inventory: InventorySettings;
  notifications: NotificationSettings;
  appearance: AppearanceSettings;
  security: SecuritySettings;
  backup: BackupSettings;
  advanced: AdvancedSettings;
  reports: ReportSettings;
  users: UserSettings;
}

// واجهة حالة التبويب
export interface TabState {
  loading: boolean;
  saving: boolean;
  success: string;
  error: string;
}

// واجهة خصائص التبويب
export interface TabProps {
  settings: any;
  setSettings: (settings: any) => void;
  tabState: TabState;
  onSave: () => void;
  onReset: () => void;
  canEdit: (path: string) => boolean;
  onCreateBackup?: () => void;
}
