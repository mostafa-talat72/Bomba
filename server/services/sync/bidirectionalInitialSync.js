import Logger from '../../middleware/logger.js';

/**
 * Bidirectional Initial Sync Service
 * Syncs missing data in BOTH directions:
 * 1. Atlas → Local (existing functionality)
 * 2. Local → Atlas (new functionality)
 */

class BidirectionalInitialSync {
    constructor(dualDatabaseManager) {
        this.databaseManager = dualDatabaseManager;
        this.isRunning = false;
        this.lastSyncTime = null;
        this.atlasToLocalInterval = null;
        this.localToAtlasInterval = null;
    }

    /**
     * Perform bidirectional sync (both directions)
     * @returns {Promise<Object>}
     */
    async performBidirectionalSync() {
        if (this.isRunning) {
            Logger.warn('⚠️  Bidirectional sync already running, skipping...');
            return { skipped: true };
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            Logger.info('🔄 Starting bidirectional sync...');

            // Check if both connections are available
            if (!this.databaseManager.isAtlasAvailable() || !this.databaseManager.isLocalAvailable()) {
                Logger.warn('⚠️  Connections not ready, skipping bidirectional sync');
                return { skipped: true, reason: 'Connections not ready' };
            }

            const atlasConnection = this.databaseManager.getAtlasConnection();
            const localConnection = this.databaseManager.getLocalConnection();

            // Get collections
            const collections = await atlasConnection.db.listCollections().toArray();
            const collectionsToSync = collections
                .map(c => c.name)
                .filter(name => !name.startsWith('system.') && name !== '_origin_tracking');

            let totalAtlasToLocalNew = 0;
            let totalAtlasToLocalUpdated = 0;
            let totalLocalToAtlasNew = 0;
            let totalLocalToAtlasUpdated = 0;

            // Sync each collection in both directions
            for (const collectionName of collectionsToSync) {
                try {
                    // Direction 1: Atlas → Local (smart sync)
                    const atlasToLocalResult = await this.syncAtlasToLocal(
                        atlasConnection,
                        localConnection,
                        collectionName
                    );
                    totalAtlasToLocalNew += atlasToLocalResult.synced || 0;
                    totalAtlasToLocalUpdated += atlasToLocalResult.updated || 0;

                    // Direction 2: Local → Atlas (smart sync)
                    const localToAtlasResult = await this.syncLocalToAtlas(
                        localConnection,
                        atlasConnection,
                        collectionName
                    );
                    totalLocalToAtlasNew += localToAtlasResult.synced || 0;
                    totalLocalToAtlasUpdated += localToAtlasResult.updated || 0;

                } catch (error) {
                    Logger.error(`❌ Error syncing collection ${collectionName}:`, error.message);
                }
            }

            const duration = Date.now() - startTime;
            this.lastSyncTime = new Date();

            const totalChanges = totalAtlasToLocalNew + totalAtlasToLocalUpdated + 
                                totalLocalToAtlasNew + totalLocalToAtlasUpdated;

            if (totalChanges > 0) {
                Logger.info('✅ Smart bidirectional sync completed');
                Logger.info(`   📥 Atlas → Local: ${totalAtlasToLocalNew} new, ${totalAtlasToLocalUpdated} updated`);
                Logger.info(`   📤 Local → Atlas: ${totalLocalToAtlasNew} new, ${totalLocalToAtlasUpdated} updated`);
                Logger.info(`   ⏱️  Duration: ${duration}ms`);
            }

            return {
                success: true,
                atlasToLocal: {
                    new: totalAtlasToLocalNew,
                    updated: totalAtlasToLocalUpdated
                },
                localToAtlas: {
                    new: totalLocalToAtlasNew,
                    updated: totalLocalToAtlasUpdated
                },
                duration
            };

        } catch (error) {
            Logger.error('❌ Bidirectional sync failed:', error.message);
            return { success: false, error: error.message };
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Sync from Atlas to Local (smart sync based on IDs and timestamps)
     * Optimized: only fetches documents that need syncing
     */
    async syncAtlasToLocal(atlasConnection, localConnection, collectionName) {
        const atlasCollection = atlasConnection.db.collection(collectionName);
        const localCollection = localConnection.db.collection(collectionName);

        // Step 1: Get IDs from both databases
        const atlasIds = await atlasCollection.distinct('_id');
        const localIds = await localCollection.distinct('_id');

        // Step 2: Find missing documents (exist in Atlas but not in Local)
        const localIdSet = new Set(localIds.map(id => id.toString()));
        const missingInLocal = atlasIds.filter(id => !localIdSet.has(id.toString()));

        let synced = 0;
        let updated = 0;

        // Step 3: Sync missing documents
        if (missingInLocal.length > 0) {
            const missingDocs = await atlasCollection.find({ _id: { $in: missingInLocal } }).toArray();
            
            for (const doc of missingDocs) {
                try {
                    await localCollection.insertOne(doc);
                    synced++;
                } catch (error) {
                    if (error.code !== 11000) { // Ignore duplicate key errors
                        Logger.error(`   ❌ Error inserting ${collectionName} doc:`, error.message);
                    }
                }
            }
        }

        // Step 4: Check for updates (only for documents that exist in both)
        // Get common IDs
        const atlasIdSet = new Set(atlasIds.map(id => id.toString()));
        const commonIds = localIds.filter(id => atlasIdSet.has(id.toString()));

        // Only check timestamps for common documents (more efficient)
        if (commonIds.length > 0) {
            // Fetch only _id and timestamp fields (much faster)
            const atlasTimestamps = await atlasCollection
                .find({ _id: { $in: commonIds } })
                .project({ _id: 1, updatedAt: 1, createdAt: 1 })
                .toArray();
            
            const localTimestamps = await localCollection
                .find({ _id: { $in: commonIds } })
                .project({ _id: 1, updatedAt: 1, createdAt: 1 })
                .toArray();

            // Create maps for comparison
            const atlasTimeMap = new Map(
                atlasTimestamps.map(doc => [doc._id.toString(), this.getDocumentTimestamp(doc)])
            );
            const localTimeMap = new Map(
                localTimestamps.map(doc => [doc._id.toString(), this.getDocumentTimestamp(doc)])
            );

            // Find documents where Atlas is newer
            const idsToUpdate = [];
            for (const [idStr, atlasTime] of atlasTimeMap) {
                const localTime = localTimeMap.get(idStr);
                if (atlasTime && localTime && atlasTime > localTime) {
                    idsToUpdate.push(atlasTimestamps.find(d => d._id.toString() === idStr)._id);
                }
            }

            // Fetch and update only the documents that need updating
            if (idsToUpdate.length > 0) {
                const docsToUpdate = await atlasCollection.find({ _id: { $in: idsToUpdate } }).toArray();
                
                for (const doc of docsToUpdate) {
                    try {
                        const result = await localCollection.replaceOne({ _id: doc._id }, doc);
                        if (result.modifiedCount > 0) {
                            updated++;
                        }
                    } catch (error) {
                        Logger.error(`   ❌ Error updating ${collectionName} doc:`, error.message);
                    }
                }
            }
        }

        if (synced > 0 || updated > 0) {
            Logger.info(`   📥 ${collectionName}: ${synced} new, ${updated} updated from Atlas → Local`);
        }
        
        return { synced, updated };
    }

    /**
     * Sync from Local to Atlas (smart sync based on IDs and timestamps)
     * Optimized: only fetches documents that need syncing
     */
    async syncLocalToAtlas(localConnection, atlasConnection, collectionName) {
        const localCollection = localConnection.db.collection(collectionName);
        const atlasCollection = atlasConnection.db.collection(collectionName);

        // Step 1: Get IDs from both databases
        const localIds = await localCollection.distinct('_id');
        const atlasIds = await atlasCollection.distinct('_id');

        // Step 2: Find missing documents (exist in Local but not in Atlas)
        const atlasIdSet = new Set(atlasIds.map(id => id.toString()));
        const missingInAtlas = localIds.filter(id => !atlasIdSet.has(id.toString()));

        let synced = 0;
        let updated = 0;

        // Step 3: Sync missing documents
        if (missingInAtlas.length > 0) {
            const missingDocs = await localCollection.find({ _id: { $in: missingInAtlas } }).toArray();
            
            for (const doc of missingDocs) {
                try {
                    await atlasCollection.insertOne(doc);
                    synced++;
                } catch (error) {
                    if (error.code !== 11000) { // Ignore duplicate key errors
                        Logger.error(`   ❌ Error inserting ${collectionName} doc:`, error.message);
                    }
                }
            }
        }

        // Step 4: Check for updates (only for documents that exist in both)
        // Get common IDs
        const localIdSet = new Set(localIds.map(id => id.toString()));
        const commonIds = atlasIds.filter(id => localIdSet.has(id.toString()));

        // Only check timestamps for common documents (more efficient)
        if (commonIds.length > 0) {
            // Fetch only _id and timestamp fields (much faster)
            const localTimestamps = await localCollection
                .find({ _id: { $in: commonIds } })
                .project({ _id: 1, updatedAt: 1, createdAt: 1 })
                .toArray();
            
            const atlasTimestamps = await atlasCollection
                .find({ _id: { $in: commonIds } })
                .project({ _id: 1, updatedAt: 1, createdAt: 1 })
                .toArray();

            // Create maps for comparison
            const localTimeMap = new Map(
                localTimestamps.map(doc => [doc._id.toString(), this.getDocumentTimestamp(doc)])
            );
            const atlasTimeMap = new Map(
                atlasTimestamps.map(doc => [doc._id.toString(), this.getDocumentTimestamp(doc)])
            );

            // Find documents where Local is newer
            const idsToUpdate = [];
            for (const [idStr, localTime] of localTimeMap) {
                const atlasTime = atlasTimeMap.get(idStr);
                if (localTime && atlasTime && localTime > atlasTime) {
                    idsToUpdate.push(localTimestamps.find(d => d._id.toString() === idStr)._id);
                }
            }

            // Fetch and update only the documents that need updating
            if (idsToUpdate.length > 0) {
                const docsToUpdate = await localCollection.find({ _id: { $in: idsToUpdate } }).toArray();
                
                for (const doc of docsToUpdate) {
                    try {
                        const result = await atlasCollection.replaceOne({ _id: doc._id }, doc);
                        if (result.modifiedCount > 0) {
                            updated++;
                        }
                    } catch (error) {
                        Logger.error(`   ❌ Error updating ${collectionName} doc:`, error.message);
                    }
                }
            }
        }

        if (synced > 0 || updated > 0) {
            Logger.info(`   📤 ${collectionName}: ${synced} new, ${updated} updated from Local → Atlas`);
        }
        
        return { synced, updated };
    }

    /**
     * Get document timestamp (tries updatedAt, then createdAt, then _id timestamp)
     * @param {Object} doc - Document
     * @returns {Date|null}
     */
    getDocumentTimestamp(doc) {
        // Try updatedAt first
        if (doc.updatedAt) {
            return new Date(doc.updatedAt);
        }
        
        // Try createdAt
        if (doc.createdAt) {
            return new Date(doc.createdAt);
        }
        
        // Try to extract timestamp from ObjectId
        if (doc._id && doc._id.getTimestamp) {
            return doc._id.getTimestamp();
        }
        
        return null;
    }

    /**
     * Start periodic bidirectional sync
     */
    startPeriodicSync(intervalMs) {
        if (intervalMs <= 0) {
            Logger.info('ℹ️  Periodic bidirectional sync disabled (interval = 0)');
            return;
        }

        Logger.info(`🔄 Starting periodic bidirectional sync (every ${intervalMs}ms)`);
        
        this.atlasToLocalInterval = setInterval(async () => {
            await this.performBidirectionalSync();
        }, intervalMs);
    }

    /**
     * Stop periodic sync
     */
    stopPeriodicSync() {
        if (this.atlasToLocalInterval) {
            clearInterval(this.atlasToLocalInterval);
            this.atlasToLocalInterval = null;
        }
        if (this.localToAtlasInterval) {
            clearInterval(this.localToAtlasInterval);
            this.localToAtlasInterval = null;
        }
        Logger.info('🛑 Periodic bidirectional sync stopped');
    }

    /**
     * Get sync status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastSyncTime: this.lastSyncTime,
            periodicSyncEnabled: this.atlasToLocalInterval !== null
        };
    }
}

export default BidirectionalInitialSync;
