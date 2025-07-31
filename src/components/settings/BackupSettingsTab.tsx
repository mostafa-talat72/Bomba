import React from 'react';
import { Save, CheckCircle, AlertTriangle, Download, Upload, Cloud, HardDrive } from 'lucide-react';
import { TabProps } from '../../types/settings';

const BackupSettingsTab: React.FC<TabProps> = ({
  settings,
  setSettings,
  tabState,
  onSave,
  onReset,
  canEdit,
  onCreateBackup
}) => {
  const handleChange = (field: string, value: any) => {
    if (!canEdit(`backup.${field}`)) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleNestedChange = (parent: string, field: string, value: any) => {
    if (!canEdit(`backup.${parent}.${field}`)) return;
    setSettings({
      ...settings,
      [parent]: { ...settings[parent], [field]: value }
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">إعدادات النسخ الاحتياطي</h3>
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

          {/* النسخ الاحتياطي التلقائي */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <HardDrive className="h-5 w-5 ml-2" />
              النسخ الاحتياطي التلقائي
            </h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.autoBackup?.enabled || false}
                    onChange={(e) => handleNestedChange('autoBackup', 'enabled', e.target.checked)}
                    disabled={!canEdit('backup.autoBackup.enabled')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تفعيل النسخ الاحتياطي التلقائي</span>
                </label>
              </div>

              {settings.autoBackup?.enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      تكرار النسخ الاحتياطي
                    </label>
                    <select
                      value={settings.autoBackup?.frequency || 'daily'}
                      onChange={(e) => handleNestedChange('autoBackup', 'frequency', e.target.value)}
                      disabled={!canEdit('backup.autoBackup.frequency')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    >
                      <option value="daily">يومياً</option>
                      <option value="weekly">أسبوعياً</option>
                      <option value="monthly">شهرياً</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        عدد النسخ المحتفظ بها
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={settings.autoBackup?.keepCount || 10}
                        onChange={(e) => handleNestedChange('autoBackup', 'keepCount', parseInt(e.target.value) || 10)}
                        disabled={!canEdit('backup.autoBackup.keepCount')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        وقت النسخ الاحتياطي
                      </label>
                      <input
                        type="time"
                        value={settings.autoBackup?.time || '02:00'}
                        onChange={(e) => handleNestedChange('autoBackup', 'time', e.target.value)}
                        disabled={!canEdit('backup.autoBackup.time')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.autoBackup?.compression || false}
                        onChange={(e) => handleNestedChange('autoBackup', 'compression', e.target.checked)}
                        disabled={!canEdit('backup.autoBackup.compression')}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                      />
                      <span className="mr-3 text-sm text-gray-700">ضغط ملفات النسخ الاحتياطي</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.autoBackup?.encryption || false}
                        onChange={(e) => handleNestedChange('autoBackup', 'encryption', e.target.checked)}
                        disabled={!canEdit('backup.autoBackup.encryption')}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                      />
                      <span className="mr-3 text-sm text-gray-700">تشفير ملفات النسخ الاحتياطي</span>
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* النسخ الاحتياطي اليدوي */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Download className="h-5 w-5 ml-2" />
              النسخ الاحتياطي اليدوي
            </h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    آخر نسخة احتياطية
                  </label>
                  <div className="text-sm text-gray-600">
                    {settings.manualBackup?.lastBackup || 'لم يتم إنشاء نسخة احتياطية بعد'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    حجم النسخة الاحتياطية
                  </label>
                  <div className="text-sm text-gray-600">
                    {settings.manualBackup?.backupSize || 'غير متوفر'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    موقع النسخة الاحتياطية
                  </label>
                  <div className="text-sm text-gray-600">
                    {settings.manualBackup?.backupLocation || 'غير محدد'}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 space-x-reverse">
                <button
                  onClick={onCreateBackup}
                  disabled={!canEdit('backup.manualBackup')}
                  className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 disabled:bg-gray-400"
                >
                  <Download className="h-4 w-4 ml-2" />
                  إنشاء نسخة احتياطية الآن
                </button>
                <button
                  onClick={() => {
                    // تنزيل النسخة الاحتياطية
                    const link = document.createElement('a');
                    link.href = '/api/backup/download';
                    link.download = `backup-${new Date().toISOString().split('T')[0]}.zip`;
                    link.click();
                  }}
                  disabled={!settings.manualBackup?.lastBackup}
                  className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 disabled:bg-gray-400"
                >
                  <Upload className="h-4 w-4 ml-2" />
                  تنزيل النسخة الاحتياطية
                </button>
              </div>
            </div>
          </div>

          {/* استعادة النسخ الاحتياطي */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">استعادة النسخ الاحتياطي</h4>
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.restore?.allowRestore || false}
                    onChange={(e) => handleNestedChange('restore', 'allowRestore', e.target.checked)}
                    disabled={!canEdit('backup.restore.allowRestore')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">السماح باستعادة النسخ الاحتياطي</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.restore?.requireConfirmation || false}
                    onChange={(e) => handleNestedChange('restore', 'requireConfirmation', e.target.checked)}
                    disabled={!canEdit('backup.restore.requireConfirmation')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تطلب تأكيد قبل الاستعادة</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.restore?.validateBackup || false}
                    onChange={(e) => handleNestedChange('restore', 'validateBackup', e.target.checked)}
                    disabled={!canEdit('backup.restore.validateBackup')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">التحقق من صحة النسخة الاحتياطية</span>
                </label>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <div className="text-sm text-gray-600 mb-2">
                  اسحب ملف النسخة الاحتياطية هنا أو انقر للاختيار
                </div>
                <input
                  type="file"
                  accept=".zip,.backup"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // معالجة استعادة النسخة الاحتياطية
                      console.log('Restoring backup:', file.name);
                    }
                  }}
                  className="hidden"
                  id="backup-file"
                />
                <label
                  htmlFor="backup-file"
                  className="inline-flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg cursor-pointer transition-colors duration-200"
                >
                  اختيار ملف
                </label>
              </div>
            </div>
          </div>

          {/* النسخ الاحتياطي السحابي */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Cloud className="h-5 w-5 ml-2" />
              النسخ الاحتياطي السحابي
            </h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.cloud?.enabled || false}
                    onChange={(e) => handleNestedChange('cloud', 'enabled', e.target.checked)}
                    disabled={!canEdit('backup.cloud.enabled')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تفعيل النسخ الاحتياطي السحابي</span>
                </label>
              </div>

              {settings.cloud?.enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      مزود الخدمة السحابية
                    </label>
                    <select
                      value={settings.cloud?.provider || 'google'}
                      onChange={(e) => handleNestedChange('cloud', 'provider', e.target.value)}
                      disabled={!canEdit('backup.cloud.provider')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    >
                      <option value="google">Google Drive</option>
                      <option value="aws">Amazon S3</option>
                      <option value="azure">Microsoft Azure</option>
                      <option value="dropbox">Dropbox</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      تكرار المزامنة (بالساعات)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={settings.cloud?.syncFrequency || 24}
                      onChange={(e) => handleNestedChange('cloud', 'syncFrequency', parseInt(e.target.value) || 24)}
                      disabled={!canEdit('backup.cloud.syncFrequency')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      بيانات الاعتماد
                    </label>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="API Key"
                        value={settings.cloud?.credentials?.apiKey || ''}
                        onChange={(e) => handleNestedChange('cloud.credentials', 'apiKey', e.target.value)}
                        disabled={!canEdit('backup.cloud.credentials')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                      />
                      <input
                        type="text"
                        placeholder="Secret Key"
                        value={settings.cloud?.credentials?.secretKey || ''}
                        onChange={(e) => handleNestedChange('cloud.credentials', 'secretKey', e.target.value)}
                        disabled={!canEdit('backup.cloud.credentials')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                      />
                      <input
                        type="text"
                        placeholder="Bucket/Folder Name"
                        value={settings.cloud?.credentials?.bucket || ''}
                        onChange={(e) => handleNestedChange('cloud.credentials', 'bucket', e.target.value)}
                        disabled={!canEdit('backup.cloud.credentials')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* إحصائيات النسخ الاحتياطي */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إحصائيات النسخ الاحتياطي</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">12</div>
                <div className="text-sm text-gray-600">إجمالي النسخ الاحتياطية</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">2.5 GB</div>
                <div className="text-sm text-gray-600">إجمالي الحجم</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">3 أيام</div>
                <div className="text-sm text-gray-600">آخر نسخة احتياطية</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">95%</div>
                <div className="text-sm text-gray-600">معدل النجاح</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupSettingsTab;
