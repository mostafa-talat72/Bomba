import mongoose from "mongoose";
import fs from "fs";
import { getBackupDir, getLastBackupStatus } from "./backup.js";

const DISK_WARN_MB = 1024;
const DISK_CRITICAL_MB = 300;
const BACKUP_MAX_AGE_MS = 26 * 60 * 60 * 1000; // 26h
const MEMORY_WARN_RATIO = 0.85;

const freeMBOf = (dir) => {
    // statfsSync exists on modern Node only — caller guards with typeof check.
    const s = fs.statfsSync(dir);
    return Math.floor((s.bavail * s.bfrsize) / (1024 * 1024));
};

const checkMongo = () => {
    const connected = mongoose.connection.readyState === 1;
    return {
        key: "mongo",
        ok: connected,
        message: connected ? "قاعدة البيانات متصلة" : "قاعدة البيانات غير متصلة",
    };
};

const checkDisk = async () => {
    try {
        if (typeof fs.statfsSync !== "function") {
            return { key: "disk", ok: true, message: "فحص القرص غير مدعوم" };
        }
        // NOTE: getBackupDir is async in this codebase — must be awaited.
        const backupDir = await getBackupDir();
        const dirs = [backupDir, process.cwd()];
        const details = dirs.map((dir) => ({ dir, freeMB: freeMBOf(dir) }));
        const min = details.reduce((a, b) => (a.freeMB <= b.freeMB ? a : b));
        if (min.freeMB < DISK_CRITICAL_MB) {
            return {
                key: "disk",
                ok: false,
                message: `مساحة القرص حرجة (${min.freeMB}MB متاحة)`,
                detail: details,
            };
        }
        if (min.freeMB < DISK_WARN_MB) {
            return {
                key: "disk",
                ok: false,
                message: `مساحة القرص منخفضة (${min.freeMB}MB متاحة)`,
                detail: details,
            };
        }
        return {
            key: "disk",
            ok: true,
            message: `مساحة القرص كافية (${min.freeMB}MB متاحة)`,
            detail: details,
        };
    } catch {
        return { key: "disk", ok: true, message: "فحص القرص غير مدعوم" };
    }
};

const checkBackup = () => {
    const last = getLastBackupStatus();
    if (!last || !last.at) {
        return { key: "backup", ok: false, message: "لا توجد نسخة احتياطية بعد" };
    }
    if (last.success === false) {
        return {
            key: "backup",
            ok: false,
            message: `آخر نسخة احتياطية فشلت${last.error ? `: ${last.error}` : ""}`,
            detail: last,
        };
    }
    const ageMs = Date.now() - new Date(last.at).getTime();
    if (Number.isNaN(ageMs) || ageMs > BACKUP_MAX_AGE_MS) {
        const hours = Number.isNaN(ageMs) ? "؟" : Math.floor(ageMs / 3600000);
        return {
            key: "backup",
            ok: false,
            message: `آخر نسخة احتياطية قديمة (منذ ${hours} ساعة)`,
            detail: last,
        };
    }
    return { key: "backup", ok: true, message: "النسخ الاحتياطي حديث", detail: last };
};

const checkMemory = () => {
    const { heapUsed, heapTotal } = process.memoryUsage();
    const ratio = heapTotal > 0 ? heapUsed / heapTotal : 0;
    const pct = Math.round(ratio * 100);
    if (ratio > MEMORY_WARN_RATIO) {
        return {
            key: "memory",
            ok: false,
            message: `استهلاك الذاكرة مرتفع (${pct}%)`,
            detail: { heapUsed, heapTotal },
        };
    }
    return {
        key: "memory",
        ok: true,
        message: `الذاكرة سليمة (${pct}%)`,
        detail: { heapUsed, heapTotal },
    };
};

export async function checkSystemHealth() {
    const checks = [checkMongo(), await checkDisk(), checkBackup(), checkMemory()];
    return { ok: checks.every((c) => c.ok), checks };
}

export default { checkSystemHealth };
