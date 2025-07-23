import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Logger from "../middleware/logger.js";

class NotificationService {
    // إنشاء إشعار جديد
    static async createNotification(notificationData, user) {
        try {
            const notification = new Notification({
                ...notificationData,
                organization: user.organization,
            });
            await notification.save();

            Logger.info("Notification created:", {
                id: notification._id,
                title: notification.title,
                category: notification.category,
                targetRoles: notification.targetRoles,
            });

            return notification;
        } catch (error) {
            Logger.error("Error creating notification:", error);
            throw error;
        }
    }

    // إنشاء إشعار للجلسات
    static async createSessionNotification(type, session, createdBy) {
        try {
            const notification = Notification.createSessionNotification(
                type,
                session,
                createdBy
            );
            if (notification) {
                await notification.save();

                Logger.info("Session notification created:", {
                    type,
                    sessionId: session._id,
                    deviceName: session.deviceName,
                });

                return notification;
            }
            return null;
        } catch (error) {
            Logger.error("Error creating session notification:", error);
            throw error;
        }
    }

    // إنشاء إشعار للطلبات
    static async createOrderNotification(type, order, createdBy) {
        try {
            const notification = Notification.createOrderNotification(
                type,
                order,
                createdBy
            );
            if (notification) {
                await notification.save();

                Logger.info("Order notification created:", {
                    type,
                    orderId: order._id,
                    orderNumber: order.orderNumber,
                });

                return notification;
            }
            return null;
        } catch (error) {
            Logger.error("Error creating order notification:", error);
            throw error;
        }
    }

    // إنشاء إشعار للمخزون
    static async createInventoryNotification(type, item, createdBy) {
        try {
            const notification = Notification.createInventoryNotification(
                type,
                item,
                createdBy
            );
            if (notification) {
                await notification.save();

                Logger.info("Inventory notification created:", {
                    type,
                    itemId: item._id,
                    itemName: item.name,
                });

                return notification;
            }
            return null;
        } catch (error) {
            Logger.error("Error creating inventory notification:", error);
            throw error;
        }
    }

    // إنشاء إشعار للفواتير
    static async createBillingNotification(type, bill, createdBy) {
        try {
            const notification = Notification.createBillingNotification(
                type,
                bill,
                createdBy
            );
            if (notification) {
                await notification.save();

                Logger.info("Billing notification created:", {
                    type,
                    billId: bill._id,
                    billNumber: bill.billNumber,
                });

                return notification;
            }
            return null;
        } catch (error) {
            Logger.error("Error creating billing notification:", error);
            throw error;
        }
    }

    // الحصول على إشعارات المستخدم
    static async getUserNotifications(userId, user, options = {}) {
        try {
            const notifications = await Notification.getForUser(userId, user, {
                ...options,
                organization: user.organization,
            });
            return notifications;
        } catch (error) {
            Logger.error("Error getting user notifications:", error);
            throw error;
        }
    }

    // الحصول على عدد الإشعارات غير المقروءة
    static async getUnreadCount(userId, user) {
        try {
            const count = await Notification.countDocuments({
                isActive: true,
                organization: user.organization,
                "readBy.user": { $ne: userId },
                $or: [
                    { targetUsers: userId },
                    { targetRoles: "all" },
                    { targetRoles: user.role },
                    { targetPermissions: { $in: user.permissions } },
                ],
            });
            return count;
        } catch (error) {
            Logger.error("Error getting unread count:", error);
            throw error;
        }
    }

    // الحصول على إشعارات المستخدم مع تصفية محسنة حسب الصلاحيات
    static async getUserNotificationsWithPermissionFilter(
        userId,
        user,
        options = {}
    ) {
        try {
            // إنشاء استعلام أساسي
            const baseQuery = {
                isActive: true,
                organization: user.organization,
                $or: [
                    { targetUsers: userId },
                    { targetRoles: "all" },
                    { targetRoles: user.role },
                ],
            };

            // إضافة تصفية الصلاحيات إذا كان المستخدم لديه صلاحيات محددة
            if (user.permissions && user.permissions.length > 0) {
                if (user.permissions.includes("all")) {
                    // إذا كان لديه جميع الصلاحيات، لا نحتاج لتصفية إضافية
                } else {
                    // إضافة الصلاحيات المطلوبة للاستعلام
                    baseQuery.$or.push({
                        targetPermissions: { $in: user.permissions },
                    });
                }
            }

            // إضافة تصفية الفئة إذا تم تحديدها
            if (options.category) {
                baseQuery.category = options.category;
            }

            // إضافة تصفية الإشعارات غير المقروءة
            if (options.unreadOnly) {
                baseQuery["readBy.user"] = { $ne: userId };
            }

            // تنفيذ الاستعلام
            const notifications = await Notification.find(baseQuery)
                .sort({ createdAt: -1 })
                .limit(options.limit || 50)
                .populate("createdBy", "name")
                .populate("targetUsers", "name");

            return notifications;
        } catch (error) {
            Logger.error(
                "Error getting user notifications with permission filter:",
                error
            );
            throw error;
        }
    }

