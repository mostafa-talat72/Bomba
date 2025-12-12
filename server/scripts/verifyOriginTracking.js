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
    try {
        // Check if sync is enabled
        if (!syncConfig.enabled) {
            return;
        }

        // Connect to local MongoDB
        await mongoose.connect(syncConfig.localUri);

        // Get the origin tracker instance
        const tracker = getOriginTracker();

        // Clear the queue for clean testing
        syncQueueManager.clear();

        // Test 1: Insert operation
        const doc = new TestModel({ name: 'Test Document', value: 42 });
        await doc.save();
        
        const queueSize = syncQueueManager.size();
        
        if (queueSize > 0) {
            const operation = syncQueueManager.peek();
            
            // Verify origin tracking
            const isTracked = tracker.isLocalChange(doc._id);
            
            if (!(operation.origin === 'local' && operation.instanceId && isTracked)) {
                throw new Error('Origin tracking verification failed');
            }
        }

        // Test 2: Update operation
        syncQueueManager.clear();
        
        doc.value = 100;
        await doc.save();
        
        const updateQueueSize = syncQueueManager.size();
        
        if (updateQueueSize > 0) {
            const updateOp = syncQueueManager.peek();
            const isTracked = tracker.isLocalChange(doc._id);
            
            if (!(updateOp.origin === 'local' && isTracked)) {
                throw new Error('Update origin tracking verification failed');
            }
        }

        // Test 3: Delete operation
        syncQueueManager.clear();
        
        await doc.deleteOne();
        
        const deleteQueueSize = syncQueueManager.size();
        
        if (deleteQueueSize > 0) {
            const deleteOp = syncQueueManager.peek();
            
            if (!(deleteOp.origin === 'local')) {
                throw new Error('Delete origin tracking verification failed');
            }
        }

    } catch (error) {
        throw error;
    } finally {
        // Cleanup
        await TestModel.deleteMany({});
        await mongoose.connection.close();
    }
}

// Run verification if executed directly
verifyOriginTracking()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        process.exit(1);
    });

export default verifyOriginTracking;
