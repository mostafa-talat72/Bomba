import Logger from "../../middleware/logger.js";
import dualDatabaseManager from "../../config/dualDatabaseManager.js";
import syncConfig from "../../config/syncConfig.js";

/**
 * PollingService
 * بديل Change Stream لـ M0 Free — يجلب التغييرات من Atlas كل 30-60 ث
 * لا يحجب أي عملية محلية (خلفية فقط)
 */
class PollingService {
    constructor() {
        this.isRunning = false;
        this.pollingInterval = null;
        this.pollingMs = parseInt(process.env.ATLAS_POLLING_INTERVAL || "30000", 10); // 30 ث افتراضي
        this.lastPollTime = null;
        this.lastPollStats = { docsChecked: 0, docsInserted: 0, docsUpdated: 0, docsDeleted: 0, errors: 0 };
        this.excludedCollections = new Set([
            "_sync_metadata",
            "_sync_tokens",
            "tombstones",
            ...(syncConfig.excludedCollections || []),
            ...(syncConfig.bidirectionalSync?.excludedCollections || []),
        ]);
        this.instanceId = `${process.env.HOSTNAME || "local"}-${process.pid}-${Date.now()}`;
    }

    /**
     * بدء الـ polling
     */
    start() {
        if (this.isRunning) return;
        if (!dualDatabaseManager.isAtlasAvailable()) {
            Logger.warn("⚠️ Atlas not available — polling will start when Atlas connects");
            dualDatabaseManager.onAtlasReconnected(() => {
                if (!this.isRunning) this.start();
            });
            return;
        }

        this.isRunning = true;
        Logger.info(`🔄 PollingService started (interval: ${this.pollingMs}ms)`);

        this.pollingInterval = setInterval(async () => {
            try {
                await this.poll();
            } catch (err) {
                Logger.error("❌ PollingService poll error:", err.message);
            }
        }, this.pollingMs);

        // Poll immediately on start
        this.poll().catch(err => Logger.error("❌ Initial poll failed:", err.message));
    }

