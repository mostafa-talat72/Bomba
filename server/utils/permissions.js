import Settings from "../models/Settings.js";
import Logger from "../middleware/logger.js";

// تعريف الصلاحيات المتاحة
export const PERMISSIONS = {
    // صلاحيات عامة
    ALL: "all",
    DASHBOARD: "dashboard",
    SETTINGS: "settings",

    // صلاحيات الإعدادات التفصيلية
    SETTINGS_GENERAL: "settings_general",
    SETTINGS_BUSINESS: "settings_business",
    SETTINGS_NOTIFICATIONS: "settings_notifications",
    SETTINGS_ORGANIZATION: "settings_organization", // إعدادات المنظمة الأساسية

    // صلاحيات الأجهزة
    PLAYSTATION: "playstation",
    COMPUTER: "computer",

    // صلاحيات المقهى
    CAFE: "cafe",
    MENU: "menu",
    BILLING: "billing",

    // صلاحيات الإدارة
    REPORTS: "reports",
    INVENTORY: "inventory",
    COSTS: "costs",
    USERS: "users",
};

// تعريف الأدوار والصلاحيات الافتراضية
export const DEFAULT_ROLES = {
    owner: {
        name: "صاحب المنشأة",
        permissions: [PERMISSIONS.ALL],
        description: "صلاحيات كاملة على النظام",
    },
    admin: {
        name: "مدير",
        permissions: [
            PERMISSIONS.DASHBOARD,
            PERMISSIONS.PLAYSTATION,
            PERMISSIONS.COMPUTER,
            PERMISSIONS.CAFE,
            PERMISSIONS.MENU,
            PERMISSIONS.BILLING,
            PERMISSIONS.REPORTS,
            PERMISSIONS.INVENTORY,
            PERMISSIONS.COSTS,
            PERMISSIONS.USERS,
            PERMISSIONS.SETTINGS,
            PERMISSIONS.SETTINGS_GENERAL,
            PERMISSIONS.SETTINGS_BUSINESS,
            PERMISSIONS.SETTINGS_NOTIFICATIONS,
            PERMISSIONS.SETTINGS_ORGANIZATION,
        ],
        description: "إدارة كاملة للنظام",
    },
    manager: {
        name: "مشرف",
        permissions: [
            PERMISSIONS.DASHBOARD,
            PERMISSIONS.PLAYSTATION,
            PERMISSIONS.COMPUTER,
            PERMISSIONS.CAFE,
            PERMISSIONS.MENU,
            PERMISSIONS.BILLING,
            PERMISSIONS.REPORTS,
            PERMISSIONS.INVENTORY,
            PERMISSIONS.SETTINGS_NOTIFICATIONS, // يمكنه تعديل إعدادات الإشعارات الخاصة به فقط
        ],
        description: "إدارة العمليات اليومية والإشعارات الشخصية",
    },
    cashier: {
        name: "كاشير",
        permissions: [
            PERMISSIONS.DASHBOARD,
            PERMISSIONS.PLAYSTATION,
            PERMISSIONS.COMPUTER,
            PERMISSIONS.CAFE,
            PERMISSIONS.BILLING,
            PERMISSIONS.SETTINGS_NOTIFICATIONS, // يمكنه تعديل إعدادات الإشعارات الخاصة به فقط
        ],
        description: "إدارة المبيعات والمدفوعات والإشعارات الشخصية",
    },
    kitchen: {
        name: "مطبخ",
        permissions: [
            PERMISSIONS.DASHBOARD,
            PERMISSIONS.CAFE,
            PERMISSIONS.MENU,
            PERMISSIONS.SETTINGS_NOTIFICATIONS, // يمكنه تعديل إعدادات الإشعارات الخاصة به فقط
        ],
        description: "إدارة الطلبات والمطبخ والإشعارات الشخصية",
    },
    staff: {
        name: "موظف",
        permissions: [
            PERMISSIONS.DASHBOARD,
            PERMISSIONS.PLAYSTATION,
            PERMISSIONS.COMPUTER,
            PERMISSIONS.SETTINGS_NOTIFICATIONS, // يمكنه تعديل إعدادات الإشعارات الخاصة به فقط
        ],
        description: "إدارة الجلسات والأجهزة والإشعارات الشخصية",
    },
};

// دالة للتحقق من صلاحيات المستخدم
export const checkPermission = (user, requiredPermission) => {
    if (!user) return false;

    // صاحب المنشأة له صلاحيات كاملة
    if (user.role === "owner" || user.permissions?.includes(PERMISSIONS.ALL)) {
        return true;
    }

    // التحقق من الصلاحية المطلوبة
    return user.permissions?.includes(requiredPermission) || false;
};

// دالة للتحقق من صلاحيات متعددة
export const checkPermissions = (user, requiredPermissions) => {
    if (!user) return false;

    // صاحب المنشأة له صلاحيات كاملة
    if (user.role === "owner" || user.permissions?.includes(PERMISSIONS.ALL)) {
        return true;
    }

    // التحقق من جميع الصلاحيات المطلوبة
    return requiredPermissions.every((permission) =>
        user.permissions?.includes(permission)
    );
};

