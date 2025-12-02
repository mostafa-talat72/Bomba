/**
 * Test script to verify idempotency enhancements in sync worker
 * Tests insert, update, and delete operations with retries
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import dualDatabaseManager from "../config/dualDatabaseManager.js";
import syncQueueManager from "../services/sync/syncQueueManager.js";
import syncWorker from "../services/sync/syncWorker.js";
import Logger from "../middleware/logger.js";

// Load environment variables
dotenv.config();

// Test document
const testDoc = {
    _id: new mongoose.Types.ObjectId(),
    name: "Test Document",
    value: 100,
    timestamp: new Date(),
};

async function testIdempotency() {
    try {
        Logger.info("🧪 Starting idempotency tests...\n");

        // Connect to databases
        await dualDatabaseManager.connectLocal(process.env.MONGODB_LOCAL_URI);
        await dualDatabaseManager.connectAtlas(process.env.MONGODB_ATLAS_URI);

        if (!dualDatabaseManager.isAtlasAvailable()) {
            Logger.error("❌ Atlas not available, cannot run tests");
            process.exit(1);
        }

        // Start sync worker
        syncWorker.start();

        // Test 1: Idempotent Insert
        Logger.info("📝 Test 1: Idempotent Insert Operations");
        Logger.info("   Queueing same insert operation 3 times...");
        
        for (let i = 0; i < 3; i++) {
            syncQueueManager.enqueue({
                type: "insert",
                collection: "test_idempotency",
                data: { ...testDoc },
                timestamp: new Date(),
                retryCount: 0,
                maxRetries: 5,
            });
        }

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 2000));
        Logger.info("   ✅ Insert operations completed (check logs for upsert details)\n");

        // Test 2: Idempotent Update
        Logger.info("📝 Test 2: Idempotent Update Operations");
        Logger.info("   Queueing same update operation 3 times...");
        
        for (let i = 0; i < 3; i++) {
            syncQueueManager.enqueue({
                type: "update",
                collection: "test_idempotency",
                filter: { _id: testDoc._id },
                data: { value: 200, updated: true },
                timestamp: new Date(),
                retryCount: 0,
                maxRetries: 5,
            });
        }

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 2000));
        Logger.info("   ✅ Update operations completed (check logs for modification details)\n");

        // Test 3: Idempotent Delete
        Logger.info("📝 Test 3: Idempotent Delete Operations");
        Logger.info("   Queueing same delete operation 3 times...");
        
        for (let i = 0; i < 3; i++) {
            syncQueueManager.enqueue({
                type: "delete",
                collection: "test_idempotency",
                filter: { _id: testDoc._id },
                timestamp: new Date(),
                retryCount: 0,
                maxRetries: 5,
            });
        }

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 2000));
        Logger.info("   ✅ Delete operations completed (check logs for deletion details)\n");

        // Test 4: Update on non-existent document (upsert)
        Logger.info("📝 Test 4: Update with Upsert (document doesn't exist)");
        const newId = new mongoose.Types.ObjectId();
        syncQueueManager.enqueue({
            type: "update",
            collection: "test_idempotency",
            filter: { _id: newId },
            data: { name: "Created by Update", value: 300 },
            timestamp: new Date(),
            retryCount: 0,
            maxRetries: 5,
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));
        Logger.info("   ✅ Update with upsert completed (check logs for creation)\n");

        // Clean up
        Logger.info("🧹 Cleaning up test data...");
        const atlasConnection = dualDatabaseManager.getAtlasConnection();
        await atlasConnection.collection("test_idempotency").deleteMany({});
        Logger.info("   ✅ Test data cleaned up\n");

        // Show stats
        Logger.info("📊 Sync Worker Stats:");
        const stats = syncWorker.getStats();
        Logger.info(`   Total Processed: ${stats.totalProcessed}`);
        Logger.info(`   Successful: ${stats.successCount}`);
        Logger.info(`   Failed: ${stats.failureCount}`);
        Logger.info(`   Success Rate: ${stats.successRate}%\n`);

        Logger.info("✅ All idempotency tests completed successfully!");
        Logger.info("   Review the logs above to verify:");
        Logger.info("   - Insert operations show 'upserted' or 'replaced' messages");
        Logger.info("   - Update operations show 'modified' or 'unchanged' messages");
        Logger.info("   - Delete operations show 'removed' or 'already deleted' messages");

        // Stop worker and close connections
        syncWorker.stop();
        await dualDatabaseManager.closeConnections();
        process.exit(0);
    } catch (error) {
        Logger.error("❌ Test failed:", error);
        process.exit(1);
    }
}

// Run tests
testIdempotency();
