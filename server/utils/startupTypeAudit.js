import mongoose from "mongoose";
import Logger from "../middleware/logger.js";
import { getTypedPaths, rehydrateDocument } from "./bsonRehydrate.js";

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
                        if (!bsonEqual(o[idx], f[idx])) setOps[`${dotted}.${idx}`] = f[idx];
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
                if (!bsonEqual(ov, fv)) setOps[key] = fv;
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
 * Resolve documents whose _id itself was stored as a string (duplicates the
 * old upsert-with-string-filter bug could create). Strategy per doc:
 *  - non-24-hex string _id → cannot be mapped, logged as skipped.
 *  - no ObjectId twin exists → insert healed copy, delete the string-_id doc.
 *  - twin exists → last-write-wins by updatedAt/createdAt, then delete the loser.
 */
async function auditStringIds(db, collectionName, fix, stats) {
    const collection = db.collection(collectionName);
    let resolved = 0;
    let skipped = 0;
    let ids = [];
    try {
        const cursor = collection
            .find({ _id: { $type: "string" } }, { projection: { _id: 1 } })
            .limit(MAX_IDS_PER_PATH);
        for await (const d of cursor) ids.push(d._id);
    } catch (e) {
        Logger.warn(`[typeAudit] _id scan failed for ${collectionName}: ${e.message}`);
        return { resolved, skipped };
    }
    if (!ids.length) return { resolved, skipped };

    for (const sid of ids) {
        try {
            if (typeof sid !== "string" || !/^[a-f0-9]{24}$/i.test(sid)) {
                skipped++;
                continue;
            }
            const oid = new mongoose.Types.ObjectId(sid);
            const strDoc = await collection.findOne({ _id: sid });
            if (!strDoc) continue;
            const existing = await collection.findOne({ _id: oid });
            rehydrateDocument(collectionName, strDoc);
            strDoc._id = oid;
            if (!fix) {
                resolved++;
                continue;
            }
            if (!existing) {
                await collection.insertOne(strDoc);
                await collection.deleteOne({ _id: sid });
            } else {
                const tNew = new Date(strDoc.updatedAt || strDoc.createdAt || 0).getTime();
                const tOld = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
                if (tNew >= tOld) {
                    const { _id, ...rest } = strDoc;
                    await collection.replaceOne({ _id: oid }, { ...rest, _id: oid });
                }
                await collection.deleteOne({ _id: sid });
            }
            resolved++;
        } catch (e) {
            Logger.warn(`[typeAudit] _id resolve failed ${collectionName}:${sid}: ${e.message}`);
            skipped++;
        }
    }
    if (resolved > 0 || skipped > 0) {
        Logger.info(`🔧 [typeAudit] ${collectionName}: resolved ${resolved} string-_id docs, skipped ${skipped}${fix ? "" : " [dry-run]"}`);
    }
    stats.totalFixedDocs += resolved;
    return { resolved, skipped };
}

