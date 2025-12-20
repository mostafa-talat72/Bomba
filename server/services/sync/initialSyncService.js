import Logger from '../../middleware/logger.js';

/**
 * Initial Sync Service
 * Syncs existing data from Atlas to Local when server starts
 * This ensures Local has all data that existed before bidirectional sync was enabled
 */

class InitialSyncService {
    constructor(dualDatabaseManager) {
        this.databaseManager = dualDatabaseManager;
        this.isRunning = false;
        this.lastSyncTime = null;
        this.syncInterval = null;
    }

    /**
     * Perform initial sync from Atlas to Local
     * @returns {Promise<Object>} Sync results
     */
    async performSync() {
        if (this.isRunning) {
            Logger.warn('⚠️  Initial sync already running, skipping...');
            return { skipped: true };
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            Logger.info('🔄 Starting initial sync from Atlas to Local...');

            // Check if Atlas is available
            if (!this.databaseManager.isAtlasAvailable()) {
                Logger.warn('⚠️  Atlas not available, skipping initial sync');
                return { skipped: true, reason: 'Atlas not available' };
            }

            const atlasConnection = this.databaseManager.getAtlasConnection();
            const localConnection = this.databaseManager.getLocalConnection();

            if (!atlasConnection || !localConnection) {
                Logger.warn('⚠️  Database connections not ready, skipping initial sync');
                return { skipped: true, reason: 'Connections not ready' };
            }

            // Get all collections from Atlas
            const collections = await atlasConnection.db.listCollections().toArray();
            
            // Filter collections to sync (exclude system collections and origin tracking)
            const collectionsToSync = collections
                .map(c => c.name)
                .filter(name => !name.startsWith('system.') && name !== '_origin_tracking');

            Logger.info(`📂 Found ${collectionsToSync.length} collections to sync`);

            let totalSynced = 0;
            let totalSkipped = 0;
            let errors = [];

            // Sync each collection
            for (const collectionName of collectionsToSync) {
                try {
                    const result = await this.syncCollection(
                        atlasConnection,
                        localConnection,
                        collectionName
                    );
                    
                    totalSynced += result.synced;
                    totalSkipped += result.skipped;

                } catch (error) {
                    Logger.error(`❌ Error syncing collection ${collectionName}:`, error.message);
                    errors.push({ collection: collectionName, error: error.message });
                }
            }

            const duration = Date.now() - startTime;
            this.lastSyncTime = new Date();

            Logger.info('✅ Initial sync completed');
            Logger.info(`   📊 Documents synced: ${totalSynced}`);
            Logger.info(`   ⏭️  Documents skipped: ${totalSkipped}`);
            Logger.info(`   ⏱️  Duration: ${duration}ms`);

            if (errors.length > 0) {
                Logger.warn(`   ⚠️  Errors: ${errors.length} collections had errors`);
            }

            return {
                success: true,
                totalSynced,
                totalSkipped,
                collectionsProcessed: collectionsToSync.length,
                errors,
                duration
            };

        } catch (error) {
            Logger.error('❌ Initial sync failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Sync a single collection from Atlas to Local
     * @param {Connection} atlasConnection 
     * @param {Connection} localConnection 
     * @param {string} collectionName 
     * @returns {Promise<Object>}
     */
    async syncCollection(atlasConnection, localConnection, collectionName) {
        const atlasCollection = atlasConnection.db.collection(collectionName);
        const localCollection = localConnection.db.collection(collectionName);

        // Get all documents from Atlas
        const atlasDocuments = await atlasCollection.find({}).toArray();

        if (atlasDocuments.length === 0) {
            return { synced: 0, skipped: 0 };
        }

        // Get existing document IDs from Local
        const localIds = await localCollection.distinct('_id');
        const localIdSet = new Set(localIds.map(id => id.toString()));

        // Filter documents that don't exist in Local
        const documentsToInsert = atlasDocuments.filter(doc => 
            !localIdSet.has(doc._id.toString())
        );

        let synced = 0;
        let skipped = atlasDocuments.length - documentsToInsert.length;

        // Insert missing documents
        if (documentsToInsert.length > 0) {
            try {
                await localCollection.insertMany(documentsToInsert, { ordered: false });
                synced = documentsToInsert.length;
                Logger.info(`   ✅ ${collectionName}: synced ${synced} documents`);
            } catch (error) {
                if (error.code === 11000) {
                    // Duplicate key error - some documents already exist
                    // Count how many were actually inserted
                    const insertedCount = error.result?.nInserted || 0;
                    synced = insertedCount;
                    skipped = documentsToInsert.length - insertedCount;
                    Logger.info(`   ⚠️  ${collectionName}: ${synced} synced, ${skipped} duplicates skipped`);
                } else {
                    throw error;
                }
            }
        } else {
            Logger.info(`   ⏭️  ${collectionName}: all ${skipped} documents already exist`);
        }

        return { synced, skipped };
    }

    /**
     * Start periodic sync if interval is configured
     * @param {number} intervalMs - Interval in milliseconds (0 = disabled)
     */
    startPeriodicSync(intervalMs) {
        if (intervalMs <= 0) {
            Logger.info('ℹ️  Periodic initial sync disabled (interval = 0)');
            return;
        }

        Logger.info(`🔄 Starting periodic initial sync (every ${intervalMs}ms)`);
        
        this.syncInterval = setInterval(async () => {
            Logger.info('⏰ Running scheduled initial sync...');
            await this.performSync();
        }, intervalMs);
    }

    /**
     * Stop periodic sync
     */
    stopPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            Logger.info('🛑 Periodic initial sync stopped');
        }
    }

    /**
     * Get sync status
     * @returns {Object}
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastSyncTime: this.lastSyncTime,
            periodicSyncEnabled: this.syncInterval !== null
        };
    }
}

export default InitialSyncService;