    // تحديد إشعار كمقروء
    static async markAsRead(notificationId, userId) {
        try {
            const notification = await Notification.findById(notificationId);
            if (!notification) {
                throw new Error("Notification not found");
            }

            await notification.markAsRead(userId);

            Logger.info("Notification marked as read:", {
                notificationId,
                userId,
            });

            return notification;
        } catch (error) {
            Logger.error("Error marking notification as read:", error);
            throw error;
        }
    }

    // تحديد جميع الإشعارات كمقروءة
    static async markAllAsRead(userId) {
        try {
            const result = await Notification.markAllAsRead(userId);

            Logger.info("All notifications marked as read:", {
                userId,
                modifiedCount: result.modifiedCount,
            });

            return result;
        } catch (error) {
            Logger.error("Error marking all notifications as read:", error);
            throw error;
        }
    }

    // حذف إشعار
    static async deleteNotification(notificationId, userId) {
        try {
            const notification = await Notification.findById(notificationId);
            if (!notification) {
                throw new Error("Notification not found");
            }

            // التحقق من الصلاحيات (فقط منشئ الإشعار أو المدير يمكنه حذفه)
            if (notification.createdBy.toString() !== userId.toString()) {
                const user = await User.findById(userId);
                if (!user || user.role !== "admin") {
                    throw new Error("Unauthorized to delete this notification");
                }
            }

            await notification.deleteOne();

            Logger.info("Notification deleted:", {
                notificationId,
                deletedBy: userId,
            });

            return true;
        } catch (error) {
            Logger.error("Error deleting notification:", error);
            throw error;
        }
    }

    // تنظيف الإشعارات المنتهية الصلاحية
    static async cleanExpiredNotifications() {
        try {
            const result = await Notification.cleanExpired();

            Logger.info("Expired notifications cleaned:", {
                deletedCount: result.deletedCount,
            });

            return result;
        } catch (error) {
            Logger.error("Error cleaning expired notifications:", error);
            throw error;
        }
    }

    // إرسال إشعار لجميع المستخدمين
    static async broadcastNotification(notificationData) {
        try {
            const users = await User.find({ status: "active" });
            const notifications = [];

            for (const user of users) {
                const notification = new Notification({
                    ...notificationData,
                    targetUsers: [user._id],
                    createdBy: notificationData.createdBy,
                });
                notifications.push(notification);
            }

            if (notifications.length > 0) {
                await Notification.insertMany(notifications);

                Logger.info("Broadcast notification sent:", {
                    title: notificationData.title,
                    recipientCount: notifications.length,
                });
            }

            return notifications;
        } catch (error) {
            Logger.error("Error broadcasting notification:", error);
            throw error;
        }
    }

    // إرسال إشعار لمستخدم محدد
    static async sendToUser(userId, notificationData) {
        try {
            const notification = new Notification({
                ...notificationData,
                targetUsers: [userId],
            });
            await notification.save();

            Logger.info("Notification sent to user:", {
                userId,
                title: notification.title,
            });

            return notification;
        } catch (error) {
            Logger.error("Error sending notification to user:", error);
            throw error;
        }
    }

    // إرسال إشعار لدور محدد
    static async sendToRole(role, notificationData) {
        try {
            const notification = new Notification({
                ...notificationData,
                targetRoles: [role],
            });
            await notification.save();

            Logger.info("Notification sent to role:", {
                role,
                title: notification.title,
            });

            return notification;
        } catch (error) {
            Logger.error("Error sending notification to role:", error);
            throw error;
        }
    }

    // إرسال إشعار لمن لديهم صلاحية محددة
    static async sendToPermission(permission, notificationData) {
        try {
            const notification = new Notification({
                ...notificationData,
                targetPermissions: [permission],
            });
            await notification.save();

            Logger.info("Notification sent to permission:", {
                permission,
                title: notification.title,
            });

            return notification;
        } catch (error) {
            Logger.error("Error sending notification to permission:", error);
            throw error;
        }
    }

    // الحصول على إحصائيات الإشعارات حسب الصلاحيات
    static async getNotificationStatsWithPermissions(userId, user) {
        try {
            const baseQuery = {
                isActive: true,
                organization: user.organization,
                $or: [
                    { targetUsers: userId },
                    { targetRoles: "all" },
                    { targetRoles: user.role },
                ],
            };

            // إضافة تصفية الصلاحيات
            if (
                user.permissions &&
                user.permissions.length > 0 &&
                !user.permissions.includes("all")
            ) {
                baseQuery.$or.push({
                    targetPermissions: { $in: user.permissions },
                });
            }

            const [total, unread, byCategory, byPriority] = await Promise.all([
                Notification.countDocuments(baseQuery),
                Notification.countDocuments({
                    ...baseQuery,
                    "readBy.user": { $ne: userId },
                }),
                Notification.aggregate([
                    { $match: baseQuery },
                    { $group: { _id: "$category", count: { $sum: 1 } } },
                ]),
                Notification.aggregate([
                    { $match: baseQuery },
                    { $group: { _id: "$priority", count: { $sum: 1 } } },
                ]),
            ]);

            return {
                total,
                unread,
                byCategory: byCategory.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                byPriority: byPriority.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
            };
        } catch (error) {
            Logger.error(
                "Error getting notification stats with permissions:",
                error
            );
            throw error;
        }
    }
}

export default NotificationService;