export async function auditCollection(db, collectionName, typedPaths, fix, stats) {
    const collection = db.collection(collectionName);
    let passes = 0;
    let fixedDocs = 0;
    let fixedFields = 0;
    let skippedDocs = 0;

    // _id pass first: string _ids can't be $set, resolve (re-insert) them up front
    // so the field passes below only deal with clean ObjectId docs.
    let resolvedIds = 0;
    try {
        ({ resolved: resolvedIds } = await auditStringIds(db, collectionName, fix, stats));
    } catch (e) {
        Logger.warn(`[typeAudit] _id pass failed for ${collectionName}: ${e.message}`);
    }

    while (passes < MAX_PASSES_PER_COLLECTION) {
        passes++;
        // Find docs having a string where schema says Date/ObjectId
        const idSet = new Set();
        for (const { segments } of typedPaths) {
            const qp = queryPath(segments);
            if (!qp) continue;
            try {
                const cursor = collection
                    .find({ [qp]: { $type: "string" } }, { projection: { _id: 1 } })
                    .limit(MAX_IDS_PER_PATH);
                for await (const d of cursor) {
                    idSet.add(String(d._id));
                    if (idSet.size >= MAX_IDS_PER_PATH) break;
                }
            } catch (e) {
                Logger.warn(`[typeAudit] query failed ${collectionName}.${qp}: ${e.message}`);
            }
            if (idSet.size >= MAX_IDS_PER_PATH) break;
        }

        if (idSet.size === 0) break;

        // Load full docs for the affected ids (match by string OR ObjectId form)
        const ids = [...idSet].slice(0, MAX_IDS_PER_PATH);
        const objectIds = [];
        for (const id of ids) {
            try {
                if (/^[a-f0-9]{24}$/i.test(id)) objectIds.push(new mongoose.Types.ObjectId(id));
            } catch {}
        }
        let docs = [];
        try {
            docs = await collection
                .find({ $or: [{ _id: { $in: ids } }, ...(objectIds.length ? [{ _id: { $in: objectIds } }] : [])] })
                .toArray();
        } catch (e) {
            Logger.warn(`[typeAudit] load failed for ${collectionName}: ${e.message}`);
            break;
        }

        const bulk = [];
        for (const doc of docs) {
            const original = doc;
            // Deep clone preserving BSON (structuredClone handles ObjectId/Date in Node 22)
            let working;
            try {
                working = structuredClone(doc);
            } catch {
                working = JSON.parse(JSON.stringify(doc));
            }
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
        if (idSet.size < MAX_IDS_PER_PATH) break;
    }

    stats.collections.push({ collection: collectionName, fixedDocs, fixedFields, skippedDocs, passes, resolvedIds });
    stats.totalFixedDocs += fixedDocs;
    stats.totalFixedFields += fixedFields;
    if (fixedDocs > 0) {
        Logger.info(`🔧 [typeAudit] ${collectionName}: fixed ${fixedDocs} docs (${fixedFields} fields)${fix ? "" : " [dry-run]"}`);
    }
    return { fixedDocs, fixedFields, resolvedIds };
}

/**
 * Scan all registered models for string values stored where the schema
 * declares Date/ObjectId, and convert them back automatically.
 * Uses raw collection ops (bypasses sync middleware — each node heals itself
 * on boot; Atlas is healed via its own pass below).
 */
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
        const names = mongoose.modelNames();
        for (const name of names) {
            let collectionName = null;
            try {
                collectionName = mongoose.model(name).collection.name;
            } catch {
                continue;
            }
            if (!collectionName || collectionName.startsWith("system.")) continue;
            let typedPaths = [];
            try {
                typedPaths = getTypedPaths(collectionName);
            } catch {
                continue;
            }
            if (!typedPaths.length) continue;
            try {
                await auditCollection(db, collectionName, typedPaths, fix, stats);
            } catch (e) {
                Logger.warn(`[typeAudit] failed for ${collectionName}: ${e.message}`);
            }
        }

        // Heal Atlas with its own pass (same schemas, raw driver handle)
        try {
            const { default: dualDatabaseManager } = await import("../config/dualDatabaseManager.js");
            const atlasDb = dualDatabaseManager.getAtlasConnection?.();
            if (atlasDb && typeof atlasDb.collection === "function") {
                Logger.info("🔍 [typeAudit] starting BSON type audit (atlas)...");
                for (const name of names) {
                    let collectionName = null;
                    try {
                        collectionName = mongoose.model(name).collection.name;
                    } catch {
                        continue;
                    }
                    if (!collectionName || collectionName.startsWith("system.")) continue;
                    const typedPaths = getTypedPaths(collectionName);
                    if (!typedPaths.length) continue;
                    try {
                        await auditCollection(atlasDb, collectionName, typedPaths, fix, stats);
                    } catch (e) {
                        Logger.warn(`[typeAudit] atlas failed for ${collectionName}: ${e.message}`);
                    }
                }
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
