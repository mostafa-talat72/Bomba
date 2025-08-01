import Settings from "../models/Settings.js";
import {
    getUserPermissionsFromSettings,
    checkSettingsPermission,
} from "./permissions.js";
import Logger from "../middleware/logger.js";

// دالة للحصول على إعدادات مع التحقق من الصلاحيات
export const getSettingsWithPermissions = async (
    user,
    organizationId,
    category
) => {
    try {
        // التحقق من صلاحيات المستخدم
        if (!checkSettingsPermission(user, category)) {
            Logger.warn("Settings access denied", {
                userId: user._id,
                userRole: user.role,
                category,
                organizationId,
            });

            return {
                success: false,
                message: "ليس لديك صلاحية للوصول لهذه الإعدادات",
                code: "PERMISSION_DENIED",
            };
        }

        // الحصول على الإعدادات أو إنشاؤها إذا لم تكن موجودة
        let settings = await Settings.findOne({
            organization: organizationId,
            category,
        });

        if (!settings) {
            // إنشاء إعدادات افتراضية
            settings = await Settings.ensureSettingsExist(
                organizationId,
                category
            );
            Logger.info("Default settings created", {
                organizationId,
                category,
                createdBy: user._id,
            });
        }

        // التحقق من صحة الإعدادات
        const validationErrors = settings.validateSettings();

        return {
            success: true,
            data: {
                settings: settings.settings,
                isDefault: settings.isDefault,
                version: settings.version,
                lastValidated: settings.lastValidated,
                validationErrors,
            },
        };
    } catch (error) {
        Logger.error("Error getting settings with permissions", {
            error: error.message,
            userId: user._id,
            organizationId,
            category,
        });

        return {
            success: false,
            message: "خطأ في جلب الإعدادات",
            error: error.message,
        };
    }
};

// دالة لتحديث الإعدادات مع التحقق من الصلاحيات
export const updateSettingsWithPermissions = async (
    user,
    organizationId,
    category,
    newSettings
) => {
    try {
        // التحقق من صلاحيات التعديل
        if (!checkSettingsPermission(user, category)) {
            Logger.warn("Settings update denied", {
                userId: user._id,
                userRole: user.role,
                category,
                organizationId,
            });

            return {
                success: false,
                message: "ليس لديك صلاحية لتعديل هذه الإعدادات",
                code: "PERMISSION_DENIED",
            };
        }

        // الحصول على الإعدادات الحالية
        let settings = await Settings.findOne({
            organization: organizationId,
            category,
        });

        if (!settings) {
            // إنشاء إعدادات جديدة
            settings = new Settings({
                organization: organizationId,
                category,
                settings: newSettings,
                createdBy: user._id,
                updatedBy: user._id,
            });
        } else {
            // تحديث الإعدادات الموجودة
            settings.settings = newSettings;
            settings.updatedBy = user._id;
            settings.isDefault = false; // لم تعد افتراضية
            settings.version += 1;
        }

        // التحقق من صحة الإعدادات
        const validationErrors = settings.validateSettings();

        // حفظ الإعدادات
        await settings.save();

        Logger.info("Settings updated successfully", {
            userId: user._id,
            organizationId,
            category,
            version: settings.version,
        });

        return {
            success: true,
            data: {
                settings: settings.settings,
                isDefault: settings.isDefault,
                version: settings.version,
                lastValidated: settings.lastValidated,
                validationErrors,
            },
        };
    } catch (error) {
        Logger.error("Error updating settings with permissions", {
            error: error.message,
            userId: user._id,
            organizationId,
            category,
        });

        return {
            success: false,
            message: "خطأ في تحديث الإعدادات",
            error: error.message,
        };
    }
};

// دالة لإعادة تعيين الإعدادات
export const resetSettingsWithPermissions = async (
    user,
    organizationId,
    category
) => {
    try {
        // التحقق من صلاحيات التعديل
        if (!checkSettingsPermission(user, category)) {
            Logger.warn("Settings reset denied", {
                userId: user._id,
                userRole: user.role,
                category,
                organizationId,
            });

            return {
                success: false,
                message: "ليس لديك صلاحية لإعادة تعيين هذه الإعدادات",
                code: "PERMISSION_DENIED",
            };
        }

        // الحصول على الإعدادات الافتراضية
        const defaultSettings = Settings.getDefaultSettings(category);

        // تحديث أو إنشاء الإعدادات
        let settings = await Settings.findOne({
            organization: organizationId,
            category,
        });

        if (!settings) {
            settings = new Settings({
                organization: organizationId,
                category,
                settings: defaultSettings,
                isDefault: true,
                createdBy: user._id,
                updatedBy: user._id,
            });
        } else {
            settings.settings = defaultSettings;
            settings.isDefault = true;
            settings.updatedBy = user._id;
            settings.version += 1;
        }

        // التحقق من صحة الإعدادات
        const validationErrors = settings.validateSettings();

        // حفظ الإعدادات
        await settings.save();

        Logger.info("Settings reset successfully", {
            userId: user._id,
            organizationId,
            category,
            version: settings.version,
        });

        return {
            success: true,
            data: {
                settings: settings.settings,
                isDefault: settings.isDefault,
                version: settings.version,
                lastValidated: settings.lastValidated,
                validationErrors,
            },
        };
    } catch (error) {
        Logger.error("Error resetting settings with permissions", {
            error: error.message,
            userId: user._id,
            organizationId,
            category,
        });

        return {
            success: false,
            message: "خطأ في إعادة تعيين الإعدادات",
            error: error.message,
        };
    }
};

