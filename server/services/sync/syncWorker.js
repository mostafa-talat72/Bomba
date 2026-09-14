import Logger from "../../middleware/logger.js";
import syncConfig from "../../config/syncConfig.js";
import dualDatabaseManager from "../../config/dualDatabaseManager.js";
import syncQueueManager from "./syncQueueManager.js";
import { rehydrateDocument, rehydrateFilter } from "../../utils/bsonRehydrate.js";
import { depopulateDocForSync, depopulateSyncPayload } from "../../utils/syncSanitize.js";

/**
 * SyncWorker
 * Processes queued synchronization operations in the background
 * Executes operations against Atlas with retry logic and exponential backoff
 */
class SyncWorker {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.baseInterval = syncConfig.workerInterval || 5000;
        this.processingInterval = this.baseInterval;
        this.retryDelays = syncConfig.retryDelays;
        this.processLoopTimer = null;
        this.atlasUnavailableSince = null;
        this.lastWarningLog = 0;
        this.warningLogThrottleMs = 60000; // log Atlas-unavailable at most once/min
        this.stats = {
            totalProcessed: 0,
            successCount: 0,
            failureCount: 0,
            lastProcessTime: null,
            avgProcessTime: 0,
            totalProcessTime: 0,
        };

        // Register for Atlas reconnection events
        this.setupReconnectionHandlers();
    }

    /**
     * Setup handlers for Atlas reconnection/disconnection
     */
    setupReconnectionHandlers() {
        // Handle Atlas reconnection
        dualDatabaseManager.onAtlasReconnected(() => {
            Logger.info("🔄 Atlas reconnected, resuming queue processing");
            this.handleAtlasReconnection();
        });

        // Handle Atlas disconnection
        dualDatabaseManager.onAtlasDisconnected(() => {
            Logger.warn("⚠️ Atlas disconnected, queue processing will pause");
            this.handleAtlasDisconnection();
        });
    }

    /**
     * Handle Atlas reconnection - resume processing
     */
    handleAtlasReconnection() {
        if (!this.isRunning) {
            return;
        }

        // Resume if paused
        if (this.isPaused) {
            this.resume();
        }

        // Log queue status
        const queueSize = syncQueueManager.size();
        if (queueSize > 0) {
            Logger.info(`📦 Resuming processing of ${queueSize} queued operations`);
            // Trigger immediate processing
            this.processQueue();
        }
    }

    /**
     * Handle Atlas disconnection
     */
    handleAtlasDisconnection() {
        const queueSize = syncQueueManager.size();
        if (queueSize > 0) {
            Logger.warn(`⚠️ ${queueSize} operations queued, waiting for Atlas reconnection`);
        }
    }

    /**
     * Start the sync worker
     */
    start() {
        if (this.isRunning) {
            return;
        }

        if (!syncConfig.enabled) {
            Logger.info("ℹ️  Sync is disabled, worker will not start");
            return;
        }

        this.isRunning = true;
        this.isPaused = false;
        this.processingInterval = this.baseInterval;
        
        Logger.info(`🚀 Sync worker started (interval: ${this.baseInterval}ms, batch: ${syncConfig.workerBatchSize})`);
        
        // Start processing loop
        this.scheduleNextProcess();
    }

    /**
     * Stop the sync worker
     */
    stop() {
        if (!this.isRunning) {
            Logger.warn("⚠️ Sync worker is not running");
            return;
        }

        this.isRunning = false;
        
        // Clear timer
        if (this.processLoopTimer) {
            clearTimeout(this.processLoopTimer);
            this.processLoopTimer = null;
        }

        Logger.info("🛑 Sync worker stopped");
        this.logStats();
    }

    /**
     * Pause the sync worker (keeps running but doesn't process)
     */
    pause() {
        this.isPaused = true;
        Logger.info("⏸️  Sync worker paused");
    }

    /**
     * Resume the sync worker
     */
    resume() {
        this.isPaused = false;
        Logger.info("▶️  Sync worker resumed");
        this.scheduleNextProcess();
    }

    /**
     * Schedule next process cycle
     */
    scheduleNextProcess() {
        if (!this.isRunning) {
            return;
        }

        const delay = this.processingInterval;
        
        this.processLoopTimer = setTimeout(() => {
            this.processQueue()
                .then(() => {
                    this.scheduleNextProcess();
                })
                .catch(error => {
                    Logger.error('Error in processQueue:', error);
                    this.scheduleNextProcess();
                });
        }, delay);
    }

    /**
     * Process the sync queue
     */
    async processQueue() {
        // Skip if paused or not running
        if (this.isPaused || !this.isRunning) {
            return;
        }

        // Skip if queue is empty
        if (syncQueueManager.isEmpty()) {
            // Reset to base interval when queue is empty
            if (this.processingInterval !== this.baseInterval) {
                this.processingInterval = this.baseInterval;
            }
            return;
        }

        // Skip if Atlas is not available — slow down to avoid log spam
        if (!dualDatabaseManager.isAtlasAvailable()) {
            if (!this.atlasUnavailableSince) {
                this.atlasUnavailableSince = Date.now();
            }
            // Back off: check every 30s when Atlas is down
            this.processingInterval = Math.max(this.processingInterval, 30000);

            // Throttled warning — at most once per minute
            const now = Date.now();
            if (now - this.lastWarningLog > this.warningLogThrottleMs) {
                const queueSize = syncQueueManager.size();
                const offlineSeconds = Math.round((now - this.atlasUnavailableSince) / 1000);
                Logger.warn(
                    `⚠️ Atlas offline for ${offlineSeconds}s, ${queueSize} operations queued (checking every ${Math.round(this.processingInterval / 1000)}s)`
                );
                this.lastWarningLog = now;
            }
            return;
        }

        // Atlas is available — reset interval and clear offline tracking
        if (this.atlasUnavailableSince) {
            Logger.info(`✅ Atlas reconnected after ${Math.round((Date.now() - this.atlasUnavailableSince) / 1000)}s offline`);
            this.atlasUnavailableSince = null;
        }
        this.processingInterval = this.baseInterval;

        // Process batch
        const queueSize = syncQueueManager.size();
        const batchSize = syncConfig.workerBatchSize || 100;
        const operationsToProcess = Math.min(queueSize, batchSize);

        if (operationsToProcess === 0) {
            return;
        }

        // Collect operations
        const operations = [];
        for (let i = 0; i < operationsToProcess; i++) {
            const operation = syncQueueManager.dequeue();
            if (operation) {
                operations.push(operation);
            }
        }

        if (operations.length === 0) {
            return;
        }

        const startTime = Date.now();
        const results = await Promise.allSettled(
            operations.map(op => this.executeOperationWithRetry(op))
        );

        let successCount = 0;
        let failureCount = 0;

        results.forEach((result, index) => {
            const operation = operations[index];
            
            if (result.status === 'fulfilled' && result.value.success) {
                successCount++;
                this.stats.successCount++;
            } else {
                failureCount++;
                this.stats.failureCount++;
                const error = result.status === 'rejected' ? result.reason : result.value.error;
                Logger.error(
                    `❌ Sync failed: ${operation.type} on ${operation.collection}`,
                    error?.message || error
                );
            }
            
            this.stats.totalProcessed++;
        });

        const duration = Date.now() - startTime;
        this.updateProcessTime(duration / operations.length);

        // Log batch results
        if (operations.length > 1) {
            Logger.info(
                `⚡ Batch synced: ${operations.length} ops in ${duration}ms ` +
                `(✅ ${successCount} | ❌ ${failureCount})`
            );
        } else if (successCount === 1) {
            Logger.debug(
                `✅ Synced: ${operations[0].type} on ${operations[0].collection} (${operations[0].id})`
            );
        }

        this.stats.lastProcessTime = new Date();

        // Notify monitor
        if (global.syncStatusMonitor && global.syncStatusMonitor.isRunning) {
            global.syncStatusMonitor.printOnChange(
                'Batch Sync',
                `${operations.length} operations in ${duration}ms`
            );
        }
    }

    /**
     * تنفيذ عملية مع إعادة المحاولة التلقائية
     */
    async executeOperationWithRetry(operation, attempt = 0) {
        try {
            await this.executeOperation(operation);
            return { success: true, operation };
        } catch (error) {
            // إعادة المحاولة إذا لم نصل للحد الأقصى
            if (attempt < (operation.maxRetries || syncConfig.maxRetries)) {
                const delay = this.calculateBackoff(attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.executeOperationWithRetry(operation, attempt + 1);
            }
            
            return { success: false, operation, error };
        }
    }

    /**
     * Execute a sync operation against Atlas
     * @param {Object} operation - Operation to execute
     */
    async executeOperation(operation) {
        const atlasConnection = dualDatabaseManager.getAtlasConnection();
        
        if (!atlasConnection || !atlasConnection.db) {
            throw new Error("Atlas connection not available");
        }

        const collection = atlasConnection.db.collection(operation.collection);

        switch (operation.type) {
            case "insert":
                await this.executeInsert(collection, operation);
                break;

            case "update":
                await this.executeUpdate(collection, operation);
                break;

            case "delete":
                await this.executeDelete(collection, operation);
                break;

            default:
                throw new Error(`Unknown operation type: ${operation.type}`);
        }
    }

    /**
     * Execute insert operation with idempotent upsert semantics
     * Uses replaceOne with upsert to ensure operations can be safely retried
     * @param {Collection} collection - MongoDB collection
     * @param {Object} operation - Operation details
     */
    async executeInsert(collection, operation) {
        if (!operation.data) {
            throw new Error("Insert operation missing data");
        }

        // Use replaceOne with upsert to handle duplicate _id gracefully
        // This ensures idempotency - same operation can be safely retried
        // Rehydrate first: queue data may have crossed JSON (disk/socket) where
        // Dates/ObjectIds degrade to strings — restore BSON types via schema.
        const collName = collection.collectionName;
        if (Array.isArray(operation.data)) {
            // Depopulate BEFORE rehydrate: collapse populated objects to _id
            // first (may yield 24-hex strings), then rehydrate casts to ObjectId.
            operation.data.forEach((doc) => depopulateDocForSync(collName, doc));
            operation.data.forEach((doc) => rehydrateDocument(collName, doc));
            // For arrays, insert each document with upsert
            const bulkOps = operation.data.map((doc) => ({
                replaceOne: {
                    filter: { _id: doc._id },
                    replacement: doc,
                    upsert: true,
                },
            }));
            const result = await collection.bulkWrite(bulkOps, { ordered: false });
            
            // Log detailed results
            Logger.debug(
                `📝 Bulk insert: ${result.upsertedCount} upserted, ${result.modifiedCount} updated for ${operation.collection}`
            );
            
            if (result.upsertedCount > 0) {
                Logger.debug(`   ➕ ${result.upsertedCount} new documents created`);
            }
            if (result.modifiedCount > 0) {
                Logger.debug(`   🔄 ${result.modifiedCount} existing documents replaced (idempotent retry)`);
            }
        } else {
            // Depopulate BEFORE rehydrate (see array branch above).
            depopulateDocForSync(collection.collectionName, operation.data);
            rehydrateDocument(collection.collectionName, operation.data);
            // For single document, use replaceOne with upsert
            const result = await collection.replaceOne(
                { _id: operation.data._id },
                operation.data,
                { upsert: true }
            );
            
            // Log whether this was an insert or update (idempotent retry)
            if (result.upsertedCount > 0) {
                Logger.debug(
                    `➕ Insert (upsert): Created new document in ${operation.collection} (_id: ${operation.data._id})`
                );
            } else if (result.modifiedCount > 0) {
                Logger.debug(
                    `🔄 Insert (upsert): Replaced existing document in ${operation.collection} (_id: ${operation.data._id}) - idempotent retry`
                );
            } else {
                Logger.debug(
                    `✓ Insert (upsert): Document unchanged in ${operation.collection} (_id: ${operation.data._id}) - idempotent retry`
                );
            }
        }
    }

    /**
     * Execute update operation with idempotent semantics
     * Uses updateOne with upsert to ensure deterministic results on retry
     * @param {Collection} collection - MongoDB collection
     * @param {Object} operation - Operation details
     */
    async executeUpdate(collection, operation) {
        if (!operation.filter) {
            throw new Error("Update operation missing filter");
        }

        if (!operation.data) {
            throw new Error("Update operation missing data");
        }

        // Rehydrate filter + payload (JSON-crossed Dates/ObjectIds degrade to
        // strings; a string _id filter would miss ObjectId docs and upsert
        // would then create duplicates with a string _id).
        const collName = collection.collectionName;
        rehydrateFilter(collName, operation.filter);
        // Depopulate BEFORE rehydrate: $set content may carry populated objects.
        try {
            operation.data = depopulateSyncPayload(collName, operation.data);
        } catch {}
        rehydrateDocument(collName, operation.data);

        // Use updateOne WITHOUT upsert — updates must never create ghost documents.
        // If the document doesn't exist in Atlas, it will be synced via full sync or polling.
        const result = await collection.updateOne(
            operation.filter,
            { $set: operation.data },
            { upsert: false }
        );

        // Log detailed results for monitoring
        if (result.upsertedCount > 0) {
            Logger.debug(
                `➕ Update (upsert): Created new document in ${operation.collection} - document didn't exist`
            );
        } else if (result.modifiedCount > 0) {
            Logger.debug(
                `🔄 Update: Modified ${result.modifiedCount} document(s) in ${operation.collection}`
            );
        } else if (result.matchedCount > 0) {
            Logger.debug(
                `✓ Update: Document unchanged in ${operation.collection} - idempotent retry (same data)`
            );
        } else {
            Logger.warn(
                `⚠️ Update matched 0 documents: ${operation.collection} - filter may be incorrect`
            );
        }
    }

    /**
     * Execute delete operation with idempotent semantics
     * Succeeds even if document doesn't exist (already deleted)
     * @param {Collection} collection - MongoDB collection
     * @param {Object} operation - Operation details
     */
    async executeDelete(collection, operation) {
        if (!operation.filter) {
            throw new Error("Delete operation missing filter");
        }

        // Rehydrate filter so string _id actually matches ObjectId docs
        rehydrateFilter(collection.collectionName, operation.filter);

        try {
            const result = await collection.deleteOne(operation.filter);

            // Log results - 0 deletions is OK for idempotency (already deleted)
            if (result.deletedCount > 0) {
                Logger.debug(
                    `🗑️  Delete: Removed ${result.deletedCount} document(s) from ${operation.collection}`
                );
            } else {
                Logger.debug(
                    `✓ Delete: Document not found in ${operation.collection} - already deleted (idempotent retry)`
                );
            }
        } catch (error) {
            // Handle delete errors gracefully
            // Some errors are acceptable for idempotency (e.g., document not found)
            if (error.code === 26 || error.message.includes("not found")) {
                Logger.debug(
                    `✓ Delete: Document not found in ${operation.collection} - already deleted (idempotent retry)`
                );
            } else {
                // Re-throw unexpected errors
                Logger.error(
                    `❌ Delete error in ${operation.collection}: ${error.message}`
                );
                throw error;
            }
        }
    }

    /**
     * Retry a failed operation with exponential backoff
     * @param {Object} operation - Failed operation
     * @param {Error} error - Error that occurred
     * @returns {Promise<boolean>} - Whether operation was requeued
     */
    async retryOperation(operation, error) {
        const retryCount = operation.retryCount || 0;

        // Check if we should retry
        if (retryCount >= operation.maxRetries) {
            Logger.error(
                `❌ Operation failed after ${retryCount} retries: ${operation.type} on ${operation.collection}`
            );
            Logger.error(`   Error: ${error.message}`);
            
            // Could move to dead letter queue here
            return false;
        }

        // Calculate backoff delay
        const delay = this.calculateBackoff(retryCount);

        Logger.warn(
            `🔄 Retrying operation (attempt ${retryCount + 1}/${operation.maxRetries}) in ${delay}ms`
        );

        // Wait for backoff period
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Re-queue the operation
        return syncQueueManager.requeue(operation);
    }

    /**
     * Calculate exponential backoff delay
     * @param {number} retryCount - Current retry count
     * @returns {number} - Delay in milliseconds
     */
    calculateBackoff(retryCount) {
        if (retryCount >= this.retryDelays.length) {
            return this.retryDelays[this.retryDelays.length - 1];
        }
        return this.retryDelays[retryCount];
    }

    /**
     * Update average process time
     * @param {number} processTime - Time taken for last operation
     */
    updateProcessTime(processTime) {
        this.stats.totalProcessTime += processTime;
        this.stats.avgProcessTime =
            this.stats.totalProcessTime / this.stats.totalProcessed;
    }

    /**
     * Get worker statistics
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            queueSize: syncQueueManager.size(),
            successRate:
                this.stats.totalProcessed > 0
                    ? (
                          (this.stats.successCount / this.stats.totalProcessed) *
                          100
                      ).toFixed(2)
                    : 0,
            failureRate:
                this.stats.totalProcessed > 0
                    ? (
                          (this.stats.failureCount / this.stats.totalProcessed) *
                          100
                      ).toFixed(2)
                    : 0,
        };
    }

    /**
     * Log worker statistics
     */
    logStats() {
        const stats = this.getStats();
        Logger.info("\n📊 Sync Worker Statistics:");
        Logger.info(`   Total Processed: ${stats.totalProcessed}`);
        Logger.info(`   Successful: ${stats.successCount} (${stats.successRate}%)`);
        Logger.info(`   Failed: ${stats.failureCount} (${stats.failureRate}%)`);
        Logger.info(`   Avg Process Time: ${stats.avgProcessTime.toFixed(2)}ms`);
        Logger.info(`   Queue Size: ${stats.queueSize}`);
        Logger.info(`   Last Process: ${stats.lastProcessTime || "Never"}`);
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalProcessed: 0,
            successCount: 0,
            failureCount: 0,
            lastProcessTime: null,
            avgProcessTime: 0,
            totalProcessTime: 0,
        };
        Logger.info("📊 Worker statistics reset");
    }

    /**
     * Check worker health
     * @returns {Object}
     */
    checkHealth() {
        const queueStats = syncQueueManager.getStats();
        const workerStats = this.getStats();
        const syncLag = syncQueueManager.getSyncLag();

        const health = {
            status: "healthy",
            issues: [],
            warnings: [],
        };

        // Check if worker is running
        if (!this.isRunning) {
            health.status = "unhealthy";
            health.issues.push("Worker is not running");
        }

        // Check if worker is paused
        if (this.isPaused) {
            health.status = "degraded";
            health.warnings.push("Worker is paused");
        }

        // Check queue size
        if (queueStats.size > syncConfig.queueWarningThreshold) {
            health.status = "degraded";
            health.warnings.push(
                `Queue size is large: ${queueStats.size}/${queueStats.maxSize}`
            );
        }

        // Check sync lag
        if (syncLag && syncLag > syncConfig.lagWarningThreshold) {
            health.status = "degraded";
            health.warnings.push(
                `Sync lag is high: ${(syncLag / 1000).toFixed(2)}s`
            );
        }

        // Check Atlas availability
        if (!dualDatabaseManager.isAtlasAvailable()) {
            health.status = "degraded";
            health.warnings.push("Atlas connection unavailable");
        }

        // Check failure rate
        if (workerStats.failureRate > 10) {
            health.status = "degraded";
            health.warnings.push(
                `High failure rate: ${workerStats.failureRate}%`
            );
        }

        return health;
    }
}

// Export singleton instance
const syncWorker = new SyncWorker();
export default syncWorker;
