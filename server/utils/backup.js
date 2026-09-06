import fs from "fs";
import path from "path";
import zlib from "zlib";
import { promisify } from "util";
import { EJSON } from "bson";
import mongoose from "mongoose";
import Logger from "../middleware/logger.js";

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

// Backup configuration
const DEFAULT_BACKUP_DIR = process.env.DESKTOP_BACKUP_DIR || path.join(process.cwd(), 'backups');
const BACKUP_DIR_FILE = path.join(process.cwd(), 'data', 'backup-dir.json');
const MAX_BACKUPS = 10; // Keep only the last 10 backups

// Last backup status (in-memory, surfaced via API)
let lastBackupStatus = { at: null, success: null, fileName: null, path: null, size: 0, documents: 0, error: null };
export const getLastBackupStatus = () => ({ ...lastBackupStatus });
const setLastBackupStatus = (s) => { lastBackupStatus = { ...lastBackupStatus, ...s }; };

// Persisted backup directory (chosen from Settings UI). Precedence:
// explicit arg > persisted file > DESKTOP_BACKUP_DIR env > ./backups default.
const readPersistedDir = () => {
    try {
        if (fs.existsSync(BACKUP_DIR_FILE)) {
            const raw = JSON.parse(fs.readFileSync(BACKUP_DIR_FILE, 'utf8'));
            if (raw && typeof raw.dir === 'string' && raw.dir.trim()) return raw.dir.trim();
        }
    } catch (e) {
        Logger.warn('Failed reading persisted backup dir', { error: e.message });
    }
    return null;
};

export const getBackupDir = async () => {
    return readPersistedDir() || DEFAULT_BACKUP_DIR;
};

export const saveBackupDir = async (dir) => {
    if (!dir || typeof dir !== 'string' || !dir.trim()) throw new Error('مسار النسخ الاحتياطي غير صالح');
    const clean = dir.trim();
    await ensureBackupDir(clean); // throws if not creatable — do not persist bad paths
    try {
        fs.mkdirSync(path.dirname(BACKUP_DIR_FILE), { recursive: true });
        fs.writeFileSync(BACKUP_DIR_FILE, JSON.stringify({ dir: clean, updatedAt: new Date().toISOString() }, null, 2));
    } catch (e) {
        Logger.warn('Failed persisting backup dir', { error: e.message });
    }
    return clean;
};

// Ensure backup directory exists
export const ensureBackupDir = async (backupDir) => {
    if (!backupDir) {
        backupDir = await getBackupDir();
    }
    if (!fs.existsSync(backupDir)) {
        try {
            fs.mkdirSync(backupDir, { recursive: true });
            Logger.info(`Created backup directory at: ${backupDir}`);
        } catch (error) {
            Logger.error('Failed to create backup directory', { error });
            throw error;
        }
    }
    return backupDir;
};

// Initialize backup directory on startup
const initBackupDir = async () => {
    try {
        await ensureBackupDir();
    } catch (error) {
        Logger.error('Backup directory initialization failed', { error });
    }
};

initBackupDir();

