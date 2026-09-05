import mongoose from "mongoose";
import Logger from "../middleware/logger.js";

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

// Cache: collectionName -> [{ segments: string[], kind: 'objectId'|'date' }]
const pathCache = new Map();

function isObjectIdString(v) {
    return typeof v === "string" && OBJECT_ID_RE.test(v);
}

function toObjectId(v) {
    try {
        return new mongoose.Types.ObjectId(v);
    } catch {
        return v;
    }
}

function toDate(v) {
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? v : v;
    if (typeof v === "string" || typeof v === "number") {
        if (v === "" || v === null) return v;
        const d = new Date(v);
        if (!Number.isNaN(d.getTime())) return d;
    }
    return v;
}

/**
 * Recursively collect typed leaf paths from a Mongoose schema.
 * segments may contain '$' meaning "each element of the array at this level".
 */
function collectFromSchema(schema, base, out) {
    if (!schema || typeof schema.eachPath !== "function") return;
    schema.eachPath((name, type) => {
        if (!type || name === "__v") return;
        const instance = type.instance;
        const isOid = instance === "ObjectID" || instance === "ObjectId";
        if (isOid) {
            out.push({ segments: [...base, ...name.split(".")], kind: "objectId" });
        } else if (instance === "Date") {
            out.push({ segments: [...base, ...name.split(".")], kind: "date" });
        } else if (instance === "Array") {
            const caster = type.caster;
            if (!caster) return;
            const casterIsOid = caster.instance === "ObjectID" || caster.instance === "ObjectId";
            if (casterIsOid) {
                out.push({ segments: [...base, name, "$"], kind: "objectId" });
            } else if (caster.instance === "Date") {
                out.push({ segments: [...base, name, "$"], kind: "date" });
            } else if (caster.schema) {
                collectFromSchema(caster.schema, [...base, name, "$"], out);
            }
            // Arrays of Mixed/primitives need no conversion
        } else if (type.schema) {
            // Single nested subdocument
            collectFromSchema(type.schema, [...base, ...name.split(".")], out);
        }
        // Mixed / Map / other: intentionally skipped (never guess)
    });
}

function findModelByCollection(collectionName) {
    if (!collectionName) return null;
    try {
        for (const name of mongoose.modelNames()) {
            try {
                const m = mongoose.model(name);
                if (m?.collection?.name === collectionName) return m;
            } catch {}
        }
    } catch {}
    return null;
}

export function getTypedPaths(collectionName) {
    if (pathCache.has(collectionName)) return pathCache.get(collectionName);
    const out = [];
    try {
        const model = findModelByCollection(collectionName);
        if (model?.schema) collectFromSchema(model.schema, [], out);
    } catch (e) {
        Logger.warn(`[bsonRehydrate] cannot collect paths for ${collectionName}: ${e.message}`);
    }
    pathCache.set(collectionName, out);
    return out;
}

function convertLeaf(value, kind) {
    if (value === null || value === undefined) return { changed: false, value };
    if (kind === "objectId") {
        if (typeof value !== "string") return { changed: false, value };
        if (!isObjectIdString(value)) return { changed: false, value };
        return { changed: true, value: toObjectId(value) };
    }
    // date
    if (value instanceof Date) return { changed: false, value };
    if (typeof value !== "string" && typeof value !== "number") return { changed: false, value };
    const d = toDate(value);
    if (d instanceof Date && !Number.isNaN(d.getTime())) {
        return { changed: true, value: d };
    }
    return { changed: false, value };
}

// Apply one typed path to a document, tracking changed dotted paths for $set
function applyPath(root, segments, kind, changedSet, prefix) {
    let node = root;
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (node === null || node === undefined) return;
        if (seg === "$") {
            if (!Array.isArray(node)) return;
            const rest = segments.slice(i + 1);
            if (rest.length === 0) {
                // Array of scalars (e.g. orders: [ObjectId]) — convert each element
                node.forEach((el, idx) => {
                    const r = convertLeaf(el, kind);
                    if (r.changed) {
                        node[idx] = r.value;
                        changedSet.add(`${prefix}[${idx}]`);
                    }
                });
                return;
            }
            node.forEach((el, idx) => {
                applyPath(el, rest, kind, changedSet, `${prefix}[${idx}]`);
            });
            return;
        }
        if (i === segments.length - 1) {
            if (node && typeof node === "object" && seg in node) {
                const r = convertLeaf(node[seg], kind);
                if (r.changed) {
                    node[seg] = r.value;
                    changedSet.add(prefix ? `${prefix}.${seg}` : seg);
                }
            }
            return;
        }
        node = node[seg];
    }
}

