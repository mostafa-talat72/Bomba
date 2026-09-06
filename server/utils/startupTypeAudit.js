import mongoose from "mongoose";
import { EJSON } from "bson";
import Logger from "../middleware/logger.js";
import { getTypedPaths, rehydrateDocument } from "./bsonRehydrate.js";

// Deep clone that preserves BSON types (ObjectId/Date/Binary)
function bsonClone(doc) {
    return EJSON.parse(EJSON.stringify(doc));
}

const MAX_IDS_PER_PATH = 2000;
const MAX_PASSES_PER_COLLECTION = 5;
const BULK_BATCH = 500;

function bsonEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    // ObjectId vs ObjectId / string
    if (a?._bsontype === "ObjectId" || b?._bsontype === "ObjectId") {
        try {
            return String(a) === String(b);
        } catch {
            return false;
        }
    }
    if (a instanceof Date || b instanceof Date) {
        const at = a instanceof Date ? a.getTime() : new Date(a).getTime();
        const bt = b instanceof Date ? b.getTime() : new Date(b).getTime();
        if (Number.isNaN(at) || Number.isNaN(bt)) return false;
        return at === bt;
    }
    if (typeof a !== typeof b) return false;
    if (typeof a === "object") {
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch {
            return false;
        }
    }
    return a === b;
}

// Dotted mongo path for queries ($ markers removed): items.$.menuItem -> items.menuItem
function queryPath(segments) {
    return segments.filter((s) => s !== "$").join(".");
}

// Strict BSON equality for the audit: a type mismatch IS a change even when
// the string forms match (ObjectId("abc") vs "abc" must still be rewritten).
// (The lenient bsonEqual would wrongly skip exactly the fixes we need.)
function bsonStrictEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    const aOid = a?._bsontype === "ObjectId";
    const bOid = b?._bsontype === "ObjectId";
    if (aOid || bOid) return !!(aOid && bOid && String(a) === String(b));
    const aDate = a instanceof Date;
    const bDate = b instanceof Date;
    if (aDate || bDate) {
        if (!(aDate && bDate)) return false;
        const at = a.getTime();
        const bt = b.getTime();
        return !Number.isNaN(at) && at === bt;
    }
    if (typeof a !== typeof b) return false;
    if (typeof a === "object") {
        try {
            return EJSON.stringify(a) === EJSON.stringify(b);
        } catch {
            return false;
        }
    }
    return a === b;
}

// Walk typed paths with numeric indices, collecting $set ops for changed leaves.
// NOTE: _id is deliberately excluded — MongoDB forbids $set on the immutable
// _id field. String _ids are resolved by auditStringIds() (delete + re-insert).
function diffTypedPaths(original, fixed, typedPaths) {
    const setOps = {};
    const walk = (origNode, fixedNode, segments, dotted) => {
        let o = origNode;
        let f = fixedNode;
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            if (seg === "$") {
                if (!Array.isArray(o) || !Array.isArray(f)) return;
                const rest = segments.slice(i + 1);
                const n = Math.min(o.length, f.length);
                for (let idx = 0; idx < n; idx++) {
                    if (rest.length === 0) {
                        // Scalar array element (e.g. orders.0)
                        if (!bsonStrictEqual(o[idx], f[idx])) setOps[`${dotted}.${idx}`] = f[idx];
                    } else {
                        walk(o[idx], f[idx], rest, `${dotted}.${idx}`);
                    }
                }
                return;
            }
            if (i === segments.length - 1) {
                const key = dotted ? `${dotted}.${seg}` : seg;
                const ov = o?.[seg];
                const fv = f?.[seg];
                if (!bsonStrictEqual(ov, fv)) setOps[key] = fv;
                return;
            }
            o = o?.[seg];
            f = f?.[seg];
            dotted = dotted ? `${dotted}.${seg}` : seg;
            if (o === null || o === undefined || f === null || f === undefined) {
                // Deeper levels unreachable on one side — still check remaining leaves
                // by continuing with undefined (leaf compare will no-op unless changed)
            }
        }
    };
    for (const { segments } of typedPaths) {
        try {
            if (segments.length === 1 && segments[0] === "_id") continue;
            walk(original, fixed, segments, "");
        } catch {}
    }
    return setOps;
}