// دالة للحصول على ملخص الإعدادات
export const getSettingsSummaryWithPermissions = async (
    user,
    organizationId
) => {
    try {
        // التحقق من صلاحيات الإعدادات
        if (!checkSettingsPermission(user, "general")) {
            Logger.warn("Settings summary access denied", {
                userId: user._id,
                userRole: user.role,
                organizationId,
            });

            return {
                success: false,
                message: "ليس لديك صلاحية للوصول لملخص الإعدادات",
                code: "PERMISSION_DENIED",
            };
        }

        const summary = await Settings.getSettingsSummary(organizationId);

        Logger.info("Settings summary retrieved", {
            userId: user._id,
            organizationId,
            summary,
        });

        return {
            success: true,
            data: summary,
        };
    } catch (error) {
        Logger.error("Error getting settings summary with permissions", {
            error: error.message,
            userId: user._id,
            organizationId,
        });

        return {
            success: false,
            message: "خطأ في جلب ملخص الإعدادات",
            error: error.message,
        };
    }
};

// دالة لتصدير الإعدادات
export const exportSettingsWithPermissions = async (user, organizationId) => {
    try {
        // التحقق من صلاحيات الإعدادات
        if (!checkSettingsPermission(user, "general")) {
            Logger.warn("Settings export denied", {
                userId: user._id,
                userRole: user.role,
                organizationId,
            });

            return {
                success: false,
                message: "ليس لديك صلاحية لتصدير الإعدادات",
                code: "PERMISSION_DENIED",
            };
        }

        // الحصول على جميع الإعدادات
        const allSettings = await Settings.find({
            organization: organizationId,
        });

        const exportData = {
            organization: organizationId,
            exportedAt: new Date().toISOString(),
            exportedBy: user._id,
            version: "1.0.0",
            settings: allSettings.map((setting) => ({
                category: setting.category,
                settings: setting.settings,
                isDefault: setting.isDefault,
                version: setting.version,
            })),
        };

        Logger.info("Settings exported successfully", {
            userId: user._id,
            organizationId,
            categoriesCount: allSettings.length,
        });

        return {
            success: true,
            data: exportData,
        };
    } catch (error) {
        Logger.error("Error exporting settings with permissions", {
            error: error.message,
            userId: user._id,
            organizationId,
        });

        return {
            success: false,
            message: "خطأ في تصدير الإعدادات",
            error: error.message,
        };
    }
};

// دالة لاستيراد الإعدادات
export const importSettingsWithPermissions = async (
    user,
    organizationId,
    importData
) => {
    try {
        // التحقق من صلاحيات الإعدادات
        if (!checkSettingsPermission(user, "general")) {
            Logger.warn("Settings import denied", {
                userId: user._id,
                userRole: user.role,
                organizationId,
            });

            return {
                success: false,
                message: "ليس لديك صلاحية لاستيراد الإعدادات",
                code: "PERMISSION_DENIED",
            };
        }

        let importedCount = 0;
        const errors = [];

        // استيراد كل فئة إعدادات
        for (const categoryData of importData.settings) {
            try {
                let settings = await Settings.findOne({
                    organization: organizationId,
                    category: categoryData.category,
                });

                if (!settings) {
                    settings = new Settings({
                        organization: organizationId,
                        category: categoryData.category,
                        settings: categoryData.settings,
                        isDefault: false,
                        createdBy: user._id,
                        updatedBy: user._id,
                    });
                } else {
                    settings.settings = categoryData.settings;
                    settings.isDefault = false;
                    settings.updatedBy = user._id;
                    settings.version += 1;
                }

                // التحقق من صحة الإعدادات
                settings.validateSettings();
                await settings.save();
                importedCount++;
            } catch (error) {
                errors.push({
                    category: categoryData.category,
                    error: error.message,
                });
            }
        }

        Logger.info("Settings imported successfully", {
            userId: user._id,
            organizationId,
            importedCount,
            errorsCount: errors.length,
        });

        return {
            success: true,
            data: {
                imported: importedCount,
                errors,
            },
        };
    } catch (error) {
        Logger.error("Error importing settings with permissions", {
            error: error.message,
            userId: user._id,
            organizationId,
        });

        return {
            success: false,
            message: "خطأ في استيراد الإعدادات",
            error: error.message,
        };
    }
};

