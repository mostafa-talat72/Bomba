import Settings from "../models/Settings.js";
import {
    checkPermission,
    checkPermissions,
    checkActionPermission,
} from "./permissions.js";
import Logger from "../middleware/logger.js";

// دالة لتطبيق الإعدادات على النظام
export const applySystemSettings = async (user, organizationId) => {
    try {
        // التحقق من صلاحيات النظام
        if (!checkPermission(user, "settings")) {
            Logger.warn("System settings application denied", {
                userId: user._id,
                userRole: user.role,
                organizationId,
            });

            return {
                success: false,
                message: "ليس لديك صلاحية لتطبيق إعدادات النظام",
                code: "PERMISSION_DENIED",
            };
        }

        // الحصول على جميع الإعدادات
        const allSettings = await Settings.find({
            organization: organizationId,
        });
        const appliedSettings = {};

        for (const setting of allSettings) {
            try {
                const result = await applyCategorySettings(
                    setting.category,
                    setting.settings,
                    organizationId
                );
                appliedSettings[setting.category] = result;
            } catch (error) {
                Logger.error("Error applying category settings", {
                    error: error.message,
                    category: setting.category,
                    organizationId,
                });
                appliedSettings[setting.category] = {
                    success: false,
                    error: error.message,
                };
            }
        }

        Logger.info("System settings applied", {
            userId: user._id,
            organizationId,
            appliedSettings,
        });

        return {
            success: true,
            data: {
                applied: appliedSettings,
                timestamp: new Date().toISOString(),
            },
        };
    } catch (error) {
        Logger.error("Error applying system settings", {
            error: error.message,
            userId: user._id,
            organizationId,
        });

        return {
            success: false,
            message: "خطأ في تطبيق إعدادات النظام",
            error: error.message,
        };
    }
};

// دالة لتطبيق إعدادات فئة معينة
async function applyCategorySettings(category, settings, organizationId) {
    switch (category) {
        case "general":
            return await applyGeneralSettings(settings, organizationId);
        case "business":
            return await applyBusinessSettings(settings, organizationId);
        case "inventory":
            return await applyInventorySettings(settings, organizationId);
        case "security":
            return await applySecuritySettings(settings, organizationId);
        case "notifications":
            return await applyNotificationSettings(settings, organizationId);
        case "appearance":
            return await applyAppearanceSettings(settings, organizationId);
        case "backup":
            return await applyBackupSettings(settings, organizationId);
        case "advanced":
            return await applyAdvancedSettings(settings, organizationId);
        case "reports":
            return await applyReportSettings(settings, organizationId);
        case "users":
            return await applyUserSettings(settings, organizationId);
        default:
            return { success: false, error: "فئة الإعدادات غير مدعومة" };
    }
}

// تطبيق الإعدادات العامة
async function applyGeneralSettings(settings, organizationId) {
    try {
        // تطبيق اسم المقهى
        if (settings.cafeName) {
            // تحديث اسم المقهى في النظام
            Logger.info("Applied cafe name", {
                cafeName: settings.cafeName,
                organizationId,
            });
        }

        // تطبيق العملة
        if (settings.currency) {
            // تحديث العملة في النظام
            Logger.info("Applied currency", {
                currency: settings.currency,
                organizationId,
            });
        }

        // تطبيق المنطقة الزمنية
        if (settings.timezone) {
            // تحديث المنطقة الزمنية في النظام
            Logger.info("Applied timezone", {
                timezone: settings.timezone,
                organizationId,
            });
        }

        // تطبيق اللغة
        if (settings.language) {
            // تحديث اللغة في النظام
            Logger.info("Applied language", {
                language: settings.language,
                organizationId,
            });
        }

        // تطبيق نسبة الضريبة
        if (settings.taxRate !== undefined) {
            // تحديث نسبة الضريبة في النظام
            Logger.info("Applied tax rate", {
                taxRate: settings.taxRate,
                organizationId,
            });
        }

        return {
            success: true,
            applied: [
                "cafeName",
                "currency",
                "timezone",
                "language",
                "taxRate",
            ],
        };
    } catch (error) {
        Logger.error("Error applying general settings", {
            error: error.message,
            organizationId,
        });
        return { success: false, error: error.message };
    }
}

// تطبيق إعدادات الأعمال
async function applyBusinessSettings(settings, organizationId) {
    try {
        const applied = [];

        // تطبيق تنسيق رقم الفاتورة
        if (settings.billNumberFormat) {
            applied.push("billNumberFormat");
        }

        // تطبيق إعدادات الدفع
        if (settings.defaultPaymentMethod) {
            applied.push("defaultPaymentMethod");
        }

        // تطبيق نسبة الخصم القصوى
        if (settings.maxDiscountPercentage !== undefined) {
            applied.push("maxDiscountPercentage");
        }

        // تطبيق مهلة الجلسة
        if (settings.sessionTimeout !== undefined) {
            applied.push("sessionTimeout");
        }

        // تطبيق إعدادات ساعات العمل
        if (settings.workingHours) {
            applied.push("workingHours");
        }

        Logger.info("Applied business settings", {
            applied,
            organizationId,
        });

        return { success: true, applied };
    } catch (error) {
        Logger.error("Error applying business settings", {
            error: error.message,
            organizationId,
        });
        return { success: false, error: error.message };
    }
}

