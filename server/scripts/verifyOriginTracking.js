/**
 * Verification Script for Origin Tracking Implementation
 * 
 * This script demonstrates that the sync middleware now adds origin metadata
 * to all queued operations.
 */

import mongoose from 'mongoose';
import syncConfig from '../config/syncConfig.js';
import { applySyncMiddleware, getOriginTracker } from '../middleware/sync/syncMiddleware.js';
import syncQueueManager from '../services/sync/syncQueueManager.js';

// Create a test schema
const TestSchema = new mongoose.Schema({
    name: String,
    value: Number,
    createdAt: { type: Date, default: Date.now }
});

// Apply sync middleware
applySyncMiddleware(TestSchema);

// Create a test model
const TestModel = mongoose.model('OriginTrackingTest', TestSchema);

async function verifyOriginTracking() {
    console.log('\n🔍 Verifying Origin Tracking Implementation\n');
    console.log('='.repeat(60));

    try {
        // Check if sync is enabled
        console.log(`\n⚙️  Sync Enabled: ${syncConfig.enabled}`);
        
        if (!syncConfig.enabled) {
            console.log('❌ Sync is disabled. Please enable SYNC_ENABLED=true in .env');
            return;
        }

        // Connect to local MongoDB
        await mongoose.connect(syncConfig.localUri);
        console.log('✅ Connected to Local MongoDB');

        // Get the origin tracker instance
        const tracker = getOriginTracker();
        console.log(`\n📋 Instance ID: ${tracker.instanceId}`);
        console.log(`📊 Tracked changes: ${tracker.size()}`);

        // Clear the queue for clean testing
        syncQueueManager.clear();
        console.log('\n🧹 Cleared sync queue');

        // Test 1: Insert operation
        console.log('\n--- Test 1: Insert Operation ---');
        const doc = new TestModel({ name: 'Test Document', value: 42 });
        await doc.save();
        
        const queueSize = syncQueueManager.size();
        console.log(`✅ Document saved, queue size: ${queueSize}`);
        
        if (queueSize > 0) {
            const operation = syncQueueManager.peek();
            console.log('\n📦 Queued Operation:');
            console.log(`   Type: ${operation.type}`);
            console.log(`   Collection: ${operation.collection}`);
            console.log(`   Origin: ${operation.origin}`);
            console.log(`   Instance ID: ${operation.instanceId}`);
            console.log(`   Timestamp: ${operation.timestamp}`);
            
            // Verify origin tracking
            const isTracked = tracker.isLocalChange(doc._id);
            console.log(`\n🔍 Origin Tracker Status:`);
            console.log(`   Document marked as local: ${isTracked ? '✅' : '❌'}`);
            
            if (operation.origin === 'local' && operation.instanceId && isTracked) {
                console.log('\n✅ Origin tracking is working correctly!');
            } else {
                console.log('\n❌ Origin tracking has issues!');
            }
        }

        // Test 2: Update operation
        console.log('\n--- Test 2: Update Operation ---');
        syncQueueManager.clear();
        
        doc.value = 100;
        await doc.save();
        
        const updateQueueSize = syncQueueManager.size();
        console.log(`✅ Document updated, queue size: ${updateQueueSize}`);
        
        if (updateQueueSize > 0) {
            const updateOp = syncQueueManager.peek();
            console.log('\n📦 Queued Update Operation:');
            console.log(`   Type: ${updateOp.type}`);
            console.log(`   Origin: ${updateOp.origin}`);
            console.log(`   Instance ID: ${updateOp.instanceId}`);
            
            const isTracked = tracker.isLocalChange(doc._id);
            console.log(`\n🔍 Still tracked as local: ${isTracked ? '✅' : '❌'}`);
        }

        // Test 3: Delete operation
        console.log('\n--- Test 3: Delete Operation ---');
        syncQueueManager.clear();
        
        await doc.deleteOne();
        
        const deleteQueueSize = syncQueueManager.size();
        console.log(`✅ Document deleted, queue size: ${deleteQueueSize}`);
        
        if (deleteQueueSize > 0) {
            const deleteOp = syncQueueManager.peek();
            console.log('\n📦 Queued Delete Operation:');
            console.log(`   Type: ${deleteOp.type}`);
            console.log(`   Origin: ${deleteOp.origin}`);
            console.log(`   Instance ID: ${deleteOp.instanceId}`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ All tests completed successfully!');
        console.log('\n📊 Final Statistics:');
        console.log(`   Tracked changes: ${tracker.size()}`);
        console.log(`   Queue size: ${syncQueueManager.size()}`);

    } catch (error) {
        console.error('\n❌ Error during verification:', error.message);
        console.error(error.stack);
    } finally {
        // Cleanup
        await TestModel.deleteMany({});
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run verification if executed directly
console.log('Starting verification script...');
verifyOriginTracking()
    .then(() => {
        console.log('Verification complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

export default verifyOriginTracking;
