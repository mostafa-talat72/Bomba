import React from 'react';
import { Save, CheckCircle, AlertTriangle } from 'lucide-react';
import { TabProps } from '../../types/settings';

const ReportSettingsTab: React.FC<TabProps> = ({
  settings,
  setSettings,
  tabState,
  onSave,
  onReset,
  canEdit
}) => {
  const handleChange = (field: string, value: any) => {
    if (!canEdit(`reports.${field}`)) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleNestedChange = (parent: string, field: string, value: any) => {
    if (!canEdit(`reports.${parent}.${field}`)) return;
    setSettings({
      ...settings,
      [parent]: { ...settings[parent], [field]: value }
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">إعدادات التقارير</h3>
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

          {/* إعدادات البيانات */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات البيانات</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  فترة الاحتفاظ بالبيانات (أيام)
                </label>
                <input
                  type="number"
                  min="30"
                  max="3650"
                  value={settings.dataRetentionDays}
                  onChange={(e) => handleChange('dataRetentionDays', parseInt(e.target.value) || 365)}
                  disabled={!canEdit('reports.dataRetentionDays')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  حد أقصى للبيانات المحملة
                </label>
                <input
                  type="number"
                  min="100"
                  max="10000"
                  value={settings.maxDataLoad}
                  onChange={(e) => handleChange('maxDataLoad', parseInt(e.target.value) || 1000)}
                  disabled={!canEdit('reports.maxDataLoad')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.includeDeletedItems}
                  onChange={(e) => handleChange('includeDeletedItems', e.target.checked)}
                  disabled={!canEdit('reports.includeDeletedItems')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">تضمين العناصر المحذوفة في التقارير</span>
              </label>
            </div>
          </div>

          {/* تنسيق التصدير */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">تنسيق التصدير</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  التنسيق الافتراضي
                </label>
                <select
                  value={settings.defaultExportFormat}
                  onChange={(e) => handleChange('defaultExportFormat', e.target.value)}
                  disabled={!canEdit('reports.defaultExportFormat')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                >
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ترميز الملف
                </label>
                <select
                  value={settings.fileEncoding}
                  onChange={(e) => handleChange('fileEncoding', e.target.value)}
                  disabled={!canEdit('reports.fileEncoding')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                >
                  <option value="utf-8">UTF-8</option>
                  <option value="windows-1256">Windows-1256</option>
                  <option value="iso-8859-6">ISO-8859-6</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.includeCharts}
                  onChange={(e) => handleChange('includeCharts', e.target.checked)}
                  disabled={!canEdit('reports.includeCharts')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">تضمين الرسوم البيانية في التقارير</span>
              </label>
            </div>
          </div>

          {/* التقارير المجدولة */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">التقارير المجدولة</h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.scheduledReports?.enabled || false}
                    onChange={(e) => handleNestedChange('scheduledReports', 'enabled', e.target.checked)}
                    disabled={!canEdit('reports.scheduledReports.enabled')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تفعيل التقارير المجدولة</span>
                </label>
              </div>
              {settings.scheduledReports?.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      نوع التقرير
                    </label>
                    <select
                      value={settings.scheduledReports?.reportType || 'financial'}
                      onChange={(e) => handleNestedChange('scheduledReports', 'reportType', e.target.value)}
                      disabled={!canEdit('reports.scheduledReports.reportType')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    >
                      <option value="financial">تقرير مالي</option>
                      <option value="sales">تقرير المبيعات</option>
                      <option value="inventory">تقرير المخزون</option>
                      <option value="customers">تقرير العملاء</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      التكرار
                    </label>
                    <select
                      value={settings.scheduledReports?.frequency || 'daily'}
                      onChange={(e) => handleNestedChange('scheduledReports', 'frequency', e.target.value)}
                      disabled={!canEdit('reports.scheduledReports.frequency')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    >
                      <option value="daily">يومياً</option>
                      <option value="weekly">أسبوعياً</option>
                      <option value="monthly">شهرياً</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* خيارات العرض */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">خيارات العرض</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  عدد العناصر في الصفحة
                </label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={settings.itemsPerPage}
                  onChange={(e) => handleChange('itemsPerPage', parseInt(e.target.value) || 20)}
                  disabled={!canEdit('reports.itemsPerPage')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تنسيق التاريخ
                </label>
                <select
                  value={settings.dateFormat}
                  onChange={(e) => handleChange('dateFormat', e.target.value)}
                  disabled={!canEdit('reports.dateFormat')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.showTotals}
                  onChange={(e) => handleChange('showTotals', e.target.checked)}
                  disabled={!canEdit('reports.showTotals')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إظهار الإجماليات في التقارير</span>
              </label>
            </div>
            <div className="mt-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.showPercentages}
                  onChange={(e) => handleChange('showPercentages', e.target.checked)}
                  disabled={!canEdit('reports.showPercentages')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">إظهار النسب المئوية</span>
              </label>
            </div>
          </div>

          {/* إعدادات متقدمة */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات متقدمة</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مهلة إنشاء التقرير (ثانية)
                </label>
                <input
                  type="number"
                  min="30"
                  max="300"
                  value={settings.reportTimeout}
                  onChange={(e) => handleChange('reportTimeout', parseInt(e.target.value) || 60)}
                  disabled={!canEdit('reports.reportTimeout')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مستوى التفاصيل
                </label>
                <select
                  value={settings.detailLevel}
                  onChange={(e) => handleChange('detailLevel', e.target.value)}
                  disabled={!canEdit('reports.detailLevel')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                >
                  <option value="summary">ملخص</option>
                  <option value="detailed">مفصل</option>
                  <option value="comprehensive">شامل</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.enableCaching}
                  onChange={(e) => handleChange('enableCaching', e.target.checked)}
                  disabled={!canEdit('reports.enableCaching')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">تفعيل التخزين المؤقت للتقارير</span>
              </label>
            </div>
            <div className="mt-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.autoRefresh}
                  onChange={(e) => handleChange('autoRefresh', e.target.checked)}
                  disabled={!canEdit('reports.autoRefresh')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                />
                <span className="mr-3 text-sm text-gray-700">تحديث تلقائي للتقارير</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportSettingsTab;
