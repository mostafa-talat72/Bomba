import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Bell, User, Lock, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../context/AppContext';

const Settings = () => {
  const { user, showNotification, updateUserProfile, changePassword, updateNotificationSettings, updateGeneralSettings } = useApp();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);

  // Profile state
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState({
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
  const [generalSettings, setGeneralSettings] = useState({
    theme: 'light',
    language: 'ar',
    timezone: 'Africa/Cairo',
    currency: 'EGP',
  });

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
      });
    }
  }, [user]);

  const handleProfileUpdate = async () => {
    if (!profile.name.trim() || !profile.email.trim()) {
      showNotification('الاسم والبريد الإلكتروني مطلوبان', 'error');
      return;
    }

    setSaving(true);
    try {
      const success = await updateUserProfile(profile);
      if (success) {
        // تحديث بيانات المستخدم في الواجهة
        // يمكن إضافة منطق إضافي هنا
      }
    } catch {
      // تم التعامل مع الخطأ في الدالة
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      showNotification('جميع الحقول مطلوبة', 'error');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showNotification('كلمة المرور الجديدة غير متطابقة', 'error');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showNotification('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
      return;
    }

    setSaving(true);
    try {
      const success = await changePassword(passwordData);
      if (success) {
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      }
    } catch {
      // تم التعامل مع الخطأ في الدالة
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationSettingsUpdate = async () => {
    setSaving(true);
    try {
      await updateNotificationSettings(notificationSettings);
    } catch {
      // تم التعامل مع الخطأ في الدالة
    } finally {
      setSaving(false);
    }
  };

  const handleGeneralSettingsUpdate = async () => {
    setSaving(true);
    try {
      await updateGeneralSettings(generalSettings);
    } catch {
      // تم التعامل مع الخطأ في الدالة
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', name: 'الملف الشخصي', icon: User },
    { id: 'password', name: 'كلمة المرور', icon: Lock },
    { id: 'notifications', name: 'الإشعارات', icon: Bell },
    { id: 'general', name: 'عام', icon: SettingsIcon },
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
    <>
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
                      disabled={saving}
                      className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      <span>{saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</span>
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
                        disabled={saving}
                        className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
                      >
                        <Lock className="h-4 w-4" />
                        <span>{saving ? 'جاري التغيير...' : 'تغيير كلمة المرور'}</span>
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
                        disabled={saving}
                        className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        <span>{saving ? 'جاري الحفظ...' : 'حفظ إعدادات الإشعارات'}</span>
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
                        disabled={saving}
                        className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        <span>{saving ? 'جاري الحفظ...' : 'حفظ الإعدادات العامة'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Settings;