const listBackupFiles = (backupDir) => {
    if (!fs.existsSync(backupDir)) return [];
    return fs.readdirSync(backupDir)
        .filter((f) => f.endsWith('.json.gz') || f.endsWith('.gz'))
        .map((fileName) => {
            const full = path.join(backupDir, fileName);
            const stat = fs.statSync(full);
            return {
                fileName,
                path: full,
                size: stat.size,
                createdAt: stat.birthtime && stat.birthtime.getTime() > 0 ? stat.birthtime : stat.mtime,
                // Legacy mongodump archives (*.gz) vs new pure-JS dumps (*.json.gz).
                // Only pure-JS dumps are restorable by this version.
                format: fileName.endsWith('.json.gz') ? 'json' : 'mongodump',
            };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

// Create database backup — pure JS (no mongodump binary needed).
// Dumps every non-system collection as EJSON (ObjectIds/Dates preserved),
// gzipped into a single file. Works offline and inside the packaged app.
export const createDatabaseBackup = async (customPath) => {
    const startedAt = new Date();
    try {
        const backupDir = customPath && customPath.trim()
            ? await ensureBackupDir(customPath.trim())
            : await ensureBackupDir(await getBackupDir());

        const db = mongoose.connection.db;
        if (!db) throw new Error('قاعدة البيانات غير متصلة');

        const collections = (await db.listCollections().toArray())
            .map((c) => c.name)
            .filter((n) => n && !n.startsWith('system.'));

        const dump = { version: 1, createdAt: startedAt.toISOString(), collections: {} };
        let documents = 0;
        for (const name of collections) {
            const docs = await db.collection(name).find({}).toArray();
            dump.collections[name] = docs;
            documents += docs.length;
        }

        const timestamp = startedAt.toISOString().replace(/[:.]/g, "-");
        const backupFileName = `bomba-backup-${timestamp}.json.gz`;
        const backupPath = path.join(backupDir, backupFileName);

        const json = EJSON.stringify(dump);
        const gz = await gzipAsync(json);
        fs.writeFileSync(backupPath, gz);

        // Retention: keep only the last MAX_BACKUPS pure-JS dumps
        try {
            const files = listBackupFiles(backupDir).filter((f) => f.format === 'json');
            for (const old of files.slice(MAX_BACKUPS)) {
                fs.unlinkSync(old.path);
                Logger.info(`Removed old backup: ${old.fileName}`);
            }
        } catch (e) {
            Logger.warn('Backup retention cleanup failed', { error: e.message });
        }

        const stat = fs.statSync(backupPath);
        setLastBackupStatus({
            at: new Date().toISOString(), success: true, fileName: backupFileName,
            path: backupPath, size: stat.size, documents, error: null,
        });
        Logger.info(`Database backup created: ${backupPath} (${documents} docs, ${stat.size} bytes)`);
        return {
            success: true,
            message: "تم إنشاء النسخة الاحتياطية بنجاح",
            fileName: backupFileName,
            path: backupPath,
            size: stat.size,
            documents,
            collections: collections.length,
            timestamp: startedAt,
        };
    } catch (error) {
        setLastBackupStatus({ at: new Date().toISOString(), success: false, error: error.message });
        Logger.error("Database backup failed", { error: error.message });
        return { success: false, message: "فشل إنشاء النسخة الاحتياطية", error: error.message };
    }
};

// List available backups
export const listBackups = async (customDir) => {
    try {
        const backupDir = customDir || await getBackupDir();
        const files = listBackupFiles(backupDir);
        return { success: true, backups: files, dir: backupDir };
    } catch (error) {
        Logger.error("Failed to list backups", { error: error.message });
        return { success: false, message: "فشل جلب النسخ الاحتياطية", error: error.message };
    }
};

// Restore database from backup (pure-JS format only)
export const restoreDatabaseBackup = async (fileName, customDir) => {
    try {
        const backupDir = customDir || await getBackupDir();
        const backupPath = path.join(backupDir, fileName);
        if (!fs.existsSync(backupPath)) {
            return { success: false, message: "ملف النسخة الاحتياطية غير موجود" };
        }
        if (!fileName.endsWith('.json.gz')) {
            return { success: false, message: "هذا الملف بصيغة mongodump القديمة ولا يمكن استعادته بهذه النسخة — أنشئ نسخة جديدة أولاً" };
        }

        const raw = await gunzipAsync(fs.readFileSync(backupPath));
        const dump = EJSON.parse(raw.toString('utf8'));
        if (!dump || typeof dump !== 'object' || !dump.collections) {
            throw new Error('ملف النسخة تالف أو بصيغة غير معروفة');
        }

        const db = mongoose.connection.db;
        if (!db) throw new Error('قاعدة البيانات غير متصلة');

        let restored = 0;
        for (const [name, docs] of Object.entries(dump.collections)) {
            if (!Array.isArray(docs)) continue;
            await db.collection(name).deleteMany({});
            for (let i = 0; i < docs.length; i += 1000) {
                const batch = docs.slice(i, i + 1000);
                if (batch.length > 0) await db.collection(name).insertMany(batch, { ordered: false });
            }
            restored += docs.length;
        }

        Logger.info(`Database restored from backup: ${fileName} (${restored} docs)`);
        return { success: true, message: "تمت استعادة النسخة الاحتياطية بنجاح", documents: restored };
    } catch (error) {
        Logger.error("Database restore failed", { error: error.message });
        return { success: false, message: "فشلت استعادة النسخة الاحتياطية", error: error.message };
    }
};

// Delete a specific backup
export const deleteBackup = async (fileName, customDir) => {
    try {
        const backupDir = customDir || await getBackupDir();
        const backupPath = path.join(backupDir, path.basename(fileName));
        if (!fs.existsSync(backupPath)) {
            return { success: false, message: "ملف النسخة الاحتياطية غير موجود" };
        }
        // Safety: only delete inside the backup dir
        if (path.dirname(path.resolve(backupPath)) !== path.resolve(backupDir)) {
            return { success: false, message: "مسار غير صالح" };
        }
        fs.unlinkSync(backupPath);
        Logger.info(`Backup deleted: ${fileName}`);
        return { success: true, message: "تم حذف النسخة الاحتياطية بنجاح" };
    } catch (error) {
        Logger.error("Failed to delete backup", { error: error.message });
        return { success: false, message: "فشل حذف النسخة الاحتياطية", error: error.message };
    }
};

export default {
    createDatabaseBackup,
    listBackups,
    restoreDatabaseBackup,
    deleteBackup,
    getBackupDir,
    saveBackupDir,
    ensureBackupDir,
    getLastBackupStatus,
};