/**
 * Resolve documents whose _id itself was stored as a string or mangled Binary
 * (duplicates the old upsert-with-string-filter bug could create). Strategy:
 *  - unmappable _id (non-24-hex string, non-12-byte Binary) → skipped, logged.
 *  - no ObjectId twin exists → insert healed copy, delete the bad-_id doc.
 *  - twin exists → last-write-wins by updatedAt/createdAt, then delete the loser.
 */
async function auditStringIds(db, collectionName, fix, stats, scope = null) {
    const collection = db.collection(collectionName);
    const statusScope = Array.isArray(scope?.statuses) && scope.statuses.length ? scope.statuses : null;
    let resolved = 0;
    let skipped = 0;
    // targets: { lookup (exact _id value as stored), hex (mapped ObjectId hex or null) }
    const targets = [];
    const seen = new Set();
    try {
        const idScan = { $or: [{ _id: { $type: "string" } }, { _id: { $type: "binData" } }] };
        const cursor = collection
            .find(statusScope ? { $and: [idScan, { status: { $in: statusScope } }] } : idScan, { projection: { _id: 1 } })
            .limit(MAX_IDS_PER_PATH);
        for await (const d of cursor) {
            const key = EJSON.stringify(d._id);
            if (seen.has(key)) continue;
            seen.add(key);
            targets.push(d._id);
        }
    } catch (e) {
        Logger.warn(`[typeAudit] _id scan failed for ${collectionName}: ${e.message}`);
        return { resolved, skipped };
    }
    if (!targets.length) return { resolved, skipped };

    for (const storedId of targets) {
        try {
            let oid = null;
            if (typeof storedId === "string" && /^[a-f0-9]{24}$/i.test(storedId)) {
                oid = new mongoose.Types.ObjectId(storedId);
            } else if (storedId && typeof storedId === "object") {
                // Mangled Binary holding 12 bytes — rehydrateDocument maps it below;
                // derive the ObjectId here for twin lookup.
                try {
                    const buf = storedId.buffer;
                    const bytes = buf ? Buffer.from(buf.buffer || buf, buf.byteOffset || 0, buf.byteLength ?? buf.length ?? 0) : null;
                    if ((storedId._bsontype === "Binary" || storedId._bsontype === "BinData") &&
                        (storedId.sub_type === 0 || storedId.subType === 0) && bytes && bytes.length === 12) {
                        oid = new mongoose.Types.ObjectId(bytes);
                    }
                } catch {}
            }
            if (!oid) {
                skipped++;
                continue;
            }
            const strDoc = await collection.findOne({ _id: storedId });
            if (!strDoc) continue;
            // Priority scope (e.g. bills draft/partial first): leave other docs for the full pass.
            if (statusScope && !statusScope.includes(strDoc.status)) continue;
            const existing = await collection.findOne({ _id: oid });
            rehydrateDocument(collectionName, strDoc);
            strDoc._id = oid;
            if (!fix) {
                resolved++;
                continue;
            }
            if (!existing) {
                await collection.insertOne(strDoc);
                await collection.deleteOne({ _id: storedId });
            } else {
                const tNew = new Date(strDoc.updatedAt || strDoc.createdAt || 0).getTime();
                const tOld = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
                if (tNew >= tOld) {
                    const { _id, ...rest } = strDoc;
                    await collection.replaceOne({ _id: oid }, { ...rest, _id: oid });
                }
                await collection.deleteOne({ _id: storedId });
            }
            resolved++;
        } catch (e) {
            Logger.warn(`[typeAudit] _id resolve failed ${collectionName}:${EJSON.stringify(storedId)}: ${e.message}`);
            skipped++;
        }
    }
    if (resolved > 0 || skipped > 0) {
        Logger.info(`🔧 [typeAudit] ${collectionName}: resolved ${resolved} bad-_id docs, skipped ${skipped}${fix ? "" : " [dry-run]"}`);
    }
    stats.totalFixedDocs += resolved;
    return { resolved, skipped };
}