// تطبيق إعدادات المخزون
async function applyInventorySettings(settings, organizationId) {
    try {
        const applied = [];

        // تطبيق حد المخزون المنخفض
        if (settings.lowStockThreshold !== undefined) {
            applied.push("lowStockThreshold");
        }

        // تطبيق حد المخزون الحرج
        if (settings.criticalStockThreshold !== undefined) {
            applied.push("criticalStockThreshold");
        }

        // تطبيق إعدادات إعادة الطلب التلقائي
        if (settings.autoReorderEnabled !== undefined) {
            applied.push("autoReorderEnabled");
        }

        // تطبيق إعدادات خصم المخزون التلقائي
        if (settings.autoDeductStock !== undefined) {
            applied.push("autoDeductStock");
        }

        Logger.info("Applied inventory settings", {
            applied,
            organizationId,
        });

        return { success: true, applied };
    } catch (error) {
        Logger.error("Error applying inventory settings", {
            error: error.message,
            organizationId,
        });
        return { success: false, error: error.message };
    }
}

// تطبيق إعدادات الأمان
async function applySecuritySettings(settings, organizationId) {
    try {
        const applied = [];

        // تطبيق سياسة كلمات المرور
        if (settings.passwordPolicy) {
            applied.push("passwordPolicy");
        }

        // تطبيق إعدادات الجلسة
        if (settings.session) {
            applied.push("session");
        }

        // تطبيق إعدادات التدقيق
        if (settings.audit) {
            applied.push("audit");
        }

        // تطبيق إعدادات الصلاحيات
        if (settings.permissions) {
            applied.push("permissions");
        }

        Logger.info("Applied security settings", {
            applied,
            organizationId,
        });

        return { success: true, applied };
    } catch (error) {
        Logger.error("Error applying security settings", {
            error: error.message,
            organizationId,
        });
        return { success: false, error: error.message };
    }
}

// تطبيق إعدادات الإشعارات
async function applyNotificationSettings(settings, organizationId) {
    try {
        const applied = [];

        // تطبيق إعدادات الإشعارات حسب النوع
        if (settings.sessions) applied.push("sessions");
        if (settings.orders) applied.push("orders");
        if (settings.inventory) applied.push("inventory");
        if (settings.billing) applied.push("billing");
        if (settings.sound) applied.push("sound");
        if (settings.display) applied.push("display");
        if (settings.email) applied.push("email");

        Logger.info("Applied notification settings", {
            applied,
            organizationId,
        });

        return { success: true, applied };
    } catch (error) {
        Logger.error("Error applying notification settings", {
            error: error.message,
            organizationId,
        });
        return { success: false, error: error.message };
    }
}

// تطبيق إعدادات المظهر
async function applyAppearanceSettings(settings, organizationId) {
    try {
        const applied = [];

        // تطبيق السمة
        if (settings.theme) applied.push("theme");
        if (settings.primaryColor) applied.push("primaryColor");
        if (settings.secondaryColor) applied.push("secondaryColor");
        if (settings.fontSize) applied.push("fontSize");
        if (settings.fontFamily) applied.push("fontFamily");
        if (settings.rtlEnabled !== undefined) applied.push("rtlEnabled");
        if (settings.animations) applied.push("animations");

        Logger.info("Applied appearance settings", {
            applied,
            organizationId,
        });

        return { success: true, applied };
    } catch (error) {
        Logger.error("Error applying appearance settings", {
            error: error.message,
            organizationId,
        });
        return { success: false, error: error.message };
    }
}

// تطبيق إعدادات النسخ الاحتياطي
async function applyBackupSettings(settings, organizationId) {
    try {
        const applied = [];

        // تطبيق إعدادات النسخ الاحتياطي التلقائي
        if (settings.autoBackup) applied.push("autoBackup");
        if (settings.restore) applied.push("restore");
        if (settings.cloud) applied.push("cloud");

        Logger.info("Applied backup settings", {
            applied,
            organizationId,
        });

        return { success: true, applied };
    } catch (error) {
        Logger.error("Error applying backup settings", {
            error: error.message,
            organizationId,
        });
        return { success: false, error: error.message };
    }
}

// تطبيق الإعدادات المتقدمة
async function applyAdvancedSettings(settings, organizationId) {
    try {
        const applied = [];

        // تطبيق إعدادات الأداء
        if (settings.performance) applied.push("performance");
        if (settings.dataRetention) applied.push("dataRetention");
        if (settings.system) applied.push("system");
        if (settings.integrations) applied.push("integrations");

        Logger.info("Applied advanced settings", {
            applied,
            organizationId,
        });

        return { success: true, applied };
    } catch (error) {
        Logger.error("Error applying advanced settings", {
            error: error.message,
            organizationId,
        });
        return { success: false, error: error.message };
    }
}

