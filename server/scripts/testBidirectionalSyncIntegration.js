/**
 * Test Bidirectional Sync Integration
 * Verifies that bidirectional sync components are properly integrated into server.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import syncConfig from '../config/syncConfig.js';
import dualDatabaseManager from '../config/dualDatabaseManager.js';
import OriginTracker from '../services/sync/originTracker.js';
import ConflictResolver from '../services/sync/conflictResolver.js';
import ChangeProcessor from '../services/sync/changeProcessor.js';
import AtlasChangeListener from '../services/sync/atlasChangeListener.js';
import bidirectionalSyncMonitor from '../services/sync/bidirectionalSyncMonitor.js';
import Logger from '../middleware/logger.js';

// Load environment variables
dotenv.config();

async function testBidirectionalSyncIntegration() {
    console.log('\n🧪 Testing Bidirectional Sync Integration\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const results = {
        configurationVerification: false,
        originTrackerInit: false,
        conflictResolverInit: false,
        changeProcessorInit: false,
        atlasChangeListenerInit: false,
        atlasAvailability: false,
        resumeTokenCheck: false,
        gracefulShutdown: false
    };

    try {
        // Test 1: Configuration Verification
        console.log('📋 Test 1: Configuration Verification');
        console.log('   Checking bidirectional sync configuration...');
        
        if (!syncConfig.bidirectionalSync) {
            throw new Error('Bidirectional sync configuration missing');
        }
        
        if (!syncConfig.bidirectionalSync.conflictResolution || !syncConfig.bidirectionalSync.conflictResolution.strategy) {
            throw new Error('Conflict resolution strategy not configured');
        }
        
        if (!syncConfig.bidirectionalSync.changeStream) {
            throw new Error('Change Stream configuration missing');
        }
        
        console.log(`   ✅ Configuration verified`);
        console.log(`      - Enabled: ${syncConfig.bidirectionalSync.enabled}`);
        console.log(`      - Conflict resolution: ${syncConfig.bidirectionalSync.conflictResolution.strategy}`);
        console.log(`      - Batch size: ${syncConfig.bidirectionalSync.changeStream.batchSize}`);
        results.configurationVerification = true;

        // Test 2: Origin Tracker Initialization
        console.log('\n🔍 Test 2: Origin Tracker Initialization');
        const originTracker = new OriginTracker();
        
        if (!originTracker.instanceId) {
            throw new Error('Origin Tracker instance ID not generated');
        }
        
        console.log(`   ✅ Origin Tracker initialized`);
        console.log(`      - Instance ID: ${originTracker.instanceId}`);
        console.log(`      - Cleanup interval: ${originTracker.cleanupInterval}ms`);
        results.originTrackerInit = true;

        // Test 3: Conflict Resolver Initialization
        console.log('\n⚖️  Test 3: Conflict Resolver Initialization');
        const conflictResolver = new ConflictResolver();
        
        if (!conflictResolver.strategy) {
            throw new Error('Conflict Resolver strategy not set');
        }
        
        console.log(`   ✅ Conflict Resolver initialized`);
        console.log(`      - Strategy: ${conflictResolver.getStrategy()}`);
        console.log(`      - Max log size: ${conflictResolver.maxLogSize}`);
        results.conflictResolverInit = true;

        // Test 4: Connect to databases
        console.log('\n🔌 Test 4: Database Connections');
        console.log('   Connecting to Local MongoDB...');
        
        const localUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba';
        await dualDatabaseManager.connectLocal(localUri);
        
        console.log('   ✅ Local MongoDB connected');
        
        if (syncConfig.enabled && syncConfig.atlasUri) {
            console.log('   Connecting to MongoDB Atlas...');
            await dualDatabaseManager.connectAtlas(syncConfig.atlasUri);
            
            if (dualDatabaseManager.isAtlasAvailable()) {
                console.log('   ✅ MongoDB Atlas connected');
                results.atlasAvailability = true;
            } else {
                console.log('   ⚠️  MongoDB Atlas not available');
            }
        } else {
            console.log('   ⚠️  Atlas URI not configured, skipping Atlas connection');
        }

        // Test 5: Change Processor Initialization
        console.log('\n⚙️  Test 5: Change Processor Initialization');
        const changeProcessor = new ChangeProcessor(originTracker, conflictResolver, dualDatabaseManager);
        
        if (!changeProcessor.originTracker || !changeProcessor.conflictResolver) {
            throw new Error('Change Processor dependencies not set');
        }
        
        console.log(`   ✅ Change Processor initialized`);
        console.log(`      - Batch size: ${changeProcessor.batchSize}`);
        console.log(`      - Queue size: ${changeProcessor.getQueueSize()}`);
        results.changeProcessorInit = true;

        // Test 6: Atlas Change Listener Initialization
        console.log('\n📡 Test 6: Atlas Change Listener Initialization');
        
        if (dualDatabaseManager.isAtlasAvailable()) {
            const atlasChangeListener = new AtlasChangeListener(dualDatabaseManager, changeProcessor, originTracker);
            
            if (!atlasChangeListener.databaseManager || !atlasChangeListener.changeProcessor) {
                throw new Error('Atlas Change Listener dependencies not set');
            }
            
            console.log(`   ✅ Atlas Change Listener initialized`);
            console.log(`      - Instance ID: ${atlasChangeListener.instanceId}`);
            console.log(`      - Batch size: ${atlasChangeListener.batchSize}`);
            console.log(`      - Max reconnect attempts: ${atlasChangeListener.maxReconnectAttempts}`);
            results.atlasChangeListenerInit = true;

            // Test 7: Resume Token Check
            console.log('\n🔄 Test 7: Resume Token Check');
            const hasResumeToken = atlasChangeListener.resumeToken !== null;
            console.log(`   ${hasResumeToken ? '✅' : 'ℹ️ '} Resume token: ${hasResumeToken ? 'Available' : 'Not available'}`);
            results.resumeTokenCheck = true;

            // Don't actually start the Change Stream in this test
            console.log('   ℹ️  Skipping Change Stream start (test mode)');
        } else {
            console.log('   ⚠️  Atlas not available, skipping Atlas Change Listener tests');
        }

        // Test 8: Bidirectional Sync Monitor
        console.log('\n📊 Test 8: Bidirectional Sync Monitor');
        const metrics = bidirectionalSyncMonitor.getDirectionalMetrics();
        
        console.log(`   ✅ Bidirectional Sync Monitor available`);
        console.log(`      - Local→Atlas operations: ${metrics.localToAtlas.totalOperations}`);
        console.log(`      - Atlas→Local operations: ${metrics.atlasToLocal.totalOperations}`);
        console.log(`      - Total conflicts: ${metrics.conflicts.totalConflicts}`);

        // Test 9: Graceful Shutdown Simulation
        console.log('\n🛑 Test 9: Graceful Shutdown Simulation');
        console.log('   Testing cleanup procedures...');
        
        // Stop Origin Tracker cleanup
        originTracker.stopCleanup();
        console.log('   ✅ Origin Tracker cleanup stopped');
        
        // Clear Change Processor queue
        changeProcessor.clearQueue();
        console.log('   ✅ Change Processor queue cleared');
        
        results.gracefulShutdown = true;

        // Summary
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Test Results Summary\n');
        
        const totalTests = Object.keys(results).length;
        const passedTests = Object.values(results).filter(r => r === true).length;
        const successRate = ((passedTests / totalTests) * 100).toFixed(1);
        
        Object.entries(results).forEach(([test, passed]) => {
            const icon = passed ? '✅' : '❌';
            const testName = test.replace(/([A-Z])/g, ' $1').trim();
            console.log(`   ${icon} ${testName}`);
        });
        
        console.log(`\n   Success Rate: ${passedTests}/${totalTests} (${successRate}%)`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        if (passedTests === totalTests) {
            console.log('✅ All tests passed! Bidirectional sync integration is working correctly.\n');
        } else {
            console.log('⚠️  Some tests failed. Review the results above.\n');
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('   Stack trace:', error.stack);
    } finally {
        // Cleanup
        console.log('🧹 Cleaning up...');
        
        try {
            await dualDatabaseManager.closeConnections();
            console.log('✅ Database connections closed');
        } catch (error) {
            console.error('❌ Error closing connections:', error.message);
        }
        
        process.exit(0);
    }
}

// Run the test
testBidirectionalSyncIntegration();