// دالة للحصول على صلاحيات المستخدم من الإعدادات
export const getUserPermissionsFromSettings = async (user, organizationId) => {
    try {
        // الحصول على إعدادات المستخدمين
        const userSettings = await Settings.findOne({
            organization: organizationId,
            category: "users",
        });

        if (!userSettings) {
            Logger.warn("User settings not found, using default permissions", {
                organizationId,
                userId: user._id,
            });
            return DEFAULT_ROLES[user.role]?.permissions || [];
        }

        const settings = userSettings.settings;
        const userRole = user.role;

        // البحث عن دور المستخدم في الإعدادات
        const roleConfig = settings.roles?.find((role) => role.id === userRole);

        if (roleConfig) {
            return roleConfig.permissions;
        }

        // إذا لم يتم العثور على الدور، استخدم الصلاحيات الافتراضية
        Logger.warn(
            "User role not found in settings, using default permissions",
            {
                organizationId,
                userId: user._id,
                userRole,
            }
        );

        return DEFAULT_ROLES[userRole]?.permissions || [];
    } catch (error) {
        Logger.error("Error getting user permissions from settings", {
            error: error.message,
            organizationId,
            userId: user._id,
        });
        return DEFAULT_ROLES[user.role]?.permissions || [];
    }
};

// دالة للتحقق من صلاحيات الإعدادات
export const checkSettingsPermission = (user, category) => {
    if (!user) return false;

    // صاحب المنشأة له صلاحيات كاملة
    if (user.role === "owner" || user.permissions?.includes(PERMISSIONS.ALL)) {
        return true;
    }

    // التحقق من الصلاحيات المطلوبة لكل فئة إعدادات
    const categoryPermissions = {
        general: [PERMISSIONS.SETTINGS_ORGANIZATION], // فقط صاحب المنشأة والمدير
        business: [PERMISSIONS.SETTINGS_ORGANIZATION], // فقط صاحب المنشأة والمدير
        notifications: [PERMISSIONS.SETTINGS_NOTIFICATIONS], // جميع المستخدمين يمكنهم تعديل إشعاراتهم
        inventory: [PERMISSIONS.SETTINGS, PERMISSIONS.INVENTORY],
        appearance: [PERMISSIONS.SETTINGS],
        security: [PERMISSIONS.SETTINGS],
        backup: [PERMISSIONS.SETTINGS],
        advanced: [PERMISSIONS.SETTINGS],
        reports: [PERMISSIONS.SETTINGS, PERMISSIONS.REPORTS],
        users: [PERMISSIONS.SETTINGS, PERMISSIONS.USERS],
    };

    const requiredPermissions = categoryPermissions[category] || [
        PERMISSIONS.SETTINGS,
    ];
    return checkPermissions(user, requiredPermissions);
};

// دالة للتحقق من صلاحيات التعديل
export const checkEditPermission = (user, path) => {
    if (!user) return false;

    // صاحب المنشأة له صلاحيات كاملة
    if (user.role === "owner" || user.permissions?.includes(PERMISSIONS.ALL)) {
        return true;
    }

    // التحقق من الصلاحيات حسب المسار
    if (path.includes("security") || path.includes("users")) {
        return checkPermissions(user, [
            PERMISSIONS.SETTINGS,
            PERMISSIONS.USERS,
        ]);
    }

    if (path.includes("inventory")) {
        return checkPermissions(user, [
            PERMISSIONS.SETTINGS,
            PERMISSIONS.INVENTORY,
        ]);
    }

    if (path.includes("reports")) {
        return checkPermissions(user, [
            PERMISSIONS.SETTINGS,
            PERMISSIONS.REPORTS,
        ]);
    }

    return checkPermission(user, PERMISSIONS.SETTINGS);
};

// دالة للتحقق من صلاحيات تعديل حقول محددة في الإعدادات
export const checkSettingsFieldPermission = (user, category, field) => {
    if (!user) return false;

    // صاحب المنشأة له صلاحيات كاملة
    if (user.role === "owner" || user.permissions?.includes(PERMISSIONS.ALL)) {
        return true;
    }

    // الحقول المحمية التي تحتاج صلاحيات خاصة
    const protectedFields = {
        general: {
            systemName: [PERMISSIONS.SETTINGS_ORGANIZATION],
            language: [], // اللغة متاحة للجميع
            timezone: [PERMISSIONS.SETTINGS_ORGANIZATION],
            currency: [PERMISSIONS.SETTINGS_ORGANIZATION],
        },
        business: {
            businessName: [PERMISSIONS.SETTINGS_ORGANIZATION],
            businessType: [PERMISSIONS.SETTINGS_ORGANIZATION],
            taxRate: [PERMISSIONS.SETTINGS_ORGANIZATION],
            serviceCharge: [PERMISSIONS.SETTINGS_ORGANIZATION],
        },
        notifications: {
            emailNotifications: [PERMISSIONS.SETTINGS_NOTIFICATIONS],
            smsNotifications: [PERMISSIONS.SETTINGS_NOTIFICATIONS],
            pushNotifications: [PERMISSIONS.SETTINGS_NOTIFICATIONS],
        },
    };

    // التحقق من الحقول المحمية
    const categoryFields = protectedFields[category];
    if (categoryFields && categoryFields[field]) {
        const requiredPermissions = categoryFields[field];
        return checkPermissions(user, requiredPermissions);
    }

    // الحقول الأخرى تحتاج صلاحيات الإعدادات العامة
    return checkPermission(user, PERMISSIONS.SETTINGS);
};

