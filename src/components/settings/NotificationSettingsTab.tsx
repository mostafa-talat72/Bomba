import React from 'react';
import { Save, CheckCircle, AlertTriangle, Volume2, VolumeX, Bell } from 'lucide-react';
import { TabProps } from '../../types/settings';

const NotificationSettingsTab: React.FC<TabProps> = ({
  settings,
  setSettings,
  tabState,
  onSave,
  onReset,
  canEdit
}) => {
  const handleChange = (field: string, value: any) => {
    if (!canEdit(`notifications.${field}`)) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleNestedChange = (parent: string, field: string, value: any) => {
    if (!canEdit(`notifications.${parent}.${field}`)) return;
    setSettings({
      ...settings,
      [parent]: { ...settings[parent], [field]: value }
    });
  };

  const handleToggleNotification = (category: string, type: string, value: boolean) => {
    if (!canEdit(`notifications.${category}.${type}`)) return;
    setSettings({
      ...settings,
      [category]: { ...settings[category], [type]: value }
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">إعدادات الإشعارات</h3>
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

          {/* إشعارات الجلسات */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Bell className="h-5 w-5 ml-2" />
              إشعارات الجلسات
            </h4>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.sessions?.sessionEnd || false}
                  onChange={(e) => handleToggleNotification('sessions', 'sessionEnd', e.target.checked)}
                  disabled={!canEdit('notifications.sessions.sessionEnd')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إشعار عند انتهاء الجلسة</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.sessions?.sessionStart || false}
                  onChange={(e) => handleToggleNotification('sessions', 'sessionStart', e.target.checked)}
                  disabled={!canEdit('notifications.sessions.sessionStart')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إشعار عند بدء جلسة جديدة</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.sessions?.sessionPause || false}
                  onChange={(e) => handleToggleNotification('sessions', 'sessionPause', e.target.checked)}
                  disabled={!canEdit('notifications.sessions.sessionPause')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إشعار عند إيقاف الجلسة مؤقتاً</span>
              </label>
            </div>
          </div>

          {/* إشعارات الطلبات */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إشعارات الطلبات</h4>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.orders?.newOrder || false}
                  onChange={(e) => handleToggleNotification('orders', 'newOrder', e.target.checked)}
                  disabled={!canEdit('notifications.orders.newOrder')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إشعار عند طلب جديد</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.orders?.orderReady || false}
                  onChange={(e) => handleToggleNotification('orders', 'orderReady', e.target.checked)}
                  disabled={!canEdit('notifications.orders.orderReady')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إشعار عند اكتمال تحضير الطلب</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.orders?.orderCancelled || false}
                  onChange={(e) => handleToggleNotification('orders', 'orderCancelled', e.target.checked)}
                  disabled={!canEdit('notifications.orders.orderCancelled')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إشعار عند إلغاء الطلب</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.orders?.orderDelivered || false}
                  onChange={(e) => handleToggleNotification('orders', 'orderDelivered', e.target.checked)}
                  disabled={!canEdit('notifications.orders.orderDelivered')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إشعار عند توصيل الطلب</span>
              </label>
            </div>
          </div>

          {/* إشعارات المخزون */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إشعارات المخزون</h4>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.inventory?.lowStock || false}
                  onChange={(e) => handleToggleNotification('inventory', 'lowStock', e.target.checked)}
                  disabled={!canEdit('notifications.inventory.lowStock')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إشعار عند انخفاض المخزون</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.inventory?.outOfStock || false}
                  onChange={(e) => handleToggleNotification('inventory', 'outOfStock', e.target.checked)}
                  disabled={!canEdit('notifications.inventory.outOfStock')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إشعار عند نفاد المخزون</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.inventory?.expiryWarning || false}
                  onChange={(e) => handleToggleNotification('inventory', 'expiryWarning', e.target.checked)}
                  disabled={!canEdit('notifications.inventory.expiryWarning')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إشعار عند اقتراب انتهاء الصلاحية</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.inventory?.reorderReminder || false}
                  onChange={(e) => handleToggleNotification('inventory', 'reorderReminder', e.target.checked)}
                  disabled={!canEdit('notifications.inventory.reorderReminder')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">تذكير بإعادة الطلب</span>
              </label>
            </div>
          </div>

          {/* إشعارات الفواتير */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إشعارات الفواتير</h4>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.billing?.newBill || false}
                  onChange={(e) => handleToggleNotification('billing', 'newBill', e.target.checked)}
                  disabled={!canEdit('notifications.billing.newBill')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إشعار عند إنشاء فاتورة جديدة</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.billing?.paymentReceived || false}
                  onChange={(e) => handleToggleNotification('billing', 'paymentReceived', e.target.checked)}
                  disabled={!canEdit('notifications.billing.paymentReceived')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إشعار عند دفع الفاتورة</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.billing?.partialPayment || false}
                  onChange={(e) => handleToggleNotification('billing', 'partialPayment', e.target.checked)}
                  disabled={!canEdit('notifications.billing.partialPayment')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إشعار عند الدفع الجزئي</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.billing?.overduePayment || false}
                  onChange={(e) => handleToggleNotification('billing', 'overduePayment', e.target.checked)}
                  disabled={!canEdit('notifications.billing.overduePayment')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إشعار عند تأخر الدفع</span>
              </label>
            </div>
          </div>

          {/* إعدادات الصوت */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              {settings.sound?.enabled ? <Volume2 className="h-5 w-5 ml-2" /> : <VolumeX className="h-5 w-5 ml-2" />}
              إعدادات الصوت
            </h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.sound?.enabled || false}
                    onChange={(e) => handleNestedChange('sound', 'enabled', e.target.checked)}
                    disabled={!canEdit('notifications.sound.enabled')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تفعيل صوت الإشعارات</span>
                </label>
              </div>

              {settings.sound?.enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      مستوى الصوت
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.sound?.volume || 60}
                      onChange={(e) => handleNestedChange('sound', 'volume', parseInt(e.target.value))}
                      disabled={!canEdit('notifications.sound.volume')}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider disabled:opacity-50"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>صامت</span>
                      <span>{settings.sound?.volume || 60}%</span>
                      <span>عالي</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      النغمة الافتراضية
                    </label>
                    <select
                      value={settings.sound?.defaultTone || 'default'}
                      onChange={(e) => handleNestedChange('sound', 'defaultTone', e.target.value)}
                      disabled={!canEdit('notifications.sound.defaultTone')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    >
                      <option value="default">النغمة الافتراضية</option>
                      <option value="success">نغمة النجاح</option>
                      <option value="warning">نغمة التحذير</option>
                      <option value="error">نغمة الخطأ</option>
                      <option value="urgent">نغمة عاجلة</option>
                      <option value="bell">جرس</option>
                      <option value="chime">رنين</option>
                      <option value="beep">صوت تنبيه</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.sound?.priorityTones || false}
                        onChange={(e) => handleNestedChange('sound', 'priorityTones', e.target.checked)}
                        disabled={!canEdit('notifications.sound.priorityTones')}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                      />
                      <span className="mr-3 text-sm text-gray-700">أصوات مختلفة حسب الأولوية</span>
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* إعدادات العرض */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات العرض</h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.display?.showCount || false}
                    onChange={(e) => handleNestedChange('display', 'showCount', e.target.checked)}
                    disabled={!canEdit('notifications.display.showCount')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">إظهار عدد الإشعارات</span>
                </label>
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.display?.autoMarkRead || false}
                    onChange={(e) => handleNestedChange('display', 'autoMarkRead', e.target.checked)}
                    disabled={!canEdit('notifications.display.autoMarkRead')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تحديد كمقروء تلقائياً</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مدة ظهور الإشعار (بالثواني)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.display?.displayDuration || 5}
                  onChange={(e) => handleNestedChange('display', 'displayDuration', parseInt(e.target.value) || 5)}
                  disabled={!canEdit('notifications.display.displayDuration')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  موقع الإشعارات
                </label>
                <select
                  value={settings.display?.position || 'top-right'}
                  onChange={(e) => handleNestedChange('display', 'position', e.target.value)}
                  disabled={!canEdit('notifications.display.position')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                >
                  <option value="top-right">أعلى اليمين</option>
                  <option value="top-left">أعلى اليسار</option>
                  <option value="bottom-right">أسفل اليمين</option>
                  <option value="bottom-left">أسفل اليسار</option>
                </select>
              </div>
            </div>
          </div>

          {/* إعدادات البريد الإلكتروني */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات البريد الإلكتروني</h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.email?.enabled || false}
                    onChange={(e) => handleNestedChange('email', 'enabled', e.target.checked)}
                    disabled={!canEdit('notifications.email.enabled')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تفعيل إشعارات البريد الإلكتروني</span>
                </label>
              </div>

              {settings.email?.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      خادم SMTP
                    </label>
                    <input
                      type="text"
                      value={settings.email?.smtpSettings?.host || ''}
                      onChange={(e) => handleNestedChange('email.smtpSettings', 'host', e.target.value)}
                      disabled={!canEdit('notifications.email.smtpSettings.host')}
                      placeholder="smtp.gmail.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      المنفذ
                    </label>
                    <input
                      type="number"
                      value={settings.email?.smtpSettings?.port || 587}
                      onChange={(e) => handleNestedChange('email.smtpSettings', 'port', parseInt(e.target.value) || 587)}
                      disabled={!canEdit('notifications.email.smtpSettings.port')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      اسم المستخدم
                    </label>
                    <input
                      type="text"
                      value={settings.email?.smtpSettings?.username || ''}
                      onChange={(e) => handleNestedChange('email.smtpSettings', 'username', e.target.value)}
                      disabled={!canEdit('notifications.email.smtpSettings.username')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      كلمة المرور
                    </label>
                    <input
                      type="password"
                      value={settings.email?.smtpSettings?.password || ''}
                      onChange={(e) => handleNestedChange('email.smtpSettings', 'password', e.target.value)}
                      disabled={!canEdit('notifications.email.smtpSettings.password')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationSettingsTab;
