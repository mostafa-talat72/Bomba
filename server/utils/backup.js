import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import Logger from "../middleware/logger.js";

const execAsync = promisify(exec);

// Backup configuration
const BACKUP_DIR = "./backups";
const MAX_BACKUPS = 10; // Keep only the last 10 backups

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Create database backup
export const createDatabaseBackup = async () => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupFileName = `bomba-backup-${timestamp}.gz`;
        const backupPath = path.join(BACKUP_DIR, backupFileName);

        // Extract database name from MongoDB URI
        const dbName = process.env.MONGODB_URI.split("/").pop().split("?")[0];

        // Create mongodump command
        const command = `mongodump --uri="${process.env.MONGODB_URI}" --gzip --archive="${backupPath}"`;

        Logger.info("Starting database backup", { fileName: backupFileName });

        await execAsync(command);

        Logger.info("Database backup completed successfully", {
            fileName: backupFileName,
            path: backupPath,
        });

        // Clean up old backups
        await cleanupOldBackups();

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
        const backupPath = path.join(BACKUP_DIR, backupFileName);

        if (!fs.existsSync(backupPath)) {
            throw new Error("ملف النسخة الاحتياطية غير موجود");
        }

        // Extract database name from MongoDB URI
        const dbName = process.env.MONGODB_URI.split("/").pop().split("?")[0];

        // Create mongorestore command
        const command = `mongorestore --uri="${process.env.MONGODB_URI}" --gzip --archive="${backupPath}" --drop`;

        Logger.info("Starting database restore", { fileName: backupFileName });

        await execAsync(command);

        Logger.info("Database restore completed successfully", {
            fileName: backupFileName,
        });

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
export const getBackupsList = () => {
    try {
        const files = fs
            .readdirSync(BACKUP_DIR)
            .filter((file) => file.endsWith(".gz"))
            .map((file) => {
                const filePath = path.join(BACKUP_DIR, file);
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
const cleanupOldBackups = async () => {
    try {
        const backups = getBackupsList();

        if (backups.length > MAX_BACKUPS) {
            const backupsToDelete = backups.slice(MAX_BACKUPS);

            for (const backup of backupsToDelete) {
                const backupPath = path.join(BACKUP_DIR, backup.fileName);
                fs.unlinkSync(backupPath);
                Logger.info("Old backup deleted", {
                    fileName: backup.fileName,
                });
            }
        }
    } catch (error) {
        Logger.error("Failed to cleanup old backups", { error: error.message });
    }
};

// Delete specific backup
export const deleteBackup = (backupFileName) => {
    try {
        const backupPath = path.join(BACKUP_DIR, backupFileName);

        if (!fs.existsSync(backupPath)) {
            throw new Error("ملف النسخة الاحتياطية غير موجود");
        }

        fs.unlinkSync(backupPath);
        Logger.info("Backup deleted", { fileName: backupFileName });

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
            Logger.info("Scheduled backup completed");
        } catch (error) {
            Logger.error("Scheduled backup failed", { error: error.message });
        }
    }, BACKUP_INTERVAL);

    Logger.info("Automatic backup scheduler started");
};
