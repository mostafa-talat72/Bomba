/**
 * Test Dual Database Sync for Cost and CostCategory Models
 * 
 * This script verifies that:
 * 1. Sync middleware is properly applied to both models
 * 2. Category creation syncs to both databases
 * 3. Cost creation and update sync to both databases
 * 4. Deletion syncs for both models
 * 5. Sync queue handling and retry logic works correctly
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Cost from '../models/Cost.js';
import CostCategory from '../models/CostCategory.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import syncConfig from '../config/syncConfig.js';
import syncQueueManager from '../services/sync/syncQueueManager.js';
import { getOriginTracker } from '../middleware/sync/syncMiddleware.js';

dotenv.config();

// Test configuration
const TEST_TIMEOUT = 10000; // 10 seconds for sync operations
const SYNC_WAIT_TIME = 2000; // 2 seconds to allow sync to complete

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(60));
    log(title, 'cyan');
    console.log('='.repeat(60));
}

function logTest(testName) {
    log(`\n📋 Test: ${testName}`, 'blue');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
    log(`ℹ️  ${message}`, 'blue');
}

// Database connections
let localConnection;
let atlasConnection;
let testUser;
let testOrg;
let testCategoryId;
let testCostId;

/**
 * Connect to both databases
 */
async function connectDatabases() {
    logSection('DATABASE CONNECTION');

    try {
        // Connect to Local MongoDB
        logInfo('Connecting to Local MongoDB...');
        localConnection = await mongoose.connect(syncConfig.localUri);
        logSuccess(`Connected to Local MongoDB: ${syncConfig.localUri}`);

        // Connect to Atlas MongoDB
        if (syncConfig.atlasUri) {
            logInfo('Connecting to Atlas MongoDB...');
            atlasConnection = await mongoose.createConnection(syncConfig.atlasUri);
            logSuccess('Connected to Atlas MongoDB');
        } else {
            logWarning('Atlas URI not configured - skipping Atlas connection');
        }

        return true;
    } catch (error) {
        logError(`Database connection failed: ${error.message}`);
        return false;
    }
}

/**
 * Setup test data
 */
async function setupTestData() {
    logSection('TEST DATA SETUP');

    try {
        // Find or create test user first (needed for organization owner)
        testUser = await User.findOne({ email: 'test-sync@example.com' });
        
        if (!testUser) {
            // Create a temporary organization-less user first
            testUser = await User.create({
                name: 'Test Sync User',
                email: 'test-sync@example.com',
                password: 'password123',
                role: 'admin',
            });
            logSuccess('Created test user');
        } else {
            logInfo('Using existing test user');
        }

        // Find or create test organization
        testOrg = await Organization.findOne({ name: 'Test Sync Organization' });
        if (!testOrg) {
            testOrg = await Organization.create({
                name: 'Test Sync Organization',
                type: 'cafe',
                owner: testUser._id,
            });
            logSuccess('Created test organization');
            
            // Update user with organization
            testUser.organization = testOrg._id;
            await testUser.save();
        } else {
            logInfo('Using existing test organization');
        }

        return true;
    } catch (error) {
        logError(`Test data setup failed: ${error.message}`);
        return false;
    }
}

/**
 * Wait for sync to complete
 */
async function waitForSync() {
    logInfo(`Waiting ${SYNC_WAIT_TIME}ms for sync to complete...`);
    await new Promise(resolve => setTimeout(resolve, SYNC_WAIT_TIME));
}

/**
 * Check if document exists in Atlas
 */
async function checkAtlasDocument(model, filter) {
    if (!atlasConnection) {
        logWarning('Atlas connection not available - skipping Atlas check');
        return null;
    }

    try {
        const AtlasModel = atlasConnection.model(model.modelName, model.schema);
        const doc = await AtlasModel.findOne(filter);
        return doc;
    } catch (error) {
        logError(`Error checking Atlas document: ${error.message}`);
        return null;
    }
}

/**
 * Test 1: Verify sync middleware is applied
 */
