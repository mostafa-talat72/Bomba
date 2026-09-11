import { useState, useEffect, FC, useRef } from 'react';
import { Settings as SettingsIcon, Save, Bell, BellRing, User, Lock, Eye, EyeOff, Building2, LucideIcon, Facebook, Instagram, Twitter, Linkedin, Youtube, MessageCircle, Send, Globe, Phone, Mail, MapPin, Users, Check, X, Clock, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { clearFreshPrintSettingsCache } from '../utils/freshPrintSettings';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useOrganization } from '../context/OrganizationContext';
import { ReportSettingsSection } from '../components/ReportSettingsSection';
import { PayrollPermissionsSection } from '../components/PayrollPermissionsSection';
import PrinterSettingsForm from '../components/settings/PrinterSettingsForm';
import UserNotificationPrefsForm from '../components/UserNotificationPrefsForm';
import MobileConnectCard from '../components/MobileConnectCard';
import ConnectedDevicesCard from '../components/ConnectedDevicesCard';
import { WORLD_TIMEZONES } from '../../shared/timezones';
import { getCurrencyName } from '../../shared/currencyNames';
import { CURRENCY_SYMBOLS } from '../../shared/currencySymbols';
import { getTimezoneName } from '../../shared/timezoneNames';
import { WORLD_LANGUAGES } from '../../shared/languages';
import api from '../services/api';
import { apiClient } from '../services/api/client';
import ServerConnectionModal from '../components/ServerConnectionModal';
import ConfirmModal from '../components/ConfirmModal';
import ModalPortal from '../components/ModalPortal';
import { openCashDrawerThroughAgent } from '../utils/localPrintBridge';

// Type for alert messages
type AlertType = 'success' | 'error' | 'info' | 'warning';

