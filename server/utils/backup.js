import fs from "fs";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";
import { promisify } from "util";
import { EJSON } from "bson";
import mongoose from "mongoose";
import Logger from "../middleware/logger.js";

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);
const scryptAsync = promisify(crypto.scrypt);

const ENC_ALGO = "aes-256-gcm";
const ENC_SALT_BYTES = 16;
const ENC_IV_BYTES = 12;
const GZIP_LEVEL = 9;

const encryptBuffer = async (plainBuf, password) => {
    const salt = crypto.randomBytes(ENC_SALT_BYTES);
    const iv = crypto.randomBytes(ENC_IV_BYTES);
    const key = await scryptAsync(String(password), salt, 32);
    const cipher = crypto.createCipheriv(ENC_ALGO, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
    const tag = cipher.getAuthTag();
    const wrapper = {
        v: 1, algo: ENC_ALGO,
        salt: salt.toString("base64"), iv: iv.toString("base64"),
        tag: tag.toString("base64"), data: ciphertext.toString("base64"),
    };
    return Buffer.from(JSON.stringify(wrapper), "utf8");
};

const decryptBuffer = async (encBuf, password) => {
    let wrapper;
    try {
        wrapper = JSON.parse(encBuf.toString("utf8"));
    } catch {
        throw new Error("ملف التشفير تالف");
    }
    if (!wrapper || wrapper.v !== 1 || !wrapper.salt || !wrapper.iv || !wrapper.tag || !wrapper.data) {
        throw new Error("صيغة التشفير غير معروفة");
    }
    const key = await scryptAsync(String(password), Buffer.from(wrapper.salt, "base64"), 32);
    const decipher = crypto.createDecipheriv(
        wrapper.algo || ENC_ALGO,
        key,
        Buffer.from(wrapper.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(wrapper.tag, "base64"));
    try {
        return Buffer.concat([
            decipher.update(Buffer.from(wrapper.data, "base64")),
            decipher.final(),
        ]);
    } catch {
        throw new Error("كلمة السر غير صحيحة أو الملف تالف");
    }
};

export const isEncryptedBackup = (fileName) => typeof fileName === "string" && fileName.toLowerCase().endsWith(".enc.json.gz");

const DEFAULT_BACKUP_DIR = process.env.DESKTOP_BACKUP_DIR || path.join(process.cwd(), 'backups');
const BACKUP_DIR_FILE = path.join(process.cwd(), 'data', 'backup-dir.json');
const SECONDARY_DIR_FILE = path.join(process.cwd(), 'data', 'backup-secondary-dir.json');
const CATALOG_FILE = path.join(process.cwd(), 'data', 'backup-catalog.json');
const MAX_BACKUPS = 10;
const MAX_DAILY = 7;
const MAX_WEEKLY = 4;
const MAX_MONTHLY = 3;
const STALE_THRESHOLD_HOURS = 26;

let lastBackupStatus = { at: null, success: null, fileName: null, path: null, size: 0, documents: 0, error: null, verified: null };
export const getLastBackupStatus = () => ({ ...lastBackupStatus });
const setLastBackupStatus = (s) => { lastBackupStatus = { ...lastBackupStatus, ...s }; };

const readJsonFile = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        Logger.warn(`Failed reading ${path.basename(filePath)}`, { error: e.message });
    }
    return null;
};

const writeJsonFile = (filePath, data) => {
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        Logger.warn(`Failed writing ${path.basename(filePath)}`, { error: e.message });
    }
};

const readPersistedDir = () => {
    const raw = readJsonFile(BACKUP_DIR_FILE);
    if (raw && typeof raw.dir === 'string' && raw.dir.trim()) return raw.dir.trim();
    return null;
};

const readSecondaryDir = () => {
    const raw = readJsonFile(SECONDARY_DIR_FILE);
    if (raw && typeof raw.dir === 'string' && raw.dir.trim()) return raw.dir.trim();
    return null;
};

export const getBackupDir = async () => {
    return readPersistedDir() || DEFAULT_BACKUP_DIR;
};

export const getSecondaryBackupDir = async () => {
    return readSecondaryDir();
};

