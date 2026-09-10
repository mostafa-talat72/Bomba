import mongoose from "mongoose";
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";

// Immutable log of important actions (deletes, admin changes, restores, shifts).
// Synced across devices like any other collection.
const auditLogSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
            index: true,
            // e.g. bill.deleted, order.deleted, user.created, user.updated,
            // user.deleted, permissions.changed, backup.restored, shift.opened, shift.closed
        },
        collection: { type: String, default: null },
        documentId: { type: mongoose.Schema.Types.ObjectId, default: null },
        documentNumber: { type: String, default: null }, // billNumber / orderNumber / username for readability
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        userName: { type: String, default: null },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            index: true,
        },
        deviceId: { type: String, default: null }, // instanceId of the acting device
        details: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        suppressReservedKeysWarning: true, // 'collection' field name is intentional
    }
);

auditLogSchema.index({ organization: 1, createdAt: -1 });
auditLogSchema.index({ organization: 1, action: 1, createdAt: -1 });

applySyncMiddleware(auditLogSchema, 'AuditLog');

export default mongoose.model("AuditLog", auditLogSchema);
