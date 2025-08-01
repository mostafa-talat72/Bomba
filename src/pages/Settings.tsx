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
  Settings as SettingsAdvanced,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  Save,
  X
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
  const { user, api } = useApp();
  const [activeTab, setActiveTab] = useState<keyof SettingsData>('general');
  const [settingsSummary, setSettingsSummary] = useState<any>(null);
  const [globalState, setGlobalState] = useState<{
    loading: boolean;
    saving: boolean;
    error: string;
    success: string;
  }>({
    loading: false,
    saving: false,
    error: '',
    success: ''
  });

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
        partialPayment: true,
        overduePayment: true
      },
      sound: {
        enabled: true,
        volume: 50,
        defaultTone: 'default',
        priorityTones: true,
        customTones: {}
      },
      display: {
        showCount: true,
        autoMarkRead: false,
        displayDuration: 5000,
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
      fontFamily: 'Cairo',
      sidebarVisible: true,
      userInfoVisible: true,
      fullscreenMode: false,
      rtlEnabled: true,
      animations: {
        enabled: true,
        duration: 300
      },
      customCSS: ''
    },
    security: {
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
        expiryDays: 90,
        preventReuse: 5
      },
      session: {
        timeout: 30,
        maxConcurrent: 3,
        forceLogout: false,
        rememberMe: true,
        ipRestriction: false,
        allowedIPs: []
      },
      audit: {
        enabled: true,
        logLevel: 'info',
        retentionDays: 90,
        logActions: ['login', 'logout', 'settings_change', 'data_export']
      },
      permissions: {
        allowMultiLogin: true,
        requireApproval: false,
        dataEncryption: false,
        twoFactorAuth: false,
        loginAttempts: 5,
        lockoutDuration: 15
      },
      api: {
        rateLimit: 100,
        apiKeyExpiry: 30,
        corsEnabled: true,
        allowedOrigins: ['http://localhost:3000']
      }
    },
    backup: {
      autoBackup: {
        enabled: false,
        frequency: 'daily',
        keepCount: 7,
        time: '02:00',
        compression: true,
        encryption: false
      },
      manualBackup: {
        lastBackup: null,
        backupSize: '0 MB',
        backupLocation: './backups'
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
        logs: 90,
        backups: 30,
        tempFiles: 7,
        userSessions: 30,
        auditLogs: 365
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
          provider: '',
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
          permissions: ['all'],
          description: 'صلاحيات كاملة على النظام'
        },
        {
          id: 'admin',
          name: 'مدير',
          permissions: ['dashboard', 'playstation', 'computer', 'cafe', 'menu', 'billing', 'reports', 'inventory', 'costs', 'users', 'settings'],
          description: 'إدارة كاملة للنظام'
        },
        {
          id: 'manager',
          name: 'مشرف',
          permissions: ['dashboard', 'playstation', 'computer', 'cafe', 'menu', 'billing', 'reports', 'inventory'],
          description: 'إدارة العمليات اليومية'
        },
        {
          id: 'cashier',
          name: 'كاشير',
          permissions: ['dashboard', 'playstation', 'computer', 'cafe', 'billing'],
          description: 'إدارة المبيعات والمدفوعات'
        },
        {
          id: 'kitchen',
          name: 'مطبخ',
          permissions: ['dashboard', 'cafe', 'menu'],
          description: 'إدارة الطلبات والمطبخ'
        },
        {
          id: 'staff',
          name: 'موظف',
          permissions: ['dashboard', 'playstation', 'computer'],
          description: 'إدارة الجلسات والأجهزة'
        }
      ],
      defaultPermissions: {
        owner: ['all'],
        admin: ['dashboard', 'playstation', 'computer', 'cafe', 'menu', 'billing', 'reports', 'inventory', 'costs', 'users', 'settings'],
        manager: ['dashboard', 'playstation', 'computer', 'cafe', 'menu', 'billing', 'reports', 'inventory'],
        cashier: ['dashboard', 'playstation', 'computer', 'cafe', 'billing'],
        kitchen: ['dashboard', 'cafe', 'menu'],
        staff: ['dashboard', 'playstation', 'computer']
      },
      userManagement: {
        allowRegistration: false,
        requireEmailVerification: true,
        requirePhoneVerification: false,
        maxUsers: 50,
        inactiveUserTimeout: 90
      },
      profile: {
        allowAvatar: true,
        allowCustomFields: true,
        requiredFields: ['name', 'email', 'role']
      }
    }
  });

  // حالة كل تبويب
  const [tabStates, setTabStates] = useState<Record<keyof SettingsData, TabState>>({
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

  // تحميل ملخص الإعدادات
  useEffect(() => {
    loadSettingsSummary();
  }, []);

  const loadSettingsSummary = async () => {
    try {
      setGlobalState(prev => ({ ...prev, loading: true }));
      const response = await api.getSettingsSummary();
      if (response.success) {
        setSettingsSummary(response.data);
      }
    } catch (error) {
      console.error('Error loading settings summary:', error);
    } finally {
      setGlobalState(prev => ({ ...prev, loading: false }));
    }
  };

  // الحصول على صلاحيات المستخدم
  const getUserPermissions = (): Permission[] => {
    if (!user) return [];
    return user.permissions || [];
  };

  // التحقق من إمكانية الوصول للتبويب
  const canAccessTab = (tabId: keyof SettingsData): boolean => {
    const permissions = getUserPermissions();

    // صاحب المنشأة له صلاحيات كاملة
    if (user?.role === 'owner' || permissions.includes('all')) {
      return true;
    }

    // التحقق من الصلاحيات المطلوبة لكل تبويب
    const tabPermissions: Record<keyof SettingsData, string[]> = {
      general: ['settings'],
      business: ['settings'],
      inventory: ['settings', 'inventory'],
      notifications: ['settings'],
      appearance: ['settings'],
      security: ['settings'],
      backup: ['settings'],
      advanced: ['settings'],
      reports: ['settings', 'reports'],
      users: ['settings', 'users']
    };

    const requiredPermissions = tabPermissions[tabId] || ['settings'];
    return requiredPermissions.some(permission => permissions.includes(permission));
  };

  // التحقق من إمكانية التعديل
  const canEdit = (path: string): boolean => {
    const permissions = getUserPermissions();

    if (user?.role === 'owner' || permissions.includes('all')) {
      return true;
    }

    // التحقق من الصلاحيات حسب المسار
    if (path.includes('security') || path.includes('users')) {
      return permissions.includes('settings') && permissions.includes('users');
    }

    if (path.includes('inventory')) {
      return permissions.includes('settings') && permissions.includes('inventory');
    }

    if (path.includes('reports')) {
      return permissions.includes('settings') && permissions.includes('reports');
    }

    return permissions.includes('settings');
  };

  // تحميل إعدادات التبويب
  const fetchTabSettings = async (category: keyof SettingsData) => {
    if (!canAccessTab(category)) {
      setTabStates(prev => ({
        ...prev,
        [category]: { ...prev[category], error: 'ليس لديك صلاحية للوصول لهذه الإعدادات' }
      }));
      return;
    }

    try {
      setTabStates(prev => ({
        ...prev,
        [category]: { ...prev[category], loading: true, error: '', success: '' }
      }));

      const response = await api.getSettings(category);

      if (response.success) {
        setSettings(prev => ({
          ...prev,
          [category]: response.data.settings
        }));

        // عرض التحذيرات إذا وجدت
        if (response.data.validationErrors && response.data.validationErrors.length > 0) {
          const warnings = response.data.validationErrors.filter((err: any) => err.severity === 'warning');
          if (warnings.length > 0) {
            setGlobalState(prev => ({
              ...prev,
              success: `تم تحميل الإعدادات مع ${warnings.length} تحذير`
            }));
          }
        }
      }
    } catch (error: any) {
      setTabStates(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          error: error.message || 'خطأ في تحميل الإعدادات'
        }
      }));
    } finally {
      setTabStates(prev => ({
        ...prev,
        [category]: { ...prev[category], loading: false }
      }));
    }
  };

  // حفظ إعدادات التبويب
  const handleSaveSettings = async (category: keyof SettingsData) => {
    if (!canEdit(category)) {
      setTabStates(prev => ({
        ...prev,
        [category]: { ...prev[category], error: 'ليس لديك صلاحية لتعديل هذه الإعدادات' }
      }));
      return;
    }

    try {
      setTabStates(prev => ({
        ...prev,
        [category]: { ...prev[category], saving: true, error: '', success: '' }
      }));

      const response = await api.updateSettings(category, settings[category]);

      if (response.success) {
        setTabStates(prev => ({
          ...prev,
          [category]: { ...prev[category], success: 'تم حفظ الإعدادات بنجاح' }
        }));

        // إعادة تحميل ملخص الإعدادات
        await loadSettingsSummary();

        // عرض التحذيرات إذا وجدت
        if (response.data.validationErrors && response.data.validationErrors.length > 0) {
          const warnings = response.data.validationErrors.filter((err: any) => err.severity === 'warning');
          if (warnings.length > 0) {
            setGlobalState(prev => ({
              ...prev,
              success: `تم حفظ الإعدادات مع ${warnings.length} تحذير`
            }));
          }
        }
      }
    } catch (error: any) {
      setTabStates(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          error: error.message || 'خطأ في حفظ الإعدادات'
        }
      }));
    } finally {
      setTabStates(prev => ({
        ...prev,
        [category]: { ...prev[category], saving: false }
      }));
    }
  };

  // إعادة تعيين إعدادات التبويب
  const handleResetSettings = async (category: keyof SettingsData) => {
    if (!canEdit(category)) {
      setTabStates(prev => ({
        ...prev,
        [category]: { ...prev[category], error: 'ليس لديك صلاحية لإعادة تعيين هذه الإعدادات' }
      }));
      return;
    }

    try {
      setTabStates(prev => ({
        ...prev,
        [category]: { ...prev[category], saving: true, error: '', success: '' }
      }));

      const response = await api.resetSettings(category);

      if (response.success) {
        setSettings(prev => ({
          ...prev,
          [category]: response.data.settings
        }));

        setTabStates(prev => ({
          ...prev,
          [category]: { ...prev[category], success: 'تم إعادة تعيين الإعدادات بنجاح' }
        }));

        await loadSettingsSummary();
      }
    } catch (error: any) {
      setTabStates(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          error: error.message || 'خطأ في إعادة تعيين الإعدادات'
        }
      }));
    } finally {
      setTabStates(prev => ({
        ...prev,
        [category]: { ...prev[category], saving: false }
      }));
    }
  };

  // إنشاء نسخة احتياطية
  const handleCreateBackup = async () => {
    try {
      setGlobalState(prev => ({ ...prev, saving: true }));
      const response = await api.exportSettings();
      if (response.success) {
        // تحميل الملف
        const blob = new Blob([JSON.stringify(response.data, null, 2)], {
          type: 'application/json'
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bomba-settings-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);

        setGlobalState(prev => ({ ...prev, success: 'تم تصدير الإعدادات بنجاح' }));
      }
    } catch (error: any) {
      setGlobalState(prev => ({ ...prev, error: error.message || 'خطأ في تصدير الإعدادات' }));
    } finally {
      setGlobalState(prev => ({ ...prev, saving: false }));
    }
  };

  // تصدير الإعدادات
  const handleExportSettings = () => {
    handleCreateBackup();
  };

  // استيراد الإعدادات
  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setGlobalState(prev => ({ ...prev, saving: true }));
        const importData = JSON.parse(e.target?.result as string);

        const response = await api.importSettings(importData);
        if (response.success) {
          setGlobalState(prev => ({
            ...prev,
            success: `تم استيراد ${response.data.imported} فئة إعدادات بنجاح`
          }));

          // إعادة تحميل الإعدادات الحالية
          await fetchTabSettings(activeTab);
          await loadSettingsSummary();
        }
      } catch (error: any) {
        setGlobalState(prev => ({
          ...prev,
          error: error.message || 'خطأ في استيراد الإعدادات'
        }));
      } finally {
        setGlobalState(prev => ({ ...prev, saving: false }));
      }
    };
    reader.readAsText(file);
  };

  // تحديث الإعدادات
  const updateSettings = (category: keyof SettingsData, newSettings: Record<string, unknown>) => {
    setSettings(prev => ({
      ...prev,
      [category]: { ...prev[category], ...newSettings }
    }));
  };

  // تحميل الإعدادات عند تغيير التبويب
  useEffect(() => {
    fetchTabSettings(activeTab);
  }, [activeTab]);

  // مسح الرسائل بعد فترة
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalState(prev => ({ ...prev, error: '', success: '' }));
      setTabStates(prev => {
        const newStates = { ...prev };
        Object.keys(newStates).forEach(key => {
          newStates[key as keyof SettingsData] = {
            ...newStates[key as keyof SettingsData],
            error: '',
            success: ''
          };
        });
        return newStates;
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [globalState.error, globalState.success]);

  // تعريف التبويبات
  const tabs = [
    { id: 'general', name: 'عام', icon: SettingsIcon, color: 'text-blue-600' },
    { id: 'business', name: 'الأعمال', icon: Briefcase, color: 'text-green-600' },
    { id: 'inventory', name: 'المخزون', icon: Package, color: 'text-orange-600' },
    { id: 'notifications', name: 'الإشعارات', icon: Bell, color: 'text-purple-600' },
    { id: 'appearance', name: 'المظهر', icon: Palette, color: 'text-pink-600' },
    { id: 'security', name: 'الأمان', icon: Shield, color: 'text-red-600' },
    { id: 'backup', name: 'النسخ الاحتياطي', icon: Database, color: 'text-indigo-600' },
    { id: 'advanced', name: 'متقدم', icon: SettingsAdvanced, color: 'text-gray-600' },
    { id: 'reports', name: 'التقارير', icon: FileText, color: 'text-teal-600' },
    { id: 'users', name: 'المستخدمين', icon: Users, color: 'text-cyan-600' }
  ];

  // تصفية التبويبات حسب الصلاحيات
  const accessibleTabs = tabs.filter(tab => canAccessTab(tab.id as keyof SettingsData));

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">الإعدادات</h1>
              <p className="text-gray-600">إدارة إعدادات النظام والصلاحيات</p>
            </div>

            {/* ملخص الإعدادات */}
            {settingsSummary && (
              <div className="flex items-center space-x-4 space-x-reverse">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{settingsSummary.totalCategories}</div>
                  <div className="text-sm text-gray-500">فئة إعدادات</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{settingsSummary.customSettings}</div>
                  <div className="text-sm text-gray-500">مخصصة</div>
                </div>
                {settingsSummary.categoriesWithErrors > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{settingsSummary.categoriesWithErrors}</div>
                    <div className="text-sm text-gray-500">أخطاء</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* رسائل الحالة العامة */}
          {globalState.error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 ml-2" />
              <span className="text-red-700">{globalState.error}</span>
              <button
                onClick={() => setGlobalState(prev => ({ ...prev, error: '' }))}
                className="mr-auto text-red-500 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {globalState.success && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 ml-2" />
              <span className="text-green-700">{globalState.success}</span>
              <button
                onClick={() => setGlobalState(prev => ({ ...prev, success: '' }))}
                className="mr-auto text-green-500 hover:text-green-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">التصنيفات</h3>

              <nav className="space-y-2">
                {accessibleTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const tabState = tabStates[tab.id as keyof SettingsData];

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as keyof SettingsData)}
                      className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ml-2 ${tab.color}`} />
                      <span className="flex-1 text-right">{tab.name}</span>

                      {/* مؤشرات الحالة */}
                      {tabState.loading && (
                        <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                      )}
                      {tabState.saving && (
                        <Save className="h-4 w-4 text-green-500" />
                      )}
                      {tabState.error && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      {tabState.success && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* أزرار التصدير والاستيراد */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-3">النسخ الاحتياطي</h4>

                <div className="space-y-2">
                  <button
                    onClick={handleExportSettings}
                    disabled={globalState.saving}
                    className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4 ml-2" />
                    تصدير الإعدادات
                  </button>

                  <label className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 cursor-pointer">
                    <Upload className="h-4 w-4 ml-2" />
                    استيراد الإعدادات
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportSettings}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm">
              {/* Tab Content */}
              <div className="p-6">
                {(() => {
                  const tabState = tabStates[activeTab];
                  const currentSettings = settings[activeTab];

                  const tabProps = {
                    settings: currentSettings,
                    setSettings: (newSettings: any) => updateSettings(activeTab, newSettings),
                    tabState,
                    onSave: () => handleSaveSettings(activeTab),
                    onReset: () => handleResetSettings(activeTab),
                    canEdit: (path: string) => canEdit(path),
                    onCreateBackup: handleCreateBackup
                  };

                  switch (activeTab) {
                    case 'general':
                      return <GeneralSettingsTab {...tabProps} />;
                    case 'business':
                      return <BusinessSettingsTab {...tabProps} />;
                    case 'inventory':
                      return <InventorySettingsTab {...tabProps} />;
                    case 'notifications':
                      return <NotificationSettingsTab {...tabProps} />;
                    case 'appearance':
                      return <AppearanceSettingsTab {...tabProps} />;
                    case 'security':
                      return <SecuritySettingsTab {...tabProps} />;
                    case 'backup':
                      return <BackupSettingsTab {...tabProps} />;
                    case 'advanced':
                      return <AdvancedSettingsTab {...tabProps} />;
                    case 'reports':
                      return <ReportSettingsTab {...tabProps} />;
                    case 'users':
                      return <UserSettingsTab {...tabProps} />;
                    default:
                      return <div>تبويب غير موجود</div>;
                  }
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
