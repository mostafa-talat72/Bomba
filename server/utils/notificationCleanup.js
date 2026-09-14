import Notification from "../models/Notification.js";
import { createTombstones } from "./tombstoneHelper.js";

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

        return result.deletedCount;
    } catch (error) {
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

        return result.deletedCount;
    } catch (error) {
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

        return result.deletedCount;
    } catch (error) {
        throw error;
    }
};

/**
 * تشغيل عملية التنظيف الكاملة
 * Records tombstones for the removed notifications (grouped by organization)
 * so polling/fullSync never resurrect them from Atlas on any device.
 */
export const runCleanup = async () => {
    try {
        // Snapshot BEFORE deletion (same filters as the two cleaners below).
        let olds = [];
        try {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
            olds = await Notification.find(
                {
                    $or: [
                        { createdAt: { $lt: oneWeekAgo }, "readBy.0": { $exists: true } },
                        { createdAt: { $lt: twoWeeksAgo }, readBy: { $size: 0 } },
                    ],
                },
                { _id: 1, organization: 1 }
            ).lean();
        } catch {}
        // Tombstones FIRST (before deletes): a crash mid-cleanup still
        // converges to deleted via polling instead of resurrecting.
        try {
            const byOrg = new Map();
            for (const d of olds) {
                const org = d.organization?._id || d.organization;
                if (!org) continue;
                const k = org.toString();
                if (!byOrg.has(k)) byOrg.set(k, { org, ids: [] });
                byOrg.get(k).ids.push(d._id);
            }
            for (const { org, ids } of byOrg.values()) {
                if (ids.length) await createTombstones("notifications", ids, org, null);
            }
        } catch {}

        const totalDeleted =
            (await cleanupOldReadNotifications()) + (await cleanupOldUnreadNotifications());

        return totalDeleted;
    } catch (error) {
        throw error;
    }
};
