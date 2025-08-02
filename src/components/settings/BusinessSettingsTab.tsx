import React, { useState, useEffect } from "react";
import { TabProps, BusinessSettings } from "../../types/settings";

const BusinessSettingsTab: React.FC<TabProps> = ({
  settings,
  onSave,
    canEdit,
    loading,
    saving,
    error,
    success,
}) => {
    // دالة للتحقق من صلاحيات تعديل حقل محدد
    const canEditField = (_field: string): boolean => {
        // يمكن إضافة منطق أكثر تعقيداً هنا للتحقق من صلاحيات المستخدم
        // حالياً نستخدم canEdit العام
        return canEdit;
    };
    const [localSettings, setLocalSettings] = useState<BusinessSettings>(settings as BusinessSettings);

    // Update local settings when props change
    useEffect(() => {
        if (settings) {
            console.log("BusinessSettingsTab received settings:", settings);
            setLocalSettings(settings as BusinessSettings);
        }
    }, [settings]);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const handleInputChange = (field: keyof BusinessSettings, value: string | number) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }));

        // Clear validation error for this field
        if (validationErrors[field]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const validateSettings = (): boolean => {
        const errors: Record<string, string> = {};

        if (!localSettings.businessName || localSettings.businessName.length < 2) {
            errors.businessName = "اسم المنشأة يجب أن يكون أكثر من حرفين";
        }

        if (localSettings.taxRate < 0 || localSettings.taxRate > 100) {
            errors.taxRate = "نسبة الضريبة يجب أن تكون بين 0 و 100";
        }

        if (localSettings.serviceCharge < 0 || localSettings.serviceCharge > 100) {
            errors.serviceCharge = "نسبة رسوم الخدمة يجب أن تكون بين 0 و 100";
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!canEdit) return;

        if (!validateSettings()) {
            return;
        }

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
                <h3 className="text-lg font-medium text-gray-900">إعدادات الأعمال</h3>
                <p className="text-sm text-gray-600 mt-1">
                    إعدادات المنشأة والضرائب والرسوم
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Business Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        اسم المنشأة
                        {!canEditField("businessName") && (
                            <span className="text-red-500 text-xs mr-2">(محظور)</span>
                        )}
                    </label>
                    <input
                        type="text"
                        value={localSettings.businessName}
                        onChange={(e) => handleInputChange("businessName", e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            validationErrors.businessName ? "border-red-500" : "border-gray-300"
                        } ${!canEditField("businessName") ? "bg-gray-100 cursor-not-allowed" : ""}`}
                        disabled={loading || saving || !canEditField("businessName")}
                    />
                    {validationErrors.businessName && (
                        <p className="text-red-500 text-sm mt-1">{validationErrors.businessName}</p>
                    )}
                    {!canEditField("businessName") && (
                        <p className="text-orange-500 text-sm mt-1">لا يمكن تعديل اسم المنشأة - صلاحيات غير كافية</p>
                    )}
                  </div>

                {/* Business Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        نوع المنشأة
                        {!canEditField("businessType") && (
                            <span className="text-red-500 text-xs mr-2">(محظور)</span>
                        )}
                    </label>
                    <select
                        value={localSettings.businessType}
                        onChange={(e) => handleInputChange("businessType", e.target.value)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            !canEditField("businessType") ? "bg-gray-100 cursor-not-allowed" : ""
                        }`}
                        disabled={loading || saving || !canEditField("businessType")}
                    >
                        <option value="cafe">مقهى</option>
                        <option value="restaurant">مطعم</option>
                        <option value="bakery">مخبز</option>
                        <option value="shop">متجر</option>
                        <option value="other">أخرى</option>
                    </select>
                    {!canEditField("businessType") && (
                        <p className="text-orange-500 text-sm mt-1">لا يمكن تعديل نوع المنشأة - صلاحيات غير كافية</p>
                    )}
          </div>

                {/* Tax Rate */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        نسبة الضريبة (%)
                        {!canEditField("taxRate") && (
                            <span className="text-red-500 text-xs mr-2">(محظور)</span>
                        )}
                    </label>
                    <input
                      type="number"
                        min="0"
                        max="100"
                      step="0.1"
                        value={localSettings.taxRate}
                        onChange={(e) => handleInputChange("taxRate", parseFloat(e.target.value) || 0)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            validationErrors.taxRate ? "border-red-500" : "border-gray-300"
                        } ${!canEditField("taxRate") ? "bg-gray-100 cursor-not-allowed" : ""}`}
                        disabled={loading || saving || !canEditField("taxRate")}
                    />
                    {validationErrors.taxRate && (
                        <p className="text-red-500 text-sm mt-1">{validationErrors.taxRate}</p>
                    )}
                    {!canEditField("taxRate") && (
                        <p className="text-orange-500 text-sm mt-1">لا يمكن تعديل نسبة الضريبة - صلاحيات غير كافية</p>
                    )}
                  </div>

                                {/* Service Charge */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        رسوم الخدمة (%)
                        {!canEditField("serviceCharge") && (
                            <span className="text-red-500 text-xs mr-2">(محظور)</span>
                        )}
                    </label>
                    <input
                      type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={localSettings.serviceCharge}
                        onChange={(e) => handleInputChange("serviceCharge", parseFloat(e.target.value) || 0)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            validationErrors.serviceCharge ? "border-red-500" : "border-gray-300"
                        } ${!canEditField("serviceCharge") ? "bg-gray-100 cursor-not-allowed" : ""}`}
                        disabled={loading || saving || !canEditField("serviceCharge")}
                    />
                    {validationErrors.serviceCharge && (
                        <p className="text-red-500 text-sm mt-1">{validationErrors.serviceCharge}</p>
                    )}
                    {!canEditField("serviceCharge") && (
                        <p className="text-orange-500 text-sm mt-1">لا يمكن تعديل رسوم الخدمة - صلاحيات غير كافية</p>
                    )}
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

export default BusinessSettingsTab;