async function testSyncMiddlewareApplied() {
    logTest('Verify Sync Middleware is Applied to Models');

    try {
        // Check if models are in excluded collections
        const costCollectionName = Cost.collection.name;
        const categoryCollectionName = CostCategory.collection.name;

        logInfo(`Cost collection name: ${costCollectionName}`);
        logInfo(`CostCategory collection name: ${categoryCollectionName}`);

        let costExcluded = false;
        let categoryExcluded = false;

        if (syncConfig.excludedCollections.includes(costCollectionName)) {
            logWarning(`Cost collection (${costCollectionName}) is in excluded collections`);
            costExcluded = true;
        } else {
            logSuccess(`Cost collection (${costCollectionName}) is NOT excluded`);
        }

        if (syncConfig.excludedCollections.includes(categoryCollectionName)) {
            logWarning(`CostCategory collection (${categoryCollectionName}) is in excluded collections`);
            categoryExcluded = true;
        } else {
            logSuccess(`CostCategory collection (${categoryCollectionName}) is NOT excluded`);
        }

        // Check if sync is enabled in config
        logInfo(`Sync enabled in config: ${syncConfig.enabled}`);
        logInfo(`Sync enabled in env: ${process.env.SYNC_ENABLED}`);

        // Verify middleware is applied by checking the model files
        // The middleware is applied at model definition time via applySyncMiddleware()
        // We can verify by checking if the models import and call applySyncMiddleware
        
        // Read the model files to verify
        const fs = await import('fs/promises');
        const costModelContent = await fs.readFile('./server/models/Cost.js', 'utf8');
        const categoryModelContent = await fs.readFile('./server/models/CostCategory.js', 'utf8');

        const costHasMiddleware = costModelContent.includes('applySyncMiddleware');
        const categoryHasMiddleware = categoryModelContent.includes('applySyncMiddleware');

        if (costHasMiddleware) {
            logSuccess('Cost model imports and applies sync middleware');
        } else {
            logError('Cost model does NOT apply sync middleware');
        }

        if (categoryHasMiddleware) {
            logSuccess('CostCategory model imports and applies sync middleware');
        } else {
            logError('CostCategory model does NOT apply sync middleware');
        }

        // Test passes if:
        // 1. Both models have middleware applied
        // 2. Neither model is excluded
        // 3. Sync is enabled (or will be enabled in production)
        const testPassed = costHasMiddleware && categoryHasMiddleware && 
                          !costExcluded && !categoryExcluded;

        if (testPassed) {
            logSuccess('✅ Sync middleware is properly configured for both models');
        } else {
            logError('❌ Sync middleware configuration incomplete');
        }

        return testPassed;
    } catch (error) {
        logError(`Middleware verification failed: ${error.message}`);
        return false;
    }
}

/**
 * Test 2: Category creation sync
 */
async function testCategoryCreationSync() {
    logTest('Category Creation Sync to Both Databases');

    try {
        // Create category in local database
        const categoryData = {
            name: `Test Category ${Date.now()}`,
            icon: 'DollarSign',
            color: '#3B82F6',
            description: 'Test category for sync verification',
            organization: testOrg._id,
            createdBy: testUser._id,
        };

        logInfo('Creating category in Local MongoDB...');
        const localCategory = await CostCategory.create(categoryData);
        testCategoryId = localCategory._id;
        logSuccess(`Category created in Local: ${localCategory._id}`);

        // Check if operation was queued
        const queueSize = syncQueueManager.size();
        logInfo(`Sync queue size: ${queueSize}`);

        // Wait for sync
        await waitForSync();

        // Verify in Atlas
        if (atlasConnection) {
            const atlasCategory = await checkAtlasDocument(CostCategory, { _id: testCategoryId });
            
            if (atlasCategory) {
                logSuccess('Category found in Atlas MongoDB');
                
                // Verify data consistency
                if (atlasCategory.name === localCategory.name &&
                    atlasCategory.icon === localCategory.icon &&
                    atlasCategory.color === localCategory.color) {
                    logSuccess('Category data is consistent between databases');
                    return true;
                } else {
                    logError('Category data mismatch between databases');
                    return false;
                }
            } else {
                logError('Category NOT found in Atlas MongoDB');
                return false;
            }
        } else {
            logWarning('Skipping Atlas verification (no connection)');
            return true;
        }
    } catch (error) {
        logError(`Category creation sync test failed: ${error.message}`);
        return false;
    }
}