// دالة للحصول على الأدوار المتاحة
export const getAvailableRoles = async (organizationId) => {
    try {
        const userSettings = await Settings.findOne({
            organization: organizationId,
            category: "users",
        });

        if (userSettings && userSettings.settings.roles) {
            return userSettings.settings.roles;
        }

        // إرجاع الأدوار الافتراضية إذا لم يتم العثور على إعدادات
        return Object.entries(DEFAULT_ROLES).map(([id, role]) => ({
            id,
            ...role,
        }));
    } catch (error) {
        Logger.error("Error getting available roles", {
            error: error.message,
            organizationId,
        });
        return Object.entries(DEFAULT_ROLES).map(([id, role]) => ({
            id,
            ...role,
        }));
    }
};

// دالة لإنشاء صلاحيات افتراضية للمستخدم الجديد
export const createDefaultUserPermissions = (role) => {
    const defaultRole = DEFAULT_ROLES[role];
    return defaultRole ? defaultRole.permissions : [];
};

// دالة للتحقق من صلاحيات الوصول للصفحة
export const checkPageAccess = (user, page) => {
    if (!user) return false;

    // صاحب المنشأة له صلاحيات كاملة
    if (user.role === "owner" || user.permissions?.includes(PERMISSIONS.ALL)) {
        return true;
    }

    // تعريف صلاحيات الصفحات
    const pagePermissions = {
        dashboard: [PERMISSIONS.DASHBOARD],
        sessions: [PERMISSIONS.PLAYSTATION, PERMISSIONS.COMPUTER],
        orders: [PERMISSIONS.CAFE, PERMISSIONS.MENU],
        bills: [PERMISSIONS.BILLING],
        inventory: [PERMISSIONS.INVENTORY],
        costs: [PERMISSIONS.COSTS],
        reports: [PERMISSIONS.REPORTS],
        users: [PERMISSIONS.USERS],
        settings: [PERMISSIONS.SETTINGS],
    };

    const requiredPermissions = pagePermissions[page] || [
        PERMISSIONS.DASHBOARD,
    ];
    return checkPermissions(user, requiredPermissions);
};

// دالة لتحديث صلاحيات المستخدم
export const updateUserPermissions = async (
    userId,
    newPermissions,
    organizationId
) => {
    try {
        // هنا يمكن إضافة منطق لتحديث صلاحيات المستخدم في قاعدة البيانات
        Logger.info("User permissions updated", {
            userId,
            newPermissions,
            organizationId,
        });

        return true;
    } catch (error) {
        Logger.error("Error updating user permissions", {
            error: error.message,
            userId,
            organizationId,
        });
        return false;
    }
};

// دالة للتحقق من صلاحيات العملية
export const checkActionPermission = (user, action) => {
    if (!user) return false;

    // صاحب المنشأة له صلاحيات كاملة
    if (user.role === "owner" || user.permissions?.includes(PERMISSIONS.ALL)) {
        return true;
    }

    // تعريف صلاحيات العمليات
    const actionPermissions = {
        "create-session": [PERMISSIONS.PLAYSTATION, PERMISSIONS.COMPUTER],
        "end-session": [PERMISSIONS.PLAYSTATION, PERMISSIONS.COMPUTER],
        "create-order": [PERMISSIONS.CAFE, PERMISSIONS.MENU],
        "update-order": [PERMISSIONS.CAFE, PERMISSIONS.MENU],
        "create-bill": [PERMISSIONS.BILLING],
        "update-bill": [PERMISSIONS.BILLING],
        "add-payment": [PERMISSIONS.BILLING],
        "create-inventory-item": [PERMISSIONS.INVENTORY],
        "update-inventory-item": [PERMISSIONS.INVENTORY],
        "create-cost": [PERMISSIONS.COSTS],
        "update-cost": [PERMISSIONS.COSTS],
        "create-user": [PERMISSIONS.USERS],
        "update-user": [PERMISSIONS.USERS],
        "delete-user": [PERMISSIONS.USERS],
        "export-report": [PERMISSIONS.REPORTS],
        "view-settings": [PERMISSIONS.SETTINGS],
        "update-settings": [PERMISSIONS.SETTINGS],
    };

    const requiredPermissions = actionPermissions[action] || [
        PERMISSIONS.DASHBOARD,
    ];
    return checkPermissions(user, requiredPermissions);
};

export default {
    PERMISSIONS,
    DEFAULT_ROLES,
    checkPermission,
    checkPermissions,
    getUserPermissionsFromSettings,
    checkSettingsPermission,
    checkEditPermission,
    getAvailableRoles,
    createDefaultUserPermissions,
    checkPageAccess,
    updateUserPermissions,
    checkActionPermission,
};
