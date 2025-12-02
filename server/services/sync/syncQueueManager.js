import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import Logger from "../../middleware/logger.js";
import syncConfig from "../../config/syncConfig.js";

/**
 * SyncQueueManager
 * Manages the queue of synchronization operations
 * Handles enqueueing, dequeueing, and persistence of sync operations
 */
class SyncQueueManager {
    constructor(maxSize = 10000) {
        this.queue = [];
        this.maxSize = maxSize;
        this.processing = false;
        this.persistencePath = syncConfig.queuePersistencePath;
        this.lastPersistTime = null;
        this.persistenceInterval = 30000; // Persist every 30 seconds if queue has items
        this.autoSaveTimer = null;
        this.pendingOperations = new Map(); // Track pending operations by collection:documentId
    }

    /**
     * Extract document ID from operation data
     * @param {Object} operation - Operation details
     * @returns {string|null} - Document ID or null if not found
     */
    extractDocumentId(operation) {
        // Try to get _id from data
        if (operation.data && operation.data._id) {
            return operation.data._id.toString();
        }

        // Try to get _id from filter
        if (operation.filter && operation.filter._id) {
            return operation.filter._id.toString();
        }

        return null;
    }

    /**
     * Generate key for pendingOperations Map
     * @param {string} collection - Collection name
     * @param {string} documentId - Document ID
     * @returns {string} - Key in format "collection:documentId"
     */
    generatePendingKey(collection, documentId) {
        return `${collection}:${documentId}`;
    }

    /**
     * Detect if a duplicate operation exists in the queue
     * @param {Object} operation - Operation to check
     * @returns {Object|null} - Existing operation or null if no duplicate
     */
    detectDuplicate(operation) {
        const documentId = this.extractDocumentId(operation);
        
        if (!documentId) {
            // Cannot detect duplicates without document ID
            return null;
        }

        const key = this.generatePendingKey(operation.collection, documentId);
        const existingIndex = this.pendingOperations.get(key);

        if (existingIndex !== undefined && existingIndex < this.queue.length) {
            return {
                operation: this.queue[existingIndex],
                index: existingIndex,
                key: key
            };
        }

        return null;
    }

    /**
     * Merge duplicate operations according to deduplication strategy
     * @param {Object} existing - Existing operation in queue
     * @param {Object} newOp - New operation to merge
     * @returns {Object} - Merged operation or replacement operation
     */
    mergeDuplicateOperation(existing, newOp) {
        const existingType = existing.type;
        const newType = newOp.type;

        Logger.debug(
            `🔀 Merging operations: ${existingType} + ${newType} for ${newOp.collection}`
        );

        // Delete supersedes everything
        if (newType === 'delete') {
            Logger.debug('  → Delete supersedes all, using delete operation');
            return {
                ...newOp,
                id: existing.id, // Keep original ID
                timestamp: existing.timestamp // Keep original timestamp for ordering
            };
        }

        // If existing is delete, ignore new operation
        if (existingType === 'delete') {
            Logger.debug('  → Existing delete supersedes new operation, keeping delete');
            return existing;
        }

        // Insert + Insert: Replace with latest
        if (existingType === 'insert' && newType === 'insert') {
            Logger.debug('  → Insert + Insert: replacing with latest data');
            return {
                ...newOp,
                id: existing.id,
                timestamp: existing.timestamp
            };
        }

        // Insert + Update: Replace with new insert (latest data wins)
        if (existingType === 'insert' && newType === 'update') {
            Logger.debug('  → Insert + Update: replacing with insert containing latest data');
            return {
                ...existing,
                data: { ...existing.data, ...newOp.data },
                timestamp: existing.timestamp
            };
        }

        // Update + Insert: Replace with new insert (latest data wins)
        if (existingType === 'update' && newType === 'insert') {
            Logger.debug('  → Update + Insert: replacing with insert (latest data)');
            return {
                ...newOp,
                id: existing.id,
                timestamp: existing.timestamp
            };
        }

        // Update + Update: Merge update data
        if (existingType === 'update' && newType === 'update') {
            Logger.debug('  → Update + Update: merging update data');
            
            // Merge the data fields
            const mergedData = { ...existing.data, ...newOp.data };
            
            return {
                ...existing,
                data: mergedData,
                // Keep original timestamp for ordering
                timestamp: existing.timestamp
            };
        }

        // Default: replace with new operation
        Logger.debug('  → Default: replacing with new operation');
        return {
            ...newOp,
            id: existing.id,
            timestamp: existing.timestamp
        };
    }

