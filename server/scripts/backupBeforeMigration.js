import { createDatabaseBackup } from '../utils/backup.js';
import dotenv from 'dotenv';

dotenv.config();

async function backupDatabase() {
    try {
        console.log('🔄 Creating database backup before migration...\n');
        
        const result = await createDatabaseBackup();
        
        console.log('✅ Backup created successfully!');
        console.log(`   📁 File: ${result.fileName}`);
        console.log(`   📊 Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   📍 Path: ${result.path}\n`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Backup failed:', error.message);
        process.exit(1);
    }
}

backupDatabase();
