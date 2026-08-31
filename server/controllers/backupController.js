import { createDatabaseBackup, getBackupsList, restoreDatabaseBackup, deleteBackup } from "../utils/backup.js";

// @desc    Create database backup
// @route   POST /api/backup/create
// @access  Private (Admin only)
export const createBackup = async (req, res) => {
    try {
        const backupPath = req.body.backupPath;
        const result = await createDatabaseBackup(backupPath);
        res.json({
            success: true,
            message: "تم إنشاء النسخة الاحتياطية بنجاح",
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
        const backups = await getBackupsList();
        res.json({
            success: true,
            data: backups,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "فشل في جلب قائمة النسخ الاحتياطية",
            error: error.message,
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
        res.json({
            success: true,
            message: "تم استعادة النسخة الاحتياطية بنجاح",
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
        await deleteBackup(fileName);
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
