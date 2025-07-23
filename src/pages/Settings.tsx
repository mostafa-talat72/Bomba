import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Bell, Palette, Shield, Database } from 'lucide-react';
import { api } from '../services/api';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [general, setGeneral] = useState({
    cafeName: '',
    currency: 'EGP',
    timezone: 'Africa/Cairo',
    language: 'ar',
    address: '',
    phone: '',
    email: '',
  });
  // إعدادات كل تبويب
  const [notifications, setNotifications] = useState<any>(null);
  const [appearance, setAppearance] = useState<any>(null);
  const [security, setSecurity] = useState<any>(null);
  const [backup, setBackup] = useState<any>(null);
  // حالة التحميل/الحفظ/النجاح/الخطأ لكل تبويب
  const [tabState, setTabState] = useState({
    general: { loading: false, saving: false, success: '', error: '' },
    notifications: { loading: false, saving: false, success: '', error: '' },
    appearance: { loading: false, saving: false, success: '', error: '' },
    security: { loading: false, saving: false, success: '', error: '' },
    backup: { loading: false, saving: false, success: '', error: '' },
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // دالة جلب الإعدادات لأي تبويب
  const fetchTabSettings = async (category: string) => {
    setTabState((prev) => ({ ...prev, [category]: { ...prev[category], loading: true, error: '', success: '' } }));
    const res = await api.getSettings(category);
    if (res.success && res.data) {
      switch (category) {
        case 'general': setGeneral({ ...general, ...res.data.settings }); break;
        case 'notifications': setNotifications(res.data.settings); break;
        case 'appearance': setAppearance(res.data.settings); break;
        case 'security': setSecurity(res.data.settings); break;
        case 'backup': setBackup(res.data.settings); break;
      }
      setTabState((prev) => ({ ...prev, [category]: { ...prev[category], loading: false, error: '', success: '' } }));
    } else {
      setTabState((prev) => ({ ...prev, [category]: { ...prev[category], loading: false, error: res.message || 'تعذر تحميل الإعدادات', success: '' } }));
    }
  };

  // دالة استعادة الإعدادات الافتراضية لأي تبويب
  const handleReset = async (category: string) => {
    setTabState((prev) => ({ ...prev, [category]: { ...prev[category], loading: true, error: '', success: '' } }));
    const res = await api.resetSettings(category);
    if (res.success && res.data) {
      await fetchTabSettings(category);
      setTabState((prev) => ({ ...prev, [category]: { ...prev[category], loading: false, error: '', success: 'تم استعادة الإعدادات الافتراضية بنجاح' } }));
    } else {
      setTabState((prev) => ({ ...prev, [category]: { ...prev[category], loading: false, error: res.message || 'تعذر استعادة الإعدادات الافتراضية', success: '' } }));
    }
  };

  // جلب الإعدادات عند تغيير التبويب
  useEffect(() => {
    fetchTabSettings(activeTab);
    // eslint-disable-next-line
  }, [activeTab]);

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setGeneral({ ...general, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess('');
    setError('');
    const res = await api.updateSettings('general', general);
    if (res.success) {
      setSuccess('تم حفظ الإعدادات بنجاح');
    } else {
      setError(res.message || 'حدث خطأ أثناء الحفظ');
    }
    setSaving(false);
  };

  const tabs = [
    { id: 'general', name: 'عام', icon: SettingsIcon },
    { id: 'notifications', name: 'الإشعارات', icon: Bell },
    { id: 'appearance', name: 'المظهر', icon: Palette },
    { id: 'security', name: 'الأمان', icon: Shield },
    { id: 'backup', name: 'النسخ الاحتياطي', icon: Database },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <SettingsIcon className="h-8 w-8 text-primary-600 ml-3" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إعدادات النظام</h1>
          <p className="text-gray-600">تخصيص وإدارة إعدادات التطبيق</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                      activeTab === tab.id
                        ? 'bg-primary-50 text-primary-700 border-r-4 border-primary-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-5 w-5 ml-3" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* General Settings */}
            {activeTab === 'general' && (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">الإعدادات العامة</h3>
                {tabState.general.loading ? (
                  <div className="text-center text-gray-500">جاري تحميل الإعدادات...</div>
                ) : tabState.general.error ? (
                  <div className="text-center text-red-600">
                    {tabState.general.error}
                    {tabState.general.error.includes('غير موجودة') && (
                      <button
                        className="mt-4 block mx-auto bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
                        onClick={() => handleReset('general')}
                        disabled={tabState.general.loading}
                      >
                        استعادة الإعدادات الافتراضية
                      </button>
                    )}
                  </div>
                ) : (
                <div className="space-y-6">
                  {tabState.general.success && <div className="text-green-600 text-center">{tabState.general.success}</div>}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">اسم الطلبات</label>
                      <input
                        type="text"
                        name="cafeName"
                        value={general.cafeName}
                        onChange={handleGeneralChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">العملة</label>
                      <select
                        name="currency"
                        value={general.currency}
                        onChange={handleGeneralChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="EGP">جنيه مصري (ج.م)</option>
                        <option value="USD">دولار أمريكي ($)</option>
                        <option value="EUR">يورو (€)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">المنطقة الزمنية</label>
                      <select
                        name="timezone"
                        value={general.timezone}
                        onChange={handleGeneralChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="Africa/Cairo">القاهرة (GMT+2)</option>
                        <option value="Asia/Dubai">دبي (GMT+4)</option>
                        <option value="Asia/Riyadh">الرياض (GMT+3)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">اللغة</label>
                      <select
                        name="language"
                        value={general.language}
                        onChange={handleGeneralChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="ar">العربية</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">عنوان الطلبات</label>
                    <textarea
                      name="address"
                      rows={3}
                      value={general.address}
                      onChange={handleGeneralChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">رقم الهاتف</label>
                      <input
                        type="tel"
                        name="phone"
                        value={general.phone}
                        onChange={handleGeneralChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">البريد الإلكتروني</label>
                      <input
                        type="email"
                        name="email"
                        value={general.email}
                        onChange={handleGeneralChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Notifications Settings */}
            {activeTab === 'notifications' && (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">إعدادات الإشعارات</h3>
                {tabState.notifications.loading ? (
                  <div className="text-center text-gray-500">جاري تحميل الإعدادات...</div>
                ) : tabState.notifications.error ? (
                  <div className="text-center text-red-600">
                    {tabState.notifications.error}
                    {tabState.notifications.error.includes('غير موجودة') && (
                      <button
                        className="mt-4 block mx-auto bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
                        onClick={() => handleReset('notifications')}
                        disabled={tabState.notifications.loading}
                      >
                        استعادة الإعدادات الافتراضية
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {tabState.notifications.success && <div className="text-green-600 text-center">{tabState.notifications.success}</div>}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">إشعارات الجلسات</h4>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">إشعار عند انتهاء الجلسة</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">إشعار عند بدء جلسة جديدة</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">إشعار عند إيقاف الجلسة مؤقتاً</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">إشعارات الطلبات</h4>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">إشعار عند طلب جديد</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">إشعار عند اكتمال تحضير الطلب</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">إشعار عند إلغاء الطلب</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">إشعارات المخزون</h4>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">إشعار عند انخفاض المخزون</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">إشعار عند نفاد المخزون</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">إشعارات الفواتير</h4>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">إشعار عند إنشاء فاتورة جديدة</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">إشعار عند دفع الفاتورة</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">إشعار عند الدفع الجزئي</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">إعدادات الصوت</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center">
                          <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                          <span className="mr-3 text-sm text-gray-700">تفعيل صوت الإشعارات</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1 mr-6">تشغيل صوت عند وصول إشعار جديد</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">مستوى الصوت</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          defaultValue="60"
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>صامت</span>
                          <span>60%</span>
                          <span>عالي</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">نوع الصوت الافتراضي</label>
                        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                          <option value="default">النغمة الافتراضية</option>
                          <option value="success">نغمة النجاح</option>
                          <option value="warning">نغمة التحذير</option>
                          <option value="error">نغمة الخطأ</option>
                          <option value="urgent">نغمة عاجلة</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">أصوات خاصة حسب الأولوية</label>
                        <div className="space-y-2">
                          <label className="flex items-center">
                            <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                            <span className="mr-3 text-sm text-gray-700">صوت مختلف للإشعارات العاجلة</span>
                          </label>
                          <label className="flex items-center">
                            <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                            <span className="mr-3 text-sm text-gray-700">صوت مختلف للإشعارات عالية الأولوية</span>
                          </label>
                          <label className="flex items-center">
                            <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                            <span className="mr-3 text-sm text-gray-700">صوت مختلف للإشعارات العادية</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">خيارات الإشعارات</h4>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">تفعيل الصوت</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">إشعارات البريد الإلكتروني</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">إظهار عدد الإشعارات</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">تحديد كمقروء تلقائياً</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">إعدادات متقدمة</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">مدة ظهور الإشعار (بالثواني)</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          defaultValue="5"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">نغمة الإشعار</label>
                        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                          <option value="default">النغمة الافتراضية</option>
                          <option value="bell">جرس</option>
                          <option value="chime">رنين</option>
                          <option value="beep">صوت تنبيه</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">أولوية الإشعارات</label>
                        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                          <option value="all">جميع الإشعارات</option>
                          <option value="high">عالية فقط</option>
                          <option value="urgent">عاجلة فقط</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">إدارة الإشعارات</h4>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 space-x-reverse">
                        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                          تحديد جميع الإشعارات كمقروءة
                        </button>
                        <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                          حذف جميع الإشعارات
                        </button>
                      </div>
                      <div className="flex items-center space-x-3 space-x-reverse">
                        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                          تنظيف الإشعارات المنتهية الصلاحية
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Appearance Settings */}
            {activeTab === 'appearance' && (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">إعدادات المظهر</h3>
                {tabState.appearance.loading ? (
                  <div className="text-center text-gray-500">جاري تحميل الإعدادات...</div>
                ) : tabState.appearance.error ? (
                  <div className="text-center text-red-600">
                    {tabState.appearance.error}
                    {tabState.appearance.error.includes('غير موجودة') && (
                      <button
                        className="mt-4 block mx-auto bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
                        onClick={() => handleReset('appearance')}
                        disabled={tabState.appearance.loading}
                      >
                        استعادة الإعدادات الافتراضية
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {tabState.appearance.success && <div className="text-green-600 text-center">{tabState.appearance.success}</div>}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">السمة</label>
                    <div className="grid grid-cols-3 gap-3">
                      <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="theme" value="light" defaultChecked className="text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">فاتح</span>
                      </label>
                      <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="theme" value="dark" className="text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">داكن</span>
                      </label>
                      <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="theme" value="auto" className="text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">تلقائي</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">اللون الأساسي</label>
                    <div className="grid grid-cols-6 gap-3">
                      {['bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-red-600', 'bg-yellow-600', 'bg-indigo-600'].map((color) => (
                        <button
                          key={color}
                          className={`w-10 h-10 rounded-lg ${color} border-2 border-transparent hover:border-gray-300`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">حجم الخط</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                      <option value="small">صغير</option>
                      <option value="medium" selected>متوسط</option>
                      <option value="large">كبير</option>
                    </select>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">تخصيص الواجهة</h4>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">إظهار الشريط الجانبي</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">إظهار معلومات المستخدم</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">وضع ملء الشاشة</span>
                      </label>
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Security Settings */}
            {activeTab === 'security' && (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">إعدادات الأمان</h3>
                {tabState.security.loading ? (
                  <div className="text-center text-gray-500">جاري تحميل الإعدادات...</div>
                ) : tabState.security.error ? (
                  <div className="text-center text-red-600">
                    {tabState.security.error}
                    {tabState.security.error.includes('غير موجودة') && (
                      <button
                        className="mt-4 block mx-auto bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
                        onClick={() => handleReset('security')}
                        disabled={tabState.security.loading}
                      >
                        استعادة الإعدادات الافتراضية
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {tabState.security.success && <div className="text-green-600 text-center">{tabState.security.success}</div>}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">كلمة المرور</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور الحالية</label>
                        <input
                          type="password"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور الجديدة</label>
                        <input
                          type="password"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">تأكيد كلمة المرور</label>
                        <input
                          type="password"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">الجلسات</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">مدة انتهاء الجلسة (بالدقائق)</label>
                        <input
                          type="number"
                          defaultValue="60"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">تسجيل الخروج التلقائي عند عدم النشاط</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">الصلاحيات</h4>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">تسجيل عمليات تسجيل الدخول</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">السماح بتسجيل الدخول من أجهزة متعددة</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">تشفير البيانات الحساسة</span>
                      </label>
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Backup Settings */}
            {activeTab === 'backup' && (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">النسخ الاحتياطي</h3>
                {tabState.backup.loading ? (
                  <div className="text-center text-gray-500">جاري تحميل الإعدادات...</div>
                ) : tabState.backup.error ? (
                  <div className="text-center text-red-600">
                    {tabState.backup.error}
                    {tabState.backup.error.includes('غير موجودة') && (
                      <button
                        className="mt-4 block mx-auto bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
                        onClick={() => handleReset('backup')}
                        disabled={tabState.backup.loading}
                      >
                        استعادة الإعدادات الافتراضية
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {tabState.backup.success && <div className="text-green-600 text-center">{tabState.backup.success}</div>}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">النسخ الاحتياطي التلقائي</h4>
                    <div className="space-y-4">
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="mr-3 text-sm text-gray-700">تفعيل النسخ الاحتياطي التلقائي</span>
                      </label>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">التكرار</label>
                        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                          <option value="daily">يومي</option>
                          <option value="weekly" selected>أسبوعي</option>
                          <option value="monthly">شهري</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">عدد النسخ المحفوظة</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          defaultValue="7"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">النسخ الاحتياطي اليدوي</h4>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 space-x-reverse">
                        <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                          إنشاء نسخة احتياطية الآن
                        </button>
                        <span className="text-sm text-gray-500">آخر نسخة احتياطية: 15 يناير 2024</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">استعادة البيانات</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">اختر ملف النسخة الاحتياطية</label>
                        <input
                          type="file"
                          accept=".backup"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                        استعادة البيانات
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-yellow-800">
                      <strong>تحذير:</strong> عملية الاستعادة ستحل محل جميع البيانات الحالية.
                      تأكد من إنشاء نسخة احتياطية قبل المتابعة.
                    </p>
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Save Button */}
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                className={`bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg flex items-center transition-colors duration-200 ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={handleSave}
                disabled={saving || loading}
              >
                <Save className="h-4 w-4 ml-2" />
                {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
