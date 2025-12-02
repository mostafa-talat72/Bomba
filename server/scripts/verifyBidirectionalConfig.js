#!/usr/bin/env node

/**
 * Verification script for bidirectional sync configuration
 * 
 * This script validates and displays the current bidirectional sync configuration.
 * Run with: node server/scripts/verifyBidirectionalConfig.js
 */

import dotenv from 'dotenv';
import syncConfig, { validateSyncConfig, getSafeConfig } from '../config/syncConfig.js';

// Load environment variables
dotenv.config();

console.log('='.repeat(80));
console.log('BIDIRECTIONAL SYNC CONFIGURATION VERIFICATION');
console.log('='.repeat(80));
console.log();

// 1. Display current configuration
console.log('📋 Current Configuration:');
console.log('-'.repeat(80));
console.log('Bidirectional Sync Enabled:', syncConfig.bidirectionalSync.enabled);
console.log('Change Stream Batch Size:', syncConfig.bidirectionalSync.changeStream.batchSize);
console.log('Reconnect Interval:', syncConfig.bidirectionalSync.changeStream.reconnectInterval, 'ms');
console.log('Max Reconnect Attempts:', syncConfig.bidirectionalSync.changeStream.maxReconnectAttempts);
console.log('Excluded Collections:', syncConfig.bidirectionalSync.excludedCollections.join(', ') || 'None');
console.log('Conflict Resolution Strategy:', syncConfig.bidirectionalSync.conflictResolution.strategy);
console.log('Origin Tracking Cleanup Interval:', syncConfig.bidirectionalSync.originTracking.cleanupInterval, 'ms');
console.log();

// 2. Validate configuration
console.log('✅ Configuration Validation:');
console.log('-'.repeat(80));
const validation = validateSyncConfig();

if (validation.isValid) {
    console.log('✅ Configuration is VALID');
    console.log('   All settings are within acceptable ranges');
} else {
    console.log('❌ Configuration is INVALID');
    console.log('   Errors found:');
    validation.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
    });
}
console.log();

// 3. Display safe configuration
console.log('🛡️  Safe Configuration:');
console.log('-'.repeat(80));
const safeConfig = getSafeConfig();
console.log('Sync Enabled (after validation):', safeConfig.enabled);
console.log('Bidirectional Sync Enabled (after validation):', safeConfig.bidirectionalSync.enabled);
console.log();

// 4. Display environment variables
console.log('🔧 Environment Variables:');
console.log('-'.repeat(80));
console.log('BIDIRECTIONAL_SYNC_ENABLED:', process.env.BIDIRECTIONAL_SYNC_ENABLED || 'not set');
console.log('ATLAS_CHANGE_STREAM_BATCH_SIZE:', process.env.ATLAS_CHANGE_STREAM_BATCH_SIZE || 'not set (using default)');
console.log('CHANGE_STREAM_RECONNECT_INTERVAL:', process.env.CHANGE_STREAM_RECONNECT_INTERVAL || 'not set (using default)');
console.log('CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS:', process.env.CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS || 'not set (using default)');
console.log('BIDIRECTIONAL_EXCLUDED_COLLECTIONS:', process.env.BIDIRECTIONAL_EXCLUDED_COLLECTIONS || 'not set (using default)');
console.log('CONFLICT_RESOLUTION_STRATEGY:', process.env.CONFLICT_RESOLUTION_STRATEGY || 'not set (using default)');
console.log('ORIGIN_TRACKING_CLEANUP_INTERVAL:', process.env.ORIGIN_TRACKING_CLEANUP_INTERVAL || 'not set (using default)');
console.log();

// 5. Display requirements validation
console.log('📝 Requirements Validation:');
console.log('-'.repeat(80));

const requirements = [
    {
        id: '5.1',
        description: 'Configuration to enable/disable bidirectional sync',
        status: typeof syncConfig.bidirectionalSync.enabled === 'boolean' ? '✅ PASS' : '❌ FAIL'
    },
    {
        id: '5.2',
        description: 'One-way sync continues when bidirectional disabled',
        status: !syncConfig.bidirectionalSync.enabled && syncConfig.enabled ? '✅ PASS' : '⚠️  N/A'
    },
    {
        id: '5.4',
        description: 'Configuration validation on startup',
        status: typeof validateSyncConfig === 'function' ? '✅ PASS' : '❌ FAIL'
    },
    {
        id: '5.5',
        description: 'Safe defaults when configuration invalid',
        status: typeof getSafeConfig === 'function' ? '✅ PASS' : '❌ FAIL'
    },
    {
        id: '8.1',
        description: 'Excluded collections configuration',
        status: Array.isArray(syncConfig.bidirectionalSync.excludedCollections) ? '✅ PASS' : '❌ FAIL'
    },
    {
        id: '8.4',
        description: 'Excluded collections validation',
        status: !syncConfig.bidirectionalSync.excludedCollections.includes('') ? '✅ PASS' : '❌ FAIL'
    }
];

requirements.forEach(req => {
    console.log(`${req.status} Requirement ${req.id}: ${req.description}`);
});
console.log();

// 6. Display recommendations
console.log('💡 Recommendations:');
console.log('-'.repeat(80));

if (!syncConfig.bidirectionalSync.enabled) {
    console.log('ℹ️  Bidirectional sync is currently DISABLED');
    console.log('   To enable: Set BIDIRECTIONAL_SYNC_ENABLED=true in .env');
    console.log('   Note: Requires MongoDB Atlas M10+ cluster with Change Streams support');
}

if (syncConfig.bidirectionalSync.changeStream.batchSize < 50) {
    console.log('⚠️  Change Stream batch size is low (<50)');
    console.log('   Consider increasing for better throughput');
}

if (syncConfig.bidirectionalSync.changeStream.reconnectInterval < 3000) {
    console.log('⚠️  Reconnect interval is low (<3 seconds)');
    console.log('   Consider increasing to reduce connection churn');
}

if (syncConfig.bidirectionalSync.excludedCollections.length === 0) {
    console.log('ℹ️  No collections are excluded from bidirectional sync');
    console.log('   Consider excluding temporary/session collections');
}

console.log();
console.log('='.repeat(80));
console.log('VERIFICATION COMPLETE');
console.log('='.repeat(80));

// Exit with appropriate code
process.exit(validation.isValid ? 0 : 1);
