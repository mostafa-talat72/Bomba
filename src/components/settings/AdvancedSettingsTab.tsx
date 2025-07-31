import React from 'react';
import { Save, CheckCircle, AlertTriangle, Settings, Database, Zap, Shield } from 'lucide-react';
import { TabProps } from '../../types/settings';

const AdvancedSettingsTab: React.FC<TabProps> = ({
  settings,
  setSettings,
  tabState,
  onSave,
  onReset,
  canEdit
}) => {
  const handleChange = (field: string, value: any) => {
    if (!canEdit(`advanced.${field}`)) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleNestedChange = (parent: string, field: string, value: any) => {
    if (!canEdit(`advanced.${parent}.${field}`)) return;
    setSettings({
      ...settings,
      [parent]: { ...settings[parent], [field]: value }
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">الإعدادات المتقدمة</h3>
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

          {/* إعدادات الأداء */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Zap className="h-5 w-5 ml-2" />
              إعدادات الأداء
            </h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.performance?.cacheEnabled || false}
                    onChange={(e) => handleNestedChange('performance', 'cacheEnabled', e.target.checked)}
                    disabled={!canEdit('advanced.performance.cacheEnabled')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تفعيل التخزين المؤقت</span>
                </label>
              </div>

              {settings.performance?.cacheEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      مدة التخزين المؤقت (بالثواني)
                    </label>
                    <input
                      type="number"
                      min="30"
                      max="3600"
                      value={settings.performance?.cacheDuration || 300}
                      onChange={(e) => handleNestedChange('performance', 'cacheDuration', parseInt(e.target.value) || 300)}
                      disabled={!canEdit('advanced.performance.cacheDuration')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الحد الأقصى لحجم التخزين المؤقت (MB)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="1000"
                      value={settings.performance?.maxCacheSize || 100}
                      onChange={(e) => handleNestedChange('performance', 'maxCacheSize', parseInt(e.target.value) || 100)}
                      disabled={!canEdit('advanced.performance.maxCacheSize')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.performance?.autoRefresh || false}
                    onChange={(e) => handleNestedChange('performance', 'autoRefresh', e.target.checked)}
                    disabled={!canEdit('advanced.performance.autoRefresh')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">التحديث التلقائي للبيانات</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.performance?.compression || false}
                    onChange={(e) => handleNestedChange('performance', 'compression', e.target.checked)}
                    disabled={!canEdit('advanced.performance.compression')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">ضغط البيانات</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.performance?.minification || false}
                    onChange={(e) => handleNestedChange('performance', 'minification', e.target.checked)}
                    disabled={!canEdit('advanced.performance.minification')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تصغير ملفات CSS و JavaScript</span>
                </label>
              </div>

              {settings.performance?.autoRefresh && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    فاصل التحديث التلقائي (بالثواني)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={settings.performance?.refreshInterval || 30}
                    onChange={(e) => handleNestedChange('performance', 'refreshInterval', parseInt(e.target.value) || 30)}
                    disabled={!canEdit('advanced.performance.refreshInterval')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                  />
                </div>
              )}
            </div>
          </div>

          {/* إعدادات الاحتفاظ بالبيانات */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Database className="h-5 w-5 ml-2" />
              إعدادات الاحتفاظ بالبيانات
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مدة الاحتفاظ بالسجلات (بالأيام)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.dataRetention?.logs || 30}
                  onChange={(e) => handleNestedChange('dataRetention', 'logs', parseInt(e.target.value) || 30)}
                  disabled={!canEdit('advanced.dataRetention.logs')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مدة الاحتفاظ بالنسخ الاحتياطية (بالأيام)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.dataRetention?.backups || 90}
                  onChange={(e) => handleNestedChange('dataRetention', 'backups', parseInt(e.target.value) || 90)}
                  disabled={!canEdit('advanced.dataRetention.backups')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مدة الاحتفاظ بالملفات المؤقتة (بالأيام)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.dataRetention?.tempFiles || 7}
                  onChange={(e) => handleNestedChange('dataRetention', 'tempFiles', parseInt(e.target.value) || 7)}
                  disabled={!canEdit('advanced.dataRetention.tempFiles')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مدة الاحتفاظ بجلسات المستخدمين (بالأيام)
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={settings.dataRetention?.userSessions || 30}
                  onChange={(e) => handleNestedChange('dataRetention', 'userSessions', parseInt(e.target.value) || 30)}
                  disabled={!canEdit('advanced.dataRetention.userSessions')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مدة الاحتفاظ بسجلات التدقيق (بالأيام)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.dataRetention?.auditLogs || 90}
                  onChange={(e) => handleNestedChange('dataRetention', 'auditLogs', parseInt(e.target.value) || 90)}
                  disabled={!canEdit('advanced.dataRetention.auditLogs')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
            </div>
          </div>

          {/* إعدادات النظام */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Settings className="h-5 w-5 ml-2" />
              إعدادات النظام
            </h4>
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.system?.debugMode || false}
                    onChange={(e) => handleNestedChange('system', 'debugMode', e.target.checked)}
                    disabled={!canEdit('advanced.system.debugMode')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">وضع التصحيح</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.system?.maintenanceMode || false}
                    onChange={(e) => handleNestedChange('system', 'maintenanceMode', e.target.checked)}
                    disabled={!canEdit('advanced.system.maintenanceMode')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">وضع الصيانة</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.system?.autoUpdate || false}
                    onChange={(e) => handleNestedChange('system', 'autoUpdate', e.target.checked)}
                    disabled={!canEdit('advanced.system.autoUpdate')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">التحديث التلقائي</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.system?.errorReporting || false}
                    onChange={(e) => handleNestedChange('system', 'errorReporting', e.target.checked)}
                    disabled={!canEdit('advanced.system.errorReporting')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">إرسال تقارير الأخطاء</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.system?.analytics || false}
                    onChange={(e) => handleNestedChange('system', 'analytics', e.target.checked)}
                    disabled={!canEdit('advanced.system.analytics')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تحليلات الاستخدام</span>
                </label>
              </div>
            </div>
          </div>

          {/* التكاملات */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 ml-2" />
              التكاملات
            </h4>
            <div className="space-y-6">
              {/* بوابات الدفع */}
              <div>
                <h5 className="text-md font-medium text-gray-900 mb-3">بوابات الدفع</h5>
                <div className="space-y-3">
                  {['fawry', 'paypal', 'stripe', 'moyasar'].map(gateway => (
                    <div key={gateway} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h6 className="font-medium text-gray-900 capitalize">{gateway}</h6>
                          <p className="text-sm text-gray-600">
                            {gateway === 'fawry' && 'بوابة فوري للدفع'}
                            {gateway === 'paypal' && 'بوابة PayPal للدفع'}
                            {gateway === 'stripe' && 'بوابة Stripe للدفع'}
                            {gateway === 'moyasar' && 'بوابة Moyasar للدفع'}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3 space-x-reverse">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={settings.integrations?.paymentGateways?.[gateway]?.enabled || false}
                              onChange={(e) => {
                                const gateways = settings.integrations?.paymentGateways || {};
                                gateways[gateway] = {
                                  ...gateways[gateway],
                                  enabled: e.target.checked
                                };
                                handleNestedChange('integrations', 'paymentGateways', gateways);
                              }}
                              disabled={!canEdit(`advanced.integrations.paymentGateways.${gateway}.enabled`)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                            />
                            <span className="mr-2 text-sm text-gray-700">مفعل</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={settings.integrations?.paymentGateways?.[gateway]?.testMode || false}
                              onChange={(e) => {
                                const gateways = settings.integrations?.paymentGateways || {};
                                gateways[gateway] = {
                                  ...gateways[gateway],
                                  testMode: e.target.checked
                                };
                                handleNestedChange('integrations', 'paymentGateways', gateways);
                              }}
                              disabled={!canEdit(`advanced.integrations.paymentGateways.${gateway}.testMode`)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                            />
                            <span className="mr-2 text-sm text-gray-700">وضع الاختبار</span>
                          </label>
                        </div>
                      </div>
                      {settings.integrations?.paymentGateways?.[gateway]?.enabled && (
                        <div className="mt-3 space-y-2">
                          <input
                            type="text"
                            placeholder="API Key"
                            value={settings.integrations?.paymentGateways?.[gateway]?.credentials?.apiKey || ''}
                            onChange={(e) => {
                              const gateways = settings.integrations?.paymentGateways || {};
                              gateways[gateway] = {
                                ...gateways[gateway],
                                credentials: {
                                  ...gateways[gateway]?.credentials,
                                  apiKey: e.target.value
                                }
                              };
                              handleNestedChange('integrations', 'paymentGateways', gateways);
                            }}
                            disabled={!canEdit(`advanced.integrations.paymentGateways.${gateway}.credentials`)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                          />
                          <input
                            type="text"
                            placeholder="Secret Key"
                            value={settings.integrations?.paymentGateways?.[gateway]?.credentials?.secretKey || ''}
                            onChange={(e) => {
                              const gateways = settings.integrations?.paymentGateways || {};
                              gateways[gateway] = {
                                ...gateways[gateway],
                                credentials: {
                                  ...gateways[gateway]?.credentials,
                                  secretKey: e.target.value
                                }
                              };
                              handleNestedChange('integrations', 'paymentGateways', gateways);
                            }}
                            disabled={!canEdit(`advanced.integrations.paymentGateways.${gateway}.credentials`)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* خدمة الرسائل النصية */}
              <div>
                <h5 className="text-md font-medium text-gray-900 mb-3">خدمة الرسائل النصية</h5>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.integrations?.sms?.enabled || false}
                        onChange={(e) => handleNestedChange('integrations.sms', 'enabled', e.target.checked)}
                        disabled={!canEdit('advanced.integrations.sms.enabled')}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                      />
                      <span className="mr-3 text-sm text-gray-700">تفعيل خدمة الرسائل النصية</span>
                    </label>
                  </div>

                  {settings.integrations?.sms?.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          مزود الخدمة
                        </label>
                        <select
                          value={settings.integrations?.sms?.provider || 'twilio'}
                          onChange={(e) => handleNestedChange('integrations.sms', 'provider', e.target.value)}
                          disabled={!canEdit('advanced.integrations.sms.provider')}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                        >
                          <option value="twilio">Twilio</option>
                          <option value="nexmo">Nexmo</option>
                          <option value="aws-sns">AWS SNS</option>
                          <option value="custom">مخصص</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          API Key
                        </label>
                        <input
                          type="text"
                          value={settings.integrations?.sms?.apiKey || ''}
                          onChange={(e) => handleNestedChange('integrations.sms', 'apiKey', e.target.value)}
                          disabled={!canEdit('advanced.integrations.sms.apiKey')}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          معرف المرسل
                        </label>
                        <input
                          type="text"
                          value={settings.integrations?.sms?.senderId || ''}
                          onChange={(e) => handleNestedChange('integrations.sms', 'senderId', e.target.value)}
                          disabled={!canEdit('advanced.integrations.sms.senderId')}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* إعدادات الطابعة */}
              <div>
                <h5 className="text-md font-medium text-gray-900 mb-3">إعدادات الطابعة</h5>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.integrations?.printer?.enabled || false}
                        onChange={(e) => handleNestedChange('integrations.printer', 'enabled', e.target.checked)}
                        disabled={!canEdit('advanced.integrations.printer.enabled')}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                      />
                      <span className="mr-3 text-sm text-gray-700">تفعيل الطباعة</span>
                    </label>
                  </div>

                  {settings.integrations?.printer?.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          نوع الطابعة
                        </label>
                        <select
                          value={settings.integrations?.printer?.type || 'thermal'}
                          onChange={(e) => handleNestedChange('integrations.printer', 'type', e.target.value)}
                          disabled={!canEdit('advanced.integrations.printer.type')}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                        >
                          <option value="thermal">طابعة حرارية</option>
                          <option value="laser">طابعة ليزر</option>
                          <option value="inkjet">طابعة نافثة للحبر</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          نوع الاتصال
                        </label>
                        <select
                          value={settings.integrations?.printer?.connection || 'usb'}
                          onChange={(e) => handleNestedChange('integrations.printer', 'connection', e.target.value)}
                          disabled={!canEdit('advanced.integrations.printer.connection')}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                        >
                          <option value="usb">USB</option>
                          <option value="network">شبكة</option>
                          <option value="bluetooth">بلوتوث</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSettingsTab;
