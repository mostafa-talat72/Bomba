import fs from "fs";
import path from "path";
import multer from "multer";
import {
    createDatabaseBackup,
    listBackups,
    restoreDatabaseBackup,
    deleteBackup,
    verifyBackup,
    getBackupDir,
    saveBackupDir,
    ensureBackupDir,
    getLastBackupStatus,
} from "../utils/backup.js";

// @desc    Create database backup
// @route   POST /api/backup/create
// @access  Private (Admin only)
export const createBackup = async (req, res) => {
    try {
        const backupPath = req.body?.backupPath;
        const password = typeof req.body?.password === "string" && req.body.password.length > 0
            ? req.body.password
            : undefined;
        const result = await createDatabaseBackup(backupPath, password ? { password } : undefined);
        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.message || "فشل في إنشاء النسخة الاحتياطية",
                error: result.error,
            });
        }
        // Persist the chosen dir so scheduled backups use it too
        if (backupPath && typeof backupPath === 'string' && backupPath.trim()) {
            try { await saveBackupDir(backupPath.trim()); } catch {}
        }
        res.json({
            success: true,
            message: result.message || "تم إنشاء النسخة الاحتياطية بنجاح",
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "فشل في إنشاء النسخة الاحتياطية",
            error: error.message,
        });
    }
};

// @desc    Get backups list
// @route   GET /api/backup
// @access  Private (Admin only)
export const getBackups = async (req, res) => {
    try {
        const result = await listBackups();
        res.json({
            success: true,
            data: result.backups || [],
            dir: result.dir,
            last: getLastBackupStatus(),
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "فشل في جلب قائمة النسخ الاحتياطية",
            error: error.message,
        });
    }
};

// @desc    Get backup settings (dir + last status)
// @route   GET /api/backup/settings
// @access  Private (Admin only)
export const getBackupSettings = async (req, res) => {
    try {
        res.json({
            success: true,
            data: { dir: await getBackupDir(), last: getLastBackupStatus() },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "فشل في جلب إعدادات النسخ الاحتياطي",
            error: error.message,
        });
    }
};

// @desc    Save backup directory (used by manual + scheduled backups)
// @route   PUT /api/backup/settings
// @access  Private (Admin only)
export const saveBackupSettings = async (req, res) => {
    try {
        const dir = await saveBackupDir(req.body?.dir);
        res.json({ success: true, message: "تم حفظ مسار النسخ الاحتياطي", data: { dir } });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || "فشل في حفظ مسار النسخ الاحتياطي",
        });
    }
};

// @desc    Restore database from backup
// @route   POST /api/backup/restore/:fileName (body: { password? } for encrypted)
// @access  Private (Admin only)
export const restoreBackup = async (req, res) => {
    try {
        const { fileName } = req.params;
        const password = typeof req.body?.password === "string" ? req.body.password : undefined;
        const result = await restoreDatabaseBackup(fileName, undefined, password);
        if (!result.success) {
            return res.status(result.needsPassword ? 401 : 400).json({
                success: false, message: result.message, error: result.error,
                needsPassword: !!result.needsPassword,
            });
        }
        // Audit (fire-and-forget) — restore replaces the whole DB
        import("../utils/auditHelper.js").then((m) => {
            m.logAudit({
                action: "backup.restored", collection: null,
                documentNumber: fileName,
                user: req.user, organization: req.user?.organization,
                deviceId: req.headers?.["x-instance-id"] || null,
                details: { documents: result.documents },
            }).catch(() => {});
        }).catch(() => {});
        res.json({
            success: true,
            message: result.message || "تم استعادة النسخة الاحتياطية بنجاح",
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "فشل في استعادة النسخة الاحتياطية",
            error: error.message,
        });
    }
};

// @desc    Import an external backup file (e.g. from another device/USB)
// @route   POST /api/backup/import (multipart, field "file", *.json.gz only)
// @access  Private (Admin only)
const importUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024, files: 1 },
}).single("file");

