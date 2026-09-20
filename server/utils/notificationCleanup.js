import Logger from "../middleware/logger.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";
import Notification from "../models/Notification.js";

const NOTIFICATION_RETENTION_MS = 24 * 60 * 60 * 1000;
const CHUNK_SIZE = 1000;
const MAX_ITERATIONS = 50;

/**
 * لماذا كانت الإشعارات تُحذف محلياً فقط؟
 * الـ cleanup القديم كان deleteMany على موديل الـ local فقط:
 *  - عمليات الحذف الجماعي لا تُطلق sync middleware (مصمم هكذا)
 *  - ولا يوجد أي استدعاء لـ Atlas
 * فكانت أطلس تكبر للأبد.
 *
 * الآن بنفس نمط auditCleanup (دفاع مزدوج):
 *  1. فهرس TTL على createdAt في القاعدتين — مونجو نفسه يحذف المنتهي.
 *  2. حذف مباشر مجدول بمقاطع 1000 حتى 10000 لكل قاعدة لكل تشغيل.
 * بلا tombstones عمداً: الإشعارات بيانات مؤقتة وعودة صف قديم غير مؤذية
 * وتُحذف ذاتياً (نفس قرار auditlogs).
 */

async function ensureNotificationsTtlIndex(db, label) {
    try {
        await db.collection("notifications").createIndex(
            { createdAt: 1 },
            { expireAfterSeconds: 24 * 60 * 60 }
        );
    } catch (e) {
        // Index already exists (or equivalent) — not fatal.
        Logger.debug(`notificationCleanup: TTL ensure on ${label}: ${e.message}`);
    }
}

async function purgeOneDb(db, label, maxTotal) {
    const coll = db.collection("notifications");
    await ensureNotificationsTtlIndex(db, label);

    let deleted = 0;
    let iterations = 0;
    for (;;) {
        if (deleted >= maxTotal || iterations >= MAX_ITERATIONS) break;
        iterations++;
        const cutoff = new Date(Date.now() - NOTIFICATION_RETENTION_MS);
        const remaining = Math.min(CHUNK_SIZE, maxTotal - deleted);
        let batch = [];
        try {
            batch = await coll
                .find({ createdAt: { $lt: cutoff } }, { projection: { _id: 1 } })
                .sort({ _id: 1 })
                .limit(remaining)
                .toArray();
        } catch (e) {
            Logger.warn(`notificationCleanup: find failed on ${label}: ${e.message}`);
            break;
        }
        if (!batch.length) break;

        try {
            const r = await coll.deleteMany({ _id: { $in: batch.map((d) => d._id) } });
            const n = r.deletedCount || 0;
            deleted += n;
            if (n < batch.length) break; // rest vanished (TTL race) — stop spinning
        } catch (e) {
            Logger.warn(`notificationCleanup: delete failed on ${label}: ${e.message}`);
            break;
        }
        if (batch.length < remaining) break; // drained
    }
    return deleted;
}

/**
 * تنظيف الإشعارات الأقدم من 24 ساعة من اللوكال + أطلس.
 * (الاسم القديم محفوظ للتوافق مع المجدول)
 */
export const cleanupOldNotifications = async ({ maxDeletedPerDb = 10000 } = {}) => {
    const started = Date.now();
    Logger.info("🧹 notificationCleanup: purging notifications older than 24h (Local + Atlas)...");

    let localDeleted = 0;
    try {
        const localConn = dualDatabaseManager.getLocalConnection();
        if (localConn?.db) {
            localDeleted = await purgeOneDb(localConn.db, "Local", maxDeletedPerDb);
        } else {
            // Fallback: mongoose model (local only) — better than nothing
            const cutoff = new Date(Date.now() - NOTIFICATION_RETENTION_MS);
            const result = await Notification.deleteMany({ createdAt: { $lt: cutoff } });
            localDeleted = result.deletedCount || 0;
        }
    } catch (e) {
        Logger.warn(`notificationCleanup: Local failed: ${e.message}`);
    }

    let atlasDeleted = 0;
    try {
        const atlasConn = dualDatabaseManager.getAtlasConnection();
        if (atlasConn && atlasConn.readyState === 1 && atlasConn.db) {
            atlasDeleted = await purgeOneDb(atlasConn.db, "Atlas", maxDeletedPerDb);
        } else {
            Logger.warn("notificationCleanup: Atlas unavailable — TTL on Atlas + next run cover it");
        }
    } catch (e) {
        Logger.warn(`notificationCleanup: Atlas failed: ${e.message}`);
    }

    Logger.info(
        `✅ notificationCleanup done in ${Date.now() - started}ms — Local deleted: ${localDeleted}, Atlas deleted: ${atlasDeleted}`
    );
    return { local: localDeleted, atlas: atlasDeleted };
};

/**
 * التنظيف المجدول (every 15 min via scheduler).
 * يُرجع العدد الإجمالي للتوافق مع المتصلين القدامى.
 */
export const runCleanup = async () => {
    try {
        const { local = 0, atlas = 0 } = await cleanupOldNotifications();
        return local + atlas;
    } catch (error) {
        throw error;
    }
};