export const saveBackupDir = async (dir) => {
    if (!dir || typeof dir !== 'string' || !dir.trim()) throw new Error('مسار النسخ الاحتياطي غير صالح');
    const clean = dir.trim();
    await ensureBackupDir(clean);
    writeJsonFile(BACKUP_DIR_FILE, { dir: clean, updatedAt: new Date().toISOString() });
    return clean;
};

export const saveSecondaryBackupDir = async (dir) => {
    if (!dir || typeof dir !== 'string' || !dir.trim()) throw new Error('مسار النسخ الاحتياطي الثانوي غير صالح');
    const clean = dir.trim();
    await ensureBackupDir(clean);
    writeJsonFile(SECONDARY_DIR_FILE, { dir: clean, updatedAt: new Date().toISOString() });
    return clean;
};

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
                format: fileName.toLowerCase().endsWith('.enc.json.gz') ? 'json-enc' : (fileName.endsWith('.json.gz') ? 'json' : 'mongodump'),
                encrypted: fileName.toLowerCase().endsWith('.enc.json.gz'),
            };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const getCatalog = () => {
    return readJsonFile(CATALOG_FILE) || { backups: [], version: 1 };
};

const saveCatalog = (catalog) => {
    writeJsonFile(CATALOG_FILE, catalog);
};

const addToCatalog = (entry) => {
    const catalog = getCatalog();
    catalog.backups.unshift(entry);
    if (catalog.backups.length > 100) catalog.backups = catalog.backups.slice(0, 100);
    saveCatalog(catalog);
};

const removeFromCatalog = (fileName) => {
    const catalog = getCatalog();
    catalog.backups = catalog.backups.filter(b => b.fileName !== fileName);
    saveCatalog(catalog);
};

let backupInProgress = false;

const verifyBackupInternal = async (filePath, password) => {
    try {
        const lower = filePath.toLowerCase();
        const encrypted = lower.endsWith('.enc.json.gz');
        if (encrypted && !password) {
            return { valid: false, needsPassword: true };
        }
        const fileBuf = fs.readFileSync(filePath);
        const gzBuf = encrypted ? await decryptBuffer(fileBuf, password) : fileBuf;
        const raw = await gunzipAsync(gzBuf);
        const dump = EJSON.parse(raw.toString('utf8'));
        if (!dump || typeof dump !== 'object' || !dump.collections || typeof dump.collections !== 'object') {
            return { valid: false, reason: 'Invalid structure' };
        }
        let documents = 0;
        for (const docs of Object.values(dump.collections)) {
            if (Array.isArray(docs)) documents += docs.length;
        }
        return { valid: true, documents, collections: Object.keys(dump.collections).length };
    } catch (e) {
        return { valid: false, reason: e.message };
    }
};

const applySmartRetention = (backupDir) => {
    try {
        const files = listBackupFiles(backupDir).filter((f) => f.format === 'json' || f.format === 'json-enc');
        const now = new Date();
        const daily = [];
        const weekly = [];
        const monthly = [];
        const toDelete = [];

        for (const f of files) {
            const age = (now - new Date(f.createdAt)) / (1000 * 60 * 60 * 24);
            if (age <= 1) {
                daily.push(f);
            } else if (age <= 7) {
                const dayOfWeek = new Date(f.createdAt).getDay();
                const existing = weekly.find(w => new Date(w.createdAt).getDay() === dayOfWeek);
                if (!existing) weekly.push(f);
                else toDelete.push(f);
            } else if (age <= 30) {
                const month = new Date(f.createdAt).getMonth();
                const existing = monthly.find(m => new Date(m.createdAt).getMonth() === month);
                if (!existing) monthly.push(f);
                else toDelete.push(f);
            } else {
                toDelete.push(f);
            }
        }

        if (daily.length > MAX_DAILY) toDelete.push(...daily.slice(MAX_DAILY));
        if (weekly.length > MAX_WEEKLY) toDelete.push(...weekly.slice(MAX_WEEKLY));
        if (monthly.length > MAX_MONTHLY) toDelete.push(...monthly.slice(MAX_MONTHLY));

        for (const f of toDelete) {
            try {
                fs.unlinkSync(f.path);
                removeFromCatalog(f.fileName);
                Logger.info(`Retention: removed old backup ${f.fileName}`);
            } catch (e) {
                Logger.warn(`Retention: failed to remove ${f.fileName}`, { error: e.message });
            }
        }
    } catch (e) {
        Logger.warn('Smart retention failed', { error: e.message });
    }
};

