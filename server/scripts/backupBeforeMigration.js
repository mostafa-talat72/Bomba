import { createDatabaseBackup } from '../utils/backup.js';
import dotenv from 'dotenv';

dotenv.config();

async function backupDatabase() {
    try {
        
        const result = await createDatabaseBackup();
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Backup failed:', error.message);
        process.exit(1);
    }
}

backupDatabase();