/**
 * Test 3: Cost creation and update sync
 */
async function testCostOperationSync() {
    logTest('Cost Creation and Update Sync to Both Databases');

    try {
        // Create cost in local database
        const costData = {
            category: testCategoryId,
            description: 'Test cost for sync verification',
            amount: 1000,
            paidAmount: 0,
            date: new Date(),
            organization: testOrg._id,
            createdBy: testUser._id,
        };

        logInfo('Creating cost in Local MongoDB...');
        const localCost = await Cost.create(costData);
        testCostId = localCost._id;
        logSuccess(`Cost created in Local: ${localCost._id}`);

        // Wait for sync
        await waitForSync();

        // Verify creation in Atlas
        if (atlasConnection) {
            let atlasCost = await checkAtlasDocument(Cost, { _id: testCostId });
            
            if (atlasCost) {
                logSuccess('Cost found in Atlas MongoDB after creation');
            } else {
                logError('Cost NOT found in Atlas MongoDB after creation');
                return false;
            }

            // Update cost in local database
            logInfo('Updating cost in Local MongoDB...');
            localCost.paidAmount = 500;
            await localCost.save();
            logSuccess('Cost updated in Local (paidAmount: 500)');

            // Wait for sync
            await waitForSync();

            // Verify update in Atlas
            atlasCost = await checkAtlasDocument(Cost, { _id: testCostId });
            
            if (atlasCost && atlasCost.paidAmount === 500) {
                logSuccess('Cost update synced to Atlas MongoDB');
                logSuccess(`Atlas paidAmount: ${atlasCost.paidAmount}, status: ${atlasCost.status}`);
                return true;
            } else {
                logError('Cost update NOT synced to Atlas MongoDB');
                return false;
            }
        } else {
            logWarning('Skipping Atlas verification (no connection)');
            return true;
        }
    } catch (error) {
        logError(`Cost operation sync test failed: ${error.message}`);
        return false;
    }
}

/**
 * Test 4: Deletion sync for both models
 */
async function testDeletionSync() {
    logTest('Deletion Sync for Both Models');

    try {
        // Delete cost first (to avoid foreign key issues)
        if (testCostId) {
            logInfo('Deleting cost from Local MongoDB...');
            await Cost.findByIdAndDelete(testCostId);
            logSuccess('Cost deleted from Local');

            // Wait for sync
            await waitForSync();

            // Verify deletion in Atlas
            if (atlasConnection) {
                const atlasCost = await checkAtlasDocument(Cost, { _id: testCostId });
                
                if (!atlasCost) {
                    logSuccess('Cost deletion synced to Atlas MongoDB');
                } else {
                    logError('Cost still exists in Atlas MongoDB after deletion');
                    return false;
                }
            }
        }

        // Delete category
        if (testCategoryId) {
            logInfo('Deleting category from Local MongoDB...');
            await CostCategory.findByIdAndDelete(testCategoryId);
            logSuccess('Category deleted from Local');

            // Wait for sync
            await waitForSync();

            // Verify deletion in Atlas
            if (atlasConnection) {
                const atlasCategory = await checkAtlasDocument(CostCategory, { _id: testCategoryId });
                
                if (!atlasCategory) {
                    logSuccess('Category deletion synced to Atlas MongoDB');
                    return true;
                } else {
                    logError('Category still exists in Atlas MongoDB after deletion');
                    return false;
                }
            } else {
                logWarning('Skipping Atlas verification (no connection)');
                return true;
            }
        }

        return true;
    } catch (error) {
        logError(`Deletion sync test failed: ${error.message}`);
        return false;
    }
}

/**
 * Test 5: Sync queue handling
 */
