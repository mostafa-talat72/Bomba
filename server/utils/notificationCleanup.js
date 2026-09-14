import Notification from "../models/Notification.js";

const NOTIFICATION_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * حذف جميع الإشعارات التي مر عليها 24 ساعة أو أكثر (مقروءة وغير مقروءة)
 */
export const cleanupOldNotifications = async () => {
    try {
        const cutoff = new Date(Date.now() - NOTIFICATION_RETENTION_MS);
        const result = await Notification.deleteMany({
            createdAt: { $lt: cutoff },
        });
        return result.deletedCount;
    } catch (error) {
        throw error;
    }
};

/**
 * تشغيل عملية التنظيف الكاملة
 * الحذف عبر Mongoose يمر بالـ sync middleware (delete op يُحال إلى Atlas/LAN)،
 * فلا حاجة لـ tombstones: الإشعارات بيانات مؤقتة، وأي إحياء عابر يصحح تلقائياً.
 */
export const runCleanup = async () => {
    try {
        const totalDeleted = await cleanupOldNotifications();
        return totalDeleted;
    } catch (error) {
        throw error;
    }
};