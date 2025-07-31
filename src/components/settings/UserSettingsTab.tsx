import React from 'react';
import { Save, CheckCircle, User, Shield, Key } from 'lucide-react';
import { TabProps } from '../../types/settings';

const UserSettingsTab: React.FC<TabProps> = ({
  settings,
  setSettings,
  tabState,
  onSave,
  onReset,
  canEdit
}) => {
  const handleChange = (field: string, value: any) => {
    if (!canEdit(`users.${field}`)) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleNestedChange = (parent: string, field: string, value: any) => {
    if (!canEdit(`users.${parent}.${field}`)) return;
    setSettings({
      ...settings,
      [parent]: { ...settings[parent], [field]: value }
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">إعدادات المستخدمين</h3>
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

          {/* إعدادات الأدوار والصلاحيات */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 ml-2" />
              إعدادات الأدوار والصلاحيات
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الدور الافتراضي للمستخدمين الجدد
                </label>
                <select
                  value={settings.defaultRole}
                  onChange={(e) => handleChange('defaultRole', e.target.value)}
                  disabled={!canEdit('users.defaultRole')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                >
                  <option value="staff">موظف</option>
                  <option value="cashier">كاشير</option>
                  <option value="kitchen">مطبخ</option>
                  <option value="manager">مدير</option>
                  <option value="admin">مدير النظام</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الحد الأقصى للمستخدمين
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.maxUsers}
                  onChange={(e) => handleChange('maxUsers', parseInt(e.target.value) || 10)}
                  disabled={!canEdit('users.maxUsers')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.allowRoleChanges}
                  onChange={(e) => handleChange('allowRoleChanges', e.target.checked)}
                  disabled={!canEdit('users.allowRoleChanges')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">السماح بتغيير الأدوار</span>
              </label>
            </div>
            <div className="mt-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.requireApproval}
                  onChange={(e) => handleChange('requireApproval', e.target.checked)}
                  disabled={!canEdit('users.requireApproval')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">تطلب موافقة لإنشاء مستخدمين جدد</span>
              </label>
            </div>
          </div>

          {/* إعدادات الملف الشخصي */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 ml-2" />
              إعدادات الملف الشخصي
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الحقول المطلوبة
                </label>
                <div className="space-y-2">
                  {['name', 'email', 'phone', 'address', 'avatar'].map((field) => (
                    <label key={field} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.requiredFields?.includes(field) || false}
                        onChange={(e) => {
                          const currentFields = settings.requiredFields || [];
                          const newFields = e.target.checked
                            ? [...currentFields, field]
                            : currentFields.filter(f => f !== field);
                          handleChange('requiredFields', newFields);
                        }}
                        disabled={!canEdit('users.requiredFields')}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                      />
                      <span className="mr-2 text-sm text-gray-700">
                        {field === 'name' ? 'الاسم' :
                         field === 'email' ? 'البريد الإلكتروني' :
                         field === 'phone' ? 'رقم الهاتف' :
                         field === 'address' ? 'العنوان' : 'الصورة الشخصية'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الحقول القابلة للتعديل
                </label>
                <div className="space-y-2">
                  {['name', 'email', 'phone', 'address', 'avatar', 'password'].map((field) => (
                    <label key={field} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.editableFields?.includes(field) || false}
                        onChange={(e) => {
                          const currentFields = settings.editableFields || [];
                          const newFields = e.target.checked
                            ? [...currentFields, field]
                            : currentFields.filter(f => f !== field);
                          handleChange('editableFields', newFields);
                        }}
                        disabled={!canEdit('users.editableFields')}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                      />
                      <span className="mr-2 text-sm text-gray-700">
                        {field === 'name' ? 'الاسم' :
                         field === 'email' ? 'البريد الإلكتروني' :
                         field === 'phone' ? 'رقم الهاتف' :
                         field === 'address' ? 'العنوان' :
                         field === 'avatar' ? 'الصورة الشخصية' : 'كلمة المرور'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* إعدادات الأمان */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Key className="h-5 w-5 ml-2" />
              إعدادات الأمان
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الحد الأقصى لمحاولات تسجيل الدخول
                </label>
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={settings.maxLoginAttempts}
                  onChange={(e) => handleChange('maxLoginAttempts', parseInt(e.target.value) || 5)}
                  disabled={!canEdit('users.maxLoginAttempts')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مدة حظر الحساب (دقيقة)
                </label>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={settings.accountLockoutDuration}
                  onChange={(e) => handleChange('accountLockoutDuration', parseInt(e.target.value) || 30)}
                  disabled={!canEdit('users.accountLockoutDuration')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.requirePasswordChange}
                  onChange={(e) => handleChange('requirePasswordChange', e.target.checked)}
                  disabled={!canEdit('users.requirePasswordChange')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">تطلب تغيير كلمة المرور عند أول تسجيل دخول</span>
              </label>
            </div>
            <div className="mt-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.enableTwoFactor}
                  onChange={(e) => handleChange('enableTwoFactor', e.target.checked)}
                  disabled={!canEdit('users.enableTwoFactor')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">تفعيل المصادقة الثنائية</span>
              </label>
            </div>
          </div>

          {/* إعدادات الجلسات */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات الجلسات</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مدة انتهاء الجلسة (دقيقة)
                </label>
                <input
                  type="number"
                  min="15"
                  max="480"
                  value={settings.sessionTimeout}
                  onChange={(e) => handleChange('sessionTimeout', parseInt(e.target.value) || 30)}
                  disabled={!canEdit('users.sessionTimeout')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الحد الأقصى للجلسات المتزامنة
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.maxConcurrentSessions}
                  onChange={(e) => handleChange('maxConcurrentSessions', parseInt(e.target.value) || 3)}
                  disabled={!canEdit('users.maxConcurrentSessions')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.autoLogout}
                  onChange={(e) => handleChange('autoLogout', e.target.checked)}
                  disabled={!canEdit('users.autoLogout')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">تسجيل الخروج التلقائي عند عدم النشاط</span>
              </label>
            </div>
          </div>

          {/* إعدادات الإشعارات */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات الإشعارات</h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.notifications?.loginAlerts || false}
                    onChange={(e) => handleNestedChange('notifications', 'loginAlerts', e.target.checked)}
                    disabled={!canEdit('users.notifications.loginAlerts')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تنبيهات تسجيل الدخول</span>
                </label>
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.notifications?.roleChanges || false}
                    onChange={(e) => handleNestedChange('notifications', 'roleChanges', e.target.checked)}
                    disabled={!canEdit('users.notifications.roleChanges')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تنبيهات تغيير الأدوار</span>
                </label>
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.notifications?.accountLockouts || false}
                    onChange={(e) => handleNestedChange('notifications', 'accountLockouts', e.target.checked)}
                    disabled={!canEdit('users.notifications.accountLockouts')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تنبيهات حظر الحسابات</span>
                </label>
              </div>
            </div>
          </div>

          {/* إعدادات متقدمة */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات متقدمة</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مدة الاحتفاظ بسجلات المستخدمين (أيام)
                </label>
                <input
                  type="number"
                  min="30"
                  max="365"
                  value={settings.userLogRetention}
                  onChange={(e) => handleChange('userLogRetention', parseInt(e.target.value) || 90)}
                  disabled={!canEdit('users.userLogRetention')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مستوى تسجيل الأحداث
                </label>
                <select
                  value={settings.logLevel}
                  onChange={(e) => handleChange('logLevel', e.target.value)}
                  disabled={!canEdit('users.logLevel')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                >
                  <option value="error">الأخطاء فقط</option>
                  <option value="warn">التحذيرات والأخطاء</option>
                  <option value="info">معلومات عامة</option>
                  <option value="debug">تفاصيل كاملة</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.enableAuditLog}
                  onChange={(e) => handleChange('enableAuditLog', e.target.checked)}
                  disabled={!canEdit('users.enableAuditLog')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">تفعيل سجل التدقيق</span>
              </label>
            </div>
            <div className="mt-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.allowGuestAccess}
                  onChange={(e) => handleChange('allowGuestAccess', e.target.checked)}
                  disabled={!canEdit('users.allowGuestAccess')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">السماح بالوصول كزائر</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSettingsTab;
