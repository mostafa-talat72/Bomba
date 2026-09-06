import {
    createDatabaseBackup,
    listBackups,
    restoreDatabaseBackup,
    deleteBackup,
    getBackupDir,
    saveBackupDir,
    getLastBackupStatus,
} from "../utils/backup.js";

// @desc    Create database backup
// @route   POST /api/backup/create
// @access  Private (Admin only)
export const createBackup = async (req, res) => {
    try {
        const backupPath = req.body?.backupPath;
        const result = await createDatabaseBackup(backupPath);
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
// @route   POST /api/backup/restore/:fileName
// @access  Private (Admin only)
export const restoreBackup = async (req, res) => {
    try {
        const { fileName } = req.params;
        const result = await restoreDatabaseBackup(fileName);
        if (!result.success) {
            return res.status(400).json({ success: false, message: result.message, error: result.error });
        }
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
