import Logger from "../../middleware/logger.js";
import syncConfig from "../../config/syncConfig.js";
import dualDatabaseManager from "../../config/dualDatabaseManager.js";

/**
 * FullSyncService
 * Handles manual full synchronization between local MongoDB and Atlas
 * Compares collections, detects differences, and synchronizes missing/outdated documents
 */
class FullSyncService {
    constructor() {
        this.isRunning = false;
        this.progress = {
            currentCollection: null,
            collectionsProcessed: 0,
            totalCollections: 0,
            documentsCompared: 0,
            documentsSynced: 0,
            errors: [],
            startTime: null,
            endTime: null,
        };
        this.shouldCancel = false;
    }

    /**
     * Start full synchronization for specified collections
     * @param {Array<string>} collections - Collection names to sync (optional, defaults to all)
     * @returns {Promise<Object>} - Sync results
     */
    async startFullSync(collections = null) {
        // Prevent concurrent full syncs
        if (this.isRunning) {
            throw new Error("Full sync is already running. Please wait for it to complete.");
        }

        // Check if Atlas is available
        if (!dualDatabaseManager.isAtlasAvailable()) {
            throw new Error("Atlas connection is not available. Cannot perform full sync.");
        }

        // Check if local is available
        if (!dualDatabaseManager.isLocalAvailable()) {
            throw new Error("Local database connection is not available.");
        }

        this.isRunning = true;
        this.shouldCancel = false;
        this.resetProgress();
        this.progress.startTime = new Date();

        Logger.info("🔄 Starting full synchronization...");

        try {
            const localConnection = dualDatabaseManager.getLocalConnection();
            const atlasConnection = dualDatabaseManager.getAtlasConnection();

            // Get list of collections to sync
            const collectionsToSync = await this.getCollectionsToSync(
                localConnection,
                collections
            );

            this.progress.totalCollections = collectionsToSync.length;
            Logger.info(`📋 Found ${collectionsToSync.length} collections to sync`);

            // Sync each collection
            for (const collectionName of collectionsToSync) {
                if (this.shouldCancel) {
                    Logger.warn("⚠️ Full sync cancelled by user");
                    break;
                }

                try {
                    await this.syncCollection(collectionName);
                    this.progress.collectionsProcessed++;
                } catch (error) {
                    Logger.error(
                        `❌ Error syncing collection ${collectionName}:`,
                        error.message
                    );
                    this.progress.errors.push({
                        collection: collectionName,
                        error: error.message,
                    });
                }
            }

            this.progress.endTime = new Date();
            const duration = this.progress.endTime - this.progress.startTime;

            Logger.info("\n✅ Full synchronization completed!");
            Logger.info(`📊 Collections processed: ${this.progress.collectionsProcessed}/${this.progress.totalCollections}`);
            Logger.info(`📄 Documents compared: ${this.progress.documentsCompared}`);
            Logger.info(`🔄 Documents synced: ${this.progress.documentsSynced}`);
            Logger.info(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);

            if (this.progress.errors.length > 0) {
                Logger.warn(`⚠️ Errors encountered: ${this.progress.errors.length}`);
            }

            return this.getProgress();
        } catch (error) {
            Logger.error("❌ Full sync failed:", error.message);
            this.progress.errors.push({
                collection: "general",
                error: error.message,
            });
            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Get list of collections to synchronize
     * @param {mongoose.Connection} localConnection - Local database connection
     * @param {Array<string>} requestedCollections - Specific collections requested (optional)
     * @returns {Promise<Array<string>>} - Collection names to sync
     */
    async getCollectionsToSync(localConnection, requestedCollections = null) {
        // Get all collections from local database
        const collections = await localConnection.db.listCollections().toArray();
        let collectionNames = collections.map((col) => col.name);

        // Filter system collections
        collectionNames = collectionNames.filter(
            (name) => !name.startsWith("system.")
        );

        // Filter excluded collections
        collectionNames = collectionNames.filter(
            (name) => !syncConfig.excludedCollections.includes(name)
        );

        // Filter to requested collections if specified
        if (requestedCollections && requestedCollections.length > 0) {
            collectionNames = collectionNames.filter((name) =>
                requestedCollections.includes(name)
            );
        }

        return collectionNames;
    }

    /**
     * Synchronize a single collection
     * @param {string} collectionName - Name of collection to sync
     * @returns {Promise<void>}
     */
    async syncCollection(collectionName) {
        this.progress.currentCollection = collectionName;
        Logger.info(`\n🔄 Syncing collection: ${collectionName}`);

        const localConnection = dualDatabaseManager.getLocalConnection();
        const atlasConnection = dualDatabaseManager.getAtlasConnection();

        // Get collections
        const localCollection = localConnection.collection(collectionName);
        const atlasCollection = atlasConnection.collection(collectionName);

        // Fetch all documents from both databases
        const localDocs = await localCollection.find({}).toArray();
        const atlasDocs = await atlasCollection.find({}).toArray();

        Logger.info(
            `   Local: ${localDocs.length} docs, Atlas: ${atlasDocs.length} docs`
        );

        this.progress.documentsCompared += localDocs.length + atlasDocs.length;

        // Compare and sync
        const differences = await this.compareDocuments(localDocs, atlasDocs);

        Logger.info(
            `   Differences: ${differences.missingInAtlas.length} missing, ${differences.outdatedInAtlas.length} outdated`
        );

        // Sync missing documents
        if (differences.missingInAtlas.length > 0) {
            await this.syncMissingDocuments(
                atlasCollection,
                differences.missingInAtlas
            );
        }

        // Sync outdated documents
        if (differences.outdatedInAtlas.length > 0) {
            await this.syncOutdatedDocuments(
                atlasCollection,
                differences.outdatedInAtlas
            );
        }

        Logger.info(`   ✅ Collection ${collectionName} synced successfully`);
    }

    /**
     * Compare documents between local and Atlas
     * @param {Array} localDocs - Documents from local database
     * @param {Array} atlasDocs - Documents from Atlas database
     * @returns {Promise<Object>} - Differences object
     */
    async compareDocuments(localDocs, atlasDocs) {
        // Create maps for efficient lookup
        const localMap = new Map();
        const atlasMap = new Map();

        // Build local map
        localDocs.forEach((doc) => {
            const id = doc._id.toString();
            localMap.set(id, doc);
        });

        // Build atlas map
        atlasDocs.forEach((doc) => {
            const id = doc._id.toString();
            atlasMap.set(id, doc);
        });

        const differences = {
            missingInAtlas: [],
            outdatedInAtlas: [],
            missingInLocal: [], // For information only, we don't sync back
        };

        // Find documents missing in Atlas or outdated
        for (const [id, localDoc] of localMap) {
            if (!atlasMap.has(id)) {
                // Document exists in local but not in Atlas
                differences.missingInAtlas.push(localDoc);
            } else {
                // Document exists in both, check if outdated
                const atlasDoc = atlasMap.get(id);
                if (this.isDocumentOutdated(localDoc, atlasDoc)) {
                    differences.outdatedInAtlas.push(localDoc);
                }
            }
        }

        // Find documents in Atlas but not in local (for logging only)
        for (const [id, atlasDoc] of atlasMap) {
            if (!localMap.has(id)) {
                differences.missingInLocal.push(atlasDoc);
            }
        }

        // Log if there are documents in Atlas not in local
        if (differences.missingInLocal.length > 0) {
            Logger.warn(
                `   ⚠️ Found ${differences.missingInLocal.length} documents in Atlas not present in local (will not delete)`
            );
        }

        return differences;
    }

    /**
     * Check if a document in Atlas is outdated compared to local
     * @param {Object} localDoc - Document from local database
     * @param {Object} atlasDoc - Document from Atlas database
     * @returns {boolean} - True if Atlas document is outdated
     */
    isDocumentOutdated(localDoc, atlasDoc) {
        // Compare updatedAt timestamps if available
        if (localDoc.updatedAt && atlasDoc.updatedAt) {
            const localTime = new Date(localDoc.updatedAt).getTime();
            const atlasTime = new Date(atlasDoc.updatedAt).getTime();
            return localTime > atlasTime;
        }

        // If no updatedAt, compare createdAt
        if (localDoc.createdAt && atlasDoc.createdAt) {
            const localTime = new Date(localDoc.createdAt).getTime();
            const atlasTime = new Date(atlasDoc.createdAt).getTime();
            return localTime > atlasTime;
        }

        // If no timestamps, do a deep comparison
        // This is expensive but necessary for documents without timestamps
        return this.hasDocumentChanged(localDoc, atlasDoc);
    }

    /**
     * Deep comparison of two documents
     * @param {Object} doc1 - First document
     * @param {Object} doc2 - Second document
     * @returns {boolean} - True if documents are different
     */
    hasDocumentChanged(doc1, doc2) {
        // Simple JSON comparison (not perfect but good enough for most cases)
        const json1 = JSON.stringify(this.normalizeDocument(doc1));
        const json2 = JSON.stringify(this.normalizeDocument(doc2));
        return json1 !== json2;
    }

    /**
     * Normalize document for comparison
     * Removes fields that shouldn't be compared
     * @param {Object} doc - Document to normalize
     * @returns {Object} - Normalized document
     */
    normalizeDocument(doc) {
        const normalized = { ...doc };

        // Remove MongoDB internal fields that might differ
        delete normalized.__v;

        // Sort keys for consistent comparison
        const sortedKeys = Object.keys(normalized).sort();
        const sorted = {};
        sortedKeys.forEach((key) => {
            sorted[key] = normalized[key];
        });

        return sorted;
    }

    /**
     * Sync missing documents to Atlas
     * @param {Collection} atlasCollection - Atlas collection
     * @param {Array} documents - Documents to sync
     * @returns {Promise<void>}
     */
    async syncMissingDocuments(atlasCollection, documents) {
        if (documents.length === 0) {
            return;
        }

        Logger.info(`   📤 Syncing ${documents.length} missing documents...`);

        // Batch insert for efficiency
        const batchSize = syncConfig.batchSize;
        let synced = 0;

        for (let i = 0; i < documents.length; i += batchSize) {
            if (this.shouldCancel) {
                Logger.warn("   ⚠️ Sync cancelled");
                break;
            }

            const batch = documents.slice(i, i + batchSize);

            try {
                await atlasCollection.insertMany(batch, { ordered: false });
                synced += batch.length;
                this.progress.documentsSynced += batch.length;
            } catch (error) {
                // Handle duplicate key errors (document might have been synced already)
                if (error.code === 11000) {
                    Logger.warn(
                        `   ⚠️ Some documents already exist in Atlas (duplicate key)`
                    );
                    // Count successful inserts from error details
                    const successCount = batch.length - (error.writeErrors?.length || 0);
                    synced += successCount;
                    this.progress.documentsSynced += successCount;
                } else {
                    throw error;
                }
            }
        }

        Logger.info(`   ✅ Synced ${synced} missing documents`);
    }

    /**
     * Sync outdated documents to Atlas
     * @param {Collection} atlasCollection - Atlas collection
     * @param {Array} documents - Documents to update
     * @returns {Promise<void>}
     */
    async syncOutdatedDocuments(atlasCollection, documents) {
        if (documents.length === 0) {
            return;
        }

        Logger.info(`   📤 Updating ${documents.length} outdated documents...`);

        let updated = 0;

        // Update documents one by one (could be optimized with bulkWrite)
        for (const doc of documents) {
            if (this.shouldCancel) {
                Logger.warn("   ⚠️ Sync cancelled");
                break;
            }

            try {
                await atlasCollection.replaceOne(
                    { _id: doc._id },
                    doc,
                    { upsert: true }
                );
                updated++;
                this.progress.documentsSynced++;
            } catch (error) {
                Logger.error(
                    `   ❌ Failed to update document ${doc._id}:`,
                    error.message
                );
                this.progress.errors.push({
                    collection: atlasCollection.collectionName,
                    documentId: doc._id.toString(),
                    error: error.message,
                });
            }
        }

        Logger.info(`   ✅ Updated ${updated} outdated documents`);
    }

    /**
     * Get current progress
     * @returns {Object} - Progress information
     */
    getProgress() {
        const progress = { ...this.progress };

        // Calculate percentage
        if (progress.totalCollections > 0) {
            progress.percentComplete = (
                (progress.collectionsProcessed / progress.totalCollections) *
                100
            ).toFixed(2);
        } else {
            progress.percentComplete = 0;
        }

        // Calculate duration
        if (progress.startTime) {
            const endTime = progress.endTime || new Date();
            progress.durationMs = endTime - progress.startTime;
            progress.durationSeconds = (progress.durationMs / 1000).toFixed(2);
        }

        return progress;
    }

    /**
     * Cancel the current full sync operation
     */
    cancel() {
        if (!this.isRunning) {
            Logger.warn("⚠️ No full sync is currently running");
            return false;
        }

        Logger.warn("⚠️ Cancelling full sync...");
        this.shouldCancel = true;
        return true;
    }

    /**
     * Reset progress tracking
     */
    resetProgress() {
        this.progress = {
            currentCollection: null,
            collectionsProcessed: 0,
            totalCollections: 0,
            documentsCompared: 0,
            documentsSynced: 0,
            errors: [],
            startTime: null,
            endTime: null,
        };
    }

    /**
     * Check if full sync is currently running
     * @returns {boolean}
     */
    isFullSyncRunning() {
        return this.isRunning;
    }

    /**
     * Get sync statistics
     * @returns {Object}
     */
    getStats() {
        return {
            isRunning: this.isRunning,
            progress: this.getProgress(),
        };
    }
}

// Export singleton instance
const fullSyncService = new FullSyncService();
export default fullSyncService;
