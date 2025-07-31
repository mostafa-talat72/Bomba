import React from 'react';
import { Save, CheckCircle, Settings, Globe, Phone, Mail } from 'lucide-react';
import { TabProps } from '../../types/settings';

const GeneralSettingsTab: React.FC<TabProps> = ({
  settings,
  setSettings,
  tabState,
  onSave,
  onReset,
  canEdit
}) => {
  const handleChange = (field: string, value: any) => {
    if (!canEdit(`general.${field}`)) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleNestedChange = (parent: string, field: string, value: any) => {
    if (!canEdit(`general.${parent}.${field}`)) return;
    setSettings({
      ...settings,
      [parent]: { ...settings[parent], [field]: value }
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">الإعدادات العامة</h3>
        <div className="flex items-center space-x-3 space-x-reverse">
          <button
            onClick={onReset}
            disabled={tabState.loading}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
          >
            استعادة الافتراضية
          </button>
          <button
            onClick={onSave}
            disabled={tabState.saving || tabState.loading}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200"
          >
            <Save className="h-4 w-4 ml-2" />
            {tabState.saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>

      {tabState.loading ? (
        <div className="text-center text-gray-500">جاري تحميل الإعدادات...</div>
      ) : tabState.error ? (
        <div className="text-center text-red-600">{tabState.error}</div>
      ) : (
        <div className="space-y-8">
          {tabState.success && (
            <div className="flex items-center text-green-600 text-center">
              <CheckCircle className="h-5 w-5 ml-2" />
              {tabState.success}
            </div>
          )}

          {/* معلومات أساسية */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Settings className="h-5 w-5 ml-2" />
              معلومات أساسية
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم المقهى
                </label>
                <input
                  type="text"
                  value={settings.cafeName}
                  onChange={(e) => handleChange('cafeName', e.target.value)}
                  disabled={!canEdit('general.cafeName')}
                  placeholder="اسم المقهى"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  العملة
                </label>
                <select
                  value={settings.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  disabled={!canEdit('general.currency')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                >
                  <option value="EGP">جنيه مصري (ج.م)</option>
                  <option value="USD">دولار أمريكي ($)</option>
                  <option value="EUR">يورو (€)</option>
                  <option value="SAR">ريال سعودي (ر.س)</option>
                  <option value="AED">درهم إماراتي (د.إ)</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                العنوان
              </label>
              <textarea
                value={settings.address}
                onChange={(e) => handleChange('address', e.target.value)}
                disabled={!canEdit('general.address')}
                placeholder="عنوان المقهى"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* معلومات الاتصال */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Phone className="h-5 w-5 ml-2" />
              معلومات الاتصال
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  disabled={!canEdit('general.phone')}
                  placeholder="+20 123 456 7890"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  disabled={!canEdit('general.email')}
                  placeholder="info@cafe.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الموقع الإلكتروني
              </label>
              <input
                type="url"
                value={settings.website || ''}
                onChange={(e) => handleChange('website', e.target.value)}
                disabled={!canEdit('general.website')}
                placeholder="https://www.cafe.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* إعدادات النظام */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Globe className="h-5 w-5 ml-2" />
              إعدادات النظام
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المنطقة الزمنية
                </label>
                <select
                  value={settings.timezone}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  disabled={!canEdit('general.timezone')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                >
                  <option value="Africa/Cairo">القاهرة (GMT+2)</option>
                  <option value="Asia/Riyadh">الرياض (GMT+3)</option>
                  <option value="Asia/Dubai">دبي (GMT+4)</option>
                  <option value="Europe/London">لندن (GMT+0)</option>
                  <option value="America/New_York">نيويورك (GMT-5)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اللغة
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => handleChange('language', e.target.value)}
                  disabled={!canEdit('general.language')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </div>
            </div>
          </div>

          {/* إعدادات الضرائب */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات الضرائب</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نسبة الضريبة (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  value={settings.taxRate}
                  onChange={(e) => handleChange('taxRate', parseFloat(e.target.value) || 0)}
                  disabled={!canEdit('general.taxRate')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.taxInclusive}
                    onChange={(e) => handleChange('taxInclusive', e.target.checked)}
                    disabled={!canEdit('general.taxInclusive')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">الأسعار شاملة الضريبة</span>
                </label>
              </div>
            </div>
          </div>

          {/* وسائل التواصل الاجتماعي */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">وسائل التواصل الاجتماعي</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  فيسبوك
                </label>
                <input
                  type="url"
                  value={settings.socialMedia?.facebook || ''}
                  onChange={(e) => handleNestedChange('socialMedia', 'facebook', e.target.value)}
                  disabled={!canEdit('general.socialMedia.facebook')}
                  placeholder="https://facebook.com/cafe"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  إنستغرام
                </label>
                <input
                  type="url"
                  value={settings.socialMedia?.instagram || ''}
                  onChange={(e) => handleNestedChange('socialMedia', 'instagram', e.target.value)}
                  disabled={!canEdit('general.socialMedia.instagram')}
                  placeholder="https://instagram.com/cafe"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تويتر
              </label>
              <input
                type="url"
                value={settings.socialMedia?.twitter || ''}
                onChange={(e) => handleNestedChange('socialMedia', 'twitter', e.target.value)}
                disabled={!canEdit('general.socialMedia.twitter')}
                placeholder="https://twitter.com/cafe"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* إعدادات متقدمة */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات متقدمة</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  معرف النظام
                </label>
                <input
                  type="text"
                  value={settings.systemId || ''}
                  onChange={(e) => handleChange('systemId', e.target.value)}
                  disabled={!canEdit('general.systemId')}
                  placeholder="SYSTEM-001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  إصدار النظام
                </label>
                <input
                  type="text"
                  value={settings.systemVersion || '1.0.0'}
                  onChange={(e) => handleChange('systemVersion', e.target.value)}
                  disabled={!canEdit('general.systemVersion')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.debugMode || false}
                  onChange={(e) => handleChange('debugMode', e.target.checked)}
                  disabled={!canEdit('general.debugMode')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">وضع التطوير</span>
              </label>
            </div>
            <div className="mt-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode || false}
                  onChange={(e) => handleChange('maintenanceMode', e.target.checked)}
                  disabled={!canEdit('general.maintenanceMode')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">وضع الصيانة</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralSettingsTab;
