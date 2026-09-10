import mongoose from "mongoose";
import crypto from "crypto";
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";

const inviteSchema = new mongoose.Schema(
    {
        token: {
            type: String,
            required: true,
            unique: true,
            index: true,
            default: () => crypto.randomBytes(32).toString("hex"),
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        email: {
            type: String,
            default: null,
            lowercase: true,
            trim: true,
        },
        role: {
            type: String,
            enum: ["staff", "cashier", "kitchen"],
            default: "staff",
        },
        used: {
            type: Boolean,
            default: false,
        },
        usedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        expiresAt: {
            type: Date,
            required: true,
            default: () => {
                const date = new Date();
                date.setDate(date.getDate() + 7);
                return date;
            },
        },
    },
    {
        timestamps: { createdAt: "createdAt", updatedAt: false },
    }
);

inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Soft delete fields - isDeleted, deletedAt, deletedBy
inviteSchema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
});
// Sync (Atlas queue + LAN mesh push) like all other collections.
// NOTE: `token` is 64-hex so the 24-hex normalizer never touches it.
applySyncMiddleware(inviteSchema, 'Invite');
export default mongoose.model("Invite", inviteSchema);