interface TabType {
  id: string;
  name: string;
  icon: LucideIcon;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ShowPasswords {
  current: boolean;
  new: boolean;
  confirm: boolean;
}

interface NotificationSettings {
  sessionNotifications: boolean;
  orderNotifications: boolean;
  inventoryNotifications: boolean;
  billingNotifications: boolean;
  soundEnabled: boolean;
  emailNotifications: boolean;
  showNotificationCount: boolean;
  autoMarkAsRead: boolean;
}

interface GeneralSettings {
  theme: string;
  language: string;
  backupPath: string;
}

interface ProfileData {
  name: string;
  email: string;
  username: string;
  phone: string;
  address: string;
}

interface OrganizationData {
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  websiteUrl: string;
  timezone?: string;
  currency?: string;
  socialLinks: {
    facebook: string;
    instagram: string;
    twitter: string;
    linkedin: string;
    youtube: string;
    tiktok: string;
    whatsapp: string;
    telegram: string;
    location: string;
  };
  workingHours: {
    [key: string]: {
      open: string;
      close: string;
      closed: boolean;
      is24Hours: boolean;
    };
  };
  logo: string;
  printSettings: {
    printQRCode: boolean;
    promptOrderPrintSections?: boolean;
    defaultOrderPrintSections?: string[];
    autoPrintOrderSections?: boolean;
    printers?: Array<{ id: string; name: string; printerName: string; printerPath?: string; paperWidthMm?: number }>;
    sectionPrinterMap?: Record<string, string>;
    documentPrinterMap?: Record<string, string>;
    printerType?: string;
    printerDevice?: string;
    printerIP?: string;
    printerPort?: number;
    openCashDrawer?: boolean;
    openCashDrawerOnPayment?: boolean;
    openCashDrawerShortcut?: boolean;
    autoPrintOnPayment?: boolean;
    charactersPerLine?: number;
    printHeader?: boolean;
    printFooter?: boolean;
    autoCut?: boolean;
  };
}

interface OrganizationPermissions {
  canEdit: boolean;
  isOwner: boolean;
  isAuthorizedAdmin: boolean;
  allowManagersToEditOrganization: boolean;
  authorizedManagers: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
}

interface Manager {
  _id: string;
  name: string;
  email: string;
}

const Settings: FC = () => {
  const { t } = useTranslation();
  const { currentLanguage, isRTL, changeLanguage } = useLanguage();
  const { isDarkMode, toggleDarkMode, setTheme } = useTheme();
  const { refreshOrganizationSettings, setCurrency, setTimezone } = useOrganization();
  const folderInputRef = useRef<HTMLInputElement>(null);

  const { user, updateUserProfile, updateMyPrintSettings, changePassword, updateGeneralSettings, getGeneralSettings, getOrganization, updateOrganization, updateOrganizationPermissions, canEditOrganization, getAvailableManagers, getReportSettings, updateReportSettings, canManageReports, sendReportNow, canManagePayroll, updatePayrollPermissions } = useApp();
  const { setUser } = useAuth();
  // Sensitive sections (backups, server address, DB maintenance, device
  // management, chrome-only QR): owner + admins only.
  const isManager = user?.role === 'admin' || user?.role === 'owner';

  // UI State
  const [activeTab, setActiveTab] = useState('profile');
  
  // Loading states
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [generalSaving, setGeneralSaving] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const serverUrlDisplay = apiClient.baseURL.replace(/\/api$/, '');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState<string | null>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [lastBackup, setLastBackup] = useState<any>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [organizationSaving, setOrganizationSaving] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  
  // Printer detection states
  const [detectingPrinters, setDetectingPrinters] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [testingDrawer, setTestingDrawer] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<any[]>([]);
  const [printerStatus, setPrinterStatus] = useState<'idle' | 'ready' | 'offline'>('idle');
  
  // Alert state
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<AlertType>('info');
  
  // Profile state
  const [profile, setProfile] = useState<ProfileData>({
    name: user?.name || '',
    email: user?.email || '',
    username: user?.username || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });

  // Password change state
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [showPasswords, setShowPasswords] = useState<ShowPasswords>({
    current: false,
    new: false,
    confirm: false,
  });

  // General settings state
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    theme: 'light',
    language: 'ar',
    backupPath: localStorage.getItem('backupPath') || '',
  });

  // Organization state
  const [organization, setOrganization] = useState<OrganizationData>({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    websiteUrl: '',
    timezone: 'Africa/Cairo',
    currency: 'EGP',
    socialLinks: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      youtube: '',
      tiktok: '',
      whatsapp: '',
      telegram: '',
      location: '',
    },
    workingHours: {
      monday: { open: '09:00', close: '22:00', closed: false, is24Hours: false },
      tuesday: { open: '09:00', close: '22:00', closed: false, is24Hours: false },
      wednesday: { open: '09:00', close: '22:00', closed: false, is24Hours: false },
      thursday: { open: '09:00', close: '22:00', closed: false, is24Hours: false },
      friday: { open: '09:00', close: '22:00', closed: false, is24Hours: false },
      saturday: { open: '09:00', close: '22:00', closed: false, is24Hours: false },
      sunday: { open: '09:00', close: '22:00', closed: false, is24Hours: false },
    },
    logo: '',
    printSettings: {
      printQRCode: true,
        promptOrderPrintSections: false,
      printers: [],
      sectionPrinterMap: {},
      documentPrinterMap: {},
    },
  });

  const [organizationPermissions, setOrganizationPermissions] = useState<OrganizationPermissions>({
    canEdit: false,
    isOwner: false,
    isAuthorizedAdmin: false,
    allowManagersToEditOrganization: false,
    authorizedManagers: [],
  });

  const [availableManagers, setAvailableManagers] = useState<Manager[]>([]);
  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);
  const [organizationLoading, setOrganizationLoading] = useState(true);
  const [menuSections, setMenuSections] = useState<Array<{ _id?: string; id?: string; name: string }>>([]);

  // My printer settings state (per-user override with org fallback)
  const [myPrint, setMyPrint] = useState<{ useCustom: boolean; settings: Record<string, any>; orgDefaults: Record<string, any> }>({
    useCustom: false,
    settings: {},
    orgDefaults: {},
  });
  const [myPrintLoading, setMyPrintLoading] = useState(true);
  const [myPrintSaving, setMyPrintSaving] = useState(false);
  // My notification settings state (per-user, follows the user on any device)
  const [myNotif, setMyNotif] = useState<Record<string, any>>({});
  const [myNotifLoading, setMyNotifLoading] = useState(true);
  const [myNotifSaving, setMyNotifSaving] = useState(false);
  const [typeAuditRunning, setTypeAuditRunning] = useState(false);
  const [typeAuditResult, setTypeAuditResult] = useState<string | null>(null);

  // Payroll settings state
  const [payrollSettings, setPayrollSettings] = useState({
    workHoursPerDay: 10,
  });
  const [payrollSaving, setPayrollSaving] = useState(false);

  // Report settings state
  const [reportSettings, setReportSettings] = useState({
    dailyReportEnabled: true,
    dailyReportStartTime: '08:00',
    dailyReportSendTime: '09:00',
    dailyReportEmails: [],
    authorizedToManageReports: [],
  });
  const [reportPermissions, setReportPermissions] = useState({
    canManage: false,
    isOwner: false,
  });
  const [reportSettingsLoading, setReportSettingsLoading] = useState(true);

  // Payroll permissions state
  const [payrollPermissions, setPayrollPermissions] = useState({
    allowManagersToManagePayroll: false,
    authorizedPayrollManagers: [],
  });
  const [payrollPermissionsData, setPayrollPermissionsData] = useState({
    canManage: false,
    isOwner: false,
  });
  const [payrollPermissionsLoading, setPayrollPermissionsLoading] = useState(true);

  // Show alert function
  const showAlertMessage = (message: string, type: AlertType = 'success') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 5000);
  };

  // Update profile when user data is loaded or changed
  useEffect(() => {
    if (user) {
      const newProfile = {
        name: user.name || '',
        email: user.email || '',
        username: user.username || '',
        phone: user.phone || '',
        address: user.address || '',
      };
      
      // Only update if the data has actually changed to avoid unnecessary re-renders
      setProfile(prev => {
        const hasChanged = 
          prev.name !== newProfile.name ||
          prev.email !== newProfile.email ||
          prev.username !== newProfile.username ||
          prev.phone !== newProfile.phone ||
          prev.address !== newProfile.address;
        
        if (hasChanged) {
       
          return newProfile;
        }
        
        return prev;
      });
    } else {
    }
  }, [user]);

  // Load settings from database
  useEffect(() => {
    const loadSettings = async () => {
      if (user) {
        try {
          // Load general settings
          const genSettings = await getGeneralSettings();
          if (genSettings) {
            setGeneralSettings(prev => ({
              ...prev,
              theme: genSettings.theme || 'light',
              language: genSettings.language || currentLanguage,
              backupPath: localStorage.getItem('backupPath') || '',
            }));
          }
        } catch (error) {
          console.error('Error loading settings:', error);
          showAlertMessage(t('settings.errors.loadSettings'), 'warning');
        }
      }
    };

    loadSettings();
  }, [user, getGeneralSettings]);

  // Load organization data and permissions
  useEffect(() => {
    const loadOrganizationData = async () => {
      setOrganizationLoading(true);
      try {
        // Load organization data
        const orgData = await getOrganization();
        if (orgData) {
          setOrganization(prev => ({
            ...prev,
            ...orgData,
            socialLinks: {
              ...prev.socialLinks,
              ...orgData.socialLinks,
            },
            workingHours: {
              ...prev.workingHours,
              ...Object.keys(orgData.workingHours || {}).reduce((acc, day) => {
                const dayData = orgData.workingHours[day];
                if (dayData) {
                  acc[day] = {
                    open: dayData.open || '09:00',
                    close: dayData.close || '22:00',
                    closed: dayData.closed || false,
                    is24Hours: dayData.is24Hours || false
                  };
                }
                return acc;
              }, {} as any)
            },
            printSettings: {
              ...prev.printSettings,
              ...orgData.printSettings,
            },
          }));
          const sectionsResponse = await api.getMenuSections();
          if (sectionsResponse.success && sectionsResponse.data) setMenuSections(sectionsResponse.data);
        }

        // Load permissions
        const permissions = await canEditOrganization();
        if (permissions) {
          setOrganizationPermissions(permissions);
          if (permissions.authorizedManagers && Array.isArray(permissions.authorizedManagers)) {
            setSelectedManagers(permissions.authorizedManagers.map((m: any) => m._id));
          }
        }

        // Load available managers if user is owner
        if (permissions?.isOwner) {
          const managers = await getAvailableManagers();
          if (managers && Array.isArray(managers)) {
            setAvailableManagers(managers);
          }
        }
      } catch (error) {
        console.error('Error loading organization data:', error);
        showAlertMessage(t('settings.organization.errors.loadOrganization'), 'error');
      } finally {
        setOrganizationLoading(false);
      }
    };

    const loadMyPrintSettings = async () => {
      setMyPrintLoading(true);
      try {
        const res = await api.getMyPrintSettings();
        if (res.success && res.data) {
          setMyPrint({
            useCustom: res.data.useCustomPrintSettings === true,
            settings: res.data.printSettings || {},
            orgDefaults: res.data.organizationDefaults || {},
          });
        }
      } catch (error) {
        console.error('Error loading my print settings:', error);
      } finally {
        setMyPrintLoading(false);
      }
    };

    const loadMyNotifSettings = async () => {
      setMyNotifLoading(true);
      try {
        const res = await (api as any).getMyNotificationSettings();
        if (res?.success && res.data) setMyNotif(res.data);
      } catch (error) {
        console.error('Error loading my notification settings:', error);
      } finally {
        setMyNotifLoading(false);
      }
    };

    if (user) {
      loadOrganizationData();
      loadMyPrintSettings();
      loadMyNotifSettings();
    }
  }, [user, getOrganization, canEditOrganization, getAvailableManagers]);

  // Load report settings
  useEffect(() => {
    const loadReportSettings = async () => {
      setReportSettingsLoading(true);
      try {
        // Load report permissions
        const permissions = await canManageReports();
        if (permissions) {
          setReportPermissions({
            canManage: permissions.canManage || false,
            isOwner: permissions.isOwner || false,
          });
        }

        // Load report settings
        const settings = await getReportSettings();
        if (settings) {
          setReportSettings({
            dailyReportEnabled: settings.dailyReportEnabled ?? true,
            dailyReportStartTime: settings.dailyReportStartTime || '08:00',
            dailyReportSendTime: settings.dailyReportSendTime || '09:00',
            dailyReportEmails: settings.dailyReportEmails || [],
            authorizedToManageReports: settings.authorizedToManageReports?.map((m: any) => m._id || m) || [],
          });
        }
      } catch (error) {
        console.error('Error loading report settings:', error);
      } finally {
        setReportSettingsLoading(false);
      }
    };

    if (user) {
      loadReportSettings();
    }
  }, [user, canManageReports, getReportSettings]);

  // Load payroll permissions
  useEffect(() => {
    const loadPayrollPermissions = async () => {
      setPayrollPermissionsLoading(true);
      try {
        // Load payroll permissions check
        const permissions = await canManagePayroll();
        if (permissions) {
          setPayrollPermissionsData({
            canManage: permissions.canManage || false,
            isOwner: permissions.isOwner || false,
          });
          
          // Load payroll permissions settings
          if (permissions.permissions) {
            setPayrollPermissions({
              allowManagersToManagePayroll: permissions.permissions.allowManagersToManagePayroll || false,
              authorizedPayrollManagers: permissions.permissions.authorizedPayrollManagers?.map((m: any) => m._id || m) || [],
            });
          }
        }
      } catch (error) {
        console.error('Error loading payroll permissions:', error);
      } finally {
        setPayrollPermissionsLoading(false);
      }
    };

    if (user) {
      loadPayrollPermissions();
    }
  }, [user, canManagePayroll]);

  // Load payroll settings
  useEffect(() => {
    const loadPayrollSettings = async () => {
      if (user) {
        try {
          const response = await fetch('/api/settings/payroll', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              setPayrollSettings(prev => ({
                ...prev,
                ...data.data,
              }));
            }
          }
        } catch (error) {
          console.error('Error loading payroll settings:', error);
        }
      }
    };

    loadPayrollSettings();
  }, [user]);

  // Show loading state if user is not loaded yet
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 dark:border-orange-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const handleProfileUpdate = async () => {
    if (!profile.name.trim() || !profile.email.trim()) {
      showAlertMessage(t('settings.profile.errors.nameEmailRequired'), 'error');
      return;
    }

    setProfileSaving(true);
    try {
      const success = await updateUserProfile(profile);
      if (success) {
        showAlertMessage(t('settings.profile.success'));
      } else {
        showAlertMessage(t('settings.profile.errors.updateFailed'), 'error');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      showAlertMessage(t('settings.profile.errors.unexpected'), 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      showAlertMessage(t('settings.password.errors.allFieldsRequired'), 'error');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showAlertMessage(t('settings.password.errors.passwordMismatch'), 'error');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showAlertMessage(t('settings.password.errors.passwordMinLength'), 'error');
      return;
    }

    setPasswordSaving(true);
    try {
      const success = await changePassword(passwordData);
      if (success) {
        showAlertMessage(t('settings.password.success'));
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        showAlertMessage(t('settings.password.errors.changeFailed'), 'error');
      }
    } catch (error) {
      showAlertMessage(t('settings.password.errors.unexpected'), 'error');
    } finally {
      setPasswordSaving(false);
    }
  };

  // اعرض المسار المحفوظ في السيرفر إن لم يوجد محلي (السيرفر مصدر الحقيقة للمجدول)
  useEffect(() => {
    (async () => {
      try {
        if (localStorage.getItem('backupPath')) return;
        const res: any = await api.getBackupSettings();
        const dir = res?.data?.dir;
        if (res?.success && dir) {
          setGeneralSettings(prev => ({ ...prev, backupPath: dir }));
          localStorage.setItem('backupPath', dir);
        }
      } catch {}
    })();
    loadBackups();
  }, []);

  const handleBrowseBackupFolder = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker();
        const path = dirHandle.name;
        setGeneralSettings(prev => ({ ...prev, backupPath: path }));
        localStorage.setItem('backupPath', path);
      } else {
        folderInputRef.current?.click();
      }
    } catch (error) {
      // User cancelled
    }
  };

  const handleFolderInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const path = files[0].webkitRelativePath.split('/')[0];
      setGeneralSettings(prev => ({ ...prev, backupPath: path }));
      localStorage.setItem('backupPath', path);
    }
  };

  const handleBackupNow = async () => {
    setBackupBusy(true);
    try {
      const path = (generalSettings.backupPath || '').trim();
      const pwd = backupPassword.trim();
      const res: any = await api.createBackup(path || undefined, pwd || undefined);
      if (res?.success) {
        const d = res.data || {};
        showAlertMessage(`تم إنشاء النسخة الاحتياطية بنجاح (${d.fileName || ''}${d.documents ? ` — ${d.documents} سجل` : ''})`);
        loadBackups();
      } else {
        showAlertMessage(res?.message || 'فشل إنشاء النسخة الاحتياطية', 'error');
      }
    } catch (error: any) {
      showAlertMessage(error?.message || 'فشل إنشاء النسخة الاحتياطية', 'error');
    } finally {
      setBackupBusy(false);
    }
  };

  const loadBackups = async () => {
    setBackupsLoading(true);
    try {
      const res: any = await api.getBackups();
      if (res?.success) {
        const list = res.data?.backups || res.data || [];
        setBackups(Array.isArray(list) ? list : []);
        if (res.data?.last) setLastBackup(res.data.last);
      }
    } catch {
      // silent — list is optional
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleVerifyBackup = async (fileName: string) => {
    setVerifyBusy(fileName);
    try {
      let res: any = await api.verifyBackup(fileName);
      if (!res?.success && (res as any)?.needsPassword) {
        setPwdValue('');
        setPwdModal({ fileName, mode: 'verify' });
        return;
      }
      if (res?.success) {
        const d = res.data || {};
        showAlertMessage(`النسخة سليمة ✅ (${d.collections || 0} جداول — ${d.documents || 0} سجل)`);
      } else {
        showAlertMessage(res?.message || 'النسخة تالفة', 'error');
      }
    } catch (error: any) {
      showAlertMessage(error?.message || 'فشل الفحص', 'error');
    } finally {
      setVerifyBusy(null);
    }
  };

  const handleDownloadBackup = async (fileName: string) => {
    try {
      const res = await api.downloadBackup(fileName);
      if (res?.ok) {
        showAlertMessage(`بدأ تنزيل النسخة (${fileName}) — انسخها لفلاشة لنقلها لجهاز آخر`);
      } else {
        showAlertMessage(res?.message || 'فشل التنزيل', 'error');
      }
    } catch (error: any) {
      showAlertMessage(error?.message || 'فشل التنزيل', 'error');
    }
  };

  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);
  const [pwdModal, setPwdModal] = useState<{ fileName: string; mode: 'verify' | 'restore' } | null>(null);
  const [pwdValue, setPwdValue] = useState('');

  const handleRestoreBackup = (fileName: string) => {
    setRestoreConfirm(fileName);
  };

  const confirmRestoreBackup = async () => {
    const fileName = restoreConfirm;
    setRestoreConfirm(null);
    if (!fileName) return;
    setRestoreBusy(fileName);
    try {
      // Safety backup before destructive restore
      try { await api.createBackup(undefined); } catch {}
      let res: any = await api.restoreBackup(fileName);
      if (!res?.success && (res as any)?.needsPassword) {
        setPwdValue('');
        setPwdModal({ fileName, mode: 'restore' });
        return;
      }
      if (res?.success) {
        showAlertMessage('تمت الاستعادة بنجاح — سيتم إعادة تحميل الصفحة الآن');
        setTimeout(() => window.location.reload(), 2500);
      } else {
        showAlertMessage(res?.message || 'فشلت الاستعادة', 'error');
      }
    } catch (error: any) {
      showAlertMessage(error?.message || 'فشلت الاستعادة', 'error');
    } finally {
      setRestoreBusy(null);
    }
  };

  const submitBackupPassword = async () => {
    const ctx = pwdModal;
    setPwdModal(null);
    if (!ctx) return;
    const pwd = pwdValue;
    setPwdValue('');
    try {
      if (ctx.mode === 'verify') {
        setVerifyBusy(ctx.fileName);
        try {
          const res: any = await api.verifyBackup(ctx.fileName, pwd);
          if (res?.success) {
            const d = res.data || {};
            showAlertMessage(`النسخة سليمة ✅ (${d.collections || 0} جداول — ${d.documents || 0} سجل)`);
          } else {
            showAlertMessage(res?.message || 'النسخة تالفة', 'error');
          }
        } finally {
          setVerifyBusy(null);
        }
      } else {
        setRestoreBusy(ctx.fileName);
        try {
          const res: any = await api.restoreBackup(ctx.fileName, pwd);
          if (res?.success) {
            showAlertMessage('تمت الاستعادة بنجاح — سيتم إعادة تحميل الصفحة الآن');
            setTimeout(() => window.location.reload(), 2500);
          } else {
            showAlertMessage(res?.message || 'فشلت الاستعادة', 'error');
          }
        } finally {
          setRestoreBusy(null);
        }
      }
    } catch (error: any) {
      showAlertMessage(error?.message || 'فشل العملية', 'error');
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json.gz')) {
      showAlertMessage('الملف يجب أن يكون نسخة احتياطية بصيغة .json.gz', 'error');
      return;
    }
    setImportBusy(true);
    try {
      const res: any = await api.importBackup(file);
      if (res?.success) {
        showAlertMessage(`تم استيراد النسخة بنجاح (${res.data?.fileName || file.name})`);
        loadBackups();
      } else {
        showAlertMessage(res?.message || 'فشل الاستيراد', 'error');
      }
    } catch (error: any) {
      showAlertMessage(error?.message || 'فشل الاستيراد', 'error');
    } finally {
      setImportBusy(false);
    }
  };

  const handleGeneralSettingsUpdate = async () => {
    setGeneralSaving(true);
    try {
      const { backupPath, ...settingsToSend } = generalSettings;

      // Save backupPath to localStorage (device-specific, not in DB)
      if (backupPath !== undefined) {
        localStorage.setItem('backupPath', backupPath);
      }

      // Persist the path on the server too — otherwise manual + scheduled
      // backups never see it (server cannot read browser localStorage).
      if (backupPath !== undefined && backupPath.trim()) {
        try {
          await api.saveBackupSettings(backupPath.trim());
        } catch (e) {
          console.warn('Server backup path save failed (local only):', e);
        }
      }
      
      const success = await updateGeneralSettings(settingsToSend);
      if (success) {
        // Apply theme changes (without saving to DB again, already saved above)
        await setTheme(generalSettings.theme as 'light' | 'dark' | 'auto', false);

        // Apply language changes (without saving to DB again, already saved above)
        if (generalSettings.language !== currentLanguage) {
          await changeLanguage(generalSettings.language, false);
        }

        showAlertMessage(t('settings.general.success'));
        
        // Reload page after a short delay to apply all changes
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showAlertMessage(t('settings.general.errors.saveFailed'), 'error');
      }
    } catch (error) {
      showAlertMessage(t('settings.general.errors.unexpected'), 'error');
    } finally {
      setGeneralSaving(false);
    }
  };

  const handleOrganizationUpdate = async () => {
    if (!organization.name.trim()) {
      showAlertMessage(t('settings.organization.errors.nameRequired'), 'error');
      return;
    }

    setOrganizationSaving(true);
    try {
      const success = await updateOrganization(organization);
      if (success) {
        // Update OrganizationContext immediately with new values
        if (organization.currency) {
          setCurrency(organization.currency);
        }
        if (organization.timezone) {
          setTimezone(organization.timezone);
        }
        
        // Refresh organization settings in OrganizationContext
        await refreshOrganizationSettings();

        // الجذر: user.organization لقطة من تسجيل الدخول — حدّثها بالقيم الطازجة
        // حتى ترى كل الشاشات (الدفع/الطباعة) التفعيل الجديد فوراً بلا إعادة دخول.
        try {
          const fresh: any = await getOrganization().catch(() => null);
          if (fresh?.success && fresh.data) {
            setUser((prev: any) => (prev && prev.organization && typeof prev.organization === 'object')
              ? { ...prev, organization: { ...prev.organization, ...fresh.data, printSettings: fresh.data.printSettings ?? (prev.organization as any).printSettings } }
              : prev);
          }
        } catch {}
        clearFreshPrintSettingsCache();

        showAlertMessage(t('settings.organization.success'));
        
        // Changes are now applied immediately without reload
      } else {
        showAlertMessage(t('settings.organization.errors.updateFailed'), 'error');
      }
    } catch (error) {
      console.error('Organization update error:', error);
      showAlertMessage(t('settings.organization.errors.unexpected'), 'error');
    } finally {
      setOrganizationSaving(false);
    }
  };

  const handleSaveReportSettings = async (settings: any) => {
    try {
      const success = await updateReportSettings(settings);
      if (success) {
        // Reload settings after save
        const updatedSettings = await getReportSettings();
        if (updatedSettings) {
          setReportSettings({
            dailyReportEnabled: updatedSettings.dailyReportEnabled ?? true,
            dailyReportStartTime: updatedSettings.dailyReportStartTime || '08:00',
            dailyReportSendTime: updatedSettings.dailyReportSendTime || '09:00',
            dailyReportEmails: updatedSettings.dailyReportEmails || [],
            authorizedToManageReports: updatedSettings.authorizedToManageReports?.map((m: any) => m._id || m) || [],
          });
        }
      }
    } catch (error) {
      console.error('Error saving report settings:', error);
    }
  };

  const handleSendReportNow = async () => {
    try {
      await sendReportNow();
    } catch (error) {
      console.error('Error sending report now:', error);
    }
  };

  const handleSavePayrollPermissions = async (permissions: any) => {
    try {
      const success = await updatePayrollPermissions(permissions);
      if (success) {
        // Reload permissions after save
        const updatedPermissions = await canManagePayroll();
        if (updatedPermissions && updatedPermissions.permissions) {
          setPayrollPermissions({
            allowManagersToManagePayroll: updatedPermissions.permissions.allowManagersToManagePayroll || false,
            authorizedPayrollManagers: updatedPermissions.permissions.authorizedPayrollManagers?.map((m: any) => m._id || m) || [],
          });
        }
      }
    } catch (error) {
      console.error('Error saving payroll permissions:', error);
    }
  };

  const handlePermissionsUpdate = async () => {
    setPermissionsSaving(true);
    try {
      const success = await updateOrganizationPermissions({
        allowManagersToEditOrganization: organizationPermissions.allowManagersToEditOrganization,
        authorizedManagers: selectedManagers,
      });
      if (success) {
        showAlertMessage(t('settings.organization.permissions.success'));
        try {
          const permissions = await canEditOrganization();
          if (permissions) {
            setOrganizationPermissions(permissions);
          }
        } catch (reloadError) {
          console.error('Error reloading permissions:', reloadError);
        }
      } else {
        showAlertMessage(t('settings.organization.permissions.errors.updateFailed'), 'error');
      }
    } catch (error) {
      console.error('Permissions update error:', error);
      showAlertMessage(t('settings.organization.permissions.errors.unexpected'), 'error');
    } finally {
      setPermissionsSaving(false);
    }
  };

  const handleManagerToggle = (managerId: string) => {
    setSelectedManagers(prev => 
      prev.includes(managerId) 
        ? prev.filter(id => id !== managerId)
        : [...prev, managerId]
    );
  };

  // Printer detection functions
  const detectPrinters = async () => {
    setDetectingPrinters(true);
    try {
      const response: any = await api.detectPrinters('usb');
      const printers = response.printers || response.data?.printers || [];
      if (response.success) {
        setAvailablePrinters(printers);
        if (printers.length > 0) {
          showAlertMessage(t('settings.organization.printSettings.printersDetected', { count: printers.length }), 'success');
        } else {
          showAlertMessage('لا توجد طابعات متصلة — تأكد من توصيل الطابعة وتشغيلها ثم حاول again', 'info');
        }
      } else {
        showAlertMessage(response.message || t('settings.organization.printSettings.detectFailed'), 'error');
      }
    } catch (error) {
      console.error('Error detecting printers:', error);
      showAlertMessage(t('settings.organization.printSettings.detectFailed'), 'error');
    } finally {
      setDetectingPrinters(false);
    }
  };

  const selectPrinter = (printer: any) => {
    setOrganization({
      ...organization,
      printSettings: {
        ...organization.printSettings,
        printerDevice: printer.path,
      },
    });
    
    // حفظ إعدادات الطابعة للجهاز الحالي
    saveDevicePrinter(printer.path, printer.name);
  };

  const testPrinter = async (printer: any) => {
    setTestingPrinter(true);
    try {
      const response = await api.testPrinter({
        printerPath: printer.path,
        printerType: 'usb',
      });
      
      if (response.success) {
        setPrinterStatus('ready');
        showAlertMessage(
          t('settings.organization.printSettings.testSuccess'),
          'success'
        );
      } else {
        setPrinterStatus('offline');
        showAlertMessage(
          t('settings.organization.printSettings.testFailed', { error: response.message || 'Unknown error' }),
          'error'
        );
      }
    } catch (error) {
      console.error('Error testing printer:', error);
      setPrinterStatus('offline');
      showAlertMessage(t('settings.organization.printSettings.testFailed', { error: 'Connection error' }), 'error');
    } finally {
      setTestingPrinter(false);
    }
  };

  const testDrawer = async () => {
    setTestingDrawer(true);
    try {
      const printSettings = organization.printSettings;
      const billPrinterId = printSettings?.documentPrinterMap?.bill;
      const printer = printSettings?.printers?.find(item => item.id === billPrinterId)
        || printSettings?.printers?.[0];
      const opened = await openCashDrawerThroughAgent(printer?.printerName || printer?.name);
      if (opened) {
        showAlertMessage(t('settings.organization.printSettings.cashDrawerOpened'), 'success');
      } else {
        showAlertMessage(t('settings.organization.printSettings.cashDrawerFailed'), 'warning');
      }
    } catch (error) {
      console.error('Error testing cash drawer:', error);
      showAlertMessage(t('settings.organization.printSettings.cashDrawerFailed'), 'error');
    } finally {
      setTestingDrawer(false);
    }
  };

  // ── My printer settings (per-user override) ──
  const handleMyPrintSave = async () => {
    setMyPrintSaving(true);
    try {
      const ok = await updateMyPrintSettings({
        useCustomPrintSettings: myPrint.useCustom,
        printSettings: myPrint.settings,
      });
      if (ok) showAlertMessage(t('settings.myPrint.saved'), 'success');
    } finally {
      setMyPrintSaving(false);
    }
  };

  // ── Smart alerts thresholds (org-wide) ──
  const [smartCfg, setSmartCfg] = useState({ idleTableMinutes: 45, idleExcludeActiveSessions: true });
  const [smartCfgLoading, setSmartCfgLoading] = useState(true);
  const [smartCfgSaving, setSmartCfgSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setSmartCfgLoading(true);
      try {
        const res: any = await (api as any).getNotificationSettings?.();
        const s = res?.success && res.data ? res.data : res?.data || {};
        setSmartCfg({
          idleTableMinutes: Number(s.idleTableMinutes) > 0 ? Number(s.idleTableMinutes) : 45,
          idleExcludeActiveSessions: s.idleExcludeActiveSessions !== false,
        });
      } catch {}
      finally {
        setSmartCfgLoading(false);
      }
    })();
  }, []);

  const handleSmartCfgSave = async () => {
    setSmartCfgSaving(true);
    try {
      const cur: any = await (api as any).getNotificationSettings?.().catch(() => null);
      const base = cur?.success && cur.data ? cur.data : {};
      const res: any = await (api as any).updateNotificationSettings?.({
        ...base,
        idleTableMinutes: smartCfg.idleTableMinutes,
        idleExcludeActiveSessions: smartCfg.idleExcludeActiveSessions,
      });
      if (res?.success) showAlertMessage(t('notifPrefs.saved'), 'success');
      else showAlertMessage(t('notifPrefs.loadError'), 'error');
    } catch {
      showAlertMessage(t('notifPrefs.loadError'), 'error');
    } finally {
      setSmartCfgSaving(false);
    }
  };

  // ── My notification settings (per-user, follows the user on any device) ──
  const handleMyNotifSave = async () => {
    setMyNotifSaving(true);
    try {
      const res = await (api as any).updateMyNotificationSettings(myNotif);
      if (res?.success) {
        // حدّث نسخة المستخدم فوراً حتى تُطبق التفضيلات بلا إعادة دخول.
        try {
          setUser((prev: any) => (prev ? { ...prev, preferences: { ...(prev.preferences || {}), notifications: res.data } } : prev));
        } catch {}
        showAlertMessage(t('notifPrefs.saved'), 'success');
      } else {
        showAlertMessage(t('notifPrefs.loadError'), 'error');
      }
    } catch {
      showAlertMessage(t('notifPrefs.loadError'), 'error');
    } finally {
      setMyNotifSaving(false);
    }
  };

  const handleMyPrintImport = () => {
    const defaults = myPrint.orgDefaults && Object.keys(myPrint.orgDefaults).length
      ? myPrint.orgDefaults
      : (organization.printSettings || {});
    setMyPrint((prev) => ({
      ...prev,
      useCustom: true,
      settings: { ...defaults },
    }));
    showAlertMessage(t('settings.myPrint.imported'), 'success');
  };

  const handleTypeAuditRun = async () => {
    setTypeAuditRunning(true);
    setTypeAuditResult(null);
    try {
      const res = await api.runTypeAudit(true);
      if (res.success && res.data) {
        const docs = res.data.totalFixedDocs || 0;
        const fields = res.data.totalFixedFields || 0;
        const collections = new Set((res.data.collections || []).map((c: any) => c.collection)).size;
        const msg = docs > 0
          ? t('settings.maintenance.done', { docs, fields, collections })
          : t('settings.maintenance.allOk', { collections });
        setTypeAuditResult(msg);
        showAlertMessage(msg, 'success');
      } else {
        showAlertMessage(res.message || t('settings.maintenance.failed'), 'error');
      }
    } catch (error) {
      console.error('Error running type audit:', error);
      showAlertMessage(t('settings.maintenance.failed'), 'error');
    } finally {
      setTypeAuditRunning(false);
    }
  };

  const handleMyPrintTestDrawer = async () => {
    setTestingDrawer(true);
    try {
      const effective = myPrint.useCustom
        ? { ...(organization.printSettings || {}), ...myPrint.settings }
        : (organization.printSettings || {});
      const billPrinterId = effective?.documentPrinterMap?.bill;
      const printer = effective?.printers?.find((item: any) => item.id === billPrinterId)
        || effective?.printers?.[0];
      const opened = await openCashDrawerThroughAgent(printer?.printerName || printer?.name);
      if (opened) {
        showAlertMessage(t('settings.organization.printSettings.cashDrawerOpened'), 'success');
      } else {
        showAlertMessage(t('settings.organization.printSettings.cashDrawerFailed'), 'warning');
      }
    } catch (error) {
      console.error('Error testing my cash drawer:', error);
      showAlertMessage(t('settings.organization.printSettings.cashDrawerFailed'), 'error');
    } finally {
      setTestingDrawer(false);
    }
  };

  const printSampleReceipt = async () => {
    try {
      const sampleBill = {
        _id: 'sample-bill',
        billNumber: 'SAMPLE',
        status: 'draft',
        total: 45,
        paid: 0,
        remaining: 45,
        items: [{ name: 'Sample Item', quantity: 1, price: 45 }],
        createdAt: new Date().toISOString(),
        organization: organization,
        table: null,
      };
      const response = await api.printBill({
        bill: sampleBill,
        organization,
        language: currentLanguage,
        tableSectionName: 'Sample',
      });
      if (response.success) {
        showAlertMessage('تمت طباعة نموذج الفاتورة بنجاح', 'success');
      } else {
        showAlertMessage(response.message || 'فشل في طباعة نموذج الفاتورة', 'error');
      }
    } catch (error) {
      console.error('Error printing sample receipt:', error);
      showAlertMessage('فشل في طباعة نموذج الفاتورة', 'error');
    }
  };

  const saveDevicePrinter = async (printerPath: string, printerName: string) => {
    try {
      const deviceId = localStorage.getItem('deviceId') || 'default';
      const userId = (JSON.parse(localStorage.getItem('user') || '{}')?._id) || 'anon';
      localStorage.setItem(`printer_${deviceId}_${userId}`, JSON.stringify({ printerPath, printerName, lastUsed: Date.now() }));
      const response = await api.saveDevicePrinter({ printerPath, printerName, deviceId });
      if (response.success) {
        setOrganization((prev) => ({
          ...prev,
          printSettings: {
            ...prev.printSettings,
            printerType: 'usb',
            printerDevice: printerPath,
            printerName,
          },
        }));
        setPrinterStatus('ready');
      }
    } catch (error) {
      console.error('Error saving device printer:', error);
      setPrinterStatus('offline');
    }
  };

  const tabs: TabType[] = [
    { id: 'profile', name: t('settings.tabs.profile'), icon: User },
    { id: 'password', name: t('settings.tabs.password'), icon: Lock },

    { id: 'mynotifications', name: t('settings.tabs.myNotifications'), icon: BellRing },
    { id: 'general', name: t('settings.tabs.general'), icon: SettingsIcon },
    { id: 'organization', name: t('settings.tabs.organization'), icon: Building2 },
  ];

  if (!user) {
  return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 dark:border-orange-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center flex-wrap gap-x-2 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
              <SettingsIcon className={`h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('settings.title')}
            </h1>
              <p className="text-xs sm:text-base text-gray-600 dark:text-gray-300 ${isRTL ? 'mr-2 sm:mr-4' : 'ml-2 sm:ml-4'}">{t('settings.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
          </div>
      </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex gap-1 sm:gap-2 md:gap-6 px-2 sm:px-6 mb-2 sm:mb-4 overflow-x-auto" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center space-x-2 py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex-shrink-0
                        ${activeTab === tab.id
                        ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'}
                      `}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="hidden min-[420px]:inline">{tab.name}</span>
                  </button>
                );
              })}
            </nav>
        </div>

          {/* Tab Content */}
              <div className="p-3 sm:p-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
                <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">{t('settings.profile.title')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('settings.profile.fullName')}
                      </label>
                      <input
                        type="text"
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder={t('settings.profile.fullNamePlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('settings.profile.email')}
                      </label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder={t('settings.profile.emailPlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('settings.profile.username')}
                      </label>
                      <input
                        type="text"
                        value={profile.username}
                        onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder={t('settings.profile.usernamePlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('settings.profile.phone')}
                      </label>
                      <input
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder={t('settings.profile.phonePlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('settings.profile.address')}
                      </label>
                      <input
                        type="text"
                        value={profile.address}
                        onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder={t('settings.profile.addressPlaceholder')}
                      />
                    </div>
                  </div>
                  <div className="mt-6">
                    <button
                      onClick={handleProfileUpdate}
                      disabled={profileSaving}
                      className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-md disabled:opacity-50 min-w-32 justify-center"
                    >
                      {profileSaving ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>{t('common.saving')}</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>{t('common.saveChanges')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Password Tab */}
            {activeTab === 'password' && (
                  <div className="space-y-6">
                  <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">{t('settings.password.title')}</h3>
                  <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('settings.password.currentPassword')}
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.current ? 'text' : 'password'}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                          placeholder={t('settings.password.currentPasswordPlaceholder')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showPasswords.current ? <EyeOff className="h-4 w-4 text-gray-400 dark:text-gray-500" /> : <Eye className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
                        </button>
                  </div>
                    </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('settings.password.newPassword')}
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.new ? 'text' : 'password'}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                          placeholder={t('settings.password.newPasswordPlaceholder')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showPasswords.new ? <EyeOff className="h-4 w-4 text-gray-400 dark:text-gray-500" /> : <Eye className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
                        </button>
                      </div>
                    </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('settings.password.confirmPassword')}
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.confirm ? 'text' : 'password'}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                          placeholder={t('settings.password.confirmPasswordPlaceholder')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showPasswords.confirm ? <EyeOff className="h-4 w-4 text-gray-400 dark:text-gray-500" /> : <Eye className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
                        </button>
                      </div>
                    </div>
                    <div className="mt-6">
                      <button
                        onClick={handlePasswordChange}
                        disabled={passwordSaving}
                        className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-md disabled:opacity-50 min-w-40 justify-center"
                      >
                        {passwordSaving ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>{t('settings.password.changing')}</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4" />
                            <span>{t('settings.password.changePassword')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}

            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">{t('settings.general.title')}</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('settings.general.theme')}
                      </label>
                      <select
                        value={generalSettings.theme}
                        onChange={(e) => setGeneralSettings({ ...generalSettings, theme: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="light">{t('settings.general.themeLight')}</option>
                        <option value="dark">{t('settings.general.themeDark')}</option>
                        <option value="auto">{t('settings.general.themeAuto')}</option>
                      </select>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('settings.general.language')}
                      </label>
                      <select
                        value={generalSettings.language}
                        onChange={(e) => setGeneralSettings({ ...generalSettings, language: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        {WORLD_LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.nativeName} ({lang.name})
                          </option>
                        ))}
                        </select>
                      </div>

                    {/* Backup settings (owner/admins only) */}
                    {isManager && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        مسار النسخ الاحتياطي
                      </label>
                      <div className="flex space-x-2 space-x-reverse">
                        <input
                          type="text"
                          value={generalSettings.backupPath}
                          onChange={(e) => setGeneralSettings({ ...generalSettings, backupPath: e.target.value })}
                          placeholder="C:\Backups\Bomba"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                        <button
                          type="button"
                          onClick={handleBrowseBackupFolder}
                          className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                        >
                          استعراض
                        </button>
                      </div>
                      <input
                        ref={folderInputRef}
                        type="file"
                        style={{ display: 'none' }}
                        {...({ webkitdirectory: true, directory: true } as React.InputHTMLAttributes<HTMLInputElement> & { webkitdirectory?: boolean; directory?: boolean })}
                        onChange={handleFolderInputChange}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        سيتم حفظ النسخ الاحتياطية في هذا المجلد على هذا الجهاز فقط
                      </p>
                      <input
                        type="password"
                        value={backupPassword}
                        onChange={(e) => setBackupPassword(e.target.value)}
                        placeholder="كلمة سر للنسخة (اختياري — للتشفير)"
                        autoComplete="new-password"
                        className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        بدون كلمة سر تُحفظ النسخة عادية — مع كلمة سر تُشفَّر ولا تُفتح بدونها
                      </p>
                      <button
                        type="button"
                        onClick={handleBackupNow}
                        disabled={backupBusy}
                        className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded-md disabled:opacity-50 min-w-40"
                      >
                        {backupBusy ? 'جاري إنشاء النسخة...' : 'نسخ احتياطي الآن'}
                      </button>
                      {lastBackup?.at && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          آخر نسخة: {new Date(lastBackup.at).toLocaleString('ar-EG')} — {lastBackup.success ? `ناجحة (${lastBackup.fileName || ''})` : `فاشلة (${lastBackup.error || ''})`}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => importInputRef.current?.click()}
                        disabled={importBusy}
                        className="mt-2 mr-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-md disabled:opacity-50 min-w-40"
                      >
                        {importBusy ? 'جاري الاستيراد...' : 'استيراد نسخة من جهاز آخر'}
                      </button>
                      <input
                        ref={importInputRef}
                        type="file"
                        accept=".gz"
                        style={{ display: 'none' }}
                        onChange={handleImportBackup}
                      />
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">النسخ المحفوظة</span>
                          <button
                            type="button"
                            onClick={loadBackups}
                            disabled={backupsLoading}
                            className="text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 disabled:opacity-50"
                          >
                            {backupsLoading ? 'جاري التحديث...' : 'تحديث القائمة'}
                          </button>
                        </div>
                        {backups.length === 0 && !backupsLoading && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">لا توجد نسخ محفوظة بعد</p>
                        )}
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {backups.map((b: any) => (
                            <div key={b.fileName} className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-mono text-gray-800 dark:text-gray-200 truncate" dir="ltr">
                                  {b.encrypted ? '🔒 ' : ''}{b.fileName}
                                </p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                  {b.size ? `${(b.size / 1024 / 1024).toFixed(2)} MB` : ''}{b.createdAt ? ` — ${new Date(b.createdAt).toLocaleString('ar-EG')}` : ''}
                                </p>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleVerifyBackup(b.fileName)}
                                  disabled={verifyBusy !== null || restoreBusy !== null}
                                  title="فحص سلامة النسخة دون استعادتها"
                                  className="px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded-md disabled:opacity-50"
                                >
                                  {verifyBusy === b.fileName ? 'يفحص...' : 'فحص'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadBackup(b.fileName)}
                                  disabled={restoreBusy !== null}
                                  title="تنزيل الملف لنقله لجهاز آخر عبر فلاشة"
                                  className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
                                >
                                  تنزيل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRestoreBackup(b.fileName)}
                                  disabled={restoreBusy !== null}
                                  className="px-2 py-1 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded-md disabled:opacity-50"
                                >
                                  {restoreBusy === b.fileName ? 'جاري الاستعادة...' : 'استعادة'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-red-500 dark:text-red-400 mt-2">
                          تنبيه: الاستعادة تستبدل قاعدة البيانات الحالية بالكامل (يتم أخذ نسخة أمان تلقائياً أولاً)
                        </p>
                      </div>
                    </div>
                    )}

                    {isManager && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('serverConnection.title')}
                      </label>
                      <div className="flex space-x-2 space-x-reverse">
                        <input
                          type="text"
                          value={serverUrlDisplay}
                          readOnly
                          dir="ltr"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-mono text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowServerModal(true)}
                          className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                        >
                          {t('serverConnection.newUrl')}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('serverConnection.desc')}
                      </p>
                    </div>
                    )}

                    <div className="mt-6">
                      <button
                        onClick={handleGeneralSettingsUpdate}
                        disabled={generalSaving}
                        className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-md disabled:opacity-50 min-w-40 justify-center"
                      >
                        {generalSaving ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>{t('common.saving')}</span>
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            <span>{t('settings.general.saveSettings')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* My printer settings (per-user override with org fallback) */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('settings.myPrint.title')}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('settings.myPrint.desc')}</p>
                  {myPrintLoading ? (
                    <p className="text-gray-500 dark:text-gray-400">{t('settings.organization.loading')}</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t('settings.myPrint.useCustom')}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('settings.myPrint.useCustomDesc')}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={myPrint.useCustom}
                            onChange={(e) => setMyPrint((prev) => ({ ...prev, useCustom: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                        </label>
                      </div>

                      {myPrint.useCustom && (
                        <>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={handleMyPrintImport}
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                            >
                              {t('settings.myPrint.import')}
                            </button>
                            <button
                              type="button"
                              onClick={handleMyPrintTestDrawer}
                              disabled={testingDrawer}
                              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-400 flex items-center gap-2"
                            >
                              {t('settings.myPrint.testDrawer')}
                            </button>
                          </div>

                          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                            <PrinterSettingsForm
                              settings={myPrint.settings}
                              onPatch={(patch) => setMyPrint((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }))}
                              menuSections={menuSections}
                              availablePrinters={availablePrinters}
                              detecting={detectingPrinters}
                              onDetect={detectPrinters}
                              onSelectDetected={(printer) => {
                                const id = String(printer.path || printer.name);
                                setMyPrint((prev) => {
                                  if ((prev.settings.printers || []).some((item: any) => item.id === id)) return prev;
                                  return {
                                    ...prev,
                                    settings: {
                                      ...prev.settings,
                                      printers: [...(prev.settings.printers || []), { id, name: printer.name, printerName: printer.name, printerPath: printer.path || '', paperWidthMm: 80 }],
                                    },
                                  };
                                });
                              }}
                              onTestPrinter={testPrinter}
                            />
                          </div>

                          <div>
                            <button
                              onClick={handleMyPrintSave}
                              disabled={myPrintSaving}
                              className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-md disabled:opacity-50 min-w-40 justify-center"
                            >
                              {myPrintSaving ? <span>{t('common.saving')}</span> : <span>{t('settings.myPrint.save')}</span>}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Smart alerts thresholds (org-wide, managers only) */}
                {isManager && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('smartCfg.title')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('smartCfg.desc')}</p>
                    {smartCfgLoading ? (
                      <p className="text-gray-500 dark:text-gray-400">{t('settings.organization.loading')}</p>
                    ) : (
                      <div className="space-y-3 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <label className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('smartCfg.minutes')}</span>
                          <input
                            type="number"
                            min={5}
                            max={480}
                            value={smartCfg.idleTableMinutes}
                            onChange={(e) => setSmartCfg((p) => ({ ...p, idleTableMinutes: Math.max(5, Number(e.target.value) || 45) }))}
                            className="w-24 px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-3 cursor-pointer">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('smartCfg.excludeActive')}</span>
                          <input
                            type="checkbox"
                            checked={smartCfg.idleExcludeActiveSessions}
                            onChange={(e) => setSmartCfg((p) => ({ ...p, idleExcludeActiveSessions: e.target.checked }))}
                            className="h-4 w-4"
                          />
                        </label>
                        <div>
                          <button
                            onClick={handleSmartCfgSave}
                            disabled={smartCfgSaving}
                            className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-md disabled:opacity-50 min-w-40"
                          >
                            {smartCfgSaving ? <span>{t('common.saving')}</span> : <span>{t('notifPrefs.save')}</span>}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Database maintenance (owner/admins only) */}
                {isManager && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('settings.maintenance.title')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('settings.maintenance.desc')}</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleTypeAuditRun}
                        disabled={typeAuditRunning}
                        className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-md disabled:opacity-50 min-w-40 justify-center"
                      >
                        {typeAuditRunning ? <span>{t('settings.maintenance.running')}</span> : <span>{t('settings.maintenance.runAudit')}</span>}
                      </button>
                    </div>
                    {typeAuditResult && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{typeAuditResult}</p>
                    )}
                  </div>
                )}

                {/* Connect mobile over LAN */}
                <div>
                  <MobileConnectCard showChromeOption={isManager} />
                </div>

                {/* Connected devices + per-device print permission (owner/admins only) */}
                {isManager && (
                  <div>
                    <ConnectedDevicesCard />
                  </div>
                )}
              </div>
            )}

            {/* Organization Tab */}
            {activeTab === 'organization' && organizationPermissions.canEdit && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('settings.organization.title')}</h3>
                    {organizationPermissions.isOwner && (
                      <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">
                        {t('settings.organization.ownerBadge')}
                      </span>
                    )}
                  </div>

                  {/* Loading state */}
                  {organizationSaving && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-blue-600 dark:text-blue-400">{t('settings.organization.saving')}</span>
                      </div>
                    </div>
                  )}

                  {/* Basic Information */}
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                    <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                      <Building2 className="h-5 w-5 ml-2" />
                      {t('settings.organization.basicInfo')}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('settings.organization.name')}
                        </label>
                        <input
                          type="text"
                          value={organization.name}
                          onChange={(e) => setOrganization({ ...organization, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder={t('settings.organization.namePlaceholder')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Phone className="h-4 w-4 inline ml-1" />
                          {t('settings.organization.phone')}
                        </label>
                        <input
                          type="tel"
                          value={organization.phone}
                          onChange={(e) => setOrganization({ ...organization, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="{t('settings.organization.phonePlaceholder')}"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Mail className="h-4 w-4 inline ml-1" />
                          {t('settings.organization.email')}
                        </label>
                        <input
                          type="email"
                          value={organization.email}
                          onChange={(e) => setOrganization({ ...organization, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="{t('settings.organization.emailPlaceholder')}"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Globe className="h-4 w-4 inline ml-1" />
                          {t('settings.organization.website')}
                        </label>
                        <input
                          type="url"
                          value={organization.website}
                          onChange={(e) => setOrganization({ ...organization, website: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="https://example.com"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <MapPin className="h-4 w-4 inline ml-1" />
                          {t('settings.organization.address')}
                        </label>
                        <input
                          type="text"
                          value={organization.address}
                          onChange={(e) => setOrganization({ ...organization, address: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="{t('settings.organization.addressPlaceholder')}"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('settings.organization.description')}
                        </label>
                        <textarea
                          value={organization.description}
                          onChange={(e) => setOrganization({ ...organization, description: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="{t('settings.organization.descriptionPlaceholder')}"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('settings.general.timezone')}
                        </label>
                        <select
                          value={organization.timezone || 'Africa/Cairo'}
                          onChange={(e) => setOrganization({ ...organization, timezone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          {WORLD_TIMEZONES.map((tz: string) => (
                            <option key={tz} value={tz}>
                              {getTimezoneName(tz, currentLanguage)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('settings.general.currency')}
                        </label>
                        <select
                          value={organization.currency || 'EGP'}
                          onChange={(e) => setOrganization({ ...organization, currency: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          {Object.keys(CURRENCY_SYMBOLS).map((currencyCode) => (
                            <option key={currencyCode} value={currencyCode}>
                              {getCurrencyName(currencyCode, currentLanguage)} ({CURRENCY_SYMBOLS[currencyCode][currentLanguage as 'ar' | 'en' | 'fr'] || CURRENCY_SYMBOLS[currencyCode]['ar']})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Generated Website Section */}
                  {organization.websiteUrl && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg mb-6">
                      <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                        <Globe className="h-5 w-5 ml-2 text-green-600" />
                        {t('settings.organization.generatedWebsite.title')}
                      </h4>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {t('settings.organization.generatedWebsite.description')}
                          </p>
                          <a
                            href={organization.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                          >
                            <Globe className="h-4 w-4 ml-2" />
                            {t('settings.organization.generatedWebsite.viewButton')}
                          </a>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('settings.organization.generatedWebsite.autoUpdate')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Print Settings Section */}
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                    <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
                      {t('settings.organization.printSettings.title')}
                    </h4>
                    
                    <PrinterSettingsForm
                      settings={organization.printSettings || {}}
                      onPatch={(patch) => setOrganization((prev: any) => ({ ...prev, printSettings: { ...prev.printSettings, ...patch } }))}
                      menuSections={menuSections}
                      availablePrinters={availablePrinters}
                      detecting={detectingPrinters}
                      onDetect={detectPrinters}
                      onSelectDetected={selectPrinter}
                      onTestPrinter={testPrinter}
                    />
                  </div>

                  {/* Social Links */}
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                    <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
                      {t('settings.organization.socialLinks.title')}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Facebook className="h-4 w-4 inline ml-1 text-blue-600" />
                          {t('settings.organization.socialLinks.facebook')}
                        </label>
                        <input
                          type="url"
                          value={organization.socialLinks.facebook}
                          onChange={(e) => setOrganization({ 
                            ...organization, 
                            socialLinks: { ...organization.socialLinks, facebook: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="https://facebook.com/yourpage"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Instagram className="h-4 w-4 inline ml-1 text-pink-600" />
                          {t('settings.organization.socialLinks.instagram')}
                        </label>
                        <input
                          type="url"
                          value={organization.socialLinks.instagram}
                          onChange={(e) => setOrganization({ 
                            ...organization, 
                            socialLinks: { ...organization.socialLinks, instagram: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="https://instagram.com/yourpage"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Twitter className="h-4 w-4 inline ml-1 text-blue-400" />
                          {t('settings.organization.socialLinks.twitter')}
                        </label>
                        <input
                          type="url"
                          value={organization.socialLinks.twitter}
                          onChange={(e) => setOrganization({ 
                            ...organization, 
                            socialLinks: { ...organization.socialLinks, twitter: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="https://twitter.com/yourpage"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Linkedin className="h-4 w-4 inline ml-1 text-blue-700" />
                          {t('settings.organization.socialLinks.linkedin')}
                        </label>
                        <input
                          type="url"
                          value={organization.socialLinks.linkedin}
                          onChange={(e) => setOrganization({ 
                            ...organization, 
                            socialLinks: { ...organization.socialLinks, linkedin: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="https://linkedin.com/company/yourpage"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Youtube className="h-4 w-4 inline ml-1 text-red-600" />
                          {t('settings.organization.socialLinks.youtube')}
                        </label>
                        <input
                          type="url"
                          value={organization.socialLinks.youtube}
                          onChange={(e) => setOrganization({ 
                            ...organization, 
                            socialLinks: { ...organization.socialLinks, youtube: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="https://youtube.com/channel/yourchannel"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('settings.organization.socialLinks.tiktok')}
                        </label>
                        <input
                          type="url"
                          value={organization.socialLinks.tiktok}
                          onChange={(e) => setOrganization({ 
                            ...organization, 
                            socialLinks: { ...organization.socialLinks, tiktok: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="https://tiktok.com/@yourpage"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <MessageCircle className="h-4 w-4 inline ml-1 text-green-600" />
                          {t('settings.organization.socialLinks.whatsapp')}
                        </label>
                        <input
                          type="tel"
                          value={organization.socialLinks.whatsapp}
                          onChange={(e) => setOrganization({ 
                            ...organization, 
                            socialLinks: { ...organization.socialLinks, whatsapp: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="+201234567890"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Send className="h-4 w-4 inline ml-1 text-blue-500" />
                          {t('settings.organization.socialLinks.telegram')}
                        </label>
                        <input
                          type="url"
                          value={organization.socialLinks.telegram}
                          onChange={(e) => setOrganization({ 
                            ...organization, 
                            socialLinks: { ...organization.socialLinks, telegram: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="https://t.me/yourchannel"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <MapPin className="h-4 w-4 inline ml-1 text-red-600" />
                          {t('settings.organization.socialLinks.location')}
                        </label>
                        <input
                          type="url"
                          value={organization.socialLinks.location}
                          onChange={(e) => setOrganization({ 
                            ...organization, 
                            socialLinks: { ...organization.socialLinks, location: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="https://maps.google.com/..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Working Hours */}
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 sm:p-4 rounded-lg mb-4 sm:mb-6">
                    <h4 className="text-base sm:text-md font-medium text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 flex items-center">
                      <Clock className="h-5 w-5 ml-2" />
                      {t('settings.organization.workingHours.title')}
                    </h4>
                    <div className="space-y-2.5 sm:space-y-4">
                      {Object.entries(organization.workingHours).map(([day, hours]) => {
                        return (
                          <div key={day} className="p-2.5 sm:p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 min-w-14">
                                  {t(`settings.organization.workingHours.days.${day}`)}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={!hours.closed}
                                    onChange={(e) => setOrganization({
                                      ...organization,
                                      workingHours: {
                                        ...organization.workingHours,
                                        [day]: { ...hours, closed: !e.target.checked, is24Hours: false }
                                      }
                                    })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-12 h-7 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                                </label>
                                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                  {hours.closed ? t('settings.organization.workingHours.closed') : hours.is24Hours ? t('settings.organization.workingHours.hours24') : t('settings.organization.workingHours.open')}
                                </span>
                              </div>
                            </div>

                            {!hours.closed && (
                              <div className="flex items-center gap-2 sm:gap-2 mt-2.5 flex-wrap">
                                {/* 24 Hours Toggle */}
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                    <input
                                      type="checkbox"
                                      checked={hours.is24Hours}
                                      onChange={(e) => setOrganization({
                                        ...organization,
                                        workingHours: {
                                          ...organization.workingHours,
                                          [day]: {
                                            ...hours,
                                            is24Hours: e.target.checked,
                                            open: e.target.checked ? '00:00' : hours.open,
                                            close: e.target.checked ? '23:59' : hours.close
                                          }
                                        }
                                      })}
                                      className="sr-only peer"
                                    />
                                    <div className="w-10 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                  </label>
                                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    {t('settings.organization.workingHours.hours24')}
                                  </span>
                                </div>

                                {/* Time Inputs - Hidden when 24 hours is enabled */}
                                {!hours.is24Hours && (
                                  <>
                                    <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
                                      <label className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{t('settings.organization.workingHours.from')}</label>
                                      <input
                                        type="time"
                                        value={hours.open}
                                        onChange={(e) => setOrganization({
                                          ...organization,
                                          workingHours: {
                                            ...organization.workingHours,
                                            [day]: { ...hours, open: e.target.value }
                                          }
                                        })}
                                        className="flex-1 min-w-0 px-2 min-h-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                      />
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
                                      <label className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{t('settings.organization.workingHours.to')}</label>
                                      <input
                                        type="time"
                                        value={hours.close}
                                        onChange={(e) => setOrganization({
                                          ...organization,
                                          workingHours: {
                                            ...organization.workingHours,
                                            [day]: { ...hours, close: e.target.value }
                                          }
                                        })}
                                        className="flex-1 min-w-0 px-2 min-h-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                      />
                                    </div>
                                  </>
                                )}

                                {/* Display 24 hours indicator */}
                                {hours.is24Hours && (
                                  <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">
                                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                      {t('settings.organization.workingHours.openAllDay')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Quick Actions */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newWorkingHours = { ...organization.workingHours };
                            Object.keys(newWorkingHours).forEach(day => {
                              newWorkingHours[day] = { open: '09:00', close: '22:00', closed: false, is24Hours: false };
                            });
                            setOrganization({ ...organization, workingHours: newWorkingHours });
                          }}
                          className="px-3.5 min-h-9 text-xs sm:text-sm font-bold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                        >
                          {t('settings.organization.workingHours.quickActions.openAll')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newWorkingHours = { ...organization.workingHours };
                            ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday'].forEach(day => {
                              newWorkingHours[day] = { open: '09:00', close: '22:00', closed: false, is24Hours: false };
                            });
                            newWorkingHours.friday = { open: '14:00', close: '22:00', closed: false, is24Hours: false };
                            setOrganization({ ...organization, workingHours: newWorkingHours });
                          }}
                          className="px-3.5 min-h-9 text-xs sm:text-sm font-bold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                        >
                          {t('settings.organization.workingHours.quickActions.normalHours')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newWorkingHours = { ...organization.workingHours };
                            Object.keys(newWorkingHours).forEach(day => {
                              newWorkingHours[day] = { open: '00:00', close: '23:59', closed: false, is24Hours: true };
                            });
                            setOrganization({ ...organization, workingHours: newWorkingHours });
                          }}
                          className="px-3.5 min-h-9 text-xs sm:text-sm font-bold bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                        >
                          {t('settings.organization.workingHours.quickActions.open24Hours')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newWorkingHours = { ...organization.workingHours };
                            Object.keys(newWorkingHours).forEach(day => {
                              newWorkingHours[day] = { ...newWorkingHours[day], closed: true, is24Hours: false };
                            });
                            setOrganization({ ...organization, workingHours: newWorkingHours });
                          }}
                          className="px-3.5 min-h-9 text-xs sm:text-sm font-bold bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                        >
                          {t('settings.organization.workingHours.quickActions.closeAll')}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Permissions Section - Only for Owner */}
                  {organizationPermissions.isOwner && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mb-6">
                      <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                        <Users className="h-5 w-5 ml-2" />
                        {t('settings.organization.permissions.title')}
                      </h4>
                      
                      {/* Enable/Disable Permission */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t('settings.organization.permissions.allowManagers')}
                          </h5>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('settings.organization.permissions.allowManagersDesc')}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={organizationPermissions.allowManagersToEditOrganization}
                            onChange={(e) => setOrganizationPermissions({ 
                              ...organizationPermissions, 
                              allowManagersToEditOrganization: e.target.checked 
                            })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                        </label>
                      </div>

                      {/* Managers Selection */}
                      {organizationPermissions.allowManagersToEditOrganization && availableManagers.length > 0 && (
                        <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                          <h6 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                            {t('settings.organization.permissions.selectManagers')}
                          </h6>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {availableManagers.map((manager) => (
                              <div key={manager._id} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                                <div className="flex items-center">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                      {manager.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {manager.email}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleManagerToggle(manager._id)}
                                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                                    selectedManagers.includes(manager._id)
                                      ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  }`}
                                >
                                  {selectedManagers.includes(manager._id) ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <X className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                          {selectedManagers.length > 0 && (
                            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                {t('settings.organization.permissions.managersSelected', { count: selectedManagers.length })}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {organizationPermissions.allowManagersToEditOrganization && availableManagers.length === 0 && (
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                            {t('settings.organization.permissions.noManagers')}
                          </p>
                        </div>
                      )}

                      <div className="mt-4">
                        <button
                          onClick={handlePermissionsUpdate}
                          disabled={permissionsSaving}
                          className="flex items-center space-x-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md disabled:opacity-50 min-w-32 justify-center"
                        >
                          {permissionsSaving ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>{t('common.saving')}</span>
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              <span>{t('settings.organization.permissions.savePermissions')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Payroll Settings Section - Only for Owner or Authorized Managers */}
                  {!payrollPermissionsLoading && (payrollPermissionsData.canManage || payrollPermissionsData.isOwner) && (
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mt-6">
                      <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                        <Clock className="h-5 w-5 ml-2 text-orange-600 dark:text-orange-400" />
                        {t('settings.organization.payroll.title')}
                      </h4>
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          {t('settings.organization.payroll.description')}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('settings.organization.payroll.workHoursPerDay')}
                        </label>
                        <div className="flex items-center gap-4">
                          <input
                            type="number"
                            min="1"
                            max="24"
                            value={payrollSettings.workHoursPerDay}
                            onChange={(e) => setPayrollSettings({ ...payrollSettings, workHoursPerDay: parseInt(e.target.value) || 10 })}
                            className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">{t('settings.organization.payroll.hours')}</span>
                        </div>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          {t('settings.organization.payroll.overtimeNote')}
                        </p>
                      </div>

                      {/* Payroll Permissions Section - Inside Payroll Settings */}
                      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                        <PayrollPermissionsSection
                          isOwner={payrollPermissionsData.isOwner}
                          onSave={handleSavePayrollPermissions}
                          initialPermissions={payrollPermissions}
                          availableManagers={availableManagers}
                        />
                      </div>
                    </div>
                  )}

                  {/* No Permission Message for Payroll Settings */}
                  {!payrollPermissionsLoading && !payrollPermissionsData.canManage && !payrollPermissionsData.isOwner && (
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mt-6">
                      <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                        <Clock className="h-5 w-5 ml-2 text-orange-600 dark:text-orange-400" />
                        {t('settings.organization.payroll.title')}
                      </h4>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <div className="flex items-start">
                          <Bell className="h-5 w-5 text-yellow-600 dark:text-yellow-400 ml-3 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                              {t('settings.organization.payroll.noPermission.title')}
                            </h4>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                              {t('settings.organization.payroll.noPermission.message')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Report Settings Section */}
                  {!reportSettingsLoading && (
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <ReportSettingsSection
                        canManage={reportPermissions.canManage}
                        isOwner={reportPermissions.isOwner}
                        onSave={handleSaveReportSettings}
                        onSendNow={handleSendReportNow}
                        initialSettings={reportSettings}
                        availableManagers={availableManagers}
                      />
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="mt-6">
                    <button
                      onClick={async () => {
                        setOrganizationSaving(true);
                        try {
                          // Save organization data
                          const orgSuccess = await updateOrganization(organization);
                          
                          // Save payroll settings
                          const payrollResponse = await fetch('/api/settings/payroll', {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            },
                            body: JSON.stringify(payrollSettings),
                          });
                          const payrollData = await payrollResponse.json();
                          
                          if (orgSuccess && payrollResponse.ok && payrollData.success) {
                            // Update OrganizationContext immediately with new values
                            if (organization.currency) {
                              setCurrency(organization.currency);
                            }
                            if (organization.timezone) {
                              setTimezone(organization.timezone);
                            }
                            
                            // Refresh organization settings
                            await refreshOrganizationSettings();
                            
                            showAlertMessage(t('settings.organization.saveAllSettings'));
                            
                            // Changes are now applied immediately without reload
                          } else if (!orgSuccess) {
                            showAlertMessage(t('settings.organization.errors.saveOrgFailed'), 'error');
                          } else {
                            showAlertMessage(t('settings.organization.errors.savePayrollWarning'), 'warning');
                          }
                        } catch (error) {
                          console.error('Error saving settings:', error);
                          showAlertMessage(t('settings.organization.errors.unexpected'), 'error');
                        } finally {
                          setOrganizationSaving(false);
                        }
                      }}
                      disabled={organizationSaving}
                      className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-md disabled:opacity-50 min-w-48 justify-center"
                    >
                      {organizationSaving ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>{t('common.saving')}</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>{t('settings.organization.saveSettings')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Organization Tab - Per-device printer for normal users (visible even without org edit permission) */}
            {activeTab === 'organization' && !organizationPermissions.canEdit && !organizationLoading && (
              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
                    {t('settings.organization.printSettings.title')} — {t('settings.organization.printSettings.myDevice')}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('settings.organization.printSettings.myDeviceDesc')}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button onClick={detectPrinters} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm">
                      {detectingPrinters ? t('settings.organization.printSettings.detecting') : t('settings.organization.printSettings.detectPrinters')}
                    </button>
                    <button onClick={testPrinter.bind(null, { path: organization.printSettings?.printerDevice || (availablePrinters[0]?.path || '') })} disabled={testingPrinter || !organization.printSettings?.printerDevice} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      {testingPrinter ? '...' : t('settings.organization.printSettings.test')}
                    </button>
                    <button onClick={testDrawer} disabled={testingDrawer} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      {testingDrawer ? '...' : (currentLanguage === 'ar' ? 'اختبار درج الكاشير' : 'Test cash drawer')}
                    </button>
                    <button onClick={printSampleReceipt} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm">
                      {currentLanguage === 'ar' ? 'طباعة نموذج فواتير' : 'Print sample receipt'}
                    </button>
                  </div>
                  <div className="mb-3 flex items-center gap-2 text-sm">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${printerStatus === 'ready' ? 'bg-emerald-500' : printerStatus === 'offline' ? 'bg-red-500' : 'bg-gray-400'}`} />
                    <span className="text-gray-700 dark:text-gray-300">
                      {printerStatus === 'ready' ? (currentLanguage === 'ar' ? 'الطابعة جاهزة' : 'Printer ready') : printerStatus === 'offline' ? (currentLanguage === 'ar' ? 'الطابعة غير متصلة' : 'Printer offline') : (currentLanguage === 'ar' ? 'في انتظار اختبار الطابعة' : 'Waiting for printer test')}
                    </span>
                  </div>
                  {availablePrinters.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2 bg-white dark:bg-gray-800">
                      {availablePrinters.map((printer: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{printer.name || printer.path}</span>
                          <button onClick={() => saveDevicePrinter(printer.path, printer.name)} className="ml-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">{t('common.select')}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-center py-6">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
                    <Building2 className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {t('settings.organization.noPermission.title')}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.organization.noPermission.message')}
                  </p>
                </div>
              </div>
            )}

            {/* Organization Tab - Loading state */}
            {activeTab === 'organization' && organizationLoading && (
              <div className="space-y-6">
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 dark:border-orange-400 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">{t('settings.organization.loading')}</p>
                </div>
              </div>
            )}

            {/* My notifications — قسم شخصي منفصل (تفضيلات المستخدم على أي جهاز) */}
            {activeTab === 'mynotifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('notifPrefs.selfTitle')}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('notifPrefs.selfDesc')}</p>
                  {myNotifLoading ? (
                    <p className="text-gray-500 dark:text-gray-400">{t('settings.organization.loading')}</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <UserNotificationPrefsForm value={myNotif} onChange={setMyNotif} disabled={myNotifSaving} />
                      </div>
                      <div>
                        <button
                          onClick={handleMyNotifSave}
                          disabled={myNotifSaving}
                          className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-md disabled:opacity-50 min-w-40 justify-center"
                        >
                          {myNotifSaving ? <span>{t('common.saving')}</span> : <span>{t('notifPrefs.save')}</span>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Alert Notification */}
      {showAlert && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`${alertType === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-4 rounded-lg shadow-lg flex items-center justify-between min-w-64`}>
            <div className="flex-1">
              <p className="text-sm">{alertMessage}</p>
            </div>
            <button 
              onClick={() => setShowAlert(false)}
              className="text-white hover:text-gray-200 ml-4"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <ServerConnectionModal isOpen={showServerModal} onClose={() => setShowServerModal(false)} />

      {/* Restore backup confirm (in-app, replaces browser confirm) */}
      <ConfirmModal
        isOpen={restoreConfirm !== null}
        onClose={() => setRestoreConfirm(null)}
        onConfirm={confirmRestoreBackup}
        title="استعادة نسخة احتياطية"
        message={`سيتم استبدال قاعدة البيانات الحالية بمحتوى النسخة "${restoreConfirm || ''}". سيتم إنشاء نسخة احتياطية تلقائية أولاً للسلامة. متابعة؟`}
        confirmText="استعادة"
        cancelText="تراجع"
        confirmColor="bg-orange-600 hover:bg-orange-700"
        loading={restoreBusy !== null}
      />

      {/* Backup password prompt (in-app, replaces browser prompt) */}
      {pwdModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[360] flex items-center justify-center bg-black/60 p-4" onClick={() => setPwdModal(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-700 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-gray-100">النسخة مشفرة</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-all" dir="ltr">{pwdModal.fileName}</p>
              </div>
              <div className="p-4 space-y-3">
                <input
                  type="password"
                  autoFocus
                  value={pwdValue}
                  onChange={e => setPwdValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && pwdValue) submitBackupPassword(); }}
                  placeholder="أدخل كلمة السر"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-orange-400"
                />
                <div className="flex gap-2">
                  <button onClick={() => setPwdModal(null)} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300 font-bold">تراجع</button>
                  <button onClick={submitBackupPassword} disabled={!pwdValue} className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold disabled:opacity-50">متابعة</button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    {/* Developer Fingerprint */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            تم تصميم وتطوير هذا النظام بواسطة المهندس مصطفى طلعت للحلول البرمجيه
          </p>
          <a
            href="tel:01116626164"
            className="mt-1 inline-block text-sm font-semibold text-orange-600 dark:text-orange-400 hover:underline"
            dir="ltr"
          >
            01116626164
          </a>
        </div>
      </div>
    </div>
  );
};

export default Settings;