export async function auditCollection(db, collectionName, typedPaths, fix, stats, scope = null) {
    const collection = db.collection(collectionName);
    let passes = 0;
    let fixedDocs = 0;
    let fixedFields = 0;
    let skippedDocs = 0;
    const samples = [];
    // Optional scope speeds priority phases, e.g. bills with status draft/partial first.
    const statusScope = Array.isArray(scope?.statuses) && scope.statuses.length ? scope.statuses : null;
    const phase = scope?.phase || "all";

    // _id pass first: string _ids can't be $set, resolve (re-insert) them up front
    // so the field passes below only deal with clean ObjectId docs.
    let resolvedIds = 0;
    try {
        ({ resolved: resolvedIds } = await auditStringIds(db, collectionName, fix, stats, scope));
    } catch (e) {
        Logger.warn(`[typeAudit] _id pass failed for ${collectionName}: ${e.message}`);
    }

    while (passes < MAX_PASSES_PER_COLLECTION) {
        passes++;
        // Find docs having a string (or mangled Binary) where schema says Date/ObjectId.
        // Raw _ids are kept with their BSON type so Binary-_id docs load exactly.
        const seenKeys = new Set();
        const rawIds = [];
        const rememberId = (raw) => {
            const key = EJSON.stringify(raw);
            if (seenKeys.has(key)) return;
            seenKeys.add(key);
            rawIds.push(raw);
        };
        for (const { segments, kind } of typedPaths) {
            const qp = queryPath(segments);
            if (!qp) continue;
            const typeQueries = [{ [qp]: { $type: "string" } }];
            if (kind === "objectId") typeQueries.push({ [qp]: { $type: "binData" } });
            for (const rawTq of typeQueries) {
                const tq = statusScope ? { $and: [rawTq, { status: { $in: statusScope } }] } : rawTq;
                try {
                    const cursor = collection.find(tq, { projection: { _id: 1 } }).limit(MAX_IDS_PER_PATH);
                    for await (const d of cursor) {
                        rememberId(d._id);
                        if (rawIds.length >= MAX_IDS_PER_PATH) break;
                    }
                } catch (e) {
                    Logger.warn(`[typeAudit] query failed ${collectionName}.${qp}: ${e.message}`);
                }
                if (rawIds.length >= MAX_IDS_PER_PATH) break;
            }
            if (rawIds.length >= MAX_IDS_PER_PATH) break;
        }

        if (rawIds.length === 0) break;

        let docs = [];
        try {
            const idFilter = { _id: { $in: rawIds.slice(0, MAX_IDS_PER_PATH) } };
            docs = await collection.find(statusScope ? { $and: [idFilter, { status: { $in: statusScope } }] } : idFilter).toArray();
        } catch (e) {
            Logger.warn(`[typeAudit] load failed for ${collectionName}: ${e.message}`);
            break;
        }

        const bulk = [];
        for (const doc of docs) {
            const original = doc;
            const working = bsonClone(doc);
            rehydrateDocument(collectionName, working);
            const setOps = diffTypedPaths(original, working, typedPaths);
            const keys = Object.keys(setOps);
            if (keys.length === 0) {
                skippedDocs++;
                continue;
            }
            if (fix) {
                bulk.push({ updateOne: { filter: { _id: doc._id }, update: { $set: setOps } } });
            }
            // Audit trail: which doc + which FIELDS (names only, never values).
            // Values are provably preserved (same instant/id/number, only BSON type changes).
            if (samples.length < 10) {
                let idText = "";
                try {
                    idText = String(doc._id?._bsontype === "ObjectId" ? doc._id : doc._id);
                } catch {
                    idText = "?";
                }
                samples.push(`${idText} [${keys.join(", ")}]`);
            }
            fixedDocs++;
            fixedFields += keys.length;
        }

        if (fix && bulk.length) {
            for (let i = 0; i < bulk.length; i += BULK_BATCH) {
                try {
                    await collection.bulkWrite(bulk.slice(i, i + BULK_BATCH), { ordered: false });
                } catch (e) {
                    Logger.warn(`[typeAudit] bulkWrite failed for ${collectionName}: ${e.message}`);
                }
            }
        }

        // If we hit the id cap there may be more — loop for another pass
        if (rawIds.length < MAX_IDS_PER_PATH) break;
    }

    stats.collections.push({ collection: collectionName, phase, fixedDocs, fixedFields, skippedDocs, passes, resolvedIds });
    stats.totalFixedDocs += fixedDocs;
    stats.totalFixedFields += fixedFields;
    if (fixedDocs > 0) {
        Logger.info(`🔧 [typeAudit] ${collectionName}: fixed ${fixedDocs} docs (${fixedFields} fields)${fix ? "" : " [dry-run]"}`);
        if (samples.length) {
            Logger.info(`   ↳ sample: ${samples.join(" | ")}${fixedDocs > samples.length ? ` (+${fixedDocs - samples.length} more)` : ""}`);
        }
    }
    return { fixedDocs, fixedFields, resolvedIds };
}