export const importBackup = [
    (req, res, next) => {
        importUpload(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.code === "LIMIT_FILE_SIZE"
                        ? "حجم الملف يتجاوز الحد المسموح (500MB)"
                        : "فشل رفع الملف",
                    error: err.message,
                });
            }
            next();
        });
    },
    async (req, res) => {
        try {
            if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
                return res.status(400).json({ success: false, message: "لم يتم إرفاق ملف" });
            }
            const rawName = path.basename(req.file.originalname || "");
            const lower = rawName.toLowerCase();
            if (!lower.endsWith(".json.gz")) {
                return res.status(400).json({
                    success: false,
                    message: "الملف يجب أن يكون نسخة احتياطية بصيغة .json.gz",
                });
            }
            // Cheap corruption guard: plain dumps start with gzip magic (0x1f 0x8b),
            // encrypted dumps (.enc.json.gz) start with the JSON wrapper ("{").
            const buf = req.file.buffer;
            const isEnc = lower.endsWith(".enc.json.gz");
            const looksGzip = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
            const looksEncWrapper = buf.length > 0 && String.fromCharCode(buf[0]) === "{";
            if (isEnc ? !looksEncWrapper : !looksGzip) {
                return res.status(400).json({ success: false, message: "الملف تالف أو بصيغة غير متوقعة" });
            }
            const backupDir = await ensureBackupDir(await getBackupDir());
            const dest = path.join(backupDir, rawName);
            // Safety: stay inside the backup dir
            if (path.dirname(path.resolve(dest)) !== path.resolve(backupDir)) {
                return res.status(400).json({ success: false, message: "اسم ملف غير صالح" });
            }
            fs.writeFileSync(dest, buf);
            const stat = fs.statSync(dest);
            return res.json({
                success: true,
                message: "تم استيراد النسخة الاحتياطية بنجاح",
                data: { fileName: rawName, path: dest, size: stat.size },
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "فشل استيراد النسخة الاحتياطية",
                error: error.message,
            });
        }
    },
];

// @desc    Verify a backup file without restoring it
// @route   POST /api/backup/verify/:fileName (body: { password? } for encrypted)
// @access  Private (Admin only)
export const verifyBackupFile = async (req, res) => {
    try {
        const { fileName } = req.params;
        const password = typeof req.body?.password === "string" ? req.body.password : undefined;
        const result = await verifyBackup(fileName, undefined, password);
        if (!result.success) {
            return res.status(result.needsPassword ? 401 : 400).json({
                success: false, message: result.message,
                needsPassword: !!result.needsPassword,
            });
        }
        res.json({ success: true, message: result.message, data: result.data });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "فشل فحص النسخة الاحتياطية",
            error: error.message,
        });
    }
};

// @desc    Download a backup file (to move it to another device via USB)
// @route   GET /api/backup/download/:fileName
// @access  Private (Admin only)
export const downloadBackup = async (req, res) => {
    try {
        const fileName = path.basename(req.params.fileName || "");
        const lower = fileName.toLowerCase();
        if (!lower.endsWith(".json.gz")) {
            return res.status(400).json({ success: false, message: "ملف غير صالح للتنزيل" });
        }
        const backupDir = await ensureBackupDir(await getBackupDir());
        const full = path.join(backupDir, fileName);
        if (path.dirname(path.resolve(full)) !== path.resolve(backupDir) || !fs.existsSync(full)) {
            return res.status(404).json({ success: false, message: "ملف النسخة الاحتياطية غير موجود" });
        }
        res.download(full, fileName);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "فشل تنزيل النسخة الاحتياطية",
            error: error.message,
        });
    }
};

// @desc    Delete backup
// @route   DELETE /api/backup/:fileName
// @access  Private (Admin only)
export const removeBackup = async (req, res) => {
    try {
        const { fileName } = req.params;
        const result = await deleteBackup(fileName);
        if (!result.success) {
            return res.status(404).json({ success: false, message: result.message });
        }
        res.json({
            success: true,
            message: "تم حذف النسخة الاحتياطية بنجاح",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "فشل في حذف النسخة الاحتياطية",
            error: error.message,
        });
    }
};
