#!/usr/bin/env node

/**
 * Quick fix for sync error with bills collection
 * This script will temporarily exclude bills from sync to prevent errors
 */

import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), 'server', '.env');

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
    
} catch (error) {
    // Error handling without console output
}