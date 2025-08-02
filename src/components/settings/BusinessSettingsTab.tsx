import React from 'react';
import { Save, CheckCircle, AlertTriangle } from 'lucide-react';
import { TabProps } from '../../types/settings';

const BusinessSettingsTab: React.FC<TabProps> = ({
  settings,
  setSettings,
  tabState,
  onSave,
  onReset,
  canEdit
}) => {
  const handleChange = (field: string, value: any) => {
    if (!canEdit(`business.${field}`)) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleNestedChange = (parent: string, field: string, value: any) => {
    if (!canEdit(`business.${parent}.${field}`)) return;
    setSettings({
      ...settings,
      [parent]: { ...settings[parent], [field]: value }
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">إعدادات الأعمال</h3>
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

          {/* إعدادات الفواتير */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات الفواتير</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تنسيق رقم الفاتورة
                </label>
                <input
                  type="text"
                  value={settings.billNumberFormat}
                  onChange={(e) => handleChange('billNumberFormat', e.target.value)}
                  disabled={!canEdit('business.billNumberFormat')}
                  placeholder="INV-{YYYY}{MM}{DD}-{XXX}"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {/* Format placeholders */}{'{YYYY}'} = السنة، {'{MM}'} = الشهر، {'{DD}'} = اليوم، {'{XXX}'} = الرقم التسلسلي
                </p>
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.autoGenerateBillNumber}
                    onChange={(e) => handleChange('autoGenerateBillNumber', e.target.checked)}
                    disabled={!canEdit('business.autoGenerateBillNumber')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">توليد رقم الفاتورة تلقائياً</span>
                </label>
              </div>
            </div>
          </div>

          {/* إعدادات الدفع */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات الدفع</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  طريقة الدفع الافتراضية
                </label>
                <select
                  value={settings.defaultPaymentMethod}
                  onChange={(e) => handleChange('defaultPaymentMethod', e.target.value)}
                  disabled={!canEdit('business.defaultPaymentMethod')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                >
                  <option value="cash">نقداً</option>
                  <option value="card">بطاقة ائتمان</option>
                  <option value="bank">تحويل بنكي</option>
                  <option value="mobile">محفظة إلكترونية</option>
                </select>
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.allowPartialPayments}
                    onChange={(e) => handleChange('allowPartialPayments', e.target.checked)}
                    disabled={!canEdit('business.allowPartialPayments')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">السماح بالدفع الجزئي</span>
                </label>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الحد الأقصى للخصم (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={settings.maxDiscountPercentage}
                onChange={(e) => handleChange('maxDiscountPercentage', parseFloat(e.target.value) || 0)}
                disabled={!canEdit('business.maxDiscountPercentage')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* إعدادات الجلسات */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات الجلسات</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مهلة انتهاء الجلسة (دقيقة)
                </label>
                <input
                  type="number"
                  min="1"
                  max="480"
                  value={settings.sessionTimeout}
                  onChange={(e) => handleChange('sessionTimeout', parseInt(e.target.value) || 30)}
                  disabled={!canEdit('business.sessionTimeout')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ترقيم الطاولات
                </label>
                <select
                  value={settings.tableNumbering}
                  onChange={(e) => handleChange('tableNumbering', e.target.value)}
                  disabled={!canEdit('business.tableNumbering')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                >
                  <option value="sequential">تسلسلي (1, 2, 3...)</option>
                  <option value="custom">مخصص</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الحد الأقصى للطاولات
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.maxTables}
                onChange={(e) => handleChange('maxTables', parseInt(e.target.value) || 20)}
                disabled={!canEdit('business.maxTables')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* ساعات العمل */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">ساعات العمل</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  وقت البداية
                </label>
                <input
                  type="time"
                  value={settings.workingHours?.start || '08:00'}
                  onChange={(e) => handleNestedChange('workingHours', 'start', e.target.value)}
                  disabled={!canEdit('business.workingHours.start')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  وقت الانتهاء
                </label>
                <input
                  type="time"
                  value={settings.workingHours?.end || '22:00'}
                  onChange={(e) => handleNestedChange('workingHours', 'end', e.target.value)}
                  disabled={!canEdit('business.workingHours.end')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                أيام الإجازة
              </label>
              <div className="grid grid-cols-7 gap-2">
                {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((day, index) => (
                  <label key={day} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.workingHours?.daysOff?.includes(day) || false}
                      onChange={(e) => {
                        const currentDaysOff = settings.workingHours?.daysOff || [];
                        const newDaysOff = e.target.checked
                          ? [...currentDaysOff, day]
                          : currentDaysOff.filter(d => d !== day);
                        handleNestedChange('workingHours', 'daysOff', newDaysOff);
                      }}
                      disabled={!canEdit('business.workingHours.daysOff')}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                    />
                    <span className="mr-2 text-sm text-gray-700">{day}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* إعدادات التوصيل */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات التوصيل</h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.deliverySettings?.enabled || false}
                    onChange={(e) => handleNestedChange('deliverySettings', 'enabled', e.target.checked)}
                    disabled={!canEdit('business.deliverySettings.enabled')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تفعيل خدمة التوصيل</span>
                </label>
              </div>
              {settings.deliverySettings?.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      نطاق التوصيل (كم)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={settings.deliverySettings?.radius || 10}
                      onChange={(e) => handleNestedChange('deliverySettings', 'radius', parseFloat(e.target.value) || 10)}
                      disabled={!canEdit('business.deliverySettings.radius')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      رسوم التوصيل
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={settings.deliverySettings?.fee || 0}
                      onChange={(e) => handleNestedChange('deliverySettings', 'fee', parseFloat(e.target.value) || 0)}
                      disabled={!canEdit('business.deliverySettings.fee')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* برنامج الولاء */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">برنامج الولاء</h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.loyaltyProgram?.enabled || false}
                    onChange={(e) => handleNestedChange('loyaltyProgram', 'enabled', e.target.checked)}
                    disabled={!canEdit('business.loyaltyProgram.enabled')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تفعيل برنامج الولاء</span>
                </label>
              </div>
              {settings.loyaltyProgram?.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      النقاط لكل وحدة عملة
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={settings.loyaltyProgram?.pointsPerCurrency || 1}
                      onChange={(e) => handleNestedChange('loyaltyProgram', 'pointsPerCurrency', parseFloat(e.target.value) || 1)}
                      disabled={!canEdit('business.loyaltyProgram.pointsPerCurrency')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      معدل الاستبدال (نقطة = عملة)
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={settings.loyaltyProgram?.redemptionRate || 0.01}
                      onChange={(e) => handleNestedChange('loyaltyProgram', 'redemptionRate', parseFloat(e.target.value) || 0.01)}
                      disabled={!canEdit('business.loyaltyProgram.redemptionRate')}
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

export default BusinessSettingsTab;
