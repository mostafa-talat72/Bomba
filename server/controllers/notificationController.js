import NotificationService from "../services/notificationService.js";
import Logger from "../middleware/logger.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getUserNotifications = async (req, res) => {
    try {
        const { category, unreadOnly, limit } = req.query;
        const options = {
            category: category || null,
            unreadOnly: unreadOnly === "true",
            limit: limit ? parseInt(limit) : 50,
        };

        // Ensure user object includes createdAt field for notification filtering
        const userWithCreatedAt = await User.findById(req.user._id).select(
            "+createdAt"
        );
        const user = userWithCreatedAt || req.user;

        const notifications =
            await NotificationService.getUserNotificationsWithPermissionFilter(
                req.user._id,
                user,
                options
            );

        res.json({
            success: true,
            count: notifications.length,
            data: notifications,
        });
    } catch (error) {
        Logger.error("getUserNotifications error:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الإشعارات",
            error: error.message,
        });
    }
};

// @desc    Get notification stats
// @route   GET /api/notifications/stats
// @access  Private
export const getNotificationStats = async (req, res) => {
    try {
        // Ensure user object includes createdAt field for notification filtering
        const userWithCreatedAt = await User.findById(req.user._id).select(
            "+createdAt"
        );
        const user = userWithCreatedAt || req.user;

        const stats =
            await NotificationService.getNotificationStatsWithPermissions(
                req.user._id,
                user
            );

        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        Logger.error("getNotificationStats error:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في جلب إحصائيات الإشعارات",
            error: error.message,
        });
    }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await NotificationService.markAsRead(
            id,
            req.user._id
        );

        res.json({
            success: true,
            message: "تم تحديد الإشعار كمقروء",
            data: notification,
        });
    } catch (error) {
        Logger.error("markAsRead error:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في تحديد الإشعار كمقروء",
            error: error.message,
        });
    }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res) => {
    try {
        const result = await NotificationService.markAllAsRead(req.user._id);

        res.json({
            success: true,
            message: "تم تحديد جميع الإشعارات كمقروءة",
            data: {
                modifiedCount: result.modifiedCount,
            },
        });
    } catch (error) {
        Logger.error("markAllAsRead error:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في تحديد الإشعارات كمقروءة",
            error: error.message,
        });
    }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        await NotificationService.deleteNotification(id, req.user._id);

        res.json({
            success: true,
            message: "تم حذف الإشعار بنجاح",
        });
    } catch (error) {
        Logger.error("deleteNotification error:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في حذف الإشعار",
            error: error.message,
        });
    }
};

// @desc    Create custom notification (Admin only)
// @route   POST /api/notifications
// @access  Private (Admin only)
export const createNotification = async (req, res) => {
    try {
        const {
            title,
            message,
            type,
            category,
            priority,
            targetRoles,
            targetPermissions,
            targetUsers,
            actionRequired,
            actionUrl,
            actionText,
            expiresAt,
        } = req.body;

        // التحقق من الحقول المطلوبة
        if (!title || !message || !category) {
            return res.status(400).json({
                success: false,
                message: "العنوان والمحتوى والفئة مطلوبة",
            });
        }

        const notificationData = {
            title,
            message,
            type: type || "info",
            category,
            priority: priority || "medium",
            targetRoles: targetRoles || ["all"],
            targetPermissions: targetPermissions || [],
            targetUsers: targetUsers || [],
            actionRequired: actionRequired || false,
            actionUrl: actionUrl || null,
            actionText: actionText || null,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            createdBy: req.user._id,
        };

        const notification = await NotificationService.createNotification(
            notificationData
        );

        res.status(201).json({
            success: true,
            message: "تم إنشاء الإشعار بنجاح",
            data: notification,
        });
    } catch (error) {
        Logger.error("createNotification error:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في إنشاء الإشعار",
            error: error.message,
        });
    }
};

