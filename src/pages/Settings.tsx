import React, { useState, useEffect, useContext } from "react";
import { AppContext } from "../context/AppContext";
import { SettingsData, TabState, GeneralSettings, BusinessSettings, NotificationsSettings } from "../types/settings";
import GeneralSettingsTab from "../components/settings/GeneralSettingsTab";
import BusinessSettingsTab from "../components/settings/BusinessSettingsTab";
import NotificationsSettingsTab from "../components/settings/NotificationsSettingsTab";

const Settings: React.FC = () => {
    const context = useContext(AppContext);
    const user = context?.user;
    const api = context?.api;
    const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState<SettingsData>({
    general: {
            systemName: "نظام إدارة المقهى",
            language: "ar",
            timezone: "Asia/Riyadh",
            currency: "SAR",
        },
        business: {
            businessName: "مقهى",
            businessType: "cafe",
            taxRate: 15,
            serviceCharge: 0,
        },
        notifications: {
            emailNotifications: false,
            smsNotifications: false,
            pushNotifications: true,
        },
    });

    const [tabStates, setTabStates] = useState<Record<string, TabState>>({
        general: { loading: false, saving: false, error: "", success: "" },
        business: { loading: false, saving: false, error: "", success: "" },
        notifications: { loading: false, saving: false, error: "", success: "" },
        security: { loading: false, saving: false, error: "", success: "" },
    });

    // Security state
    const [securityState, setSecurityState] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        loading: false,
        error: "",
        success: "",
    });

    const [globalState, setGlobalState] = useState({
        error: "",
        success: "",
    });

    // Get user permissions
    const getUserPermissions = (): string[] => {
    if (!user) return [];
        return (user.permissions as string[]) || [];
    };

    // Check if user can access a tab
    const canAccessTab = (tab: string): boolean => {
        const permissions = getUserPermissions();
        if (permissions.includes("all")) return true;
        if (tab === "security") return true; // Security tab is accessible to all authenticated users
        return permissions.includes("settings");
    };

    // Check if user can edit settings
    const canEdit = (tab: string): boolean => {
        const permissions = getUserPermissions();
        if (permissions.includes("all")) return true;
        if (tab === "security") return true; // Security tab is editable by all authenticated users
        return permissions.includes("settings");
    };

    // Handle password change
    const handlePasswordChange = async () => {
        if (!api) return;

        // Validation
        if (!securityState.currentPassword || !securityState.newPassword || !securityState.confirmPassword) {
            setSecurityState(prev => ({ ...prev, error: "جميع الحقول مطلوبة" }));
            return;
        }

        if (securityState.newPassword !== securityState.confirmPassword) {
            setSecurityState(prev => ({ ...prev, error: "كلمة المرور الجديدة غير متطابقة" }));
            return;
        }

        if (securityState.newPassword.length < 6) {
            setSecurityState(prev => ({ ...prev, error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" }));
            return;
        }

        setSecurityState(prev => ({ ...prev, loading: true, error: "", success: "" }));

        try {
            const response = await api.updatePassword(securityState.currentPassword, securityState.newPassword);
            if (response.success) {
                setSecurityState(prev => ({
                    ...prev,
                    loading: false,
                    success: "تم تغيير كلمة المرور بنجاح",
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                }));
            } else {
                setSecurityState(prev => ({
        ...prev,
                    loading: false,
                    error: response.message || "خطأ في تغيير كلمة المرور"
      }));
            }
    } catch {
            setSecurityState(prev => ({
        ...prev,
          loading: false,
                error: "خطأ في تغيير كلمة المرور"
            }));
        }
    };

    // Load settings for a specific tab
    const loadSettings = async (category: string) => {
        if (!api || category === "security") return;

        setTabStates(prev => ({ ...prev, [category]: { ...prev[category], loading: true, error: "" } }));

        try {
            const response = await api.getSettings(category);
            if (response.success) {
                setSettings(prev => ({
                    ...prev,
                    [category]: response.data.settings,
                }));
            } else {
                setTabStates(prev => ({
        ...prev,
                    [category]: { ...prev[category], loading: false, error: response.message || "" }
      }));
            }
    } catch {
            setTabStates(prev => ({
        ...prev,
                [category]: { ...prev[category], loading: false, error: "خطأ في تحميل الإعدادات" }
            }));
        }

        setTabStates(prev => ({ ...prev, [category]: { ...prev[category], loading: false } }));
    };

    // Save settings for a specific tab
    const handleSaveSettings = async (category: string, newSettings: Record<string, unknown>) => {
        if (!api) return;

        setTabStates(prev => ({ ...prev, [category]: { ...prev[category], saving: true, error: "", success: "" } }));

        try {
            const response = await api.updateSettings(category, newSettings);
            if (response.success) {
                setSettings(prev => ({
                    ...prev,
                    [category]: response.data.settings,
                }));
                setTabStates(prev => ({
                    ...prev,
                    [category]: { ...prev[category], saving: false, success: "تم حفظ الإعدادات بنجاح" }
                }));
            } else {
                setTabStates(prev => ({
        ...prev,
                    [category]: { ...prev[category], saving: false, error: response.message || "" }
      }));
            }
    } catch {
            setTabStates(prev => ({
        ...prev,
                [category]: { ...prev[category], saving: false, error: "خطأ في حفظ الإعدادات" }
      }));
    }
  };

    // Load settings when tab changes
  useEffect(() => {
        if (canAccessTab(activeTab) && activeTab !== "security") {
            loadSettings(activeTab);
    }
  }, [activeTab]);

    // Clear messages after 3 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            setGlobalState({ error: "", success: "" });
            setTabStates(prev => {
                const newStates = { ...prev };
                Object.keys(newStates).forEach(key => {
                    newStates[key] = { ...newStates[key], error: "", success: "" };
                });
                return newStates;
            });
            setSecurityState(prev => ({ ...prev, error: "", success: "" }));
        }, 3000);

        return () => clearTimeout(timer);
    }, [globalState, tabStates, securityState]);

    const tabs = [
        { id: "general", name: "عام", icon: "⚙️" },
        { id: "business", name: "الأعمال", icon: "🏢" },
        { id: "notifications", name: "الإشعارات", icon: "🔔" },
        { id: "security", name: "الأمان", icon: "🔒" },
    ];

    const renderTabContent = () => {
        if (activeTab === "security") {
  return (
    <div className="space-y-6">
          <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">تغيير كلمة المرور</h3>

                        {securityState.error && (
                            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                                {securityState.error}
                            </div>
                        )}

                        {securityState.success && (
                            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                                {securityState.success}
          </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    كلمة المرور الحالية
                                </label>
                                <input
                                    type="password"
                                    value={securityState.currentPassword}
                                    onChange={(e) => setSecurityState(prev => ({ ...prev, currentPassword: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="أدخل كلمة المرور الحالية"
                                />
        </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    كلمة المرور الجديدة
                                </label>
              <input
                                    type="password"
                                    value={securityState.newPassword}
                                    onChange={(e) => setSecurityState(prev => ({ ...prev, newPassword: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="أدخل كلمة المرور الجديدة"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    تأكيد كلمة المرور الجديدة
            </label>
                                <input
                                    type="password"
                                    value={securityState.confirmPassword}
                                    onChange={(e) => setSecurityState(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="أعد إدخال كلمة المرور الجديدة"
                                />
                            </div>

            <button
                                onClick={handlePasswordChange}
                                disabled={securityState.loading}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                                {securityState.loading ? "جاري التغيير..." : "تغيير كلمة المرور"}
            </button>
          </div>
                    </div>
                </div>
            );
        }

        const currentSettings = settings[activeTab as keyof SettingsData];
        const currentTabState = tabStates[activeTab];
        const canEditCurrent = canEdit(activeTab);

        if (!canAccessTab(activeTab)) {
            return (
                <div className="text-center py-8">
                    <div className="text-red-500 text-lg mb-2">🚫</div>
                    <p className="text-gray-600">ليس لديك صلاحية للوصول لهذه الإعدادات</p>
                </div>
            );
        }

        const commonProps = {
            settings: currentSettings,
            onSave: (newSettings: GeneralSettings | BusinessSettings | NotificationsSettings) =>
                handleSaveSettings(activeTab, newSettings as unknown as Record<string, unknown>),
            canEdit: canEditCurrent,
            loading: currentTabState.loading,
            saving: currentTabState.saving,
            error: currentTabState.error,
            success: currentTabState.success,
        };

        switch (activeTab) {
            case "general":
                return <GeneralSettingsTab {...commonProps} />;
            case "business":
                return <BusinessSettingsTab {...commonProps} />;
            case "notifications":
                return <NotificationsSettingsTab {...commonProps} />;
            default:
                return <div>فئة غير معروفة</div>;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        الإعدادات
                    </h1>
                    <p className="text-gray-600">
                        إدارة إعدادات النظام والإشعارات
                    </p>
      </div>

                {/* Global Messages */}
                {globalState.error && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                        {globalState.error}
                    </div>
                )}
                {globalState.success && (
                    <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                        {globalState.success}
                    </div>
                )}

                {/* Tabs */}
                <div className="bg-white rounded-lg shadow">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8 px-6">
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.id;
                                const canAccess = canAccessTab(tab.id);
                                const tabState = tabStates[tab.id];

                return (
                  <button
                    key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        disabled={!canAccess}
                                        className={`
                                            py-4 px-1 border-b-2 font-medium text-sm
                                            ${isActive
                                                ? "border-blue-500 text-blue-600"
                                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                            }
                                            ${!canAccess ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                                        `}
                                    >
                                        <span className="mr-2">{tab.icon}</span>
                      {tab.name}
                                        {tabState.loading && <span className="ml-2">⏳</span>}
                                        {tabState.saving && <span className="ml-2">💾</span>}
                                        {tabState.error && <span className="ml-2 text-red-500">⚠️</span>}
                                        {tabState.success && <span className="ml-2 text-green-500">✅</span>}
                  </button>
                );
              })}
            </nav>
        </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
