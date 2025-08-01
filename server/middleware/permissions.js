import {
    checkPermission,
    checkPermissions,
    checkActionPermission,
    checkPageAccess,
} from "../utils/permissions.js";
import Logger from "./logger.js";

// Middleware للتحقق من صلاحية واحدة
export const requirePermission = (permission) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "يجب تسجيل الدخول أولاً",
                });
            }

            if (!checkPermission(req.user, permission)) {
                Logger.warn("Permission denied", {
                    userId: req.user._id,
                    userRole: req.user.role,
                    requiredPermission: permission,
                    path: req.path,
                });

                return res.status(403).json({
                    success: false,
                    message: "ليس لديك صلاحية للوصول لهذا المورد",
                });
            }

            next();
        } catch (error) {
            Logger.error("Error in permission middleware", {
                error: error.message,
                userId: req.user?._id,
                permission,
            });

            return res.status(500).json({
                success: false,
                message: "خطأ في التحقق من الصلاحيات",
            });
        }
    };
};

// Middleware للتحقق من صلاحيات متعددة
export const requirePermissions = (permissions) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "يجب تسجيل الدخول أولاً",
                });
            }

            if (!checkPermissions(req.user, permissions)) {
                Logger.warn("Multiple permissions denied", {
                    userId: req.user._id,
                    userRole: req.user.role,
                    requiredPermissions: permissions,
                    path: req.path,
                });

                return res.status(403).json({
                    success: false,
                    message: "ليس لديك الصلاحيات المطلوبة للوصول لهذا المورد",
                });
            }

            next();
        } catch (error) {
            Logger.error("Error in multiple permissions middleware", {
                error: error.message,
                userId: req.user?._id,
                permissions,
            });

            return res.status(500).json({
                success: false,
                message: "خطأ في التحقق من الصلاحيات",
            });
        }
    };
};

// Middleware للتحقق من صلاحيات العملية
export const requireActionPermission = (action) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "يجب تسجيل الدخول أولاً",
                });
            }

            if (!checkActionPermission(req.user, action)) {
                Logger.warn("Action permission denied", {
                    userId: req.user._id,
                    userRole: req.user.role,
                    requiredAction: action,
                    path: req.path,
                    method: req.method,
                });

                return res.status(403).json({
                    success: false,
                    message: "ليس لديك صلاحية لتنفيذ هذه العملية",
                });
            }

            next();
        } catch (error) {
            Logger.error("Error in action permission middleware", {
                error: error.message,
                userId: req.user?._id,
                action,
            });

            return res.status(500).json({
                success: false,
                message: "خطأ في التحقق من صلاحيات العملية",
            });
        }
    };
};

// Middleware للتحقق من صلاحيات الوصول للصفحة
export const requirePageAccess = (page) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "يجب تسجيل الدخول أولاً",
                });
            }

            if (!checkPageAccess(req.user, page)) {
                Logger.warn("Page access denied", {
                    userId: req.user._id,
                    userRole: req.user.role,
                    requiredPage: page,
                    path: req.path,
                });

                return res.status(403).json({
                    success: false,
                    message: "ليس لديك صلاحية للوصول لهذه الصفحة",
                });
            }

            next();
        } catch (error) {
            Logger.error("Error in page access middleware", {
                error: error.message,
                userId: req.user?._id,
                page,
            });

            return res.status(500).json({
                success: false,
                message: "خطأ في التحقق من صلاحيات الوصول للصفحة",
            });
        }
    };
};

// Middleware للتحقق من صلاحيات الإعدادات
export const requireSettingsPermission = (category) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "يجب تسجيل الدخول أولاً",
                });
            }

            // التحقق من صلاحيات الإعدادات حسب الفئة
            const categoryPermissions = {
                general: ["settings"],
                business: ["settings"],
                inventory: ["settings", "inventory"],
                notifications: ["settings"],
                appearance: ["settings"],
                security: ["settings"],
                backup: ["settings"],
                advanced: ["settings"],
                reports: ["settings", "reports"],
                users: ["settings", "users"],
            };

            const requiredPermissions = categoryPermissions[category] || [
                "settings",
            ];

            if (!checkPermissions(req.user, requiredPermissions)) {
                Logger.warn("Settings permission denied", {
                    userId: req.user._id,
                    userRole: req.user.role,
                    requiredCategory: category,
                    requiredPermissions,
                    path: req.path,
                });

                return res.status(403).json({
                    success: false,
                    message: "ليس لديك صلاحية للوصول لهذه الإعدادات",
                });
            }

            next();
        } catch (error) {
            Logger.error("Error in settings permission middleware", {
                error: error.message,
                userId: req.user?._id,
                category,
            });

            return res.status(500).json({
                success: false,
                message: "خطأ في التحقق من صلاحيات الإعدادات",
            });
        }
    };
};