// دالة للتحقق من صحة الإعدادات
export const validateSettingsWithPermissions = async (
    user,
    organizationId,
    category,
    settings
) => {
    try {
        // التحقق من صلاحيات الإعدادات
        if (!checkSettingsPermission(user, category)) {
            Logger.warn("Settings validation denied", {
                userId: user._id,
                userRole: user.role,
                category,
                organizationId,
            });

            return {
                success: false,
                message: "ليس لديك صلاحية للتحقق من هذه الإعدادات",
                code: "PERMISSION_DENIED",
            };
        }

        // إنشاء كائن مؤقت للتحقق من الصحة
        const tempSettings = new Settings({
            organization: organizationId,
            category,
            settings,
        });

        const validationErrors = tempSettings.validateSettings();

        Logger.info("Settings validation completed", {
            userId: user._id,
            organizationId,
            category,
            errorsCount: validationErrors.length,
        });

        return {
            success: true,
            data: {
                isValid: validationErrors.length === 0,
                validationErrors,
            },
        };
    } catch (error) {
        Logger.error("Error validating settings with permissions", {
            error: error.message,
            userId: user._id,
            organizationId,
            category,
        });

        return {
            success: false,
            message: "خطأ في التحقق من صحة الإعدادات",
            error: error.message,
        };
    }
};

// دالة لتطبيق الإعدادات على النظام
export const applySettingsToSystem = async (user, organizationId, category) => {
    try {
        // التحقق من صلاحيات الإعدادات
        if (!checkSettingsPermission(user, category)) {
            Logger.warn("Settings application denied", {
                userId: user._id,
                userRole: user.role,
                category,
                organizationId,
            });

            return {
                success: false,
                message: "ليس لديك صلاحية لتطبيق هذه الإعدادات",
                code: "PERMISSION_DENIED",
            };
        }

        // الحصول على الإعدادات
        const settings = await Settings.findOne({
            organization: organizationId,
            category,
        });

        if (!settings) {
            return {
                success: false,
                message: "الإعدادات غير موجودة",
            };
        }

        // تطبيق الإعدادات حسب الفئة
        let appliedCount = 0;
        const errors = [];

        switch (category) {
            case "general":
                // تطبيق الإعدادات العامة
                appliedCount = await applyGeneralSettings(
                    settings.settings,
                    organizationId
                );
                break;
            case "business":
                // تطبيق إعدادات الأعمال
                appliedCount = await applyBusinessSettings(
                    settings.settings,
                    organizationId
                );
                break;
            case "inventory":
                // تطبيق إعدادات المخزون
                appliedCount = await applyInventorySettings(
                    settings.settings,
                    organizationId
                );
                break;
            case "security":
                // تطبيق إعدادات الأمان
                appliedCount = await applySecuritySettings(
                    settings.settings,
                    organizationId
                );
                break;
            default:
                errors.push("فئة الإعدادات غير مدعومة للتطبيق التلقائي");
        }

        Logger.info("Settings applied to system", {
            userId: user._id,
            organizationId,
            category,
            appliedCount,
            errorsCount: errors.length,
        });

        return {
            success: true,
            data: {
                applied: appliedCount,
                errors,
            },
        };
    } catch (error) {
        Logger.error("Error applying settings to system", {
            error: error.message,
            userId: user._id,
            organizationId,
            category,
        });

        return {
            success: false,
            message: "خطأ في تطبيق الإعدادات على النظام",
            error: error.message,
        };
    }
};

// دوال مساعدة لتطبيق الإعدادات
async function applyGeneralSettings(settings, organizationId) {
    // تطبيق الإعدادات العامة
    Logger.info("Applying general settings", { organizationId });
    return 1;
}

async function applyBusinessSettings(settings, organizationId) {
    // تطبيق إعدادات الأعمال
    Logger.info("Applying business settings", { organizationId });
    return 1;
}

async function applyInventorySettings(settings, organizationId) {
    // تطبيق إعدادات المخزون
    Logger.info("Applying inventory settings", { organizationId });
    return 1;
}

async function applySecuritySettings(settings, organizationId) {
    // تطبيق إعدادات الأمان
    Logger.info("Applying security settings", { organizationId });
    return 1;
}

export default {
    getSettingsWithPermissions,
    updateSettingsWithPermissions,
    resetSettingsWithPermissions,
    getSettingsSummaryWithPermissions,
    exportSettingsWithPermissions,
    importSettingsWithPermissions,
    validateSettingsWithPermissions,
    applySettingsToSystem,
};
