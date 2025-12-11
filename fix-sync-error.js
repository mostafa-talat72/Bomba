#!/usr/bin/env node

/**
 * Quick fix for sync error with bills collection
 * This script will temporarily exclude bills from sync to prevent errors
 */

import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), 'server', '.env');

console.log('🔧 Fixing sync error for bills collection...');

try {
    // Read current .env file
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Check if SYNC_EXCLUDED_COLLECTIONS exists
    if (envContent.includes('SYNC_EXCLUDED_COLLECTIONS=')) {
        // Update existing line
        envContent = envContent.replace(
            /SYNC_EXCLUDED_COLLECTIONS=.*/,
            'SYNC_EXCLUDED_COLLECTIONS=bills'
        );
    } else {
        // Add new line
        envContent += '\n# Temporarily exclude bills from sync to prevent errors\nSYNC_EXCLUDED_COLLECTIONS=bills\n';
    }
    
    // Write back to file
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ Successfully excluded bills collection from sync');
    console.log('📝 Updated server/.env file');
    console.log('🔄 Please restart the server for changes to take effect');
    console.log('');
    console.log('To restart the server:');
    console.log('  npm run server:dev');
    console.log('');
    console.log('To re-enable bills sync later (when Atlas connection is stable):');
    console.log('  1. Edit server/.env');
    console.log('  2. Change SYNC_EXCLUDED_COLLECTIONS=bills to SYNC_EXCLUDED_COLLECTIONS=');
    console.log('  3. Restart the server');
    
} catch (error) {
    console.error('❌ Error fixing sync configuration:', error.message);
    console.log('');
    console.log('Manual fix:');
    console.log('1. Open server/.env file');
    console.log('2. Find the line: SYNC_EXCLUDED_COLLECTIONS=');
    console.log('3. Change it to: SYNC_EXCLUDED_COLLECTIONS=bills');
    console.log('4. Save the file and restart the server');
}