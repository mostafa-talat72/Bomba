import Notification from "../models/Notification.js";

/**
 * حذف الإشعارات التي مر عليها أسبوع أو أكثر
 */
export const cleanupOldNotifications = async () => {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const result = await Notification.deleteMany({
            createdAt: { $lt: oneWeekAgo },
        });

        console.log(
            `✅ تم حذف ${result.deletedCount} إشعار قديم (أسبوع أو أكثر)`
        );
        return result.deletedCount;
    } catch (error) {
        console.error("❌ خطأ في حذف الإشعارات القديمة:", error);
        throw error;
    }
};

/**
 * حذف الإشعارات المقروءة التي مر عليها أسبوع أو أكثر
 */
export const cleanupOldReadNotifications = async () => {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const result = await Notification.deleteMany({
            createdAt: { $lt: oneWeekAgo },
            "readBy.0": { $exists: true }, // إشعارات مقروءة
        });

        console.log(
            `✅ تم حذف ${result.deletedCount} إشعار مقروء قديم (أسبوع أو أكثر)`
        );
        return result.deletedCount;
    } catch (error) {
        console.error("❌ خطأ في حذف الإشعارات المقروءة القديمة:", error);
        throw error;
    }
};

/**
 * حذف الإشعارات غير المقروءة التي مر عليها أسبوعين أو أكثر
 */
export const cleanupOldUnreadNotifications = async () => {
    try {
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const result = await Notification.deleteMany({
            createdAt: { $lt: twoWeeksAgo },
            readBy: { $size: 0 }, // إشعارات غير مقروءة
        });

        console.log(
            `✅ تم حذف ${result.deletedCount} إشعار غير مقروء قديم (أسبوعين أو أكثر)`
        );
        return result.deletedCount;
    } catch (error) {
        console.error("❌ خطأ في حذف الإشعارات غير المقروءة القديمة:", error);
        throw error;
    }
};

/**
 * تشغيل عملية التنظيف الكاملة
 */
export const runCleanup = async () => {
    try {
        console.log("🔄 بدء عملية تنظيف الإشعارات القديمة...");

        const readDeleted = await cleanupOldReadNotifications();
        const unreadDeleted = await cleanupOldUnreadNotifications();

        const totalDeleted = readDeleted + unreadDeleted;
        console.log(
            `✅ تم الانتهاء من تنظيف الإشعارات. إجمالي المحذوف: ${totalDeleted}`
        );

        return totalDeleted;
    } catch (error) {
        console.error("❌ خطأ في عملية تنظيف الإشعارات:", error);
        throw error;
    }
};