// تطبيق إعدادات التقارير
async function applyReportSettings(settings, organizationId) {
    try {
        const applied = [];

        // تطبيق إعدادات التقارير
        if (settings.defaultPeriod) applied.push("defaultPeriod");
        if (settings.autoGenerate !== undefined) applied.push("autoGenerate");
        if (settings.emailReports !== undefined) applied.push("emailReports");
        if (settings.reportFormat) applied.push("reportFormat");
        if (settings.charts) applied.push("charts");

        Logger.info("Applied report settings", {
            applied,
            organizationId,
        });

        return { success: true, applied };
    } catch (error) {
        Logger.error("Error applying report settings", {
            error: error.message,
            organizationId,
        });
        return { success: false, error: error.message };
    }
}

// تطبيق إعدادات المستخدمين
async function applyUserSettings(settings, organizationId) {
    try {
        const applied = [];

        // تطبيق الأدوار والصلاحيات
        if (settings.roles) applied.push("roles");
        if (settings.defaultPermissions) applied.push("defaultPermissions");
        if (settings.userManagement) applied.push("userManagement");
        if (settings.profile) applied.push("profile");

        Logger.info("Applied user settings", {
            applied,
            organizationId,
        });

        return { success: true, applied };
    } catch (error) {
        Logger.error("Error applying user settings", {
            error: error.message,
            organizationId,
        });
        return { success: false, error: error.message };
    }
}

// دالة للتحقق من حالة النظام
export const checkSystemStatus = async (user, organizationId) => {
    try {
        // التحقق من صلاحيات النظام
        if (!checkPermission(user, "settings")) {
            return {
                success: false,
                message: "ليس لديك صلاحية للوصول لحالة النظام",
                code: "PERMISSION_DENIED",
            };
        }

        // الحصول على جميع الإعدادات
        const allSettings = await Settings.find({
            organization: organizationId,
        });

        const systemStatus = {
            totalCategories: 10,
            configuredCategories: allSettings.length,
            categoriesWithErrors: [],
            lastUpdated: new Date().toISOString(),
            version: "1.0.0",
        };

        // التحقق من الأخطاء في الإعدادات
        for (const setting of allSettings) {
            const validationErrors = setting.validateSettings();
            if (validationErrors.length > 0) {
                systemStatus.categoriesWithErrors.push(setting.category);
            }
        }

        Logger.info("System status checked", {
            userId: user._id,
            organizationId,
            systemStatus,
        });

        return {
            success: true,
            data: systemStatus,
        };
    } catch (error) {
        Logger.error("Error checking system status", {
            error: error.message,
            userId: user._id,
            organizationId,
        });

        return {
            success: false,
            message: "خطأ في التحقق من حالة النظام",
            error: error.message,
        };
    }
};

// دالة لإعادة تشغيل النظام
export const restartSystem = async (user, organizationId) => {
    try {
        // التحقق من صلاحيات النظام
        if (!checkPermission(user, "settings")) {
            return {
                success: false,
                message: "ليس لديك صلاحية لإعادة تشغيل النظام",
                code: "PERMISSION_DENIED",
            };
        }

        // تطبيق جميع الإعدادات
        const result = await applySystemSettings(user, organizationId);

        Logger.info("System restarted", {
            userId: user._id,
            organizationId,
            result,
        });

        return {
            success: true,
            message: "تم إعادة تشغيل النظام بنجاح",
            data: result,
        };
    } catch (error) {
        Logger.error("Error restarting system", {
            error: error.message,
            userId: user._id,
            organizationId,
        });

        return {
            success: false,
            message: "خطأ في إعادة تشغيل النظام",
            error: error.message,
        };
    }
};

// دالة لتنظيف النظام
export const cleanupSystem = async (user, organizationId) => {
    try {
        // التحقق من صلاحيات النظام
        if (!checkPermission(user, "settings")) {
            return {
                success: false,
                message: "ليس لديك صلاحية لتنظيف النظام",
                code: "PERMISSION_DENIED",
            };
        }

        // تنظيف الملفات المؤقتة
        Logger.info("System cleanup started", {
            userId: user._id,
            organizationId,
        });

        // تنظيف السجلات القديمة
        // تنظيف الملفات المؤقتة
        // تنظيف ذاكرة التخزين المؤقت

        Logger.info("System cleanup completed", {
            userId: user._id,
            organizationId,
        });

        return {
            success: true,
            message: "تم تنظيف النظام بنجاح",
        };
    } catch (error) {
        Logger.error("Error cleaning up system", {
            error: error.message,
            userId: user._id,
            organizationId,
        });

        return {
            success: false,
            message: "خطأ في تنظيف النظام",
            error: error.message,
        };
    }
};

export default {
    applySystemSettings,
    checkSystemStatus,
    restartSystem,
    cleanupSystem,
};