// @desc    Send notification to role
// @route   POST /api/notifications/role/:role
// @access  Private (Admin only)
export const sendToRole = async (req, res) => {
    try {
        const { role } = req.params;
        const {
            title,
            message,
            type,
            category,
            priority,
            actionRequired,
            actionUrl,
            actionText,
        } = req.body;

        if (!title || !message || !category) {
            return res.status(400).json({
                success: false,
                message: "العنوان والمحتوى والفئة مطلوبة",
            });
        }

        const notificationData = {
            title,
            message,
            type: type || "info",
            category,
            priority: priority || "medium",
            actionRequired: actionRequired || false,
            actionUrl: actionUrl || null,
            actionText: actionText || null,
            createdBy: req.user._id,
        };

        const notification = await NotificationService.sendToRole(
            role,
            notificationData
        );

        res.status(201).json({
            success: true,
            message: `تم إرسال الإشعار لدور ${role} بنجاح`,
            data: notification,
        });
    } catch (error) {
        Logger.error("sendToRole error:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في إرسال الإشعار",
            error: error.message,
        });
    }
};

// @desc    Send notification to permission
// @route   POST /api/notifications/permission/:permission
// @access  Private (Admin only)
export const sendToPermission = async (req, res) => {
    try {
        const { permission } = req.params;
        const {
            title,
            message,
            type,
            category,
            priority,
            actionRequired,
            actionUrl,
            actionText,
        } = req.body;

        if (!title || !message || !category) {
            return res.status(400).json({
                success: false,
                message: "العنوان والمحتوى والفئة مطلوبة",
            });
        }

        const notificationData = {
            title,
            message,
            type: type || "info",
            category,
            priority: priority || "medium",
            actionRequired: actionRequired || false,
            actionUrl: actionUrl || null,
            actionText: actionText || null,
            createdBy: req.user._id,
        };

        const notification = await NotificationService.sendToPermission(
            permission,
            notificationData
        );

        res.status(201).json({
            success: true,
            message: `تم إرسال الإشعار لمن لديهم صلاحية ${permission} بنجاح`,
            data: notification,
        });
    } catch (error) {
        Logger.error("sendToPermission error:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في إرسال الإشعار",
            error: error.message,
        });
    }
};

// @desc    Broadcast notification to all users
// @route   POST /api/notifications/broadcast
// @access  Private (Admin only)
export const broadcastNotification = async (req, res) => {
    try {
        const {
            title,
            message,
            type,
            category,
            priority,
            actionRequired,
            actionUrl,
            actionText,
        } = req.body;

        if (!title || !message || !category) {
            return res.status(400).json({
                success: false,
                message: "العنوان والمحتوى والفئة مطلوبة",
            });
        }

        const notificationData = {
            title,
            message,
            type: type || "info",
            category,
            priority: priority || "medium",
            actionRequired: actionRequired || false,
            actionUrl: actionUrl || null,
            actionText: actionText || null,
            createdBy: req.user._id,
        };

        const notifications = await NotificationService.broadcastNotification(
            notificationData
        );

        res.status(201).json({
            success: true,
            message: "تم إرسال الإشعار لجميع المستخدمين بنجاح",
            data: {
                count: notifications.length,
            },
        });
    } catch (error) {
        Logger.error("broadcastNotification error:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في إرسال الإشعار",
            error: error.message,
        });
    }
};

// @desc    Clean expired notifications
// @route   DELETE /api/notifications/clean-expired
// @access  Private (Admin only)
export const cleanExpiredNotifications = async (req, res) => {
    try {
        const result = await NotificationService.cleanExpiredNotifications();

        res.json({
            success: true,
            message: "تم تنظيف الإشعارات المنتهية الصلاحية",
            data: {
                deletedCount: result.deletedCount,
            },
        });
    } catch (error) {
        Logger.error("cleanExpiredNotifications error:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في تنظيف الإشعارات",
            error: error.message,
        });
    }
};

export const sendSubscriptionNotification = async (userId, message) => {
    await Notification.create({
        user: userId,
        message,
        type: "subscription",
        read: false,
        createdAt: new Date(),
    });
};
