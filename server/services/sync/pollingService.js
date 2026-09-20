import Logger from "../../middleware/logger.js";
import dualDatabaseManager from "../../config/dualDatabaseManager.js";
import syncConfig from "../../config/syncConfig.js";

/**
 * PollingService
 * بديل Change Stream لـ M0 Free — يجلب التغييرات من Atlas كل 30-60 ث
 * لا يحجب أي عملية محلية (خلفية فقط)
 *
 * After every local write triggered by Atlas data, connected clients are
 * notified via Socket.IO so the UI updates instantly.
 */
class PollingService {
    constructor() {
        this.isRunning = false;
        this.pollingInterval = null;
        this.pollingMs = parseInt(process.env.ATLAS_POLLING_INTERVAL || "10000", 10); // 10 ث افتراضي (خفيف بفضل timestamp query)
        this.lastPollTime = null;
        this.lastPollTimestamps = new Map(); // collectionName → Date of last successful poll
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
     * Broadcast a local-write notification to all connected Socket.IO clients.
     * collectionName → socket event mapping (subset that the frontend listens to).
     */
    notifyLocalClients(collectionName, type, doc) {
        const io = global.__socketIO;
        if (!io || !doc) return;
        try {
            const org = doc.organization ? String(doc.organization) : null;
            const toOrg = (event, data) => {
                if (org) { io.to(`org-${org}`).emit(event, data); io.to(`org:${org}`).emit(event, data); }
                else io.emit(event, data);
            };
            switch (collectionName) {
                case "bills":
                    toOrg("bill:created", doc);
                    toOrg("bill-update", { type, bill: doc });
                    break;
                case "orders":
                    toOrg("order:created", doc);
                    toOrg("order-update", { type, order: doc });
                    break;
                case "sessions":
                    toOrg("session:created", doc);
                    toOrg("session-update", { type, session: doc });
                    break;
                case "tables":
                    toOrg("table:updated", doc);
                    toOrg("table-status-update", { tableId: doc._id, status: doc.status || "empty" });
                    break;
                case "menuitems":
                case "menucategories":
                case "menusections":
                    toOrg("menu-update", { type, item: doc });
                    break;
                case "costs":
                    toOrg("cost-update", { type, cost: doc });
                    break;
                case "inventory":
                case "warehouse":
                    io.emit("inventory-update", { type, item: doc });
                    break;
                default:
                    // Generic broadcast for other collections
                    io.emit("sync:update", { collection: collectionName, type, doc });
                    break;
            }
        } catch { /* swallow — notification is best-effort */ }
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
     * Lightweight: uses timestamp-based queries for updates, full ID diff only for inserts/deletes.
     */
    async syncCollection(atlasDb, localDb, collectionName, stats) {
        const atlasColl = atlasDb.collection(collectionName);
        const localColl = localDb.collection(collectionName);

        // Timestamp-based fast path: only fetch docs updated since last poll
        const lastPoll = this.lastPollTimestamps.get(collectionName);

        // 1. New docs in Atlas (created since last poll) → INSERT into Local
        const newInAtlas = lastPoll
            ? await atlasColl.find({ createdAt: { $gt: lastPoll } }, { projection: { _id: 1, createdAt: 1 } }).toArray()
            : [];
        // Also catch docs with no createdAt but updated recently (edge case)
        const recentAtlas = lastPoll
            ? await atlasColl.find({ updatedAt: { $gt: lastPoll }, _id: { $nin: newInAtlas.map(d => d._id) } }, { projection: { _id: 1 } }).toArray()
            : [];
        const atlasIdsToCheck = new Set([...newInAtlas.map(d => d._id.toString()), ...recentAtlas.map(d => d._id.toString())]);
        stats.docsChecked += atlasIdsToCheck.size;

        if (atlasIdsToCheck.size > 0) {
            // Get local IDs only for the subset we need to check
            const atlasIdArray = [...newInAtlas, ...recentAtlas].map(d => d._id);
            const localExisting = await localColl.find({ _id: { $in: atlasIdArray } }, { projection: { _id: 1 } }).toArray();
            const localExistingSet = new Set(localExisting.map(d => d._id.toString()));

            const toInsert = [...newInAtlas, ...recentAtlas].filter(d => !localExistingSet.has(d._id.toString()));

            if (toInsert.length > 0) {
                // Tombstone check
                const tombstoneColl = localDb.collection("tombstones");
                const localTombIds = await tombstoneColl.distinct("documentId", { collectionName });
                const localTombSet = new Set(localTombIds.map(id => id.toString()));
                const atlasTombstoneColl = atlasDb.collection("tombstones");
                const atlasTombIds = await atlasTombstoneColl.distinct("documentId", { collectionName }).catch(() => []);
                const atlasTombSet = new Set(atlasTombIds.map(id => id.toString()));

                const filteredToInsert = toInsert.filter(d => {
                    const idStr = d._id.toString();
                    return !localTombSet.has(idStr) && !atlasTombSet.has(idStr);
                });

                if (filteredToInsert.length > 0) {
                    const fullDocs = [];
                    for (const doc of filteredToInsert) {
                        const fullDoc = await atlasColl.findOne({ _id: doc._id });
                        if (fullDoc) fullDocs.push(fullDoc);
                    }
                    // Expired docs cleanup
                    const nowTs = Date.now();
                    const liveDocs = [];
                    const expiredIds = [];
                    for (const d of fullDocs) {
                        const exp = d.expiresAt ? new Date(d.expiresAt).getTime() : NaN;
                        if (Number.isFinite(exp) && exp <= nowTs) expiredIds.push(d._id);
                        else liveDocs.push(d);
                    }
                    if (expiredIds.length > 0) {
                        try { await atlasColl.deleteMany({ _id: { $in: expiredIds } }).catch(() => {}); stats.docsDeleted += expiredIds.length; } catch {}
                    }
                    if (liveDocs.length > 0) {
                        const BATCH = 100;
                        for (let i = 0; i < liveDocs.length; i += BATCH) {
                            const batch = liveDocs.slice(i, i + BATCH);
                            try { await localColl.insertMany(batch, { ordered: false }).catch(() => {}); } catch {}
                        }
                        stats.docsInserted += liveDocs.length;
                        Logger.info(`📥 Poll: inserted ${liveDocs.length} docs into ${collectionName}`);
                        for (const doc of liveDocs) this.notifyLocalClients(collectionName, "created", doc);
                    }
                }

                // Propagate LOCAL tombstones — delete from Atlas
                const toDeleteFromAtlas = toInsert.filter(d => localTombSet.has(d._id.toString()));
                if (toDeleteFromAtlas.length > 0) {
                    await atlasColl.deleteMany({ _id: { $in: toDeleteFromAtlas.map(d => d._id) } }).catch(() => {});
                }
            }
        }

        // 2. Timestamp-based updates: fetch Atlas docs updated since last poll, apply to Local
        if (lastPoll) {
            const updatedSincePoll = await atlasColl
                .find({ updatedAt: { $gt: lastPoll } })
                .toArray();
            for (const atlasDoc of updatedSincePoll) {
                try {
                    const { _id, ...rest } = atlasDoc;
                    await localColl.updateOne({ _id }, { $set: rest }, { upsert: true });
                    stats.docsUpdated++;
                    this.notifyLocalClients(collectionName, "updated", atlasDoc);
                } catch {}
            }
        }

        // 3. Rare case: Local has docs not in Atlas (created offline) — full ID diff
        // Only run on first poll or every 5th poll to reduce cost
        const pollCount = (this.lastPollTimestamps.get(`${collectionName}_count`) || 0) + 1;
        this.lastPollTimestamps.set(`${collectionName}_count`, pollCount);
        if (!lastPoll || pollCount % 5 === 0) {
            const atlasAllIds = await atlasColl.find({}, { projection: { _id: 1 } }).toArray();
            const atlasIdSet = new Set(atlasAllIds.map(d => d._id.toString()));
            const localAllDocs = await localColl.find({}, { projection: { _id: 1, organization: 1 } }).toArray();
            const missingInAtlas = localAllDocs.filter(d => !atlasIdSet.has(d._id.toString()));

            if (missingInAtlas.length > 0) {
                const tombstoneColl = localDb.collection("tombstones");
                const localTombIds = await tombstoneColl.distinct("documentId", { collectionName });
                const localTombSet = new Set(localTombIds.map(id => id.toString()));
                const atlasTombstoneColl = atlasDb.collection("tombstones");
                const atlasTombIds = await atlasTombstoneColl.distinct("documentId", { collectionName }).catch(() => []);
                const atlasTombSet = new Set(atlasTombIds.map(id => id.toString()));

                for (const doc of missingInAtlas) {
                    const docIdStr = doc._id.toString();
                    if (localTombSet.has(docIdStr) || atlasTombSet.has(docIdStr)) {
                        try { await localColl.deleteOne({ _id: doc._id }); stats.docsDeleted++; } catch {}
                        continue;
                    }
                    const fullDoc = await localColl.findOne({ _id: doc._id });
                    if (fullDoc) {
                        const expTs = fullDoc.expiresAt ? new Date(fullDoc.expiresAt).getTime() : NaN;
                        if (Number.isFinite(expTs) && expTs <= Date.now()) {
                            try { await localColl.deleteOne({ _id: doc._id }); stats.docsDeleted++; } catch {}
                            continue;
                        }
                        try {
                            await atlasColl.updateOne({ _id: fullDoc._id }, { $set: fullDoc }, { upsert: true });
                            stats.docsUpdated++;
                        } catch {}
                    }
                }
            }
        }

        // Record poll timestamp
        this.lastPollTimestamps.set(collectionName, new Date());
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
