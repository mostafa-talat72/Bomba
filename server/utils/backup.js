import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import Logger from "../middleware/logger.js";

const execAsync = promisify(exec);

// Backup configuration
const DEFAULT_BACKUP_DIR = process.env.DESKTOP_BACKUP_DIR || path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 10; // Keep only the last 10 backups

// Get backup directory from settings or default
export const getBackupDir = async () => {
    return DEFAULT_BACKUP_DIR;
};

// Ensure backup directory exists
const ensureBackupDir = async (backupDir) => {
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

// Create database backup
export const createDatabaseBackup = async (customPath) => {
    try {
        let backupDir = customPath;
        if (!backupDir) {
            backupDir = await getBackupDir();
        }
        await ensureBackupDir(backupDir);

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupFileName = `bomba-backup-${timestamp}.gz`;
        const backupPath = path.join(backupDir, backupFileName);

        // Extract database name from MongoDB URI
        const dbName = process.env.MONGODB_URI.split("/").pop().split("?")[0];

        // Create mongodump command
        const command = `mongodump --uri="${process.env.MONGODB_URI}" --gzip --archive="${backupPath}"`;

        await execAsync(command);

        // Clean up old backups
        await cleanupOldBackups(backupDir);

        return {
            success: true,
            fileName: backupFileName,
            path: backupPath,
            size: fs.statSync(backupPath).size,
        };
    } catch (error) {
        Logger.error("Database backup failed", { error: error.message });
        throw new Error(`فشل في إنشاء النسخة الاحتياطية: ${error.message}`);
    }
};

// Restore database from backup
export const restoreDatabaseBackup = async (backupFileName) => {
    try {
        const backupDir = await getBackupDir();
        const backupPath = path.join(backupDir, backupFileName);

        if (!fs.existsSync(backupPath)) {
            throw new Error("ملف النسخة الاحتياطية غير موجود");
        }

        // Extract database name from MongoDB URI
        const dbName = process.env.MONGODB_URI.split("/").pop().split("?")[0];

        // Create mongorestore command
        const command = `mongorestore --uri="${process.env.MONGODB_URI}" --gzip --archive="${backupPath}" --drop`;

        await execAsync(command);

        return {
            success: true,
            fileName: backupFileName,
        };
    } catch (error) {
        Logger.error("Database restore failed", { error: error.message });
        throw new Error(`فشل في استعادة النسخة الاحتياطية: ${error.message}`);
    }
};

// Get list of available backups
export const getBackupsList = async () => {
    try {
        const backupDir = await getBackupDir();
        const files = fs
            .readdirSync(backupDir)
            .filter((file) => file.endsWith(".gz"))
            .map((file) => {
                const filePath = path.join(backupDir, file);
                const stats = fs.statSync(filePath);

                return {
                    fileName: file,
                    size: stats.size,
                    createdAt: stats.birthtime,
                    modifiedAt: stats.mtime,
                };
            })
            .sort((a, b) => b.createdAt - a.createdAt);

        return files;
    } catch (error) {
        Logger.error("Failed to get backups list", { error: error.message });
        throw new Error(`فشل في جلب قائمة النسخ الاحتياطية: ${error.message}`);
    }
};

// Clean up old backups
const cleanupOldBackups = async (backupDir) => {
    try {
        const backups = await getBackupsList();

        if (backups.length > MAX_BACKUPS) {
            const backupsToDelete = backups.slice(MAX_BACKUPS);

            for (const backup of backupsToDelete) {
                const backupPath = path.join(backupDir, backup.fileName);
                fs.unlinkSync(backupPath);
            }
        }
    } catch (error) {
        Logger.error("Failed to cleanup old backups", { error: error.message });
    }
};

// Delete specific backup
export const deleteBackup = async (backupFileName) => {
    try {
        const backupDir = await getBackupDir();
        const backupPath = path.join(backupDir, backupFileName);

        if (!fs.existsSync(backupPath)) {
            throw new Error("ملف النسخة الاحتياطية غير موجود");
        }

        fs.unlinkSync(backupPath);

        return { success: true };
    } catch (error) {
        Logger.error("Failed to delete backup", { error: error.message });
        throw new Error(`فشل في حذف النسخة الاحتياطية: ${error.message}`);
    }
};

// Schedule automatic backups
export const scheduleBackups = () => {
    const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    setInterval(async () => {
        try {
            await createDatabaseBackup();
        } catch (error) {
            Logger.error("Scheduled backup failed", { error: error.message });
        }
    }, BACKUP_INTERVAL);
};
