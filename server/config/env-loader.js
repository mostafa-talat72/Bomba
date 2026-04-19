/**
 * Environment Variable Loader
 * 
 * CRITICAL: This file MUST be imported FIRST before any other imports
 * in server.js to ensure environment variables are loaded before
 * any configuration files try to read them.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from server directory
const envPath = join(__dirname, '../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('❌ Failed to load .env file:', result.error.message);
    console.error(`   Tried to load from: ${envPath}`);
    process.exit(1);
}

console.log('✅ Environment variables loaded from:', envPath);

// Export a flag to confirm loading
export const ENV_LOADED = true;