    /**
     * إيقاف الـ polling
     */
    stop() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isRunning = false;
        Logger.info("🛑 PollingService stopped");
    }

    /**
     * تنفيذ poll واحد — يجلب التغييرات من Atlas
     */
    async poll() {
        if (!dualDatabaseManager.isAtlasAvailable()) return;

        const atlasConn = dualDatabaseManager.getAtlasConnection();
        const localConn = dualDatabaseManager.getLocalConnection();
        if (!atlasConn || !localConn) return;

        this.lastPollTime = new Date();
        const stats = { docsChecked: 0, docsInserted: 0, docsUpdated: 0, docsDeleted: 0, errors: 0 };

        try {
            // Get all non-excluded collections from Atlas
            const atlasDb = atlasConn.db;
            const localDb = localConn.db;

            const collections = await atlasDb.listCollections().toArray();

            for (const collInfo of collections) {
                if (this.excludedCollections.has(collInfo.name)) continue;
                if (collInfo.type !== "collection") continue;

                try {
                    await this.syncCollection(atlasDb, localDb, collInfo.name, stats);
                } catch (err) {
                    Logger.warn(`⚠️ Polling failed for collection ${collInfo.name}: ${err.message}`);
                    stats.errors++;
                }
            }

            this.lastPollStats = stats;

            if (stats.docsInserted > 0 || stats.docsUpdated > 0 || stats.docsDeleted > 0) {
                Logger.info(
                    `🔄 Poll completed: checked=${stats.docsChecked} inserted=${stats.docsInserted} updated=${stats.docsUpdated} deleted=${stats.docsDeleted} errors=${stats.errors}`
                );
            }
        } catch (err) {
            Logger.error("❌ PollingService poll failed:", err.message);
            stats.errors++;
            this.lastPollStats = stats;
        }
    }

    /**
     * مزامنة collection واحد من Atlas → Local
     */
    async syncCollection(atlasDb, localDb, collectionName, stats) {
        const atlasColl = atlasDb.collection(collectionName);
        const localColl = localDb.collection(collectionName);

        // Find all documents in Atlas
        const atlasDocs = await atlasColl.find({}, { projection: { _id: 1 } }).toArray();
        const atlasIds = new Set(atlasDocs.map(d => d._id.toString()));
        stats.docsChecked += atlasDocs.length;

        // Find all documents in Local
        const localDocs = await localColl.find({}, { projection: { _id: 1 } }).toArray();
        const localIds = new Set(localDocs.map(d => d._id.toString()));

        // 1. Documents in Atlas but NOT in Local → INSERT into Local
        const toInsert = atlasDocs.filter(d => !localIds.has(d._id.toString()));
        if (toInsert.length > 0) {
            // Check LOCAL tombstones — don't re-insert docs we deleted
            const tombstoneColl = localDb.collection("tombstones");
            const localTombIds = await tombstoneColl.distinct("documentId", { collectionName });
            const localTombSet = new Set(localTombIds.map(id => id.toString()));

            // Also check ATLAS tombstones — don't re-insert docs deleted by other devices
            const atlasTombstoneColl = atlasDb.collection("tombstones");
            const atlasTombIds = await atlasTombstoneColl.distinct("documentId", { collectionName }).catch(() => []);
            const atlasTombSet = new Set(atlasTombIds.map(id => id.toString()));

            const filteredToInsert = toInsert.filter(d => {
                const idStr = d._id.toString();
                return !localTombSet.has(idStr) && !atlasTombSet.has(idStr);
            });

            if (filteredToInsert.length > 0) {
                // Fetch full documents from Atlas
                const fullDocs = [];
                for (const doc of filteredToInsert) {
                    const fullDoc = await atlasColl.findOne({ _id: doc._id });
                    if (fullDoc) fullDocs.push(fullDoc);
                }

                // Expired docs (expiresAt in the past — e.g. invites/notifications
                // removed locally by TTL) must NEVER be re-inserted: delete them
                // from Atlas instead.
                const nowTs = Date.now();
                const liveDocs = [];
                const expiredIds = [];
                for (const d of fullDocs) {
                    const exp = d.expiresAt ? new Date(d.expiresAt).getTime() : NaN;
                    if (Number.isFinite(exp) && exp <= nowTs) expiredIds.push(d._id);
                    else liveDocs.push(d);
                }
                if (expiredIds.length > 0) {
                    try {
                        await atlasColl.deleteMany({ _id: { $in: expiredIds } }).catch(() => {});
                        stats.docsDeleted += expiredIds.length;
                        Logger.info(`🗑️ Poll: deleted ${expiredIds.length} expired docs from Atlas (${collectionName})`);
                    } catch {}
                }

                if (liveDocs.length > 0) {
                    // Insert in batches
                    const BATCH = 100;
                    for (let i = 0; i < liveDocs.length; i += BATCH) {
                        const batch = liveDocs.slice(i, i + BATCH);
                        try {
                            await localColl.insertMany(batch, { ordered: false }).catch(() => {});
                        } catch {}
                    }
                    stats.docsInserted += liveDocs.length;
                    Logger.info(`📥 Poll: inserted ${liveDocs.length} docs into ${collectionName}`);
                }
            }

            // Propagate LOCAL tombstones — delete from Atlas docs that have local tombstones
            const toDeleteFromAtlas = toInsert.filter(d => localTombSet.has(d._id.toString()));
            if (toDeleteFromAtlas.length > 0) {
                const idsToDelete = toDeleteFromAtlas.map(d => d._id);
                await atlasColl.deleteMany({ _id: { $in: idsToDelete } }).catch(() => {});
                Logger.info(`🗑️ Poll: deleted ${idsToDelete.length} tombstoned docs from Atlas (${collectionName})`);
            }
        }

        // 2. Documents in Local but NOT in Atlas → check tombstones → DELETE from Local or push to Atlas
        //    Must check BOTH local and Atlas tombstones to propagate deletes from other devices
        const missingInAtlas = localDocs.filter(d => !atlasIds.has(d._id.toString()));
        if (missingInAtlas.length > 0) {
            const tombstoneColl = localDb.collection("tombstones");
            const localTombIds = await tombstoneColl.distinct("documentId", { collectionName });
            const localTombSet = new Set(localTombIds.map(id => id.toString()));

            // Also check Atlas tombstones (other devices may have deleted + tombstoned)
            const atlasTombstoneColl = atlasDb.collection("tombstones");
            const atlasTombIds = await atlasTombstoneColl.distinct("documentId", { collectionName }).catch(() => []);
            const atlasTombSet = new Set(atlasTombIds.map(id => id.toString()));

            for (const doc of missingInAtlas) {
                const docIdStr = doc._id.toString();
                const hasLocalTomb = localTombSet.has(docIdStr);
                const hasAtlasTomb = atlasTombSet.has(docIdStr);

                if (hasLocalTomb || hasAtlasTomb) {
                    // Has tombstone (local or Atlas) → doc was intentionally deleted
                    // 1. Propagate tombstone to Local if only in Atlas
                    if (hasAtlasTomb && !hasLocalTomb) {
                        try {
                            const atlasTomb = await atlasTombstoneColl.findOne({ documentId: doc._id, collectionName });
                            if (atlasTomb) {
                                await tombstoneColl.updateOne(
                                    { collectionName, documentId: doc._id, organization: atlasTomb.organization },
                                    { $set: { deletedAt: atlasTomb.deletedAt, deletedBy: atlasTomb.deletedBy } },
                                    { upsert: true }
                                );
                            }
                        } catch {}
                    }
                    // 2. Delete from Local (cleanup — doc was deleted by this or another device)
                    try {
                        await localColl.deleteOne({ _id: doc._id });
                        stats.docsDeleted++;
                        Logger.info(`🗑️ Poll: deleted tombstoned doc from Local: ${collectionName}:${docIdStr}`);
                    } catch {}
                    continue;
                }

                // No tombstone anywhere → push to Atlas (new doc created offline)
                const fullDoc = await localColl.findOne({ _id: doc._id });
                if (fullDoc) {
                    // Expired locally (TTL will remove it) → never push back to
                    // Atlas; drop it locally instead.
                    const expTs = fullDoc.expiresAt ? new Date(fullDoc.expiresAt).getTime() : NaN;
                    if (Number.isFinite(expTs) && expTs <= Date.now()) {
                        try {
                            await localColl.deleteOne({ _id: doc._id });
                            stats.docsDeleted++;
                        } catch {}
                        continue;
                    }
                    try {
                        await atlasColl.updateOne(
                            { _id: fullDoc._id },
                            { $set: fullDoc },
                            { upsert: true }
                        );
                        stats.docsUpdated++;
                    } catch {}
                }
            }
        }

        // 3. Documents in both → check updatedAt for updates (skip for perf on large collections)
        // Only check if collection has updatedAt field
        if (atlasDocs.length > 0 && atlasDocs.length < 5000) {
            for (const atlasDoc of atlasDocs) {
                if (!localIds.has(atlasDoc._id.toString())) continue;

                const localDoc = await localColl.findOne(
                    { _id: atlasDoc._id },
                    { projection: { updatedAt: 1, _id: 0 } }
                );
                const atlasFullDoc = await atlasColl.findOne(
                    { _id: atlasDoc._id },
                    { projection: { updatedAt: 1, _id: 0 } }
                );

                if (!localDoc || !atlasFullDoc) continue;

                const localTime = localDoc.updatedAt ? new Date(localDoc.updatedAt).getTime() : 0;
                const atlasTime = atlasFullDoc.updatedAt ? new Date(atlasFullDoc.updatedAt).getTime() : 0;

                // If Atlas is newer → update Local
                if (atlasTime > localTime && atlasTime - localTime > 1000) {
                    // Check if this change originated locally (skip if we wrote it)
                    // We can't know for sure without origin tracking, so use updatedAt comparison
                    const fullAtlasDoc = await atlasColl.findOne({ _id: atlasDoc._id });
                    if (fullAtlasDoc) {
                        try {
                            // Remove undefined fields
                            delete fullAtlasDoc._id;
                            await localColl.updateOne(
                                { _id: atlasDoc._id },
                                { $set: fullAtlasDoc }
                            );
                            stats.docsUpdated++;
                        } catch {}
                    }
                }
            }
        }
    }

    /**
     * Get polling status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            pollingMs: this.pollingMs,
            lastPollTime: this.lastPollTime,
            lastPollStats: this.lastPollStats,
            instanceId: this.instanceId,
        };
    }
}

// Export singleton
const pollingService = new PollingService();
export default pollingService;
