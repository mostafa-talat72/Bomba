import { useState, useEffect, FC } from 'react';
import { Settings as SettingsIcon, Save, Bell, User, Lock, Eye, EyeOff, Building2, LucideIcon, Facebook, Instagram, Twitter, Linkedin, Youtube, MessageCircle, Send, Globe, Phone, Mail, MapPin, Clock, Users, Check, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

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
  timezone: string;
  currency: string;
}

interface ProfileData {
  name: string;
  email: string;
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
  socialLinks: {
    facebook: string;
    instagram: string;
    twitter: string;
    linkedin: string;
    youtube: string;
    tiktok: string;
    whatsapp: string;
    telegram: string;
  };
  workingHours: {
    [key: string]: {
      open: string;
      close: string;
      closed: boolean;
    };
  };
  logo: string;
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
  const { user, updateUserProfile, changePassword, updateNotificationSettings, updateGeneralSettings, getNotificationSettings, getGeneralSettings, getOrganization, updateOrganization, updateOrganizationPermissions, canEditOrganization, getAvailableManagers } = useApp();
  
  // UI State
  const [activeTab, setActiveTab] = useState('profile');
  
  // Loading states
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [generalSaving, setGeneralSaving] = useState(false);
  const [organizationSaving, setOrganizationSaving] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  
  // Alert state
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<AlertType>('info');
  
  // Profile state
  const [profile, setProfile] = useState<ProfileData>({
    name: user?.name || '',
    email: user?.email || '',
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

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    sessionNotifications: true,
    orderNotifications: true,
    inventoryNotifications: true,
    billingNotifications: true,
    soundEnabled: true,
    emailNotifications: false,
    showNotificationCount: true,
    autoMarkAsRead: false,
  });