const copyToSecondary = async (filePath, secondaryDir) => {
    if (!secondaryDir || !fs.existsSync(secondaryDir)) return null;
    try {
        const dest = path.join(secondaryDir, path.basename(filePath));
        fs.copyFileSync(filePath, dest);
        Logger.info(`Backup copied to secondary: ${dest}`);
        return dest;
    } catch (e) {
        Logger.warn('Failed to copy backup to secondary dir', { error: e.message });
        return null;
    }
};

const checkStaleBackup = async () => {
    try {
        const backupDir = await getBackupDir();
        const files = listBackupFiles(backupDir).filter((f) => f.format === 'json' || f.format === 'json-enc');
        if (files.length === 0) {
            Logger.error('⚠️ STALE BACKUP: No backups found!');
            return { stale: true, reason: 'no_backups' };
        }
        const latest = files[files.length - 1];
        const ageHours = (Date.now() - new Date(latest.createdAt).getTime()) / (1000 * 60 * 60);
        if (ageHours > STALE_THRESHOLD_HOURS) {
            Logger.error(`⚠️ STALE BACKUP: Last backup is ${Math.round(ageHours)}h old (${latest.fileName})`);
            return { stale: true, reason: 'too_old', ageHours, fileName: latest.fileName };
        }
        return { stale: false, lastBackup: latest.fileName, ageHours: Math.round(ageHours) };
    } catch (e) {
        Logger.warn('Stale backup check failed', { error: e.message });
        return { stale: false };
    }
};

const detectEmptyDb = async () => {
    try {
        const db = mongoose.connection.db;
        if (!db) return false;
        const collections = (await db.listCollections().toArray())
            .map((c) => c.name)
            .filter((n) => n && !n.startsWith('system.'));
        if (collections.length === 0) return true;
        const billsCount = await db.collection('bills').countDocuments({}).catch(() => 0);
        const ordersCount = await db.collection('orders').countDocuments({}).catch(() => 0);
        return billsCount === 0 && ordersCount === 0;
    } catch {
        return false;
    }
};

const isSyncInProgress = async () => {
    try {
        const { default: syncQueueManager } = await import("./services/sync/syncQueueManager.js");
        if (syncQueueManager && typeof syncQueueManager.isProcessing === 'function') {
            return syncQueueManager.isProcessing();
        }
        if (syncQueueManager && typeof syncQueueManager.getStats === 'function') {
            const stats = syncQueueManager.getStats();
            return stats && (stats.processing > 0 || stats.pending > 0);
        }
    } catch {}
    try {
        const { default: syncWorker } = await import("./services/sync/syncWorker.js");
        if (syncWorker && typeof syncWorker.isRunning === 'function') {
            return syncWorker.isRunning();
        }
    } catch {}
    return false;
};

const waitForSyncToComplete = async (maxWaitMs = 120000) => {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        const inProgress = await isSyncInProgress();
        if (!inProgress) return true;
        await new Promise(r => setTimeout(r, 2000));
    }
    return false;
};

const autoRestore = async () => {
    try {
        Logger.info('Auto-restore: waiting for sync to complete before checking...');
        const syncDone = await waitForSyncToComplete();
        if (!syncDone) {
            Logger.warn('Auto-restore: sync still running after timeout, skipping check');
            return { restored: false, reason: 'sync_in_progress' };
        }

        const isEmpty = await detectEmptyDb();
        if (!isEmpty) return { restored: false };

        Logger.error('🚨 Database appears empty! Attempting auto-restore...');
        const backupDir = await getBackupDir();
        const files = listBackupFiles(backupDir).filter((f) => f.format === 'json' || f.format === 'json-enc');
        if (files.length === 0) {
            Logger.error('🚨 No backups available for auto-restore!');
            return { restored: false, reason: 'no_backups' };
        }

        for (let i = files.length - 1; i >= 0; i--) {
            const f = files[i];
            const verify = await verifyBackupInternal(f.path);
            if (verify.valid) {
                Logger.info(`Auto-restore: using backup ${f.fileName}`);
                const result = await restoreDatabaseBackup(f.fileName, backupDir);
                if (result.success) {
                    Logger.info(`✅ Auto-restore successful: ${result.documents} documents restored`);
                    return { restored: true, fileName: f.fileName, documents: result.documents };
                }
            }
        }
        Logger.error('🚨 Auto-restore failed: no valid backup found');
        return { restored: false, reason: 'no_valid_backup' };
    } catch (e) {
        Logger.error('Auto-restore error', { error: e.message });
        return { restored: false, reason: e.message };
    }
};