    /**
     * Enqueue a synchronization operation
     * @param {Object} operation - Operation details
     * @returns {boolean} - Success status
     */
    enqueue(operation) {
        // Create operation with metadata first
        const queueOperation = {
            id: operation.id || uuidv4(),
            type: operation.type, // 'insert', 'update', 'delete'
            collection: operation.collection,
            data: operation.data,
            filter: operation.filter,
            timestamp: operation.timestamp || new Date(),
            retryCount: operation.retryCount || 0,
            maxRetries: operation.maxRetries || syncConfig.maxRetries,
        };

        // Extract document ID for deduplication
        const documentId = this.extractDocumentId(queueOperation);

        // Check for duplicates if we have a document ID
        if (documentId) {
            const duplicate = this.detectDuplicate(queueOperation);
            
            if (duplicate) {
                Logger.debug(
                    `🔍 Duplicate operation detected for ${queueOperation.collection}:${documentId}`
                );
                
                // Merge the operations
                const mergedOperation = this.mergeDuplicateOperation(
                    duplicate.operation,
                    queueOperation
                );
                
                // Replace the existing operation in the queue
                this.queue[duplicate.index] = mergedOperation;
                
                Logger.debug(
                    `✅ Merged duplicate operation at index ${duplicate.index}`
                );
                
                // No need to add to queue or update pendingOperations
                // The operation is already tracked at the same index
                return true;
            }
        }

        // Check if queue is full
        if (this.isFull()) {
            Logger.warn(
                `⚠️ Sync queue is full (${this.maxSize}), attempting to persist to disk`
            );
            
            // Try to persist and clear some space
            this.persistToDisk().catch((error) => {
                Logger.error("❌ Failed to persist queue to disk:", error.message);
            });

            // If still full after persistence attempt, drop oldest operation
            if (this.isFull()) {
                const dropped = this.queue.shift();
                // Update pendingOperations map when dropping
                const droppedDocId = this.extractDocumentId(dropped);
                if (droppedDocId) {
                    const droppedKey = this.generatePendingKey(dropped.collection, droppedDocId);
                    this.pendingOperations.delete(droppedKey);
                }
                Logger.warn(
                    `⚠️ Dropped oldest operation from queue: ${dropped.type} on ${dropped.collection}`
                );
            }
        }

        // Add to queue
        const newIndex = this.queue.length;
        this.queue.push(queueOperation);

        // Track in pendingOperations map
        if (documentId) {
            const key = this.generatePendingKey(queueOperation.collection, documentId);
            this.pendingOperations.set(key, newIndex);
        }

        // Log if queue is getting large
        if (this.size() > syncConfig.queueWarningThreshold) {
            Logger.warn(
                `⚠️ Sync queue size is large: ${this.size()}/${this.maxSize}`
            );
        }

        // Schedule auto-save if not already scheduled
        this.scheduleAutoSave();

        return true;
    }

    /**
     * Dequeue the next operation
     * @returns {Object|null} - Next operation or null if queue is empty
     */
    dequeue() {
        if (this.isEmpty()) {
            return null;
        }

        const operation = this.queue.shift();

        // Remove from pendingOperations map
        const documentId = this.extractDocumentId(operation);
        if (documentId) {
            const key = this.generatePendingKey(operation.collection, documentId);
            this.pendingOperations.delete(key);
        }

        // Update all indices in pendingOperations map (they all shifted down by 1)
        const updatedMap = new Map();
        for (const [key, index] of this.pendingOperations.entries()) {
            if (index > 0) {
                updatedMap.set(key, index - 1);
            }
        }
        this.pendingOperations = updatedMap;

        return operation;
    }

    /**
     * Peek at the next operation without removing it
     * @returns {Object|null} - Next operation or null if queue is empty
     */
    peek() {
        if (this.isEmpty()) {
            return null;
        }

        return this.queue[0];
    }

    /**
     * Re-queue a failed operation (for retry)
     * @param {Object} operation - Operation to retry
     * @returns {boolean} - Success status
     */
    requeue(operation) {
        operation.retryCount = (operation.retryCount || 0) + 1;

        if (operation.retryCount >= operation.maxRetries) {
            Logger.error(
                `❌ Operation exceeded max retries (${operation.maxRetries}): ${operation.type} on ${operation.collection}`
            );
            // Move to dead letter queue (could be implemented later)
            return false;
        }

        // Add back to queue
        this.queue.unshift(operation);
        return true;
    }

    /**
     * Get current queue size
     * @returns {number}
     */
    size() {
        return this.queue.length;
    }

    /**
     * Check if queue is empty
     * @returns {boolean}
     */
    isEmpty() {
        return this.queue.length === 0;
    }

    /**
     * Check if queue is full
     * @returns {boolean}
     */
    isFull() {
        return this.queue.length >= this.maxSize;
    }

    /**
     * Clear the queue
     */
    clear() {
        const size = this.queue.length;
        this.queue = [];
        this.pendingOperations.clear();
        Logger.info(`🗑️  Cleared sync queue (${size} operations removed)`);
    }

    /**
     * Get queue statistics
     * @returns {Object}
     */
    getStats() {
        const stats = {
            size: this.size(),
            maxSize: this.maxSize,
            isEmpty: this.isEmpty(),
            isFull: this.isFull(),
            utilizationPercent: ((this.size() / this.maxSize) * 100).toFixed(2),
        };

        // Count operations by type
        const byType = {};
        const byCollection = {};
        let totalRetries = 0;

        this.queue.forEach((op) => {
            byType[op.type] = (byType[op.type] || 0) + 1;
            byCollection[op.collection] = (byCollection[op.collection] || 0) + 1;
            totalRetries += op.retryCount || 0;
        });

        stats.byType = byType;
        stats.byCollection = byCollection;
        stats.totalRetries = totalRetries;
        stats.avgRetries = this.size() > 0 ? (totalRetries / this.size()).toFixed(2) : 0;

        return stats;
    }