  // General settings state
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    theme: 'light',
    language: 'ar',
    timezone: 'Africa/Cairo',
    currency: 'EGP',
  });

  // Organization state
  const [organization, setOrganization] = useState<OrganizationData>({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    socialLinks: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      youtube: '',
      tiktok: '',
      whatsapp: '',
      telegram: '',
    },
    workingHours: {
      monday: { open: '09:00', close: '22:00', closed: false },
      tuesday: { open: '09:00', close: '22:00', closed: false },
      wednesday: { open: '09:00', close: '22:00', closed: false },
      thursday: { open: '09:00', close: '22:00', closed: false },
      friday: { open: '09:00', close: '22:00', closed: false },
      saturday: { open: '09:00', close: '22:00', closed: false },
      sunday: { open: '09:00', close: '22:00', closed: false },
    },
    logo: '',
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
      console.log('=== User data received in Settings ===');
      console.log('Full user object:', user);
      console.log('User name:', user.name);
      console.log('User email:', user.email);
      console.log('User phone:', user.phone);
      console.log('User address:', user.address);
      console.log('=====================================');
      
      const newProfile = {
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
      };
      console.log('New profile data to set:', newProfile);
      
      // Only update if the data has actually changed to avoid unnecessary re-renders
      setProfile(prev => {
        const hasChanged = 
          prev.name !== newProfile.name ||
          prev.email !== newProfile.email ||
          prev.phone !== newProfile.phone ||
          prev.address !== newProfile.address;
        
        if (hasChanged) {
          console.log('Profile data changed, updating form fields');
          console.log('Previous profile:', prev);
          console.log('New profile:', newProfile);
          return newProfile;
        }
        
        console.log('Profile data unchanged, keeping current values');
        return prev;
      });
    } else {
      console.log('No user data available');
    }
  }, [user]);

  // Load settings from database
  useEffect(() => {
    const loadSettings = async () => {
      if (user) {
        try {
          // Load notification settings
          const notifSettings = await getNotificationSettings();
          if (notifSettings) {
            setNotificationSettings(prev => ({
              ...prev,
              ...notifSettings
            }));
          }

          // Load general settings
          const genSettings = await getGeneralSettings();
          if (genSettings) {
            setGeneralSettings(prev => ({
              ...prev,
              ...genSettings
            }));
          }
        } catch (error) {
          console.error('Error loading settings:', error);
          showAlertMessage('حدث خطأ أثناء تحميل الإعدادات', 'warning');
        }
      }
    };

    loadSettings();
  }, [user, getNotificationSettings, getGeneralSettings]);

  // Load organization data and permissions
  useEffect(() => {
    const loadOrganizationData = async () => {
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
              ...orgData.workingHours,
            },
          }));
        }

        // Load permissions
        const permissions = await canEditOrganization();
        if (permissions) {
          setOrganizationPermissions(permissions);
          if (permissions.authorizedManagers) {
            setSelectedManagers(permissions.authorizedManagers.map((m: any) => m._id));
          }
        }

        // Load available managers if user is owner
        if (permissions?.isOwner) {
          const managers = await getAvailableManagers();
          if (managers) {
            setAvailableManagers(managers);
          }
        }
      } catch (error) {
        console.error('Error loading organization data:', error);
      }
    };

    if (user) {
      loadOrganizationData();
    }
  }, [user, getOrganization, canEditOrganization, getAvailableManagers]);

  // Show loading state if user is not loaded yet
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 dark:border-orange-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const handleProfileUpdate = async () => {
    if (!profile.name.trim() || !profile.email.trim()) {
      showAlertMessage('الاسم والبريد الإلكتروني مطلوبان', 'error');
      return;
    }

    setProfileSaving(true);
    try {
      console.log('Updating profile with data:', profile);
      const success = await updateUserProfile(profile);
      if (success) {
        console.log('Profile updated successfully');
        showAlertMessage('تم تحديث الملف الشخصي بنجاح');
        // The user state should be automatically updated by the updateUserProfile function
      } else {
        console.log('Profile update failed');
        showAlertMessage('حدث خطأ أثناء تحديث الملف الشخصي', 'error');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      showAlertMessage('حدث خطأ غير متوقع أثناء تحديث الملف الشخصي', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      showAlertMessage('جميع الحقول مطلوبة', 'error');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showAlertMessage('كلمة المرور الجديدة غير متطابقة', 'error');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showAlertMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
      return;
    }

    setPasswordSaving(true);
    try {
      const success = await changePassword(passwordData);
      if (success) {
        showAlertMessage('تم تغيير كلمة المرور بنجاح');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        showAlertMessage('فشل تغيير كلمة المرور. يرجى التحقق من كلمة المرور الحالية', 'error');
      }
    } catch (error) {
      showAlertMessage('حدث خطأ أثناء تغيير كلمة المرور', 'error');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleNotificationSettingsUpdate = async () => {
    setNotificationsSaving(true);
    try {
      console.log('Updating notification settings:', notificationSettings);
      const success = await updateNotificationSettings(notificationSettings);
      if (success) {
        showAlertMessage('تم حفظ إعدادات الإشعارات بنجاح');
      } else {
        showAlertMessage('حدث خطأ أثناء حفظ إعدادات الإشعارات', 'error');
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
      showAlertMessage('حدث خطأ أثناء حفظ إعدادات الإشعارات', 'error');
    } finally {
      setNotificationsSaving(false);
    }
  };

  const handleGeneralSettingsUpdate = async () => {
    setGeneralSaving(true);
    try {
      const success = await updateGeneralSettings(generalSettings);
      if (success) {
        showAlertMessage('تم حفظ الإعدادات العامة بنجاح');
      } else {
        showAlertMessage('حدث خطأ أثناء حفظ الإعدادات العامة', 'error');
      }
    } catch (error) {
      showAlertMessage('حدث خطأ أثناء حفظ الإعدادات العامة', 'error');
    } finally {
      setGeneralSaving(false);
    }
  };

  const handleOrganizationUpdate = async () => {
    setOrganizationSaving(true);
    try {
      const success = await updateOrganization(organization);
      if (success) {
        showAlertMessage('تم تحديث بيانات المنشأة بنجاح');
      } else {
        showAlertMessage('حدث خطأ أثناء تحديث بيانات المنشأة', 'error');
      }
    } catch (error) {
      showAlertMessage('حدث خطأ أثناء تحديث بيانات المنشأة', 'error');
    } finally {
      setOrganizationSaving(false);
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
        showAlertMessage('تم تحديث صلاحيات المنشأة بنجاح');
        // Reload permissions to get updated data
        const permissions = await canEditOrganization();
        if (permissions) {
          setOrganizationPermissions(permissions);
        }
      } else {
        showAlertMessage('حدث خطأ أثناء تحديث صلاحيات المنشأة', 'error');
      }
    } catch (error) {
      showAlertMessage('حدث خطأ أثناء تحديث صلاحيات المنشأة', 'error');
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

  const tabs: TabType[] = [
    { id: 'profile', name: 'الملف الشخصي', icon: User },
    { id: 'password', name: 'كلمة المرور', icon: Lock },
    { id: 'notifications', name: 'الإشعارات', icon: Bell },
    { id: 'general', name: 'عام', icon: SettingsIcon },
    ...(organizationPermissions.canEdit ? [{ id: 'organization', name: 'المنشأة', icon: Building2 }] : []),
  ];

  if (!user) {
  return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 dark:border-orange-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
          <div className="flex items-center justify-between flex-wrap xs:flex-col xs:items-start xs:gap-2 xs:space-y-2 xs:w-full">
            <div className="flex items-center xs:w-full xs:justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center xs:text-base xs:w-full xs:text-center">
              <SettingsIcon className="h-6 w-6 text-orange-600 dark:text-orange-400 ml-2" />
              الإعدادات
            </h1>
              <p className="text-gray-600 dark:text-gray-300 mr-4 xs:mr-0 xs:w-full xs:text-center">ضبط إعدادات النظام والصلاحيات</p>
            </div>
            <div className="flex items-center gap-2 xs:w-full xs:justify-center xs:mt-2">
              {/* ضع هنا أزرار الإجراءات مثل حفظ الإعدادات */}
          </div>
      </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex flex-wrap justify-center gap-2 md:gap-6 px-6 mb-4" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                        ${activeTab === tab.id
                        ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'}
                      `}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
        </div>

          {/* Tab Content */}
              <div className="p-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
                <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">الملف الشخصي</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        الاسم الكامل
                      </label>
                      <input
                        type="text"
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="أدخل اسمك الكامل"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        البريد الإلكتروني
                      </label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="أدخل بريدك الإلكتروني"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        رقم الهاتف
                      </label>
                      <input
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="أدخل رقم هاتفك"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        العنوان
                      </label>
                      <input
                        type="text"
                        value={profile.address}
                        onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="أدخل عنوانك"
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
                          <span>جاري الحفظ...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>حفظ التغييرات</span>
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
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">تغيير كلمة المرور</h3>
                  <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        كلمة المرور الحالية
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.current ? 'text' : 'password'}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                          placeholder="أدخل كلمة المرور الحالية"
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
                        كلمة المرور الجديدة
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.new ? 'text' : 'password'}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                          placeholder="أدخل كلمة المرور الجديدة"
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
                        تأكيد كلمة المرور الجديدة
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.confirm ? 'text' : 'password'}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                          placeholder="أعد إدخال كلمة المرور الجديدة"
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
                            <span>جاري التغيير...</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4" />
                            <span>تغيير كلمة المرور</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                  <div className="space-y-6">
                  <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">إعدادات الإشعارات</h3>
                    <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">إشعارات الجلسات</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">استلام إشعارات عند بدء أو انتهاء الجلسات</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.sessionNotifications}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, sessionNotifications: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                      </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">إشعارات الطلبات</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">استلام إشعارات عند إنشاء أو تحديث الطلبات</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.orderNotifications}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, orderNotifications: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                      </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">إشعارات المخزون</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">استلام إشعارات عند انخفاض المخزون</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.inventoryNotifications}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, inventoryNotifications: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">إشعارات الفواتير</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">استلام إشعارات عند إنشاء أو دفع الفواتير</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.billingNotifications}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, billingNotifications: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                  </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">صوت الإشعارات</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">تشغيل صوت عند استلام الإشعارات</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.soundEnabled}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, soundEnabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                  </div>

                    <div className="flex items-center justify-between">
                  <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">إشعارات البريد الإلكتروني</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">إرسال الإشعارات عبر البريد الإلكتروني</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.emailNotifications}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, emailNotifications: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">إظهار عدد الإشعارات</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">إظهار عدد الإشعارات غير المقروءة</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.showNotificationCount}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, showNotificationCount: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">تحديد كمقروء تلقائياً</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">تحديد الإشعارات كمقروءة تلقائياً بعد فترة</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.autoMarkAsRead}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, autoMarkAsRead: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="mt-6">
                      <button
                        onClick={handleNotificationSettingsUpdate}
                        disabled={notificationsSaving}
                        className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-md disabled:opacity-50 min-w-48 justify-center"
                      >
                        {notificationsSaving ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>جاري الحفظ...</span>
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            <span>حفظ إعدادات الإشعارات</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">الإعدادات العامة</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        المظهر
                      </label>
                      <select
                        value={generalSettings.theme}
                        onChange={(e) => setGeneralSettings({ ...generalSettings, theme: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="light">فاتح</option>
                        <option value="dark">داكن</option>
                        <option value="auto">تلقائي</option>
                      </select>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        اللغة
                      </label>
                      <select
                        value={generalSettings.language}
                        onChange={(e) => setGeneralSettings({ ...generalSettings, language: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="ar">العربية</option>
                        <option value="en">English</option>
                        </select>
                      </div>

                      <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        المنطقة الزمنية
                      </label>
                      <select
                        value={generalSettings.timezone}
                        onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="Africa/Cairo">القاهرة (GMT+2)</option>
                        <option value="Asia/Riyadh">الرياض (GMT+3)</option>
                        <option value="Asia/Dubai">دبي (GMT+4)</option>
                      </select>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        العملة
                      </label>
                      <select
                        value={generalSettings.currency}
                        onChange={(e) => setGeneralSettings({ ...generalSettings, currency: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="EGP">جنيه مصري (EGP)</option>
                        <option value="SAR">ريال سعودي (SAR)</option>
                        <option value="AED">درهم إماراتي (AED)</option>
                        <option value="USD">دولار أمريكي (USD)</option>
                      </select>
                  </div>

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
                            <span>جاري الحفظ...</span>
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            <span>حفظ الإعدادات العامة</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Organization Tab */}
            {activeTab === 'organization' && organizationPermissions.canEdit && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">بيانات المنشأة</h3>
                    {organizationPermissions.isOwner && (
                      <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">
                        مالك المنشأة
                      </span>
                    )}
                  </div>

                  {/* Basic Information */}
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                    <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                      <Building2 className="h-5 w-5 ml-2" />
                      المعلومات الأساسية
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          اسم المنشأة
                        </label>
                        <input
                          type="text"
                          value={organization.name}
                          onChange={(e) => setOrganization({ ...organization, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="أدخل اسم المنشأة"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Phone className="h-4 w-4 inline ml-1" />
                          رقم الهاتف
                        </label>
                        <input
                          type="tel"
                          value={organization.phone}
                          onChange={(e) => setOrganization({ ...organization, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="أدخل رقم الهاتف"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Mail className="h-4 w-4 inline ml-1" />
                          البريد الإلكتروني
                        </label>
                        <input
                          type="email"
                          value={organization.email}
                          onChange={(e) => setOrganization({ ...organization, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="أدخل البريد الإلكتروني"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Globe className="h-4 w-4 inline ml-1" />
                          الموقع الإلكتروني
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
                          العنوان
                        </label>
                        <input
                          type="text"
                          value={organization.address}
                          onChange={(e) => setOrganization({ ...organization, address: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="أدخل عنوان المنشأة"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          وصف المنشأة
                        </label>
                        <textarea
                          value={organization.description}
                          onChange={(e) => setOrganization({ ...organization, description: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="أدخل وصف مختصر للمنشأة"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Social Links */}
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                    <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
                      الروابط الاجتماعية
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Facebook className="h-4 w-4 inline ml-1 text-blue-600" />
                          فيسبوك
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
                          إنستغرام
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
                          تويتر
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
                          لينكد إن
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
                          يوتيوب
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
                          تيك توك
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
                          واتساب
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
                          تليجرام
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
                    </div>
                  </div>

                  {/* Permissions Section - Only for Owner */}
                  {organizationPermissions.isOwner && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mb-6">
                      <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                        <Users className="h-5 w-5 ml-2" />
                        صلاحيات المنشأة
                      </h4>
                      
                      {/* Enable/Disable Permission */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            السماح للمديرين بتعديل بيانات المنشأة
                          </h5>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            عند التفعيل، سيتمكن المديرون المحددون من تعديل بيانات المنشأة والروابط الاجتماعية
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
                            اختر المديرين المخولين:
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
                                تم اختيار {selectedManagers.length} من المديرين
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {organizationPermissions.allowManagersToEditOrganization && availableManagers.length === 0 && (
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                            لا يوجد مديرين متاحين في المنشأة
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
                              <span>جاري الحفظ...</span>
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              <span>حفظ الصلاحيات</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="mt-6">
                    <button
                      onClick={handleOrganizationUpdate}
                      disabled={organizationSaving}
                      className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-md disabled:opacity-50 min-w-48 justify-center"
                    >
                      {organizationSaving ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>جاري الحفظ...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>حفظ بيانات المنشأة</span>
                        </>
                      )}
                    </button>
                  </div>
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
    </div>
  );
};

export default Settings;

