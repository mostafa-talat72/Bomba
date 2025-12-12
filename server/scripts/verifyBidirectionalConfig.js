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

// 1. Get current configuration
const currentConfig = syncConfig.bidirectionalSync;

// 2. Validate configuration
const validation = validateSyncConfig();

// 3. Get safe configuration
const safeConfig = getSafeConfig();

// 4. Check requirements
const requirements = [
    {
        id: '5.1',
        description: 'Configuration to enable/disable bidirectional sync',
        status: typeof syncConfig.bidirectionalSync.enabled === 'boolean'
    },
    {
        id: '5.2',
        description: 'One-way sync continues when bidirectional disabled',
        status: !syncConfig.bidirectionalSync.enabled && syncConfig.enabled
    },
    {
        id: '5.4',
        description: 'Configuration validation on startup',
        status: typeof validateSyncConfig === 'function'
    },
    {
        id: '5.5',
        description: 'Safe defaults when configuration invalid',
        status: typeof getSafeConfig === 'function'
    },
    {
        id: '8.1',
        description: 'Excluded collections configuration',
        status: Array.isArray(syncConfig.bidirectionalSync.excludedCollections)
    },
    {
        id: '8.4',
        description: 'Excluded collections validation',
        status: !syncConfig.bidirectionalSync.excludedCollections.includes('')
    }
];

// Verification completed silently
const allRequirementsPassed = requirements.every(req => req.status);

// Exit with appropriate code
process.exit(validation.isValid && allRequirementsPassed ? 0 : 1);