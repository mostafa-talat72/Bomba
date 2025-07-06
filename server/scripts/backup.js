import dotenv from 'dotenv';
import { createDatabaseBackup } from '../utils/backup.js';

dotenv.config();

const runBackup = async () => {
  try {
    console.log('Starting database backup...');
    const result = await createDatabaseBackup();
    console.log('Backup completed successfully:', result);
  } catch (error) {
    console.error('Backup failed:', error.message);
    process.exit(1);
  }
};

runBackup();