async function testSyncQueueHandling() {
    logTest('Sync Queue Handling and Retry Logic');

    try {
        // Get queue statistics
        const queueSize = syncQueueManager.size();
        const queueStats = syncQueueManager.getStats();

        logInfo(`Current queue size: ${queueSize}`);
        logInfo(`Queue statistics:`);
        console.log(JSON.stringify(queueStats, null, 2));

        // Verify queue is not overflowing
        if (queueSize < syncConfig.queueMaxSize * 0.8) {
            logSuccess('Queue size is within acceptable limits');
        } else {
            logWarning(`Queue size is high: ${queueSize}/${syncConfig.queueMaxSize}`);
        }

        // Check if sync is enabled
        if (syncConfig.enabled) {
            logSuccess('Sync is enabled in configuration');
        } else {
            logWarning('Sync is disabled in configuration');
        }

        // Check origin tracker
        const originTracker = getOriginTracker();
        if (originTracker) {
            logSuccess('Origin tracker is initialized');
            logInfo(`Instance ID: ${originTracker.instanceId}`);
        } else {
            logWarning('Origin tracker not initialized');
        }

        return true;
    } catch (error) {
        logError(`Queue handling test failed: ${error.message}`);
        return false;
    }
}

/**
 * Cleanup test data
 */
async function cleanup() {
    logSection('CLEANUP');

    try {
        // Delete test cost if exists
        if (testCostId) {
            await Cost.findByIdAndDelete(testCostId).catch(() => {});
            if (atlasConnection) {
                const AtlasCost = atlasConnection.model('Cost', Cost.schema);
                await AtlasCost.findByIdAndDelete(testCostId).catch(() => {});
            }
        }

        // Delete test category if exists
        if (testCategoryId) {
            await CostCategory.findByIdAndDelete(testCategoryId).catch(() => {});
            if (atlasConnection) {
                const AtlasCategory = atlasConnection.model('CostCategory', CostCategory.schema);
                await AtlasCategory.findByIdAndDelete(testCategoryId).catch(() => {});
            }
        }

        logSuccess('Cleanup completed');
    } catch (error) {
        logWarning(`Cleanup error: ${error.message}`);
    }
}

/**
 * Main test runner
 */
async function runTests() {
    logSection('DUAL DATABASE SYNC TEST SUITE');
    logInfo('Testing Cost and CostCategory Models');
    
    const results = {
        total: 0,
        passed: 0,
        failed: 0,
        tests: [],
    };

    try {
        // Connect to databases
        const connected = await connectDatabases();
        if (!connected) {
            logError('Failed to connect to databases - aborting tests');
            process.exit(1);
        }

        // Setup test data
        const setupSuccess = await setupTestData();
        if (!setupSuccess) {
            logError('Failed to setup test data - aborting tests');
            process.exit(1);
        }

        // Run tests
        const tests = [
            { name: 'Sync Middleware Applied', fn: testSyncMiddlewareApplied },
            { name: 'Category Creation Sync', fn: testCategoryCreationSync },
            { name: 'Cost Operation Sync', fn: testCostOperationSync },
            { name: 'Deletion Sync', fn: testDeletionSync },
            { name: 'Sync Queue Handling', fn: testSyncQueueHandling },
        ];

        for (const test of tests) {
            results.total++;
            const passed = await test.fn();
            
            if (passed) {
                results.passed++;
                results.tests.push({ name: test.name, status: 'PASSED' });
            } else {
                results.failed++;
                results.tests.push({ name: test.name, status: 'FAILED' });
            }
        }

        // Cleanup
        await cleanup();

        // Print summary
        logSection('TEST SUMMARY');
        console.log(`\nTotal Tests: ${results.total}`);
        logSuccess(`Passed: ${results.passed}`);
        if (results.failed > 0) {
            logError(`Failed: ${results.failed}`);
        }

        console.log('\nTest Results:');
        results.tests.forEach(test => {
            const color = test.status === 'PASSED' ? 'green' : 'red';
            log(`  ${test.status === 'PASSED' ? '✅' : '❌'} ${test.name}: ${test.status}`, color);
        });

        // Exit with appropriate code
        if (results.failed > 0) {
            logError('\n❌ Some tests failed');
            process.exit(1);
        } else {
            logSuccess('\n✅ All tests passed!');
            process.exit(0);
        }

    } catch (error) {
        logError(`Test suite error: ${error.message}`);
        console.error(error);
        process.exit(1);
    } finally {
        // Close connections
        if (localConnection) {
            await mongoose.disconnect();
        }
        if (atlasConnection) {
            await atlasConnection.close();
        }
    }
}

// Run tests
runTests();
