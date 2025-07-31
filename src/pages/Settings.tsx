import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Briefcase,
  Package,
  Users,
  FileText,
  Download,
  Upload,
  Bell,
  Palette,
  Shield,
  Database,
  Settings as SettingsAdvanced
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SettingsData, TabState, Permission } from '../types/settings';

// استيراد مكونات التبويبات
import GeneralSettingsTab from '../components/settings/GeneralSettingsTab';
import BusinessSettingsTab from '../components/settings/BusinessSettingsTab';
import InventorySettingsTab from '../components/settings/InventorySettingsTab';
import NotificationSettingsTab from '../components/settings/NotificationSettingsTab';
import AppearanceSettingsTab from '../components/settings/AppearanceSettingsTab';
import SecuritySettingsTab from '../components/settings/SecuritySettingsTab';
import BackupSettingsTab from '../components/settings/BackupSettingsTab';
import AdvancedSettingsTab from '../components/settings/AdvancedSettingsTab';
import ReportSettingsTab from '../components/settings/ReportSettingsTab';
import UserSettingsTab from '../components/settings/UserSettingsTab';

const Settings = () => {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<keyof SettingsData>('general');

  // إعدادات كل تبويب
  const [settings, setSettings] = useState<SettingsData>({
    general: {
      cafeName: '',
      currency: 'EGP',
      timezone: 'Africa/Cairo',
      language: 'ar',
      address: '',
      phone: '',
      email: '',
      taxRate: 0,
      taxInclusive: false
    },
    business: {
      billNumberFormat: 'INV-{YYYY}{MM}{DD}-{XXX}',
      autoGenerateBillNumber: true,
      defaultPaymentMethod: 'cash',
      allowPartialPayments: false,
      maxDiscountPercentage: 10,
      sessionTimeout: 30,
      tableNumbering: 'sequential',
      maxTables: 20,
      workingHours: {
        start: '08:00',
        end: '22:00',
        daysOff: []
      },
      deliverySettings: {
        enabled: false,
        radius: 10,
        fee: 0
      },
      loyaltyProgram: {
        enabled: false,
        pointsPerCurrency: 1,
        redemptionRate: 0.01
      }
    },
    inventory: {
      lowStockThreshold: 10,
      criticalStockThreshold: 5,
      autoReorderEnabled: false,
      reorderThreshold: 5,
      defaultSupplier: '',
      unitConversions: {},
      expiryWarningDays: 7,
      barcodeEnabled: false,
      autoDeductStock: true,
      allowNegativeStock: false,
      stockMovementLogging: true,
      suppliers: []
    },
    notifications: {
      sessions: {
        sessionEnd: true,
        sessionStart: true,
        sessionPause: false
      },
      orders: {
        newOrder: true,
        orderReady: true,
        orderCancelled: true,
        orderDelivered: false
      },
      inventory: {
        lowStock: true,
        outOfStock: true,
        expiryWarning: true,
        reorderReminder: false
      },
      billing: {
        newBill: true,
        paymentReceived: true,
        partialPayment: false,
        overduePayment: true
      },
      sound: {
        enabled: true,
        volume: 60,
        defaultTone: 'default',
        priorityTones: false,
        customTones: {}
      },
      display: {
        showCount: true,
        autoMarkRead: false,
        displayDuration: 5,
        position: 'top-right'
      },
      email: {
        enabled: false,
        smtpSettings: {
          host: '',
          port: 587,
          username: '',
          password: '',
          secure: false
        },
        templates: {}
      }
    },
    appearance: {
      theme: 'light',
      primaryColor: '#3B82F6',
      secondaryColor: '#6B7280',
      fontSize: 'medium',
      fontFamily: "'Cairo', sans-serif",
      sidebarVisible: true,
      userInfoVisible: true,
      fullscreenMode: false,
      rtlEnabled: true,
      animations: {
        enabled: true,
        duration: 300
      }
    },
    security: {
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
        expiryDays: 90,
        preventReuse: 3
      },
      session: {
        timeout: 30,
        maxConcurrent: 3,
        forceLogout: true,
        rememberMe: true,
        ipRestriction: false,
        allowedIPs: []
      },
      audit: {
        enabled: true,
        logLevel: 'info',
        retentionDays: 30,
        logActions: ['login', 'logout', 'password_change', 'settings_change']
      },
      permissions: {
        allowMultiLogin: false,
        requireApproval: false,
        dataEncryption: true,
        twoFactorAuth: false,
        loginAttempts: 5,
        lockoutDuration: 30
      },
      api: {
        rateLimit: 100,
        apiKeyExpiry: 30,
        corsEnabled: true,
        allowedOrigins: []
      }
    },
    backup: {
      autoBackup: {
        enabled: true,
        frequency: 'daily',
        keepCount: 10,
        time: '02:00',
        compression: true,
        encryption: false
      },
      manualBackup: {
        lastBackup: '',
        backupSize: '',
        backupLocation: ''
      },
      restore: {
        allowRestore: true,
        requireConfirmation: true,
        validateBackup: true
      },
      cloud: {
        enabled: false,
        provider: 'google',
        credentials: {},
        syncFrequency: 24
      }
    },
    advanced: {
      performance: {
        cacheEnabled: true,
        cacheDuration: 300,
        maxCacheSize: 100,
        autoRefresh: true,
        refreshInterval: 30,
        compression: true,
        minification: true
      },
      dataRetention: {
        logs: 30,
        backups: 90,
        tempFiles: 7,
        userSessions: 30,
        auditLogs: 90
      },
      system: {
        debugMode: false,
        maintenanceMode: false,
        autoUpdate: true,
        errorReporting: true,
        analytics: false
      },
      integrations: {
        paymentGateways: {},
        sms: {
          enabled: false,
          provider: 'twilio',
          apiKey: '',
          senderId: ''
        },
        printer: {
          enabled: false,
          type: 'thermal',
          connection: 'usb',
          settings: {}
        }
      }
    },
    reports: {
      defaultPeriod: 'daily',
      autoGenerate: false,
      emailReports: false,
      reportFormat: 'pdf',
      customReports: [],
      charts: {
        defaultType: 'line',
        colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'],
        animations: true
      }
    },
    users: {
      roles: [
        {
          id: 'owner',
          name: 'صاحب المنشأة',
          permissions: ['owner'],
          description: 'صلاحيات كاملة على النظام'
        },
        {
          id: 'admin',
          name: 'مدير',
          permissions: ['admin'],
          description: 'إدارة النظام والمستخدمين'
        },
        {
          id: 'manager',
          name: 'مشرف',
          permissions: ['manager'],
          description: 'إدارة العمليات اليومية'
        },
        {
          id: 'staff',
          name: 'موظف',
          permissions: ['staff'],
          description: 'الوصول للوظائف الأساسية'
        },
        {
          id: 'cashier',
          name: 'كاشير',
          permissions: ['cashier'],
          description: 'إدارة المبيعات والمدفوعات'
        },
        {
          id: 'kitchen',
          name: 'مطبخ',
          permissions: ['kitchen'],
          description: 'إدارة الطلبات والمخزون'
        }
      ],
      defaultPermissions: {
        'general': ['owner', 'admin'],
        'business': ['owner', 'admin'],
        'inventory': ['owner', 'admin', 'manager', 'kitchen'],
        'notifications': ['owner', 'admin'],
        'appearance': ['owner', 'admin'],
        'security': ['owner'],
        'backup': ['owner', 'admin'],
        'advanced': ['owner'],
        'reports': ['owner', 'admin', 'manager'],
        'users': ['owner', 'admin']
      },
      userManagement: {
        allowRegistration: false,
        requireEmailVerification: true,
        requirePhoneVerification: false,
        maxUsers: 50,
        inactiveUserTimeout: 30
      },
      profile: {
        allowAvatar: true,
        allowCustomFields: false,
        requiredFields: ['name', 'email']
      }
    }
  });

  // حالة التحميل/الحفظ/النجاح/الخطأ لكل تبويب
  const [tabState, setTabState] = useState<Record<keyof SettingsData, TabState>>({
    general: { loading: false, saving: false, success: '', error: '' },
    business: { loading: false, saving: false, success: '', error: '' },
    inventory: { loading: false, saving: false, success: '', error: '' },
    notifications: { loading: false, saving: false, success: '', error: '' },
    appearance: { loading: false, saving: false, success: '', error: '' },
    security: { loading: false, saving: false, success: '', error: '' },
    backup: { loading: false, saving: false, success: '', error: '' },
    advanced: { loading: false, saving: false, success: '', error: '' },
    reports: { loading: false, saving: false, success: '', error: '' },
    users: { loading: false, saving: false, success: '', error: '' }
  });

  // دالة تحديد صلاحيات المستخدم
  const getUserPermissions = (): Permission[] => {
    if (!user) return [];

    switch (user.role) {
      case 'owner':
        return ['owner'];
      case 'admin':
        return ['admin'];
      case 'manager':
        return ['manager'];
      case 'staff':
        return ['staff'];
      case 'cashier':
        return ['cashier'];
      case 'kitchen':
        return ['kitchen'];
      default:
        return [];
    }
  };

  // دالة التحقق من إمكانية الوصول للتبويب
  const canAccessTab = (tabId: keyof SettingsData): boolean => {
    const userPermissions = getUserPermissions();
    const requiredPermissions = settings.users.defaultPermissions[tabId] || [];

    return requiredPermissions.some(permission =>
      userPermissions.includes(permission as Permission)
    );
  };

  // دالة التحقق من إمكانية تعديل الإعداد
  const canEdit = (path: string): boolean => {
    const userPermissions = getUserPermissions();
    const [category] = path.split('.');
    const requiredPermissions = settings.users.defaultPermissions[category as keyof SettingsData] || [];

    return requiredPermissions.some(permission =>
      userPermissions.includes(permission as Permission)
    );
  };

  // دالة جلب الإعدادات لأي تبويب
  const fetchTabSettings = async (category: keyof SettingsData) => {
    setTabState((prev) => ({
      ...prev,
      [category]: { ...prev[category], loading: true, error: '', success: '' }
    }));

    try {
      // هنا سيتم استدعاء API لجلب الإعدادات
      // const res = await api.getSettings(category);
      // if (res.success && res.data) {
      //   setSettings(prev => ({ ...prev, [category]: res.data.settings }));
      // }

      setTabState((prev) => ({
        ...prev,
        [category]: { ...prev[category], loading: false, error: '', success: '' }
      }));
    } catch {
      setTabState((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          loading: false,
          error: 'تعذر تحميل الإعدادات',
          success: ''
        }
      }));
    }
  };

  // دالة حفظ الإعدادات
  const handleSaveSettings = async (category: keyof SettingsData) => {
    setTabState((prev) => ({
      ...prev,
      [category]: { ...prev[category], saving: true, error: '', success: '' }
    }));

    try {
      // هنا سيتم استدعاء API لحفظ الإعدادات
      // const res = await api.updateSettings(category, settings[category]);
      // if (res.success) {
      //   setTabState((prev) => ({
      //     ...prev,
      //     [category]: { ...prev[category], saving: false, success: 'تم حفظ الإعدادات بنجاح' }
      //   }));
      // }

      setTabState((prev) => ({
        ...prev,
        [category]: { ...prev[category], saving: false, success: 'تم حفظ الإعدادات بنجاح' }
      }));
    } catch {
      setTabState((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          saving: false,
          error: 'حدث خطأ أثناء الحفظ'
        }
      }));
    }
  };

  // دالة استعادة الإعدادات الافتراضية
  const handleResetSettings = async (category: keyof SettingsData) => {
    setTabState((prev) => ({
      ...prev,
      [category]: { ...prev[category], loading: true, error: '', success: '' }
    }));

    try {
      // هنا سيتم استدعاء API لاستعادة الإعدادات الافتراضية
      // const res = await api.resetSettings(category);
      // if (res.success) {
      //   await fetchTabSettings(category);
      //   setTabState((prev) => ({
      //     ...prev,
      //     [category]: { ...prev[category], loading: false, success: 'تم استعادة الإعدادات الافتراضية' }
      //   }));
      // }

      setTabState((prev) => ({
        ...prev,
        [category]: { ...prev[category], loading: false, success: 'تم استعادة الإعدادات الافتراضية' }
      }));
    } catch {
      setTabState((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          loading: false,
          error: 'حدث خطأ أثناء الاستعادة'
        }
      }));
    }
  };

  // دالة إنشاء نسخة احتياطية
  const handleCreateBackup = async () => {
    try {
      // هنا سيتم استدعاء API لإنشاء نسخة احتياطية
      console.log('Creating backup...');
    } catch (error) {
      console.error('Error creating backup:', error);
    }
  };

  // دالة تصدير الإعدادات
  const handleExportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `settings-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // دالة استيراد الإعدادات
  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target?.result as string);
          setSettings(importedSettings);
        } catch (error) {
          console.error('Error importing settings:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  // جلب الإعدادات عند تغيير التبويب
  useEffect(() => {
    if (canAccessTab(activeTab)) {
      fetchTabSettings(activeTab);
    }
  }, [activeTab]);

  // التبويبات المتاحة حسب الصلاحيات
  const availableTabs = [
    { id: 'general', name: 'عام', icon: SettingsIcon, description: 'الإعدادات الأساسية للنظام' },
    { id: 'business', name: 'الأعمال', icon: Briefcase, description: 'إعدادات الأعمال والمدفوعات' },
    { id: 'inventory', name: 'المخزون', icon: Package, description: 'إدارة المخزون والموردين' },
    { id: 'notifications', name: 'الإشعارات', icon: Bell, description: 'إعدادات الإشعارات والتنبيهات' },
    { id: 'appearance', name: 'المظهر', icon: Palette, description: 'تخصيص مظهر التطبيق' },
    { id: 'security', name: 'الأمان', icon: Shield, description: 'إعدادات الأمان والصلاحيات' },
    { id: 'backup', name: 'النسخ الاحتياطي', icon: Database, description: 'إدارة النسخ الاحتياطي' },
    { id: 'advanced', name: 'متقدم', icon: SettingsAdvanced, description: 'الإعدادات المتقدمة' },
    { id: 'reports', name: 'التقارير', icon: FileText, description: 'إعدادات التقارير' },
    { id: 'users', name: 'المستخدمين', icon: Users, description: 'إدارة المستخدمين والصلاحيات' }
  ].filter(tab => canAccessTab(tab.id as keyof SettingsData));

  // دالة تحديث الإعدادات
  const updateSettings = (category: keyof SettingsData, newSettings: Record<string, unknown>) => {
    setSettings(prev => ({
      ...prev,
      [category]: { ...prev[category], ...newSettings }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <SettingsIcon className="h-8 w-8 text-primary-600 ml-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">إعدادات النظام</h1>
            <p className="text-gray-600">تخصيص وإدارة إعدادات التطبيق</p>
          </div>
        </div>

        {/* أزرار التصدير والاستيراد (للمديرين فقط) */}
        {canEdit('general') && (
          <div className="flex items-center space-x-3 space-x-reverse">
            <label className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg cursor-pointer transition-colors duration-200">
              <Upload className="h-4 w-4 ml-2" />
              استيراد الإعدادات
              <input
                type="file"
                accept=".json"
                onChange={handleImportSettings}
                className="hidden"
              />
            </label>
            <button
              onClick={handleExportSettings}
              className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
            >
              <Download className="h-4 w-4 ml-2" />
              تصدير الإعدادات
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <nav className="space-y-2">
              {availableTabs.map((tab) => {
                const Icon = tab.icon;
                const isLoading = tabState[tab.id as keyof SettingsData]?.loading;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as keyof SettingsData)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                      activeTab === tab.id
                        ? 'bg-primary-50 text-primary-700 border-r-4 border-primary-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    title={tab.description}
                  >
                    <div className="flex items-center">
                      <Icon className="h-5 w-5 ml-3" />
                      {tab.name}
                    </div>
                    {isLoading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {activeTab === 'general' && (
              <GeneralSettingsTab
                settings={settings.general}
                setSettings={(newSettings) => updateSettings('general', newSettings)}
                tabState={tabState.general}
                onSave={() => handleSaveSettings('general')}
                onReset={() => handleResetSettings('general')}
                canEdit={canEdit}
              />
            )}

            {activeTab === 'business' && (
              <BusinessSettingsTab
                settings={settings.business}
                setSettings={(newSettings) => updateSettings('business', newSettings)}
                tabState={tabState.business}
                onSave={() => handleSaveSettings('business')}
                onReset={() => handleResetSettings('business')}
                canEdit={canEdit}
              />
            )}

            {activeTab === 'inventory' && (
              <InventorySettingsTab
                settings={settings.inventory}
                setSettings={(newSettings) => updateSettings('inventory', newSettings)}
                tabState={tabState.inventory}
                onSave={() => handleSaveSettings('inventory')}
                onReset={() => handleResetSettings('inventory')}
                canEdit={canEdit}
              />
            )}

            {activeTab === 'notifications' && (
              <NotificationSettingsTab
                settings={settings.notifications}
                setSettings={(newSettings) => updateSettings('notifications', newSettings)}
                tabState={tabState.notifications}
                onSave={() => handleSaveSettings('notifications')}
                onReset={() => handleResetSettings('notifications')}
                canEdit={canEdit}
              />
            )}

            {activeTab === 'appearance' && (
              <AppearanceSettingsTab
                settings={settings.appearance}
                setSettings={(newSettings) => updateSettings('appearance', newSettings)}
                tabState={tabState.appearance}
                onSave={() => handleSaveSettings('appearance')}
                onReset={() => handleResetSettings('appearance')}
                canEdit={canEdit}
              />
            )}

            {activeTab === 'security' && (
              <SecuritySettingsTab
                settings={settings.security}
                setSettings={(newSettings) => updateSettings('security', newSettings)}
                tabState={tabState.security}
                onSave={() => handleSaveSettings('security')}
                onReset={() => handleResetSettings('security')}
                canEdit={canEdit}
              />
            )}

            {activeTab === 'backup' && (
              <BackupSettingsTab
                settings={settings.backup}
                setSettings={(newSettings) => updateSettings('backup', newSettings)}
                tabState={tabState.backup}
                onSave={() => handleSaveSettings('backup')}
                onReset={() => handleResetSettings('backup')}
                canEdit={canEdit}
                onCreateBackup={handleCreateBackup}
              />
            )}

            {activeTab === 'advanced' && (
              <AdvancedSettingsTab
                settings={settings.advanced}
                setSettings={(newSettings) => updateSettings('advanced', newSettings)}
                tabState={tabState.advanced}
                onSave={() => handleSaveSettings('advanced')}
                onReset={() => handleResetSettings('advanced')}
                canEdit={canEdit}
              />
            )}

            {activeTab === 'reports' && (
              <ReportSettingsTab
                settings={settings.reports}
                setSettings={(newSettings) => updateSettings('reports', newSettings)}
                tabState={tabState.reports}
                onSave={() => handleSaveSettings('reports')}
                onReset={() => handleResetSettings('reports')}
                canEdit={canEdit}
              />
            )}

            {activeTab === 'users' && (
              <UserSettingsTab
                settings={settings.users}
                setSettings={(newSettings) => updateSettings('users', newSettings)}
                tabState={tabState.users}
                onSave={() => handleSaveSettings('users')}
                onReset={() => handleResetSettings('users')}
                canEdit={canEdit}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
