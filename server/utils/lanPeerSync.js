/**
 * Simple LAN peer push (mesh, offline-first, HTTP).
 *
 * Flow: device A writes Local DB -> (sync middleware hook) -> pushLanOp(op)
 * pushes the doc to every discovered peer via
 * `POST http://{peerIp}:{peerPort}/api/lan/receive` with
 * `{ collection, doc, operation }` (fire-and-forget, 2s timeout).
 * Peer upserts into its own Local DB.
 *
 * If a device is down, the other keeps full data; when the missing device
 * returns, `catchUpWithPeer()` pulls `{ collection, since }` pages from
 * `POST /api/lan/sync-missing` and upserts them (last-write-wins).
 *
 * Atlas sync is untouched — this is an additional channel, not a replacement.
 * Uses global `fetch` (Node 18+), no new dependencies.
 */
import mongoose from "mongoose";
import lanMeshDiscovery from "./lanDiscovery.js";
import Logger from "../middleware/logger.js";

export const LAN_PUSH_TIMEOUT_MS = 2000;
const CATCH_UP_PAGE_SIZE = 500;

// Collections pulled during catch-up (peer-up auto-sync). Writes of ANY
// collection are still pushed live; this list only bounds the pull scope.
const CATCH_UP_COLLECTIONS = [
    "orders",
    "bills",
    "sessions",
    "tables",
    "tablesections",
    "devices",
    "users",
    "menuitems",
    "menucategories",
    "menusections",
    "inventoryitems",
    "warehouseitems",
    "notifications",
    "settings",
    "costs",
    "costcategories",
    "payments",
    "payrolls",
    "employees",
    "advances",
    "attendances",
    "deductions",
];

/** Mesh push enabled by default (offline-first). Set LAN_PEER_SYNC_ENABLED=false to disable. */
export function meshSyncEnabled() {
    return process.env.LAN_PEER_SYNC_ENABLED !== "false";
}

function isSafeCollection(name) {
    if (typeof name !== "string" || !name) return false;
    if (name.startsWith("system.")) return false;
    if (name.includes("$") || name.includes("\0")) return false;
    if (name.length > 120) return false;
    return true;
}

function toObjectId(id) {
    if (id instanceof mongoose.Types.ObjectId) return id;
    if (typeof id === "string" && /^[a-f0-9]{24}$/i.test(id)) {
        try {
            return new mongoose.Types.ObjectId(id);
        } catch {
            return id;
        }
    }
    return id;
}

async function markLanOrigin(docId) {
    try {
        const mod = await import("../services/sync/originTracker.js");
        const tracker = mod.default?.getInstance
            ? mod.default.getInstance()
            : global.__originTracker || null;
        if (tracker && docId) tracker.markLanChange(docId);
    } catch {}
}

/**
 * Apply a doc received from a LAN peer into the Local DB.
 * insert/update -> updateOne({ _id }, { $set: doc }, { upsert: true }) with
 * last-write-wins on updatedAt; delete -> deleteOne.
 */
export async function applyReceivedDoc(collectionName, doc, operation) {
    if (!isSafeCollection(collectionName)) throw new Error(`Unsafe collection: ${collectionName}`);
    const db = mongoose.connection?.db;
    if (!db) throw new Error("Local DB not connected");

    const op = operation === "delete" ? "delete" : operation === "insert" ? "insert" : "update";
    const collection = db.collection(collectionName);

    if (op === "delete") {
        const id = toObjectId(doc?._id);
        if (id === undefined || id === null) throw new Error("Delete missing _id");
        await markLanOrigin(id);
        await collection.deleteOne({ _id: id });
        return { applied: "delete" };
    }

    if (!doc || doc._id === undefined || doc._id === null) throw new Error("Doc missing _id");
    const toApply = { ...doc, _id: toObjectId(doc._id) };
    await markLanOrigin(toApply._id);

    // Last-write-wins: skip when local copy is newer.
    try {
        const existing = await collection.findOne({ _id: toApply._id }, { projection: { updatedAt: 1 } });
        if (existing) {
            const existingTime = new Date(existing.updatedAt || 0).getTime();
            const incomingTime = new Date(toApply.updatedAt || 0).getTime();
            if (incomingTime < existingTime) return { applied: "skipped-stale" };
        }
    } catch {}

    const { _id, ...rest } = toApply;
    await collection.updateOne({ _id }, { $set: { _id, ...rest } }, { upsert: true });
    return { applied: op };
}

/**
 * Normalize a sync-middleware operation into a full-doc push payload.
 * Update hooks often carry partial `$set` data; when peers exist we read the
 * full local doc so a peer missing the doc still converges (upsert).
 */
