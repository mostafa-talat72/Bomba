import { getTypedPaths } from "./bsonRehydrate.js";

/**
 * syncSanitize — depopulate documents before any sync write.
 *
 * Root cause it fixes: controllers often call `bill.populate("orders")` (or
 * sessions/table/...) and then pass `bill.toObject()` to `writeToAtlas` or the
 * sync middleware. Without this step the populated SUB-OBJECTS overwrite the
 * ObjectId arrays in Atlas (orders becomes Array-of-objects instead of
 * Array-of-ObjectIds), and polling/fullSync then spread the corruption to
 * every device.
 *
 * Strategy: reuse the schema-derived ObjectId paths from bsonRehydrate
 * (covers every table + nested subdocuments, no hand-maintained lists).
 * Any plain object found on an ObjectId path is collapsed to its `_id`.
 * Scalars, strings (incl. legacy string-stored ids), null and unknown paths
 * are NEVER touched. Idempotent — safe to run multiple times.
 */

function isPlainObject(v) {
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    if (v instanceof Date) return false;
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(v)) return false;
    // BSON scalars (ObjectId, Binary, Decimal128, Long, ...) — not plain objects.
    if (v._bsontype) return false;
    return true;
}

/**
 * Collapse one value found on an ObjectId path:
 * populated doc -> its _id (recursively, max 3 levels for double-populate),
 * {$oid} wrapper -> the hex string (rehydrate casts it afterwards),
 * anything else (incl. objects WITHOUT _id) -> returned UNCHANGED
 * (we never destroy data we don't understand).
 */
function collapseValue(value) {
    let v = value;
    for (let i = 0; i < 3; i++) {
        if (!isPlainObject(v)) return v;
        if (v.$oid !== undefined) return v.$oid;
        if (v._id === undefined) return value;
        v = v._id;
    }
    return v;
}

function applyDepopulate(root, segments) {
    let node = root;
    for (let i = 0; i < segments.length; i++) {
        if (node === null || node === undefined) return;
        const seg = segments[i];
        if (seg === "$") {
            if (!Array.isArray(node)) return;
            const rest = segments.slice(i + 1);
            if (rest.length === 0) {
                for (let idx = 0; idx < node.length; idx++) {
                    node[idx] = collapseValue(node[idx]);
                }
                return;
            }
            for (const el of node) applyDepopulate(el, rest);
            return;
        }
        if (i === segments.length - 1) {
            if (node && typeof node === "object" && seg in node) {
                node[seg] = collapseValue(node[seg]);
            }
            return;
        }
        node = node[seg];
    }
}

/**
 * Collapse every populated object on ObjectId schema paths back to its _id.
 * Mutates and returns the passed object (pass a copy if you must keep the
 * original). Returns input unchanged when no model/paths are found.
 *
 * IMPORTANT: run BEFORE bsonRehydrate — collapse first (object -> _id, which
 * may be a 24-hex string), then rehydrate casts strings back to ObjectId.
 */
export function depopulateDocForSync(collectionName, doc) {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return doc;
    // Live Mongoose document passed by mistake? Work on a plain copy.
    if (doc.$__ && typeof doc.toObject === "function") {
        try {
            doc = doc.toObject();
        } catch {
            return doc;
        }
    }
    let paths = [];
    try {
        paths = getTypedPaths(collectionName).filter((p) => p.kind === "objectId");
    } catch {
        return doc;
    }
    if (!paths.length) return doc;
    for (const p of paths) {
        try {
            applyDepopulate(doc, p.segments);
        } catch {}
    }
    return doc;
}

export default { depopulateDocForSync, depopulateSyncPayload };

/**
 * Payload-aware wrapper: handles update-operator wrappers ({ $set: {...} }),
 * arrays, and plain docs. Use this for queue/Atlas payloads whose shape
 * (full doc vs $set content) is not known upfront.
 */
export function depopulateSyncPayload(collectionName, data) {
    if (!data || typeof data !== "object") return data;
    if (Array.isArray(data)) {
        return data.map((d) => depopulateSyncPayload(collectionName, d));
    }
    const keys = Object.keys(data);
    // MongoDB documents can never contain $ keys — so all-$ keys means
    // an update-operator object: sanitize each operator's value object.
    if (keys.length > 0 && keys.every((k) => k.startsWith("$"))) {
        const out = { ...data };
        for (const k of keys) {
            const v = data[k];
            out[k] =
                v && typeof v === "object" && !Array.isArray(v)
                    ? depopulateDocForSync(collectionName, { ...v })
                    : v;
        }
        return out;
    }
    return depopulateDocForSync(collectionName, data);
}
