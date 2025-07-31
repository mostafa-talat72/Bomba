import React from 'react';
import { Save, CheckCircle, AlertTriangle, Lock, Shield, Key, Eye, EyeOff } from 'lucide-react';
import { TabProps } from '../../types/settings';

const SecuritySettingsTab: React.FC<TabProps> = ({
  settings,
  setSettings,
  tabState,
  onSave,
  onReset,
  canEdit
}) => {
  const handleChange = (field: string, value: any) => {
    if (!canEdit(`security.${field}`)) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleNestedChange = (parent: string, field: string, value: any) => {
    if (!canEdit(`security.${parent}.${field}`)) return;
    setSettings({
      ...settings,
      [parent]: { ...settings[parent], [field]: value }
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">إعدادات الأمان</h3>
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

          {/* سياسة كلمة المرور */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Lock className="h-5 w-5 ml-2" />
              سياسة كلمة المرور
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الحد الأدنى لطول كلمة المرور
                </label>
                <input
                  type="number"
                  min="6"
                  max="50"
                  value={settings.passwordPolicy?.minLength || 8}
                  onChange={(e) => handleNestedChange('passwordPolicy', 'minLength', parseInt(e.target.value) || 8)}
                  disabled={!canEdit('security.passwordPolicy.minLength')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.passwordPolicy?.requireUppercase || false}
                    onChange={(e) => handleNestedChange('passwordPolicy', 'requireUppercase', e.target.checked)}
                    disabled={!canEdit('security.passwordPolicy.requireUppercase')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تطلب حروف كبيرة</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.passwordPolicy?.requireNumbers || false}
                    onChange={(e) => handleNestedChange('passwordPolicy', 'requireNumbers', e.target.checked)}
                    disabled={!canEdit('security.passwordPolicy.requireNumbers')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تطلب أرقام</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.passwordPolicy?.requireSpecialChars || false}
                    onChange={(e) => handleNestedChange('passwordPolicy', 'requireSpecialChars', e.target.checked)}
                    disabled={!canEdit('security.passwordPolicy.requireSpecialChars')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تطلب رموز خاصة</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    مدة صلاحية كلمة المرور (بالأيام)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={settings.passwordPolicy?.expiryDays || 90}
                    onChange={(e) => handleNestedChange('passwordPolicy', 'expiryDays', parseInt(e.target.value) || 90)}
                    disabled={!canEdit('security.passwordPolicy.expiryDays')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    منع إعادة استخدام كلمات المرور (آخر N كلمة)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={settings.passwordPolicy?.preventReuse || 3}
                    onChange={(e) => handleNestedChange('passwordPolicy', 'preventReuse', parseInt(e.target.value) || 3)}
                    disabled={!canEdit('security.passwordPolicy.preventReuse')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* إعدادات الجلسة */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 ml-2" />
              إعدادات الجلسة
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مهلة انتهاء الجلسة (بالدقائق)
                </label>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={settings.session?.timeout || 30}
                  onChange={(e) => handleNestedChange('session', 'timeout', parseInt(e.target.value) || 30)}
                  disabled={!canEdit('security.session.timeout')}
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
                  value={settings.session?.maxConcurrent || 3}
                  onChange={(e) => handleNestedChange('session', 'maxConcurrent', parseInt(e.target.value) || 3)}
                  disabled={!canEdit('security.session.maxConcurrent')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.session?.forceLogout || false}
                    onChange={(e) => handleNestedChange('session', 'forceLogout', e.target.checked)}
                    disabled={!canEdit('security.session.forceLogout')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">إجبار تسجيل الخروج عند انتهاء المهلة</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.session?.rememberMe || false}
                    onChange={(e) => handleNestedChange('session', 'rememberMe', e.target.checked)}
                    disabled={!canEdit('security.session.rememberMe')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">السماح بخيار "تذكرني"</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.session?.ipRestriction || false}
                    onChange={(e) => handleNestedChange('session', 'ipRestriction', e.target.checked)}
                    disabled={!canEdit('security.session.ipRestriction')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تقييد الجلسات بعنوان IP</span>
                </label>
              </div>

              {settings.session?.ipRestriction && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    عناوين IP المسموحة (واحد في كل سطر)
                  </label>
                  <textarea
                    rows={4}
                    value={settings.session?.allowedIPs?.join('\n') || ''}
                    onChange={(e) => handleNestedChange('session', 'allowedIPs', e.target.value.split('\n').filter(ip => ip.trim()))}
                    disabled={!canEdit('security.session.allowedIPs')}
                    placeholder="192.168.1.1&#10;10.0.0.1&#10;172.16.0.1"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                  />
                </div>
              )}
            </div>
          </div>

          {/* إعدادات التدقيق */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Eye className="h-5 w-5 ml-2" />
              إعدادات التدقيق
            </h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.audit?.enabled || false}
                    onChange={(e) => handleNestedChange('audit', 'enabled', e.target.checked)}
                    disabled={!canEdit('security.audit.enabled')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تفعيل سجل التدقيق</span>
                </label>
              </div>

              {settings.audit?.enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      مستوى السجل
                    </label>
                    <select
                      value={settings.audit?.logLevel || 'info'}
                      onChange={(e) => handleNestedChange('audit', 'logLevel', e.target.value)}
                      disabled={!canEdit('security.audit.logLevel')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    >
                      <option value="error">أخطاء فقط</option>
                      <option value="warn">تحذيرات وأخطاء</option>
                      <option value="info">معلومات وتحذيرات وأخطاء</option>
                      <option value="debug">كل شيء</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      مدة الاحتفاظ بالسجلات (بالأيام)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={settings.audit?.retentionDays || 30}
                      onChange={(e) => handleNestedChange('audit', 'retentionDays', parseInt(e.target.value) || 30)}
                      disabled={!canEdit('security.audit.retentionDays')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الإجراءات المسجلة
                    </label>
                    <div className="space-y-2">
                      {['login', 'logout', 'password_change', 'settings_change', 'data_access', 'data_modification'].map(action => (
                        <label key={action} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings.audit?.logActions?.includes(action) || false}
                            onChange={(e) => {
                              const currentActions = settings.audit?.logActions || [];
                              const newActions = e.target.checked
                                ? [...currentActions, action]
                                : currentActions.filter(a => a !== action);
                              handleNestedChange('audit', 'logActions', newActions);
                            }}
                            disabled={!canEdit('security.audit.logActions')}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                          />
                          <span className="mr-3 text-sm text-gray-700">
                            {action === 'login' && 'تسجيل الدخول'}
                            {action === 'logout' && 'تسجيل الخروج'}
                            {action === 'password_change' && 'تغيير كلمة المرور'}
                            {action === 'settings_change' && 'تغيير الإعدادات'}
                            {action === 'data_access' && 'الوصول للبيانات'}
                            {action === 'data_modification' && 'تعديل البيانات'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* إعدادات الصلاحيات */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Key className="h-5 w-5 ml-2" />
              إعدادات الصلاحيات
            </h4>
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.permissions?.allowMultiLogin || false}
                    onChange={(e) => handleNestedChange('permissions', 'allowMultiLogin', e.target.checked)}
                    disabled={!canEdit('security.permissions.allowMultiLogin')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">السماح بتسجيل الدخول المتعدد</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.permissions?.requireApproval || false}
                    onChange={(e) => handleNestedChange('permissions', 'requireApproval', e.target.checked)}
                    disabled={!canEdit('security.permissions.requireApproval')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تطلب موافقة على الإجراءات الحساسة</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.permissions?.dataEncryption || false}
                    onChange={(e) => handleNestedChange('permissions', 'dataEncryption', e.target.checked)}
                    disabled={!canEdit('security.permissions.dataEncryption')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تشفير البيانات الحساسة</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.permissions?.twoFactorAuth || false}
                    onChange={(e) => handleNestedChange('permissions', 'twoFactorAuth', e.target.checked)}
                    disabled={!canEdit('security.permissions.twoFactorAuth')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تفعيل المصادقة الثنائية</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    عدد محاولات تسجيل الدخول
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.permissions?.loginAttempts || 5}
                    onChange={(e) => handleNestedChange('permissions', 'loginAttempts', parseInt(e.target.value) || 5)}
                    disabled={!canEdit('security.permissions.loginAttempts')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    مدة الحظر (بالدقائق)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    value={settings.permissions?.lockoutDuration || 30}
                    onChange={(e) => handleNestedChange('permissions', 'lockoutDuration', parseInt(e.target.value) || 30)}
                    disabled={!canEdit('security.permissions.lockoutDuration')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* إعدادات API */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات API</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  حد معدل الطلبات (طلبات/دقيقة)
                </label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={settings.api?.rateLimit || 100}
                  onChange={(e) => handleNestedChange('api', 'rateLimit', parseInt(e.target.value) || 100)}
                  disabled={!canEdit('security.api.rateLimit')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مدة صلاحية مفتاح API (بالأيام)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.api?.apiKeyExpiry || 30}
                  onChange={(e) => handleNestedChange('api', 'apiKeyExpiry', parseInt(e.target.value) || 30)}
                  disabled={!canEdit('security.api.apiKeyExpiry')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.api?.corsEnabled || false}
                    onChange={(e) => handleNestedChange('api', 'corsEnabled', e.target.checked)}
                    disabled={!canEdit('security.api.corsEnabled')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تفعيل CORS</span>
                </label>
              </div>

              {settings.api?.corsEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    المصادر المسموحة (واحد في كل سطر)
                  </label>
                  <textarea
                    rows={4}
                    value={settings.api?.allowedOrigins?.join('\n') || ''}
                    onChange={(e) => handleNestedChange('api', 'allowedOrigins', e.target.value.split('\n').filter(origin => origin.trim()))}
                    disabled={!canEdit('security.api.allowedOrigins')}
                    placeholder="https://example.com&#10;https://app.example.com&#10;http://localhost:3000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecuritySettingsTab;
