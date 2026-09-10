import mongoose from "mongoose";

// Max serialized size for the `changes` payload (~4KB).
const MAX_CHANGES_JSON = 4096;

// Lazy model lookup: the AuditLog model may not be registered yet when a
// plugin hook fires (audit routes are mounted independently), so resolve it
// at call time instead of a top-level import (also avoids any import cycle).
async function getAuditLogModel() {
    try {
        if (mongoose.models.AuditLog) return mongoose.models.AuditLog;
        const mod = await import("../models/AuditLog.js");
        return mod.default || mongoose.models.AuditLog || null;
    } catch {
        return null;
    }
}

function toObjectIdOrNull(value) {
    try {
        const id = value?._id ?? value;
        if (id == null || id === "") return null;
        if (id instanceof mongoose.Types.ObjectId) return id;
        const str = String(id);
        return mongoose.isValidObjectId(str) ? new mongoose.Types.ObjectId(str) : null;
    } catch {
        return null;
    }
}

function toNullableString(value) {
    try {
        if (value == null || value === "") return null;
        return String(value);
    } catch {
        return null;
    }
}

// Strip large arrays / deep nesting / long strings so entries stay small.
function sanitizeChanges(value, depth = 0) {
    if (value == null) return value;
    if (depth > 4) return "[truncated]";
    if (value instanceof Date) return value;
    try {
        if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return "[binary]";
    } catch {}
    if (Array.isArray(value)) {
        if (value.length > 10) {
            return {
                _arrayLength: value.length,
                _preview: value.slice(0, 5).map((item) => sanitizeChanges(item, depth + 1)),
            };
        }
        return value.map((item) => sanitizeChanges(item, depth + 1));
    }
    if (typeof value === "object") {
        // Mongoose subdocument / populated ref — keep only plain data.
        const plain =
            typeof value.toObject === "function" ? value.toObject({ depopulate: true }) : value;
        if (plain == null || typeof plain !== "object") return plain;
        const out = {};
        for (const key of Object.keys(plain).slice(0, 50)) {
            try {
                out[key] = sanitizeChanges(plain[key], depth + 1);
            } catch {}
        }
        return out;
    }
    if (typeof value === "string" && value.length > 500) {
        return `${value.slice(0, 500)}…[truncated]`;
    }
    return value;
}

function capChanges(changes) {
    try {
        if (changes == null) return null;
        const clean = sanitizeChanges(changes, 0);
        let json = null;
        try {
            json = JSON.stringify(clean);
        } catch {
            return null;
        }
        if (json && json.length > MAX_CHANGES_JSON) {
            return { _truncated: true, preview: json.slice(0, MAX_CHANGES_JSON - 64) };
        }
        return clean;
    } catch {
        return null;
    }
}

/**
 * Fire-and-forget audit writer. NEVER throws — all failures are swallowed
 * so auditing can never break the operation being audited.
 */
export async function auditLog({
    action,
    collection,
    documentId,
    documentLabel,
    organization,
    user,
    userName,
    deviceId,
    instanceId,
    changes,
}) {
    try {
        if (!action || !collection || organization == null || organization === "") return null;
        const AuditLog = await getAuditLogModel();
        if (!AuditLog) return null;
        const entry = new AuditLog({
            action: String(action),
            collection: String(collection),
            documentId: toObjectIdOrNull(documentId),
            documentLabel: toNullableString(documentLabel),
            organization: toObjectIdOrNull(organization) ?? organization,
            user: toObjectIdOrNull(user),
            userName: toNullableString(userName),
            deviceId: toNullableString(deviceId),
            instanceId: toNullableString(instanceId),
            changes: capChanges(changes),
        });
        await entry.save();
        return entry;
    } catch {
        return null;
    }
}

function documentLabelOf(doc) {
    try {
        if (!doc) return null;
        const label =
            doc.billNumber ??
            doc.orderNumber ??
            doc.sessionNumber ??
            doc.name ??
            doc.number ??
            doc.username ??
            doc.email ??
            null;
        return label != null ? String(label) : null;
    } catch {
        return null;
    }
}

// Req-less context: hooks only see the document, so identity comes from
// its own fields. deviceId/instanceId are unknown here → null (controllers
// with access to req.headers['x-instance-id'] can pass them explicitly).
function contextOf(doc) {
    try {
        if (!doc) return { organization: null, user: null };
        return {
            organization: doc.organization ?? doc.organizationId ?? null,
            user: doc.updatedBy ?? doc.createdBy ?? null,
        };
    } catch {
        return { organization: null, user: null };
    }
}

function fireAndForget(payload) {
    try {
        auditLog(payload).catch(() => {});
    } catch {}
}

/**
 * Mongoose plugin: auto-audit create/update/delete.
 * Usage (at the end of a model file, next to applySyncMiddleware):
 *   auditPlugin(billSchema, 'bills');
 * All hooks are non-blocking and can never break saves.
 */
export function auditPlugin(schema, collectionName) {
    if (!schema || !collectionName) return;

    // Remember insert-vs-update before save (post('save') sees isNew === false).
    try {
        schema.pre("save", function (next) {
            try {
                this.$__auditWasNew = this.isNew === true;
            } catch {}
            next();
        });
    } catch {}

    schema.post("save", function (doc) {
        try {
            if (!doc) return;
            const ctx = contextOf(doc);
            fireAndForget({
                action: doc.$__auditWasNew ? "create" : "update",
                collection: collectionName,
                documentId: doc._id ?? null,
                documentLabel: documentLabelOf(doc),
                organization: ctx.organization,
                user: ctx.user,
                userName: null,
                deviceId: null,
                instanceId: null,
                changes: null,
            });
        } catch {}
    });

    schema.post("findOneAndUpdate", function (doc) {
        try {
            if (!doc) return;
            const ctx = contextOf(doc);
            fireAndForget({
                action: "update",
                collection: collectionName,
                documentId: doc._id ?? null,
                documentLabel: documentLabelOf(doc),
                organization: ctx.organization,
                user: ctx.user,
                userName: null,
                deviceId: null,
                instanceId: null,
                changes: null,
            });
        } catch {}
    });

    schema.post("findOneAndDelete", function (doc) {
        try {
            if (!doc) return;
            const ctx = contextOf(doc);
            fireAndForget({
                action: "delete",
                collection: collectionName,
                documentId: doc._id ?? null,
                documentLabel: documentLabelOf(doc),
                organization: ctx.organization,
                user: ctx.user,
                userName: null,
                deviceId: null,
                instanceId: null,
                changes: null,
            });
        } catch {}
    });
}