// Middleware للتحقق من صلاحيات التعديل
export const requireEditPermission = (path) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "يجب تسجيل الدخول أولاً",
                });
            }

            // صاحب المنشأة له صلاحيات كاملة
            if (
                req.user.role === "owner" ||
                req.user.permissions?.includes("all")
            ) {
                return next();
            }

            // التحقق من الصلاحيات حسب المسار
            let requiredPermissions = ["settings"];

            if (path.includes("security") || path.includes("users")) {
                requiredPermissions = ["settings", "users"];
            } else if (path.includes("inventory")) {
                requiredPermissions = ["settings", "inventory"];
            } else if (path.includes("reports")) {
                requiredPermissions = ["settings", "reports"];
            }

            if (!checkPermissions(req.user, requiredPermissions)) {
                Logger.warn("Edit permission denied", {
                    userId: req.user._id,
                    userRole: req.user.role,
                    path,
                    requiredPermissions,
                    requestPath: req.path,
                });

                return res.status(403).json({
                    success: false,
                    message: "ليس لديك صلاحية لتعديل هذه الإعدادات",
                });
            }

            next();
        } catch (error) {
            Logger.error("Error in edit permission middleware", {
                error: error.message,
                userId: req.user?._id,
                path,
            });

            return res.status(500).json({
                success: false,
                message: "خطأ في التحقق من صلاحيات التعديل",
            });
        }
    };
};

// Middleware للتحقق من صلاحيات المنظمة
export const requireOrganizationAccess = () => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "يجب تسجيل الدخول أولاً",
                });
            }

            if (!req.user.organization) {
                Logger.warn("User has no organization", {
                    userId: req.user._id,
                    userEmail: req.user.email,
                });

                return res.status(400).json({
                    success: false,
                    message: "المستخدم لا ينتمي لأي منظمة",
                });
            }

            next();
        } catch (error) {
            Logger.error("Error in organization access middleware", {
                error: error.message,
                userId: req.user?._id,
            });

            return res.status(500).json({
                success: false,
                message: "خطأ في التحقق من صلاحيات المنظمة",
            });
        }
    };
};

// Middleware للتحقق من صلاحيات المالك
export const requireOwnerAccess = () => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "يجب تسجيل الدخول أولاً",
                });
            }

            if (req.user.role !== "owner") {
                Logger.warn("Owner access denied", {
                    userId: req.user._id,
                    userRole: req.user.role,
                    path: req.path,
                });

                return res.status(403).json({
                    success: false,
                    message: "هذا الإجراء متاح فقط لصاحب المنشأة",
                });
            }

            next();
        } catch (error) {
            Logger.error("Error in owner access middleware", {
                error: error.message,
                userId: req.user?._id,
            });

            return res.status(500).json({
                success: false,
                message: "خطأ في التحقق من صلاحيات المالك",
            });
        }
    };
};

// Middleware للتحقق من صلاحيات المدير أو أعلى
export const requireManagerAccess = () => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "يجب تسجيل الدخول أولاً",
                });
            }

            const allowedRoles = ["owner", "admin", "manager"];

            if (!allowedRoles.includes(req.user.role)) {
                Logger.warn("Manager access denied", {
                    userId: req.user._id,
                    userRole: req.user.role,
                    path: req.path,
                });

                return res.status(403).json({
                    success: false,
                    message: "هذا الإجراء متاح فقط للمديرين وأعلى",
                });
            }

            next();
        } catch (error) {
            Logger.error("Error in manager access middleware", {
                error: error.message,
                userId: req.user?._id,
            });

            return res.status(500).json({
                success: false,
                message: "خطأ في التحقق من صلاحيات المدير",
            });
        }
    };
};

export default {
    requirePermission,
    requirePermissions,
    requireActionPermission,
    requirePageAccess,
    requireSettingsPermission,
    requireEditPermission,
    requireOrganizationAccess,
    requireOwnerAccess,
    requireManagerAccess,
};