    /**
     * Schedule automatic queue persistence
     */
    scheduleAutoSave() {
        if (!syncConfig.persistQueue) {
            return;
        }

        // Clear existing timer
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // Schedule new save
        this.autoSaveTimer = setTimeout(() => {
            if (!this.isEmpty()) {
                this.persistToDisk().catch((error) => {
                    Logger.error("❌ Auto-save failed:", error.message);
                });
            }
        }, this.persistenceInterval);
    }

    /**
     * Persist queue to disk
     * @returns {Promise<void>}
     */
    async persistToDisk() {
        if (!syncConfig.persistQueue) {
            return;
        }

        try {
            // Ensure directory exists
            const dir = path.dirname(this.persistencePath);
            await fs.mkdir(dir, { recursive: true });

            // Prepare data
            const data = {
                version: "1.0",
                timestamp: new Date().toISOString(),
                queueSize: this.queue.length,
                operations: this.queue,
            };

            // Write to file
            await fs.writeFile(
                this.persistencePath,
                JSON.stringify(data, null, 2),
                "utf8"
            );

            this.lastPersistTime = new Date();
            Logger.info(
                `💾 Queue persisted to disk: ${this.queue.length} operations`
            );
        } catch (error) {
            Logger.error("❌ Failed to persist queue to disk:", error.message);
            throw error;
        }
    }

    /**
     * Load queue from disk
     * @returns {Promise<number>} - Number of operations loaded
     */
    async loadFromDisk() {
        if (!syncConfig.persistQueue) {
            return 0;
        }

        try {
            // Check if file exists
            try {
                await fs.access(this.persistencePath);
            } catch {
                Logger.info("ℹ️  No persisted queue file found");
                return 0;
            }

            // Read file
            const fileContent = await fs.readFile(this.persistencePath, "utf8");
            const data = JSON.parse(fileContent);

            // Validate data
            if (!data.operations || !Array.isArray(data.operations)) {
                Logger.warn("⚠️ Invalid queue file format");
                return 0;
            }

            // Load operations
            const loadedCount = data.operations.length;
            this.queue = data.operations;

            // Rebuild pendingOperations map
            this.pendingOperations.clear();
            this.queue.forEach((operation, index) => {
                const documentId = this.extractDocumentId(operation);
                if (documentId) {
                    const key = this.generatePendingKey(operation.collection, documentId);
                    this.pendingOperations.set(key, index);
                }
            });

            Logger.info(
                `📂 Loaded ${loadedCount} operations from persisted queue`
            );
            Logger.info(`📅 Queue was persisted at: ${data.timestamp}`);

            // Delete the file after successful load
            await fs.unlink(this.persistencePath);
            Logger.info("🗑️  Deleted persisted queue file");

            return loadedCount;
        } catch (error) {
            Logger.error("❌ Failed to load queue from disk:", error.message);
            return 0;
        }
    }

    /**
     * Get operations by collection name
     * @param {string} collectionName
     * @returns {Array}
     */
    getOperationsByCollection(collectionName) {
        return this.queue.filter((op) => op.collection === collectionName);
    }

    /**
     * Get operations by type
     * @param {string} type - 'insert', 'update', or 'delete'
     * @returns {Array}
     */
    getOperationsByType(type) {
        return this.queue.filter((op) => op.type === type);
    }

    /**
     * Remove operations for a specific collection
     * Useful for excluding collections from sync
     * @param {string} collectionName
     * @returns {number} - Number of operations removed
     */
    removeOperationsByCollection(collectionName) {
        const initialSize = this.queue.length;
        this.queue = this.queue.filter((op) => op.collection !== collectionName);
        const removed = initialSize - this.queue.length;

        if (removed > 0) {
            Logger.info(
                `🗑️  Removed ${removed} operations for collection: ${collectionName}`
            );
        }

        return removed;
    }

    /**
     * Get oldest operation timestamp
     * @returns {Date|null}
     */
    getOldestOperationTime() {
        if (this.isEmpty()) {
            return null;
        }

        return this.queue[0].timestamp;
    }

    /**
     * Get sync lag in milliseconds
     * @returns {number|null}
     */
    getSyncLag() {
        const oldest = this.getOldestOperationTime();
        if (!oldest) {
            return null;
        }

        return Date.now() - new Date(oldest).getTime();
    }

    /**
     * Check if sync lag exceeds threshold
     * @returns {boolean}
     */
    isLagging() {
        const lag = this.getSyncLag();
        if (lag === null) {
            return false;
        }

        return lag > syncConfig.lagWarningThreshold;
    }

    /**
     * Cleanup - stop auto-save timer
     */
    cleanup() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }
}

// Export singleton instance
const syncQueueManager = new SyncQueueManager(syncConfig.queueMaxSize);
export default syncQueueManager;

// Export class for testing
export { SyncQueueManager };
