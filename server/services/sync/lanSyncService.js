import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import syncConfig from "../../config/syncConfig.js";
import Logger from "../../middleware/logger.js";
import { getDeviceId } from "../../utils/deviceIdentity.js";
import lanDiscovery from "./lanDiscovery.js";
import { EJSON } from "bson";
import { rehydrateDocument, rehydrateFilter } from "../../utils/bsonRehydrate.js";

let originTrackerInstance = null;
let conflictResolverInstance = null;

// Use shared singleton origin tracker (same as middleware and bidirectional sync)
async function getOriginTracker() {
    if (global.__originTracker) return global.__originTracker;
    if (originTrackerInstance) return originTrackerInstance;
    try {
        const mod = await import("./originTracker.js");
        if (mod.default?.getInstance) {
            originTrackerInstance = mod.default.getInstance();
        } else {
            originTrackerInstance = new mod.default();
        }
    } catch {
        const { default: OT } = await import("./originTracker.js");
        originTrackerInstance = OT.getInstance ? OT.getInstance() : new OT();
    }
    return originTrackerInstance;
}

class LanQueueManager {
    constructor(filePath, maxSize = 5000) {
        this.filePath = filePath;
        this.maxSize = maxSize;
        this.queue = [];
        this.timer = null;
    }
    enqueue(op) {
        if (this.queue.length >= this.maxSize) this.queue.shift();
        this.queue.push({ ...op, queuedAt: new Date().toISOString() });
        this.scheduleSave();
    }
    dequeueAll() {
        const all = [...this.queue];
        this.queue = [];
        this.scheduleSave();
        return all;
    }
    size() { return this.queue.length; }
    isEmpty() { return this.queue.length === 0; }
    scheduleSave() {
        if (this.timer) return;
        this.timer = setTimeout(() => { this.timer = null; this.persist(); }, 2000);
        if (this.timer.unref) this.timer.unref();
    }
    persist() {
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.filePath, EJSON.stringify({ version: 1, queue: this.queue }, null, 2), "utf8");
        } catch (e) {
            Logger.warn("[LanSync] Failed to persist LAN queue:", e.message);
        }
    }
    load() {
        try {
            if (!fs.existsSync(this.filePath)) return 0;
            const data = EJSON.parse(fs.readFileSync(this.filePath, "utf8"));
            if (Array.isArray(data.queue)) {
                this.queue = data.queue;
                Logger.info(`[LanSync] Loaded ${this.queue.length} ops from LAN queue`);
                return this.queue.length;
            }
        } catch (e) {
            Logger.warn("[LanSync] Failed to load LAN queue:", e.message);
        }
        return 0;
    }
    cleanup() {
        if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    }
}

class LanSyncService {
    constructor() {
        this.deviceId = getDeviceId();
        this.io = null;
        this.httpServer = null;
        this.nsp = null;
        this.clientSocket = null;
        this.isRunning = false;
        this.isPrimary = false;
        this.primaryInfo = null;
        this.connectedPeers = new Map(); // socket.id -> { deviceId, socket }
        this.reconnectTimer = null;
        this.queueManager = new LanQueueManager(
            syncConfig.lanSync?.queuePath || "./data/lan-queue.json",
            syncConfig.queueMaxSize || 5000
        );
        this.stats = { sent: 0, received: 0, applied: 0, queued: 0, errors: 0 };
        this.applyInProgress = new Set(); // dedup by op id
    }

    async start(httpServer, io) {
        if (this.isRunning) return;
        if (!syncConfig.lanSync?.enabled) {
            Logger.info("[LanSync] LAN sync disabled");
            return;
        }
        this.isRunning = true;
        this.httpServer = httpServer;
        this.io = io;
        this.queueManager.load();

        Logger.info(`[LanSync] Starting LAN sync service deviceId=${this.deviceId}`);

        // Setup socket.io namespace for LAN sync
        this.setupNamespace();

        // Start discovery
        lanDiscovery.on("became-primary", () => this.onBecamePrimary());
        lanDiscovery.on("became-secondary", (info) => this.onBecameSecondary(info));
        lanDiscovery.on("primary-lost", () => this.onPrimaryLost());
        lanDiscovery.on("primary-changed", (info) => this.onPrimaryChanged(info));
        lanDiscovery.on("election-won", () => this.onBecamePrimary());
        lanDiscovery.on("election-lost", (info) => this.onBecameSecondary(info));

        await lanDiscovery.start();

        // If discovery already decided, trigger handler
        const status = lanDiscovery.getStatus();
        if (status.role === "primary") await this.onBecamePrimary();
        else if (status.role === "secondary" && status.primary) await this.onBecameSecondary(status.primary);

        Logger.info("[LanSync] LAN sync service started");
    }