export const createDatabaseBackup = async (customPath, options = {}) => {
    if (backupInProgress) {
        Logger.info("Backup skipped: another backup is already running");
        return { success: false, skipped: true, message: "نسخة احتياطية جارية بالفعل" };
    }
    backupInProgress = true;
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
        const usePassword = options && typeof options.password === "string" && options.password.length > 0;
        const backupFileName = usePassword
            ? `bomba-backup-${timestamp}.enc.json.gz`
            : `bomba-backup-${timestamp}.json.gz`;
        const backupPath = path.join(backupDir, backupFileName);

        const json = EJSON.stringify(dump);
        const gz = await gzipAsync(json, { level: GZIP_LEVEL });
        const payload = usePassword ? await encryptBuffer(gz, options.password) : gz;
        fs.writeFileSync(backupPath, payload);

        const verifyResult = await verifyBackupInternal(backupPath, options.password);
        const stat = fs.statSync(backupPath);

        const secondaryDir = await getSecondaryBackupDir();
        const secondaryPath = await copyToSecondary(backupPath, secondaryDir);

        applySmartRetention(backupDir);
        if (secondaryDir && fs.existsSync(secondaryDir)) {
            applySmartRetention(secondaryDir);
        }

        const catalogEntry = {
            fileName: backupFileName,
            path: backupPath,
            secondaryPath,
            size: stat.size,
            documents,
            collections: collections.length,
            encrypted: usePassword,
            verified: verifyResult.valid,
            createdAt: startedAt.toISOString(),
        };
        addToCatalog(catalogEntry);

        setLastBackupStatus({
            at: new Date().toISOString(), success: true, fileName: backupFileName,
            path: backupPath, size: stat.size, documents, error: null,
            verified: verifyResult.valid,
        });

        Logger.info(`Database backup created: ${backupPath} (${documents} docs, ${stat.size} bytes, verified=${verifyResult.valid})`);
        return {
            success: true,
            message: "تم إنشاء النسخة الاحتياطية بنجاح",
            fileName: backupFileName,
            path: backupPath,
            secondaryPath,
            size: stat.size,
            documents,
            collections: collections.length,
            encrypted: usePassword,
            verified: verifyResult.valid,
            timestamp: startedAt,
        };
    } catch (error) {
        setLastBackupStatus({ at: new Date().toISOString(), success: false, error: error.message });
        Logger.error("Database backup failed", { error: error.message });
        return { success: false, message: "فشل إنشاء النسخة الاحتياطية", error: error.message };
    } finally {
        backupInProgress = false;
    }
};

export const listBackups = async (customDir) => {
    try {
        const backupDir = customDir || await getBackupDir();
        const files = listBackupFiles(backupDir);
        const catalog = getCatalog();
        const catalogMap = new Map(catalog.backups.map(b => [b.fileName, b]));
        const enriched = files.map(f => ({
            ...f,
            verified: catalogMap.get(f.fileName)?.verified ?? null,
        }));
        return { success: true, backups: enriched, dir: backupDir };
    } catch (error) {
        Logger.error("Failed to list backups", { error: error.message });
        return { success: false, message: "فشل جلب النسخ الاحتياطية", error: error.message };
    }
};

