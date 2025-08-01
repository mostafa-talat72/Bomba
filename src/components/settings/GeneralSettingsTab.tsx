import React, { useState } from 'react';
import { Save, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';
import { TabProps } from '../../types/settings';

const GeneralSettingsTab: React.FC<TabProps> = ({
  settings,
  setSettings,
  tabState,
  onSave,
  onReset,
  canEdit
}) => {
  const [validationErrors, setValidationErrors] = useState<Array<{
    field: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>>([]);

  const handleInputChange = (field: string, value: any) => {
    if (!canEdit('general')) return;

    setSettings({
      ...settings,
      [field]: value
    });

    // Clear validation errors for this field
    setValidationErrors(prev => prev.filter(err => err.field !== field));
  };

  const handleSave = async () => {
    if (!canEdit('general')) return;

    // Basic validation
    const errors: Array<{ field: string; message: string; severity: 'error' | 'warning' | 'info' }> = [];

    if (!settings.cafeName || settings.cafeName.trim().length < 2) {
      errors.push({
        field: 'cafeName',
        message: 'اسم المقهى مطلوب ويجب أن يكون أكثر من حرفين',
        severity: 'error'
      });
    }

    if (settings.taxRate < 0 || settings.taxRate > 100) {
      errors.push({
        field: 'taxRate',
        message: 'نسبة الضريبة يجب أن تكون بين 0 و 100',
        severity: 'error'
      });
    }

    if (settings.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
      errors.push({
        field: 'email',
        message: 'البريد الإلكتروني غير صحيح',
        severity: 'error'
      });
    }

    setValidationErrors(errors);

    if (errors.some(err => err.severity === 'error')) {
      return;
    }

    await onSave();
  };

  const getFieldError = (field: string) => {
    return validationErrors.find(err => err.field === field);
  };

  const getFieldWarning = (field: string) => {
    return validationErrors.find(err => err.field === field && err.severity === 'warning');
  };

  if (!canEdit('general')) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">ليس لديك صلاحية</h3>
        <p className="text-gray-600">ليس لديك صلاحية للوصول لهذه الإعدادات</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">الإعدادات العامة</h2>
          <p className="text-gray-600">إعدادات أساسية للنظام</p>
        </div>

        <div className="flex items-center space-x-3 space-x-reverse">
          <button
            onClick={onReset}
            disabled={tabState.saving}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4 ml-2" />
            إعادة تعيين
          </button>

          <button
            onClick={handleSave}
            disabled={tabState.saving || !canEdit('general')}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 ml-2" />
            حفظ الإعدادات
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {tabState.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-500 ml-2" />
          <span className="text-red-700">{tabState.error}</span>
        </div>
      )}

      {tabState.success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 text-green-500 ml-2" />
          <span className="text-green-700">{tabState.success}</span>
        </div>
      )}

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">المعلومات الأساسية</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اسم المقهى *
            </label>
            <input
              type="text"
              value={settings.cafeName || ''}
              onChange={(e) => handleInputChange('cafeName', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                getFieldError('cafeName') ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="أدخل اسم المقهى"
            />
            {getFieldError('cafeName') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('cafeName')?.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={settings.email || ''}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                getFieldError('email') ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="example@cafe.com"
            />
            {getFieldError('email') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('email')?.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              رقم الهاتف
            </label>
            <input
              type="tel"
              value={settings.phone || ''}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="+20 123 456 7890"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              العنوان
            </label>
            <textarea
              value={settings.address || ''}
              onChange={(e) => handleInputChange('address', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="أدخل العنوان الكامل"
            />
          </div>
        </div>

        {/* System Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">إعدادات النظام</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              العملة
            </label>
            <select
              value={settings.currency || 'EGP'}
              onChange={(e) => handleInputChange('currency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="EGP">جنيه مصري (EGP)</option>
              <option value="USD">دولار أمريكي (USD)</option>
              <option value="EUR">يورو (EUR)</option>
              <option value="SAR">ريال سعودي (SAR)</option>
              <option value="AED">درهم إماراتي (AED)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              المنطقة الزمنية
            </label>
            <select
              value={settings.timezone || 'Africa/Cairo'}
              onChange={(e) => handleInputChange('timezone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              value={settings.language || 'ar'}
              onChange={(e) => handleInputChange('language', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              نسبة الضريبة (%) *
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={settings.taxRate || 0}
              onChange={(e) => handleInputChange('taxRate', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                getFieldError('taxRate') ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="0"
            />
            {getFieldError('taxRate') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('taxRate')?.message}</p>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="taxInclusive"
              checked={settings.taxInclusive || false}
              onChange={(e) => handleInputChange('taxInclusive', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="taxInclusive" className="mr-2 text-sm text-gray-700">
              الضريبة شاملة في الأسعار
            </label>
          </div>
        </div>
      </div>

      {/* Social Media */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">وسائل التواصل الاجتماعي</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              فيسبوك
            </label>
            <input
              type="url"
              value={settings.socialMedia?.facebook || ''}
              onChange={(e) => handleInputChange('socialMedia', {
                ...settings.socialMedia,
                facebook: e.target.value
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://facebook.com/yourpage"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              إنستغرام
            </label>
            <input
              type="url"
              value={settings.socialMedia?.instagram || ''}
              onChange={(e) => handleInputChange('socialMedia', {
                ...settings.socialMedia,
                instagram: e.target.value
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://instagram.com/yourpage"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              تويتر
            </label>
            <input
              type="url"
              value={settings.socialMedia?.twitter || ''}
              onChange={(e) => handleInputChange('socialMedia', {
                ...settings.socialMedia,
                twitter: e.target.value
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://twitter.com/yourpage"
            />
          </div>
        </div>
      </div>

      {/* Website */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">الموقع الإلكتروني</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            رابط الموقع
          </label>
          <input
            type="url"
            value={settings.website || ''}
            onChange={(e) => handleInputChange('website', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="https://yourcafe.com"
          />
        </div>
      </div>

      {/* Loading State */}
      {tabState.loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="mr-3 text-gray-600">جاري تحميل الإعدادات...</span>
        </div>
      )}

      {/* Saving State */}
      {tabState.saving && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <span className="mr-3 text-gray-600">جاري حفظ الإعدادات...</span>
        </div>
      )}
    </div>
  );
};

export default GeneralSettingsTab;