    setupNamespace() {
        if (!this.io) return;
        this.nsp = this.io.of("/lan-sync");

        // Device auth: allow any deviceId, no JWT needed for LAN (trusted network)
        this.nsp.use((socket, next) => {
            const deviceId = socket.handshake.auth?.deviceId || socket.handshake.query?.deviceId;
            if (!deviceId) return next(new Error("deviceId required"));
            socket.data.deviceId = deviceId;
            socket.data.hostname = socket.handshake.auth?.hostname || "unknown";
            next();
        });

        this.nsp.on("connection", (socket) => {
            const deviceId = socket.data.deviceId;
            Logger.info(`[LanSync] Peer connected: ${deviceId} socket=${socket.id}`);

            if (!this.isPrimary) {
                Logger.warn(`[LanSync] Received peer connection but we are not primary, disconnecting ${deviceId}`);
                socket.disconnect(true);
                return;
            }

            this.connectedPeers.set(socket.id, { deviceId, socket, connectedAt: Date.now() });

            socket.on("lan:op", async (op, ack) => {
                try {
                    await this.handleRemoteOperation(op, deviceId);
                    // Broadcast to other secondaries (exclude sender)
                    for (const [sid, peer] of this.connectedPeers.entries()) {
                        if (sid !== socket.id) {
                            peer.socket.emit("lan:op", op);
                        }
                    }
                    if (ack) ack({ success: true });
                } catch (e) {
                    Logger.error(`[LanSync] Error handling lan:op from ${deviceId}:`, e.message);
                    if (ack) ack({ success: false, error: e.message });
                }
            });

            socket.on("lan:initial-sync-request", async (data, ack) => {
                try {
                    Logger.info(`[LanSync] Initial sync requested by ${deviceId}`);
                    const result = await this.handleInitialSyncRequest(socket, data);
                    if (ack) ack({ success: true, ...result });
                } catch (e) {
                    Logger.error(`[LanSync] Initial sync failed for ${deviceId}:`, e.message);
                    if (ack) ack({ success: false, error: e.message });
                }
            });

            socket.on("disconnect", (reason) => {
                Logger.info(`[LanSync] Peer disconnected: ${deviceId} reason=${reason}`);
                this.connectedPeers.delete(socket.id);
            });

            // Send welcome and trigger initial sync push after a short delay
            // The secondary will request initial sync itself, so no auto-push needed
        });
    }

    async onBecamePrimary() {
        this.isPrimary = true;
        this.primaryInfo = { deviceId: this.deviceId, address: lanDiscovery.localIP, port: lanDiscovery.port };
        Logger.info(`[LanSync] Role -> PRIMARY`);

        // If we were previously a secondary client, disconnect
        if (this.clientSocket) {
            try { this.clientSocket.disconnect(); } catch {}
            this.clientSocket = null;
        }
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }

        // Drain any queued ops (as primary we don't queue, but if we were secondary previously)
        if (!this.queueManager.isEmpty()) {
            Logger.info(`[LanSync] Draining ${this.queueManager.size()} queued ops as new primary (no peer to send, will keep for Atlas)`);
            // For primary, queued ops are local ops that failed to send while secondary; now as primary they are already in local DB, just clear
            this.queueManager.dequeueAll();
        }
    }

    async onBecameSecondary(primaryInfo) {
        this.isPrimary = false;
        this.primaryInfo = primaryInfo;
        Logger.info(`[LanSync] Role -> SECONDARY primary=${primaryInfo.deviceId} @ ${primaryInfo.address}:${primaryInfo.port}`);
        this.connectToPrimary();
    }

    onPrimaryLost() {
        Logger.warn("[LanSync] Primary lost, waiting for election...");
        // Disconnect client socket
        if (this.clientSocket) {
            try { this.clientSocket.disconnect(); } catch {}
            this.clientSocket = null;
        }
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    }

    onPrimaryChanged(newPrimary) {
        Logger.info(`[LanSync] Primary changed to ${newPrimary.deviceId} @ ${newPrimary.address}:${newPrimary.port}`);
        this.primaryInfo = newPrimary;
        if (!this.isPrimary) {
            this.connectToPrimary();
        }
    }

    connectToPrimary() {
        if (this.isPrimary || !this.primaryInfo) return;
        if (this.clientSocket?.connected) {
            // Already connected to correct primary?
            return;
        }

        const url = `http://${this.primaryInfo.address}:${this.primaryInfo.port}/lan-sync`;
        Logger.info(`[LanSync] Connecting to primary ${url} deviceId=${this.deviceId}`);

        if (this.clientSocket) {
            try { this.clientSocket.disconnect(); } catch {}
            this.clientSocket = null;
        }

        // Dynamic import of socket.io-client
        import("socket.io-client").then(({ io }) => {
            this.clientSocket = io(url, {
                auth: { deviceId: this.deviceId, hostname: lanDiscovery.hostname },
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 2000,
                timeout: 5000,
            });

            this.clientSocket.on("connect", async () => {
                Logger.info(`[LanSync] Connected to primary ${this.primaryInfo.deviceId}`);
                // Request initial sync if needed
                try {
                    await this.requestInitialSync();
                } catch (e) {
                    Logger.warn("[LanSync] Initial sync request failed:", e.message);
                }
                // Drain queued ops
                await this.drainQueue();
            });

            this.clientSocket.on("lan:op", async (op) => {
                try {
                    await this.handleRemoteOperation(op, this.primaryInfo.deviceId);
                } catch (e) {
                    Logger.error("[LanSync] Error handling lan:op from primary:", e.message);
                }
            });

            this.clientSocket.on("lan:initial-sync-data", async (payload) => {
                try {
                    await this.handleInitialSyncData(payload);
                } catch (e) {
                    Logger.error("[LanSync] Error handling initial sync data:", e.message);
                }
            });

            this.clientSocket.on("disconnect", (reason) => {
                Logger.warn(`[LanSync] Disconnected from primary reason=${reason}`);
                if (this.isRunning && !this.isPrimary) {
                    // Will auto-reconnect via socket.io-client reconnection, but also fallback to discovery re-election if needed
                }
            });

            this.clientSocket.on("connect_error", (err) => {
                Logger.warn(`[LanSync] Connect error to primary: ${err.message}`);
            });
        }).catch(e => {
            Logger.error("[LanSync] Failed to import socket.io-client:", e.message);
        });
    }

    // Called from syncMiddleware when a local operation occurs
    async handleLocalOperation(operation) {
        if (!this.isRunning || !syncConfig.lanSync?.enabled) return;

        // Enrich with deviceId and timestamp
        const op = {
            ...operation,
            deviceId: this.deviceId,
            lanTimestamp: new Date().toISOString(),
            _id: operation._id || `${this.deviceId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        };

        // Deduplication: if this op originated from LAN (isLanChange), skip
        try {
            const tracker = await getOriginTracker();
            const docId = op.data?._id || op.filter?._id || op.documentId;
            if (docId && tracker.isLanChange(docId)) {
                return;
            }
        } catch {}

        await this.broadcastOperation(op);
    }

    async broadcastOperation(op) {
        if (!this.isRunning) return;

        if (this.isPrimary) {
            // Broadcast to all connected secondaries
            if (this.connectedPeers.size === 0) {
                // No peers connected, queue for later if persist enabled? For primary with no peers, no need to queue
                // But log
                Logger.info(`[LanSync] No peers connected, skipping broadcast ${op.type}:${op.collection}`);
                return;
            }
            let sent = 0;
            for (const peer of this.connectedPeers.values()) {
                try {
                    peer.socket.emit("lan:op", op);
                    sent++;
                } catch (e) {
                    Logger.warn(`[LanSync] Failed to send to peer ${peer.deviceId}:`, e.message);
                }
            }
            this.stats.sent += sent;
            Logger.info(`[LanSync] Broadcast ${op.type}:${op.collection} to ${sent} peers`);
        } else {
            // Secondary -> send to primary
            if (this.clientSocket?.connected) {
                try {
                    await new Promise((resolve, reject) => {
                        this.clientSocket.emit("lan:op", op, (res) => {
                            if (res?.success) resolve(res);
                            else reject(new Error(res?.error || "ack failed"));
                        });
                        setTimeout(() => reject(new Error("ack timeout")), 5000);
                    });
                    this.stats.sent++;
                    Logger.info(`[LanSync] Sent ${op.type}:${op.collection} to primary`);
                } catch (e) {
                    Logger.warn(`[LanSync] Failed to send to primary, queuing: ${e.message}`);
                    this.queueManager.enqueue(op);
                    this.stats.queued++;
                }
            } else {
                Logger.info(`[LanSync] Not connected to primary, queuing ${op.type}:${op.collection}`);
                this.queueManager.enqueue(op);
                this.stats.queued++;
            }
        }
    }

    async handleRemoteOperation(op, sourceDeviceId) {
        if (!op || !op.collection || !op.type) {
            Logger.warn("[LanSync] Invalid op received", op);
            return;
        }

        // Dedup by op id
        const opKey = op._id || `${op.collection}:${op.data?._id || op.filter?._id}:${op.timestamp}`;
        if (this.applyInProgress.has(opKey)) {
            Logger.info(`[LanSync] Duplicate op skipped ${opKey}`);
            return;
        }
        this.applyInProgress.add(opKey);
        setTimeout(() => this.applyInProgress.delete(opKey), 60000);

        // Check origin: if this change originated from us (local), skip (prevent loop)
        try {
            const tracker = await getOriginTracker();
            const docId = op.data?._id || op.filter?._id;
            if (docId && tracker.isLocalChange(docId)) {
                Logger.info(`[LanSync] Skipping op ${opKey} originated from local`);
                return;
            }
            // Mark as LAN origin to prevent re-broadcast
            if (docId) tracker.markLanChange(docId);
        } catch {}

        this.stats.received++;
        Logger.info(`[LanSync] Applying remote op ${op.type}:${op.collection} from ${sourceDeviceId}`);

        try {
            await this.applyOperation(op);
            this.stats.applied++;

            // Also enqueue for Atlas sync if Atlas enabled (so LAN changes reach cloud)
            if (syncConfig.enabled && syncConfig.atlasUri) {
                try {
                    const { default: syncQueueManager } = await import("./syncQueueManager.js");
                    // Enqueue a copy for Atlas (without lan metadata)
                    const atlasOp = { type: op.type, collection: op.collection, data: op.data, filter: op.filter, timestamp: new Date(), origin: 'local' };
                    // Mark local change for Atlas deduplication? The change came from LAN, but for Atlas it's a local change
                    syncQueueManager.enqueue(atlasOp);
                    Logger.info(`[LanSync] Enqueued LAN op for Atlas sync ${op.type}:${op.collection}`);
                } catch (e) {
                    Logger.warn("[LanSync] Failed to enqueue LAN op for Atlas:", e.message);
                }
            }
        } catch (e) {
            this.stats.errors++;
            Logger.error(`[LanSync] Failed to apply remote op ${op.type}:${op.collection}:`, e.message);
            throw e;
        }
    }

    async applyOperation(op) {
        const collectionName = op.collection;
        const type = op.type;

        // Get mongoose model if exists, otherwise use direct db collection
        let Model = null;
        try {
            Model = mongoose.model(collectionName);
        } catch {
            // Try capitalized
            try { Model = mongoose.model(collectionName.charAt(0).toUpperCase() + collectionName.slice(1)); } catch {}
        }

        const db = mongoose.connection.db;
        if (!db) throw new Error("Local DB not connected");

        const collection = db.collection(collectionName);

        if (type === "insert") {
            const data = op.data;
            if (!data || !data._id) throw new Error("Insert op missing data._id");
            // Conflict resolution: if exists, compare updatedAt
            const existing = await collection.findOne({ _id: new mongoose.Types.ObjectId(data._id) }).catch(() => null) 
                || await collection.findOne({ _id: data._id }).catch(() => null);
            if (existing) {
                // last-write-wins
                const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
                const incomingTime = new Date(data.updatedAt || data.createdAt || op.timestamp || 0).getTime();
                if (incomingTime <= existingTime) {
                    Logger.info(`[LanSync] Insert skipped (existing newer) ${collectionName}:${data._id}`);
                    return;
                }
            }
            // Direct collection upsert bypassing middleware
            const toInsert = { ...data };
            // Restore BSON types (socket.io is JSON: Dates/nested ObjectIds arrive as strings)
            rehydrateDocument(collectionName, toInsert);
            // Ensure _id is ObjectId if it looks like one
            try { if (typeof toInsert._id === 'string' && /^[a-f0-9]{24}$/i.test(toInsert._id)) toInsert._id = new mongoose.Types.ObjectId(toInsert._id); } catch {}
            await collection.replaceOne({ _id: toInsert._id }, toInsert, { upsert: true });
            Logger.info(`[LanSync] Applied insert ${collectionName}:${data._id}`);

        } else if (type === "update") {
            const filter = op.filter || {};
            const data = op.data || {};
            if (!filter._id && !data._id) throw new Error("Update op missing _id");
            const id = filter._id || data._id;
            let objectId = id;
            try { if (typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)) objectId = new mongoose.Types.ObjectId(id); } catch {}
            const existing = await collection.findOne({ _id: objectId }).catch(() => null);
            if (existing) {
                const existingTime = new Date(existing.updatedAt || 0).getTime();
                const incomingTime = new Date(data.updatedAt || op.timestamp || 0).getTime();
                if (incomingTime < existingTime) {
                    Logger.info(`[LanSync] Update skipped (existing newer) ${collectionName}:${id}`);
                    return;
                }
            }
            const filterObj = { _id: objectId };
            // Restore BSON types in payload (socket.io JSON degrades Dates/nested ObjectIds)
            rehydrateDocument(collectionName, data);
            // Use $set for update
            const updateDoc = { $set: { ...data, updatedAt: new Date() } };
            // Remove _id from $set
            delete updateDoc.$set._id;
            await collection.updateOne(filterObj, updateDoc, { upsert: false });
            Logger.info(`[LanSync] Applied update ${collectionName}:${id}`);

        } else if (type === "delete") {
            const filter = op.filter || {};
            let id = filter._id;
            if (!id) throw new Error("Delete op missing _id");
            try { if (typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)) id = new mongoose.Types.ObjectId(id); } catch {}
            await collection.deleteOne({ _id: id });
            Logger.info(`[LanSync] Applied delete ${collectionName}:${id}`);

            // Create tombstone for delete propagation
            try {
                const { default: Tombstone } = await import("../../models/Tombstone.js").catch(() => ({ default: null }));
                if (Tombstone) {
                    const org = op.data?.organization || op.organization || null;
                    if (org) await collection.db.collection("tombstones").updateOne(
                        { collectionName, documentId: id.toString(), organization: new mongoose.Types.ObjectId(org) },
                        { $set: { deletedAt: new Date(), deletedBy: op.deviceId || this.deviceId } },
                        { upsert: true }
                    );
                }
            } catch {}

        } else {
            throw new Error(`Unknown op type: ${type}`);
        }
    }

    async handleInitialSyncRequest(socket, data) {
        // Secondary requests full data; we send all collections
        const db = mongoose.connection.db;
        if (!db) throw new Error("DB not connected");

        const collections = await db.listCollections().toArray();
        const collNames = collections.map(c => c.name).filter(n => !n.startsWith("system.") && !n.startsWith("_sync") && n !== "tombstones");

        Logger.info(`[LanSync] Initial sync: ${collNames.length} collections`);

        // Send in batches via socket events
        for (const collName of collNames) {
            const docs = await db.collection(collName).find({}).toArray();
            Logger.info(`[LanSync] Sending ${docs.length} docs for ${collName}`);
            // Chunk into 100 doc batches
            for (let i = 0; i < docs.length; i += 100) {
                const chunk = docs.slice(i, i + 100);
                socket.emit("lan:initial-sync-data", { collection: collName, docs: chunk, total: docs.length, index: i });
                // Small delay to avoid flooding
                await new Promise(r => setTimeout(r, 50));
            }
        }
        socket.emit("lan:initial-sync-complete", { collections: collNames.length });
        return { collections: collNames.length };
    }

    async requestInitialSync() {
        if (this.isPrimary || !this.clientSocket?.connected) return;
        Logger.info("[LanSync] Requesting initial sync from primary...");

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Initial sync timeout")), 30000);
            this.clientSocket.emit("lan:initial-sync-request", { deviceId: this.deviceId }, (res) => {
                clearTimeout(timeout);
                if (res?.success) {
                    Logger.info(`[LanSync] Initial sync request ack: ${res.collections} collections`);
                    resolve(res);
                } else {
                    reject(new Error(res?.error || "Initial sync failed"));
                }
            });
        });
    }

    async handleInitialSyncData(payload) {
        const { collection, docs } = payload;
        if (!collection || !Array.isArray(docs) || docs.length === 0) return;

        Logger.info(`[LanSync] Received initial sync data ${collection}: ${docs.length} docs`);

        const db = mongoose.connection.db;
        if (!db) return;

        const coll = db.collection(collection);
        for (const doc of docs) {
            try {
                // Mark as LAN to prevent re-broadcast
                try {
                    const tracker = await getOriginTracker();
                    if (doc._id) tracker.markLanChange(doc._id);
                } catch {}

                let id = doc._id;
                try { if (typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)) doc._id = new mongoose.Types.ObjectId(id); } catch {}

                // Restore BSON types for nested refs + dates (initial sync travels as JSON)
                rehydrateDocument(collection, doc);

                // Check if exists and compare timestamps
                const existing = await coll.findOne({ _id: doc._id }).catch(() => null);
                if (existing) {
                    const existingTime = new Date(existing.updatedAt || 0).getTime();
                    const incomingTime = new Date(doc.updatedAt || 0).getTime();
                    if (incomingTime <= existingTime) continue;
                }

                await coll.replaceOne({ _id: doc._id }, doc, { upsert: true });
                this.stats.applied++;
            } catch (e) {
                Logger.warn(`[LanSync] Failed to apply initial sync doc ${collection}:${doc._id}:`, e.message);
            }
        }
    }

    async drainQueue() {
        if (this.queueManager.isEmpty()) return;
        if (this.isPrimary) return; // primary doesn't queue to peer

        const ops = this.queueManager.dequeueAll();
        Logger.info(`[LanSync] Draining ${ops.length} queued ops to primary`);

        for (const op of ops) {
            try {
                await this.broadcastOperation(op);
                // Small delay
                await new Promise(r => setTimeout(r, 20));
            } catch (e) {
                Logger.warn("[LanSync] Failed to drain queued op, re-queuing:", e.message);
                this.queueManager.enqueue(op);
            }
        }
    }

    getStatus() {
        return {
            enabled: !!syncConfig.lanSync?.enabled,
            isRunning: this.isRunning,
            isPrimary: this.isPrimary,
            deviceId: this.deviceId,
            primary: this.primaryInfo,
            discovery: lanDiscovery.getStatus(),
            connectedPeers: this.isPrimary ? [...this.connectedPeers.values()].map(p => ({ deviceId: p.deviceId, connectedAt: p.connectedAt })) : [],
            clientConnected: !!this.clientSocket?.connected,
            queueSize: this.queueManager.size(),
            stats: { ...this.stats },
        };
    }

    async stop() {
        this.isRunning = false;
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        if (this.clientSocket) { try { this.clientSocket.disconnect(); } catch {} this.clientSocket = null; }
        for (const peer of this.connectedPeers.values()) {
            try { peer.socket.disconnect(true); } catch {}
        }
        this.connectedPeers.clear();
        this.queueManager.cleanup();
        // Persist queue
        if (!this.queueManager.isEmpty()) this.queueManager.persist();
        await lanDiscovery.stop();
        Logger.info("[LanSync] Stopped");
    }
}

const lanSyncService = new LanSyncService();
export default lanSyncService;
