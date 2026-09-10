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
    "bonuses",
    "deliveryzones",
    "tombstones",
    "invites",
    "auditlogs",
    "shifts",
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

const HEX24 = /^[a-f0-9]{24}$/i;

function toObjectId(id) {
    if (id instanceof mongoose.Types.ObjectId) return id;
    if (typeof id === "string" && HEX24.test(id)) {
        try {
            return new mongoose.Types.ObjectId(id);
        } catch {
            return id;
        }
    }
    return id;
}

function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof mongoose.Types.ObjectId) && !(v instanceof Date) && !Buffer.isBuffer(v);
}

// EJSON wrapper { $oid: "hex..." } -> ObjectId (unambiguous, always safe).
function unwrapOid(value) {
    if (isPlainObject(value) && typeof value.$oid === "string" && HEX24.test(value.$oid)) {
        try {
            return new mongoose.Types.ObjectId(value.$oid);
        } catch {
            return value;
        }
    }
    return value;
}

/**
 * Single-ObjectId reference fields per collection.
 * NOTE: string-typed fields (InventoryItem.category, Notification.category,
 * Settings.category, Cost.subcategory, Device.number, Bonus.month, ...) are
 * deliberately NOT listed — and conversion additionally requires an exact
 * 24-hex value, so names/prices/notes can never be corrupted.
 */
const SINGLE_REFS = {
    bills: ["organization", "table", "createdBy", "updatedBy", "deletedBy"],
    orders: ["organization", "table", "bill", "createdBy", "preparedBy", "deliveredBy", "updatedBy"],
    sessions: ["organization", "deviceId", "table", "bill", "createdBy", "updatedBy"],
    tables: ["organization", "section"],
    tablesections: ["organization"],
    devices: ["organization"],
    users: ["organization"],
    menuitems: ["organization", "category", "section"],
    menucategories: ["organization", "section"],
    menusections: ["organization"],
    inventoryitems: ["organization"],
    warehouseitems: ["organization"],
    notifications: ["organization"],
    settings: ["organization", "updatedBy"],
    costs: ["organization", "category", "createdBy"],
    costcategories: ["organization"],
    payments: ["organizationId", "employeeId", "paidBy", "recordedBy", "createdBy"],
    payrolls: ["organizationId", "employeeId", "createdBy", "approvedBy", "paidBy"],
    employees: ["organizationId", "userId"],
    advances: ["organizationId", "employeeId", "approvedBy", "createdBy"],
    attendances: ["organizationId", "employeeId", "createdBy"],
    bonuses: ["organizationId", "employeeId", "approvedBy", "createdBy"],
    deductions: ["organizationId", "employeeId", "approvedBy", "createdBy"],
    deliveryzones: ["organization", "createdBy"],
    invites: ["organization", "createdBy", "usedBy"],
    auditlogs: ["organization", "user", "documentId"],
    shifts: ["organization", "openedBy", "closedBy"],
    tombstones: ["organization", "createdBy", "documentId"],
};

/** Array-of-ObjectId fields per collection. */
const ARRAY_REFS = {
    bills: ["orders", "sessions"],
    notifications: ["targetUsers"],
};

/** Nested subdocument arrays: { arrayField: { single: [...], subArrays: { nestedArray: [...] } } } */
const NESTED_REFS = {
    orders: {
        items: { single: ["menuItem", "category", "section"] },
    },
    bills: {
        itemPayments: { single: ["orderId"], subArrays: { paymentHistory: ["paidBy"] } },
        sessionPayments: { single: ["sessionId"], subArrays: { payments: ["paidBy"] } },
        payments: { single: ["paidBy"] },
    },
    notifications: {
        readBy: { single: ["user"] },
    },
    payrolls: {
        advances: { single: ["approvedBy"] },
        deductions: { single: ["approvedBy"] },
        bonuses: { single: ["approvedBy"] },
        payments: { single: ["paidBy"] },
    },
};

function convertRefField(obj, field) {
    const v = obj[field];
    if (v === undefined || v === null) return;
    const unwrapped = unwrapOid(v);
    if (unwrapped !== v) {
        obj[field] = unwrapped;
        return;
    }
    if (typeof v === "string" && HEX24.test(v)) {
        obj[field] = toObjectId(v);
    }
    // Embedded populated objects are kept as-is (their _id is fixed by recursion).
}

function normalizeSubArray(elements, singleFields) {
    if (!Array.isArray(elements)) return elements;
    return elements.map((el) => {
        if (!isPlainObject(el)) return el;
        const copy = { ...el };
        for (const f of singleFields) convertRefField(copy, f);
        return copy;
    });
}

/**
 * Deep-normalize a doc received over JSON (LAN push / catch-up) for ONE
 * collection: restores ObjectIds lost in JSON serialization.
 * - `_id` always converted (24-hex string or {$oid}).
 * - Known single/array reference fields converted (exact 24-hex only).
 * - Any `{$oid}` wrapper anywhere in known positions converted (explicitly typed).
 * - Unknown fields are NEVER touched — plain strings stay strings.
 */
export function normalizeIncomingDoc(collectionName, doc) {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return doc;
    const out = { ...doc };

    if (out._id !== undefined) {
        const unwrapped = unwrapOid(out._id);
        out._id = unwrapped !== out._id ? unwrapped : toObjectId(out._id);
    }

    const singles = SINGLE_REFS[collectionName];
    if (singles) {
        for (const f of singles) {
            if (out[f] === undefined || out[f] === null) continue;
            if (isPlainObject(out[f]) && out[f].$oid === undefined) {
                out[f] = normalizeIncomingDoc(collectionName, out[f]); // populated object: recurse, keep shape
            } else {
                convertRefField(out, f);
            }
        }
    }

    const arrays = ARRAY_REFS[collectionName];
    if (arrays) {
        for (const f of arrays) {
            if (!Array.isArray(out[f])) continue;
            out[f] = out[f].map((el) => {
                if (el === null || el === undefined) return el;
                const unwrapped = unwrapOid(el);
                if (unwrapped !== el) return unwrapped;
                if (typeof el === "string") return toObjectId(el);
                if (isPlainObject(el)) return normalizeIncomingDoc(collectionName, el);
                return el;
            });
        }
    }

    const nested = NESTED_REFS[collectionName];
    if (nested) {
        for (const [arrField, rule] of Object.entries(nested)) {
            if (!Array.isArray(out[arrField])) continue;
            out[arrField] = out[arrField].map((el) => {
                if (!isPlainObject(el)) return el;
                const copy = { ...el };
                for (const f of rule.single || []) convertRefField(copy, f);
                if (rule.subArrays) {
                    for (const [subField, subSingles] of Object.entries(rule.subArrays)) {
                        if (Array.isArray(copy[subField])) {
                            copy[subField] = normalizeSubArray(copy[subField], subSingles);
                        }
                    }
                }
                return copy;
            });
        }
    }

    return out;
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
        return { applied: "delete", doc: { _id: id } };
    }

    if (!doc || doc._id === undefined || doc._id === null) throw new Error("Doc missing _id");
    // Restore ObjectIds lost in JSON serialization (all tables) BEFORE apply,
    // so refs never land as strings in the local DB.
    const toApply = normalizeIncomingDoc(collectionName, { ...doc, _id: toObjectId(doc._id) });
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
    return { applied: op, doc: toApply };
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
    normalizeIncomingDoc,
    catchUpWithPeer,
    wirePeerCatchUp,
};