/**
 * Convert stringified Dates/ObjectIds back to BSON types, guided strictly by
 * the Mongoose schema of the collection. Unknown paths are never touched.
 * Mutates and returns the passed object. Returns it unchanged if no model found.
 */
export function rehydrateDocument(collectionName, doc) {
    if (!doc || typeof doc !== "object") return doc;
    const paths = getTypedPaths(collectionName);
    if (!paths.length) return doc;
    const changed = new Set();
    for (const { segments, kind } of paths) {
        try {
            applyPath(doc, segments, kind, changed, "");
        } catch {}
    }
    return doc;
}

/** Same as rehydrateDocument but also returns the list of changed dotted paths. */
export function rehydrateDocumentWithChanges(collectionName, doc) {
    if (!doc || typeof doc !== "object") return { doc, changed: [] };
    const paths = getTypedPaths(collectionName);
    if (!paths.length) return { doc, changed: [] };
    const changed = new Set();
    for (const { segments, kind } of paths) {
        try {
            applyPath(doc, segments, kind, changed, "");
        } catch {}
    }
    return { doc, changed: [...changed] };
}

function rehydrateFilterValue(schemaPathKind, value) {
    // Handles direct value, $in arrays
    if (Array.isArray(value)) {
        let changed = false;
        const out = value.map((v) => {
            const r = convertLeaf(v, schemaPathKind);
            if (r.changed) changed = true;
            return r.value;
        });
        return { changed, value: out };
    }
    if (value && typeof value === "object" && !(value instanceof Date)) {
        // Operator object like { $in: [...] } — convert known array operators
        let changed = false;
        const out = { ...value };
        for (const op of ["$in", "$nin"]) {
            if (Array.isArray(out[op])) {
                const r = rehydrateFilterValue(schemaPathKind, out[op]);
                if (r.changed) {
                    changed = true;
                    out[op] = r.value;
                }
            }
        }
        return { changed, value: out };
    }
    return convertLeaf(value, schemaPathKind);
}

/**
 * Rehydrate a Mongo filter object (top-level keys + $or/$and/$nor).
 * Raw-driver filters with string _id would otherwise miss ObjectId docs
 * (and upserts would then create duplicates with string _id).
 */
export function rehydrateFilter(collectionName, filter) {
    if (!filter || typeof filter !== "object") return filter;
    const model = findModelByCollection(collectionName);
    if (!model?.schema) return filter;
    const schema = model.schema;

    const kindOf = (key) => {
        try {
            const t = schema.path(key);
            if (!t) return null;
            if (t.instance === "ObjectID" || t.instance === "ObjectId") return "objectId";
            if (t.instance === "Date") return "date";
        } catch {}
        return null;
    };

    const walk = (obj) => {
        if (!obj || typeof obj !== "object") return;
        for (const key of Object.keys(obj)) {
            if (key === "$or" || key === "$and" || key === "$nor") {
                if (Array.isArray(obj[key])) obj[key].forEach(walk);
                continue;
            }
            if (key.startsWith("$")) continue;
            const kind = kindOf(key);
            if (!kind) {
                // Recurse into nested plain objects (e.g. { nested: { _id: ... } }) — rare, best effort
                if (obj[key] && typeof obj[key] === "object" && !(obj[key] instanceof Date) && !Array.isArray(obj[key])) {
                    const subKeys = Object.keys(obj[key]).filter((k) => !k.startsWith("$"));
                    if (subKeys.length) walk(obj[key]);
                }
                continue;
            }
            const r = rehydrateFilterValue(kind, obj[key]);
            if (r.changed) obj[key] = r.value;
        }
    };
    try {
        walk(filter);
    } catch {}
    return filter;
}

export function clearRehydrateCache() {
    pathCache.clear();
}

export default {
    rehydrateDocument,
    rehydrateDocumentWithChanges,
    rehydrateFilter,
    getTypedPaths,
    clearRehydrateCache,
};
