import React, { useState } from 'react';
import { Save, CheckCircle, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { TabProps } from '../../types/settings';

const InventorySettingsTab: React.FC<TabProps> = ({
  settings,
  setSettings,
  tabState,
  onSave,
  onReset,
  canEdit
}) => {
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contact: '',
    email: '',
    phone: ''
  });

  const handleChange = (field: string, value: any) => {
    if (!canEdit(`inventory.${field}`)) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleNestedChange = (parent: string, field: string, value: any) => {
    if (!canEdit(`inventory.${parent}.${field}`)) return;
    setSettings({
      ...settings,
      [parent]: { ...settings[parent], [field]: value }
    });
  };

  const addSupplier = () => {
    if (!newSupplier.name || !newSupplier.contact) return;

    const suppliers = settings.suppliers || [];
    const supplier = {
      id: Date.now().toString(),
      ...newSupplier
    };

    setSettings({
      ...settings,
      suppliers: [...suppliers, supplier]
    });

    setNewSupplier({ name: '', contact: '', email: '', phone: '' });
  };

  const removeSupplier = (id: string) => {
    const suppliers = settings.suppliers || [];
    setSettings({
      ...settings,
      suppliers: suppliers.filter(s => s.id !== id)
    });
  };

  const addUnitConversion = () => {
    const conversions = settings.unitConversions || {};
    const newFromUnit = prompt('أدخل الوحدة الأساسية (مثل: كيلو)');
    const newToUnit = prompt('أدخل الوحدة المطلوبة (مثل: جرام)');
    const rate = prompt('أدخل معدل التحويل (مثل: 1000)');

    if (newFromUnit && newToUnit && rate) {
      if (!conversions[newFromUnit]) {
        conversions[newFromUnit] = {};
      }
      conversions[newFromUnit][newToUnit] = parseFloat(rate);

      setSettings({
        ...settings,
        unitConversions: conversions
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">إعدادات المخزون</h3>
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

          {/* تنبيهات المخزون */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">تنبيهات المخزون</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  حد المخزون المنخفض
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.lowStockThreshold}
                  onChange={(e) => handleChange('lowStockThreshold', parseInt(e.target.value) || 0)}
                  disabled={!canEdit('inventory.lowStockThreshold')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">سيتم إرسال تنبيه عند وصول المخزون لهذا الحد</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  حد المخزون الحرج
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.criticalStockThreshold}
                  onChange={(e) => handleChange('criticalStockThreshold', parseInt(e.target.value) || 0)}
                  disabled={!canEdit('inventory.criticalStockThreshold')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">سيتم إرسال تنبيه عاجل عند وصول المخزون لهذا الحد</p>
              </div>
            </div>
          </div>

          {/* إعادة الطلب التلقائي */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعادة الطلب التلقائي</h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.autoReorderEnabled}
                    onChange={(e) => handleChange('autoReorderEnabled', e.target.checked)}
                    disabled={!canEdit('inventory.autoReorderEnabled')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تفعيل إعادة الطلب التلقائي</span>
                </label>
              </div>
              {settings.autoReorderEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      حد إعادة الطلب
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settings.reorderThreshold}
                      onChange={(e) => handleChange('reorderThreshold', parseInt(e.target.value) || 0)}
                      disabled={!canEdit('inventory.reorderThreshold')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      المورد الافتراضي
                    </label>
                    <select
                      value={settings.defaultSupplier}
                      onChange={(e) => handleChange('defaultSupplier', e.target.value)}
                      disabled={!canEdit('inventory.defaultSupplier')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    >
                      <option value="">اختر المورد</option>
                      {(settings.suppliers || []).map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* إعدادات المخزون */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات المخزون</h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.autoDeductStock}
                    onChange={(e) => handleChange('autoDeductStock', e.target.checked)}
                    disabled={!canEdit('inventory.autoDeductStock')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">خصم المخزون تلقائياً عند الطلب</span>
                </label>
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.allowNegativeStock}
                    onChange={(e) => handleChange('allowNegativeStock', e.target.checked)}
                    disabled={!canEdit('inventory.allowNegativeStock')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">السماح بالمخزون السلبي</span>
                </label>
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.stockMovementLogging}
                    onChange={(e) => handleChange('stockMovementLogging', e.target.checked)}
                    disabled={!canEdit('inventory.stockMovementLogging')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تسجيل حركة المخزون</span>
                </label>
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.barcodeEnabled}
                    onChange={(e) => handleChange('barcodeEnabled', e.target.checked)}
                    disabled={!canEdit('inventory.barcodeEnabled')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تفعيل نظام الباركود</span>
                </label>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                أيام تحذير انتهاء الصلاحية
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={settings.expiryWarningDays}
                onChange={(e) => handleChange('expiryWarningDays', parseInt(e.target.value) || 7)}
                disabled={!canEdit('inventory.expiryWarningDays')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* تحويلات الوحدات */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">تحويلات الوحدات</h4>
            <div className="space-y-4">
              <button
                onClick={addUnitConversion}
                disabled={!canEdit('inventory.unitConversions')}
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 disabled:bg-gray-400"
              >
                <Plus className="h-4 w-4 ml-2" />
                إضافة تحويل جديد
              </button>

              <div className="space-y-2">
                {Object.entries(settings.unitConversions || {}).map(([fromUnit, conversions]) => (
                  <div key={fromUnit} className="border border-gray-200 rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 mb-2">{fromUnit}</h5>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(conversions).map(([toUnit, rate]) => (
                        <div key={toUnit} className="text-sm text-gray-600">
                          {toUnit}: {rate}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* الموردين */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">الموردين</h4>
            <div className="space-y-4">
              {/* إضافة مورد جديد */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="text"
                  placeholder="اسم المورد"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="text"
                  placeholder="اسم المسؤول"
                  value={newSupplier.contact}
                  onChange={(e) => setNewSupplier({ ...newSupplier, contact: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  value={newSupplier.email}
                  onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="tel"
                  placeholder="رقم الهاتف"
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <button
                onClick={addSupplier}
                disabled={!newSupplier.name || !newSupplier.contact}
                className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 disabled:bg-gray-400"
              >
                <Plus className="h-4 w-4 ml-2" />
                إضافة مورد
              </button>

              {/* قائمة الموردين */}
              <div className="space-y-2">
                {(settings.suppliers || []).map(supplier => (
                  <div key={supplier.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{supplier.name}</div>
                      <div className="text-sm text-gray-600">
                        {supplier.contact} • {supplier.email} • {supplier.phone}
                      </div>
                    </div>
                    <button
                      onClick={() => removeSupplier(supplier.id)}
                      disabled={!canEdit('inventory.suppliers')}
                      className="text-red-600 hover:text-red-700 disabled:text-gray-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventorySettingsTab;
