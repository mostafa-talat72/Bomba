import React from 'react';
import { Save, CheckCircle, AlertTriangle, Palette, Type, Eye, EyeOff } from 'lucide-react';
import { TabProps } from '../../types/settings';

const AppearanceSettingsTab: React.FC<TabProps> = ({
  settings,
  setSettings,
  tabState,
  onSave,
  onReset,
  canEdit
}) => {
  const handleChange = (field: string, value: any) => {
    if (!canEdit(`appearance.${field}`)) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleNestedChange = (parent: string, field: string, value: any) => {
    if (!canEdit(`appearance.${parent}.${field}`)) return;
    setSettings({
      ...settings,
      [parent]: { ...settings[parent], [field]: value }
    });
  };

  const applyAppearancePreview = () => {
    // تطبيق التغييرات مباشرة على الواجهة
    const root = document.documentElement;

    // تطبيق الثيم
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      // auto theme
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }

    // تطبيق الألوان
    if (settings.primaryColor) {
      root.style.setProperty('--color-primary', settings.primaryColor);
    }
    if (settings.secondaryColor) {
      root.style.setProperty('--color-secondary', settings.secondaryColor);
    }

    // تطبيق حجم الخط
    const fontSizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px'
    };
    if (settings.fontSize) {
      root.style.setProperty('--font-size-base', fontSizeMap[settings.fontSize]);
    }

    // تطبيق نوع الخط
    if (settings.fontFamily) {
      root.style.setProperty('--font-family', settings.fontFamily);
    }

    // تطبيق اتجاه النص
    if (settings.rtlEnabled) {
      root.setAttribute('dir', 'rtl');
    } else {
      root.setAttribute('dir', 'ltr');
    }
  };

  React.useEffect(() => {
    applyAppearancePreview();
  }, [settings]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">إعدادات المظهر</h3>
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

          {/* إعدادات الثيم */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Palette className="h-5 w-5 ml-2" />
              إعدادات الثيم
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المظهر
                </label>
                <select
                  value={settings.theme}
                  onChange={(e) => handleChange('theme', e.target.value)}
                  disabled={!canEdit('appearance.theme')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                >
                  <option value="light">فاتح</option>
                  <option value="dark">داكن</option>
                  <option value="auto">تلقائي (حسب النظام)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    اللون الأساسي
                  </label>
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <input
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => handleChange('primaryColor', e.target.value)}
                      disabled={!canEdit('appearance.primaryColor')}
                      className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer disabled:opacity-50"
                    />
                    <input
                      type="text"
                      value={settings.primaryColor}
                      onChange={(e) => handleChange('primaryColor', e.target.value)}
                      disabled={!canEdit('appearance.primaryColor')}
                      placeholder="#3B82F6"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    اللون الثانوي
                  </label>
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <input
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) => handleChange('secondaryColor', e.target.value)}
                      disabled={!canEdit('appearance.secondaryColor')}
                      className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer disabled:opacity-50"
                    />
                    <input
                      type="text"
                      value={settings.secondaryColor}
                      onChange={(e) => handleChange('secondaryColor', e.target.value)}
                      disabled={!canEdit('appearance.secondaryColor')}
                      placeholder="#6B7280"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* إعدادات الخط */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Type className="h-5 w-5 ml-2" />
              إعدادات الخط
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  حجم الخط
                </label>
                <select
                  value={settings.fontSize}
                  onChange={(e) => handleChange('fontSize', e.target.value)}
                  disabled={!canEdit('appearance.fontSize')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                >
                  <option value="small">صغير (14px)</option>
                  <option value="medium">متوسط (16px)</option>
                  <option value="large">كبير (18px)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نوع الخط
                </label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => handleChange('fontFamily', e.target.value)}
                  disabled={!canEdit('appearance.fontFamily')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                >
                  <option value="'Cairo', sans-serif">Cairo</option>
                  <option value="'Tajawal', sans-serif">Tajawal</option>
                  <option value="'Almarai', sans-serif">Almarai</option>
                  <option value="'Changa', sans-serif">Changa</option>
                  <option value="'Arial', sans-serif">Arial</option>
                  <option value="'Helvetica', sans-serif">Helvetica</option>
                  <option value="'Georgia', serif">Georgia</option>
                  <option value="'Times New Roman', serif">Times New Roman</option>
                </select>
              </div>
            </div>
          </div>

          {/* إعدادات الواجهة */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Eye className="h-5 w-5 ml-2" />
              إعدادات الواجهة
            </h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.sidebarVisible}
                    onChange={(e) => handleChange('sidebarVisible', e.target.checked)}
                    disabled={!canEdit('appearance.sidebarVisible')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">إظهار الشريط الجانبي</span>
                </label>
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.userInfoVisible}
                    onChange={(e) => handleChange('userInfoVisible', e.target.checked)}
                    disabled={!canEdit('appearance.userInfoVisible')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">إظهار معلومات المستخدم</span>
                </label>
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.fullscreenMode}
                    onChange={(e) => handleChange('fullscreenMode', e.target.checked)}
                    disabled={!canEdit('appearance.fullscreenMode')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">وضع ملء الشاشة</span>
                </label>
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.rtlEnabled}
                    onChange={(e) => handleChange('rtlEnabled', e.target.checked)}
                    disabled={!canEdit('appearance.rtlEnabled')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تفعيل الاتجاه من اليمين لليسار</span>
                </label>
              </div>
            </div>
          </div>

          {/* إعدادات الحركة */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">إعدادات الحركة</h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.animations?.enabled || false}
                    onChange={(e) => handleNestedChange('animations', 'enabled', e.target.checked)}
                    disabled={!canEdit('appearance.animations.enabled')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:bg-gray-100"
                  />
                  <span className="mr-3 text-sm text-gray-700">تفعيل الحركات والانتقالات</span>
                </label>
              </div>
              {settings.animations?.enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    مدة الحركة (بالمللي ثانية)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="2000"
                    step="50"
                    value={settings.animations?.duration || 300}
                    onChange={(e) => handleNestedChange('animations', 'duration', parseInt(e.target.value) || 300)}
                    disabled={!canEdit('appearance.animations.duration')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                  />
                </div>
              )}
            </div>
          </div>

          {/* CSS مخصص */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">CSS مخصص</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                قواعد CSS مخصصة
              </label>
              <textarea
                rows={8}
                value={settings.customCSS || ''}
                onChange={(e) => handleChange('customCSS', e.target.value)}
                disabled={!canEdit('appearance.customCSS')}
                placeholder="/* أضف قواعد CSS مخصصة هنا */
.custom-button {
  background-color: #ff6b6b;
  border-radius: 8px;
}"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                يمكنك إضافة قواعد CSS مخصصة لتخصيص مظهر التطبيق
              </p>
            </div>
          </div>

          {/* معاينة سريعة */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">معاينة سريعة</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-2">زر أساسي</h5>
                <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                  زر تجريبي
                </button>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-2">نص تجريبي</h5>
                <p className="text-gray-700">
                  هذا نص تجريبي لاختبار حجم الخط ونوعه
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-2">ألوان</h5>
                <div className="flex space-x-2 space-x-reverse">
                  <div className="w-6 h-6 rounded-full bg-primary-600"></div>
                  <div className="w-6 h-6 rounded-full bg-secondary-600"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppearanceSettingsTab;
