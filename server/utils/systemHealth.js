import fs from "fs";
import Organization from "../models/Organization.js";
import Notification from "../models/Notification.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";
import syncQueueManager from "../services/sync/syncQueueManager.js";
import { getLastBackupStatus, getBackupDir } from "./backup.js";
import Logger from "../middleware/logger.js";

// Thresholds
const DISK_FREE_GB_MIN = 2;
const BACKUP_MAX_AGE_MS = 3 * 60 * 60 * 1000; // 3h
const QUEUE_SIZE_MAX = 1000;
const DEDUP_WINDOWS = {
    disk: 6 * 60 * 60 * 1000,
    mongo: 60 * 60 * 1000,
    backup: 6 * 60 * 60 * 1000,
    queue: 60 * 60 * 1000,
};

let running = false;

const raiseOnce = async (org, key, title, message, priority = "high") => {
    try {
        const orgId = org?._id || org;
        if (!orgId) return;
        const since = new Date(Date.now() - (DEDUP_WINDOWS[key] || DEDUP_WINDOWS.mongo));
        const existing = await Notification.exists({
            organization: orgId,
            category: "system",
            "metadata.healthKey": key,
            createdAt: { $gte: since },
        });
        if (existing) return;
        const ownerId = org?.owner?._id || org?.owner || null;
        if (!ownerId) return;
        await Notification.create({
            title,
            message,
            type: key === "mongo" ? "error" : "warning",
            category: "system",
            priority,
            targetRoles: ["admin"],
            metadata: { healthKey: key },
            createdBy: ownerId,
            organization: orgId,
        });
        Logger.warn(`[health] alert raised (${key}): ${title}`);
    } catch (e) {
        Logger.warn(`[health] alert failed (${key}): ${e.message}`);
    }
};

const diskFreeGB = () => {
    try {
        if (typeof fs.statfsSync !== "function") return null;
        const dir = process.cwd();
        const st = fs.statfsSync(dir);
        const blockSize = st.bsize || 4096;
        const free = (st.bavail ?? st.bfree ?? 0) * blockSize;
        return free / (1024 * 1024 * 1024);
    } catch {
        return null;
    }
};

/**
 * Periodic system health check (every 5 min via scheduler).
 * Raises admin 'system' notifications on: low disk, Mongo down,
 * stale backups, oversized sync queue. Deduped per key.
 */
export const runSystemHealthCheck = async () => {
    if (running) return;
    running = true;
    try {
        const orgs = await Organization.find({}).select("_id owner").lean();
        if (orgs.length === 0) return;

        // Disk (device-global, same value for all orgs)
        const freeGB = diskFreeGB();
        const diskOk = freeGB === null ? true : freeGB >= DISK_FREE_GB_MIN;

        // Mongo local connectivity
        let mongoOk = true;
        try {
            const status = dualDatabaseManager.getConnectionStatus?.();
            const local = status?.local;
            mongoOk = !local || local.connected === true || local.readyState === 1 || local.status === "connected";
        } catch {
            mongoOk = true; // fail-open: don't alert on introspection errors
        }

        // Backup freshness
        let backupAgeMs = 0;
        try {
            const last = getLastBackupStatus?.();
            backupAgeMs = last?.at ? Date.now() - new Date(last.at).getTime() : Infinity;
        } catch {}
        const backupOk = backupAgeMs <= BACKUP_MAX_AGE_MS;

        // Sync queue
        let queueSize = 0;
        try {
            queueSize = syncQueueManager.size?.() || 0;
        } catch {}
        const queueOk = queueSize <= QUEUE_SIZE_MAX;

        for (const org of orgs) {
            if (!diskOk) {
                await raiseOnce(org, "disk", "مساحة القرص منخفضة", `المساحة الحرة ${(freeGB ?? 0).toFixed(1)}GB — أقل من ${DISK_FREE_GB_MIN}GB. احذف نسخاً قديمة أو وسّع القرص.`);
            }
            if (!mongoOk) {
                await raiseOnce(org, "mongo", "قاعدة البيانات المحلية غير متصلة", "تعذر الاتصال بـ MongoDB المحلية. تحقق من خدمة mongod.", "urgent");
            }
            if (!backupOk) {
                await raiseOnce(org, "backup", "النسخ الاحتياطي متوقف", "لم تتم أي نسخة ناجحة منذ أكثر من 3 ساعات. تحقق من المجدول ومسار الحفظ.");
            }
            if (!queueOk) {
                await raiseOnce(org, "queue", "طابور المزامنة متراكم", `عدد العمليات المعلقة ${queueSize} — تحقق من اتصال Atlas.`);
            }
        }
    } catch (e) {
        Logger.warn(`[health] check failed: ${e.message}`);
    } finally {
        running = false;
    }
};

let intervalId = null;
export const scheduleSystemHealthChecks = (intervalMs = 5 * 60 * 1000) => {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
        runSystemHealthCheck().catch(() => {});
    }, intervalMs);
    if (intervalId.unref) intervalId.unref();
    Logger.info("✅ System health checks scheduled: every 5 minutes");
    return intervalId;
};

export const getBackupDirSafe = async () => {
    try {
        return await getBackupDir();
    } catch {
        return null;
    }
};

export default { runSystemHealthCheck, scheduleSystemHealthChecks };