export const readBackupDump = async (fileName, customDir, password) => {
    const backupDir = customDir || await getBackupDir();
    const backupPath = path.join(backupDir, path.basename(fileName));
    if (!fs.existsSync(backupPath)) {
        return { error: "ملف النسخة الاحتياطية غير موجود" };
    }
    if (path.dirname(path.resolve(backupPath)) !== path.resolve(backupDir)) {
        return { error: "مسار غير صالح" };
    }
    const lower = String(fileName).toLowerCase();
    if (!lower.endsWith('.json.gz')) {
        return { error: "هذا الملف بصيغة mongodump القديمة ولا يمكن استعادته بهذه النسخة — أنشئ نسخة جديدة أولاً" };
    }
    const encrypted = lower.endsWith('.enc.json.gz');
    if (encrypted && (!password || !String(password).length)) {
        return { error: "هذه النسخة مشفرة — أدخل كلمة السر", needsPassword: true };
    }
    try {
        const fileBuf = fs.readFileSync(backupPath);
        const gzBuf = encrypted ? await decryptBuffer(fileBuf, password) : fileBuf;
        const raw = await gunzipAsync(gzBuf);
        const dump = EJSON.parse(raw.toString('utf8'));
        if (!dump || typeof dump !== 'object' || !dump.collections || typeof dump.collections !== 'object') {
            return { error: "ملف النسخة تالف أو بصيغة غير معروفة" };
        }
        return { dump, encrypted, backupPath };
    } catch (e) {
        return { error: e.message || "تعذر قراءة ملف النسخة" };
    }
};

export const verifyBackup = async (fileName, customDir, password) => {
    try {
        const read = await readBackupDump(fileName, customDir, password);
        if (read.error) {
            return { success: false, message: read.error, needsPassword: !!read.needsPassword };
        }
        const collections = Object.keys(read.dump.collections);
        let documents = 0;
        for (const docs of Object.values(read.dump.collections)) {
            if (Array.isArray(docs)) documents += docs.length;
        }
        return {
            success: true,
            message: "النسخة سليمة وجاهزة للاستعادة",
            data: {
                fileName: path.basename(fileName),
                encrypted: read.encrypted,
                createdAt: read.dump.createdAt || null,
                collections: collections.length,
                documents,
            },
        };
    } catch (error) {
        Logger.error("Backup verify failed", { error: error.message });
        return { success: false, message: "فشل فحص النسخة", error: error.message };
    }
};

export const restoreDatabaseBackup = async (fileName, customDir, password) => {
    try {
        const read = await readBackupDump(fileName, customDir, password);
        if (read.error) {
            return { success: false, message: read.error, needsPassword: !!read.needsPassword };
        }
        const { dump } = read;

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

export const deleteBackup = async (fileName, customDir) => {
    try {
        const backupDir = customDir || await getBackupDir();
        const backupPath = path.join(backupDir, path.basename(fileName));
        if (!fs.existsSync(backupPath)) {
            return { success: false, message: "ملف النسخة الاحتياطية غير موجود" };
        }
        if (path.dirname(path.resolve(backupPath)) !== path.resolve(backupDir)) {
            return { success: false, message: "مسار غير صالح" };
        }
        fs.unlinkSync(backupPath);
        removeFromCatalog(fileName);

        const secondaryDir = await getSecondaryBackupDir();
        if (secondaryDir) {
            const secondaryPath = path.join(secondaryDir, path.basename(fileName));
            if (fs.existsSync(secondaryPath)) {
                try { fs.unlinkSync(secondaryPath); } catch {}
            }
        }

        Logger.info(`Backup deleted: ${fileName}`);
        return { success: true, message: "تم حذف النسخة الاحتياطية بنجاح" };
    } catch (error) {
        Logger.error("Failed to delete backup", { error: error.message });
        return { success: false, message: "فشل حذف النسخة الاحتياطية", error: error.message };
    }
};

export const checkBackupHealth = async () => {
    const staleCheck = await checkStaleBackup();
    const lastStatus = getLastBackupStatus();
    return {
        stale: staleCheck.stale,
        reason: staleCheck.reason,
        lastBackup: staleCheck.lastBackup || lastStatus.fileName,
        lastBackupAge: staleCheck.ageHours,
        lastStatus: lastStatus.success,
        verified: lastStatus.verified,
    };
};

export const runAutoRestoreIfEmpty = async () => {
    return await autoRestore();
};

export const getBackupCatalog = async () => {
    const catalog = getCatalog();
    return { success: true, catalog };
};

export default {
    createDatabaseBackup,
    listBackups,
    restoreDatabaseBackup,
    deleteBackup,
    verifyBackup,
    readBackupDump,
    isEncryptedBackup,
    getBackupDir,
    saveBackupDir,
    ensureBackupDir,
    getLastBackupStatus,
    getSecondaryBackupDir,
    saveSecondaryBackupDir,
    checkBackupHealth,
    runAutoRestoreIfEmpty,
    getBackupCatalog,
};