/**
 * Scan all registered models for string values stored where the schema
 * declares Date/ObjectId, and convert them back automatically.
 * Uses raw collection ops (bypasses sync middleware — each node heals itself
 * on boot; Atlas is healed via its own pass below).
 */
// Priority order: all bills first (any status), then orders,
// then sessions, then everything else.
const PRIORITY_COLLECTIONS = ["bills", "orders", "sessions"];

function orderedCollectionNames() {
    const seen = new Set();
    const ordered = [];
    for (const name of mongoose.modelNames()) {
        let cn = null;
        try {
            cn = mongoose.model(name).collection.name;
        } catch {
            continue;
        }
        if (!cn || cn.startsWith("system.") || seen.has(cn)) continue;
        seen.add(cn);
        ordered.push(cn);
    }
    ordered.sort((a, b) => {
        const ia = PRIORITY_COLLECTIONS.indexOf(a);
        const ib = PRIORITY_COLLECTIONS.indexOf(b);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        return a.localeCompare(b);
    });
    return ordered;
}

async function auditDatabase(db, fix, stats, tag) {
    for (const collectionName of orderedCollectionNames()) {
        let typedPaths = [];
        try {
            typedPaths = getTypedPaths(collectionName);
        } catch {
            continue;
        }
        if (!typedPaths.length) continue;
        try {
            // Priority order is bills (all statuses) -> orders -> sessions -> rest.
            await auditCollection(db, collectionName, typedPaths, fix, stats);
        } catch (e) {
            Logger.warn(`[typeAudit] ${tag} failed for ${collectionName}: ${e.message}`);
        }
    }
}

export async function runStartupTypeAudit({ fix = true, label = "local" } = {}) {
    const stats = { collections: [], totalFixedDocs: 0, totalFixedFields: 0, label };
    try {
        if (process.env.SKIP_TYPE_AUDIT === "true") {
            Logger.info("⏭️ [typeAudit] skipped via SKIP_TYPE_AUDIT=true");
            return stats;
        }
        if (process.env.TYPE_AUDIT_FIX === "false") fix = false;

        const db = mongoose.connection?.db;
        if (!db) {
            Logger.warn("[typeAudit] local DB not connected, skipping");
            return stats;
        }

        Logger.info(`🔍 [typeAudit] starting BSON type audit (${label}, fix=${fix})...`);
        await auditDatabase(db, fix, stats, label);

        // Heal Atlas with its own pass (same schemas, raw driver handle)
        try {
            const { default: dualDatabaseManager } = await import("../config/dualDatabaseManager.js");
            const atlasDb = dualDatabaseManager.getAtlasConnection?.();
            if (atlasDb && typeof atlasDb.collection === "function") {
                Logger.info("🔍 [typeAudit] starting BSON type audit (atlas)...");
                await auditDatabase(atlasDb, fix, stats, "atlas");
            }
        } catch (e) {
            Logger.warn(`[typeAudit] atlas pass skipped: ${e.message}`);
        }

        if (stats.totalFixedDocs > 0) {
            Logger.info(`✅ [typeAudit] done: fixed ${stats.totalFixedDocs} docs (${stats.totalFixedFields} fields)${fix ? "" : " [dry-run]"}`);
        } else {
            Logger.info("✅ [typeAudit] done: all databases OK — no type mismatches found");
        }
    } catch (e) {
        Logger.error(`❌ [typeAudit] audit failed: ${e.message}`);
    }
    return stats;
}

export default { runStartupTypeAudit };
