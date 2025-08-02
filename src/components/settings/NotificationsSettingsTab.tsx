import React, { useState, useEffect } from "react";
import { TabProps, NotificationsSettings } from "../../types/settings";

const NotificationsSettingsTab: React.FC<TabProps> = ({
    settings,
    onSave,
    canEdit,
    loading,
    saving,
    error,
    success,
}) => {
    const [localSettings, setLocalSettings] = useState<NotificationsSettings>(settings as NotificationsSettings);

    // Update local settings when props change
    useEffect(() => {
        if (settings) {
            console.log("NotificationsSettingsTab received settings:", settings);
            setLocalSettings(settings as NotificationsSettings);
        }
    }, [settings]);

    const handleInputChange = (field: keyof NotificationsSettings, value: boolean) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!canEdit) return;
        onSave(localSettings);
    };

    if (!canEdit) {
        return (
            <div className="text-center py-8">
                <div className="text-red-500 text-lg mb-2">🚫</div>
                <p className="text-gray-600">ليس لديك صلاحية لتعديل هذه الإعدادات</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-medium text-gray-900">إعدادات الإشعارات</h3>
                <p className="text-sm text-gray-600 mt-1">
                    إدارة الإشعارات والتنبيهات في النظام
                </p>
            </div>



            {/* Error/Success Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                    {success}
                </div>
            )}

            {/* Settings Form */}
            <div className="space-y-6">
                {/* Email Notifications */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-lg font-medium text-gray-900">إشعارات البريد الإلكتروني</h4>
                            <p className="text-sm text-gray-600 mt-1">
                                استلام الإشعارات عبر البريد الإلكتروني
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localSettings.emailNotifications}
                                onChange={(e) => handleInputChange("emailNotifications", e.target.checked)}
                                disabled={loading || saving}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>

                {/* SMS Notifications */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-lg font-medium text-gray-900">إشعارات الرسائل النصية</h4>
                            <p className="text-sm text-gray-600 mt-1">
                                استلام الإشعارات عبر الرسائل النصية
                            </p>
                            <div className="mt-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    سوف تتوفر قريباً
                                </span>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer opacity-50">
                            <input
                                type="checkbox"
                                checked={localSettings.smsNotifications}
                                onChange={(e) => handleInputChange("smsNotifications", e.target.checked)}
                                disabled={true}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-400"></div>
                        </label>
                    </div>
                </div>

                {/* Push Notifications */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-lg font-medium text-gray-900">الإشعارات الفورية</h4>
                            <p className="text-sm text-gray-600 mt-1">
                                استلام الإشعارات الفورية في المتصفح
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localSettings.pushNotifications}
                                onChange={(e) => handleInputChange("pushNotifications", e.target.checked)}
                                disabled={loading || saving}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>
            </div>



            {/* Save Button */}
            <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                    onClick={handleSave}
                    disabled={loading || saving}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
                </button>
            </div>
        </div>
    );
};

export default NotificationsSettingsTab;