async function normalizeOp(operation) {
    const collection = operation?.collection;
    if (!isSafeCollection(collection)) return null;

    if (operation.type === "delete") {
        const id = operation.filter?._id ?? operation.data?._id;
        if (id === undefined || id === null) return null;
        return { collection, doc: { _id: id }, operation: "delete" };
    }

    let doc = operation.data && typeof operation.data === "object" ? { ...operation.data } : null;
    const id = doc?._id ?? operation.filter?._id;
    if (id === undefined || id === null) return null;

    // Partial update (no updatedAt in payload) -> fetch full doc from Local DB.
    if ((!doc || doc.updatedAt === undefined) && operation.type === "update") {
        try {
            const db = mongoose.connection?.db;
            if (db) {
                const full = await db.collection(collection).findOne({ _id: toObjectId(id) });
                if (full) doc = full;
            }
        } catch {}
    }
    if (!doc) doc = { _id: id, ...(operation.data || {}) };
    if (doc._id === undefined) doc._id = id;
    return { collection, doc, operation: operation.type === "insert" ? "insert" : "update" };
}

async function postJson(url, body, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json().catch(() => ({}));
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Fire-and-forget push of a local write to all discovered peers (<10ms LAN).
 * Returns immediately; delivery happens in the background. Safe to call from
 * mongoose post-hooks: never throws, never blocks the local save.
 */
export function pushLanOp(operation) {
    if (!meshSyncEnabled()) return;
    if (!operation || !operation.collection || !operation.type) return;
    const peers = lanMeshDiscovery.getPeers();
    if (peers.length === 0) return;

    (async () => {
        try {
            const payload = await normalizeOp(operation);
            if (!payload) return;
            await Promise.allSettled(
                peers.map((peer) =>
                    postJson(
                        `http://${peer.ip}:${peer.port}/api/lan/receive`,
                        payload,
                        LAN_PUSH_TIMEOUT_MS
                    ).then(
                        () => Logger.info(`[LanMesh] pushed ${payload.operation}:${payload.collection} -> ${peer.name} (${peer.ip})`),
                        (err) => Logger.warn(`[LanMesh] push to ${peer.ip}:${peer.port} failed: ${err.message}`)
                    )
                )
            );
        } catch (err) {
            Logger.warn(`[LanMesh] push failed: ${err.message}`);
        }
    })().catch(() => {});
}

// High-water marks for incremental catch-up: `${peerId}:${collection}` -> ISO ts
const catchUpMarks = new Map();
let catchUpRunning = false;

async function pullCollectionFromPeer(peer, collection, since) {
    let pulled = 0;
    let cursor = since;
    for (;;) {
        const res = await postJson(
            `http://${peer.ip}:${peer.port}/api/lan/sync-missing`,
            { collection, since: cursor, limit: CATCH_UP_PAGE_SIZE },
            10000
        );
        const docs = Array.isArray(res?.docs) ? res.docs : [];
        for (const doc of docs) {
            try {
                await applyReceivedDoc(collection, doc, "update");
                pulled++;
            } catch (err) {
                Logger.warn(`[LanMesh] catch-up apply ${collection}:${doc?._id} failed: ${err.message}`);
            }
            const ts = doc?.updatedAt || doc?.createdAt;
            if (ts && new Date(ts).getTime() > new Date(cursor || 0).getTime()) {
                cursor = new Date(ts).toISOString();
            }
        }
        if (docs.length < CATCH_UP_PAGE_SIZE) break;
    }
    return { pulled, cursor };
}

/**
 * Pull missing changes from a peer (called when a peer appears/returns).
 * Incremental per peer+collection via in-memory high-water marks; first
 * contact pulls everything (since = epoch) so a returning device converges.
 */
export async function catchUpWithPeer(peer) {
    if (!peer?.ip || !peer?.port) return;
    for (const collection of CATCH_UP_COLLECTIONS) {
        const key = `${peer.deviceId}:${collection}`;
        const since = catchUpMarks.get(key) || new Date(0).toISOString();
        try {
            const { pulled, cursor } = await pullCollectionFromPeer(peer, collection, since);
            if (cursor) catchUpMarks.set(key, cursor);
            if (pulled > 0) Logger.info(`[LanMesh] catch-up ${collection}: +${pulled} from ${peer.name} (${peer.ip})`);
        } catch (err) {
            Logger.warn(`[LanMesh] catch-up ${collection} from ${peer.ip} failed: ${err.message}`);
        }
    }
}

async function catchUpWithAllPeers() {
    if (catchUpRunning) return;
    catchUpRunning = true;
    try {
        for (const peer of lanMeshDiscovery.getPeers()) {
            await catchUpWithPeer(peer);
        }
    } finally {
        catchUpRunning = false;
    }
}

/** Wire auto catch-up: when a peer appears, pull its missing changes. */
export function wirePeerCatchUp() {
    lanMeshDiscovery.removeAllListeners("peer-up-catchup");
    const onPeerUp = (peer) => {
        // Small delay: let the peer finish booting its HTTP server.
        setTimeout(() => catchUpWithPeer(peer).catch(() => {}), 3000);
    };
    lanMeshDiscovery.on("peer-up", onPeerUp);
    // Also catch up with peers already discovered before wiring.
    setTimeout(() => catchUpWithAllPeers().catch(() => {}), 5000);
}

export default {
    meshSyncEnabled,
    pushLanOp,
    applyReceivedDoc,
    catchUpWithPeer,
    wirePeerCatchUp,
};
