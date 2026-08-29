import mongoose from "mongoose";
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";

const settingsSchema = new mongoose.Schema(
    {
        category: {
            type: String,
            required: true,
        },
        settings: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Create compound index for category and organization
settingsSchema.index({ category: 1, organization: 1 }, { unique: true });

// Soft delete fields - isDeleted, deletedAt, deletedBy
settingsSchema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
});
settingsSchema.index({ isDeleted: 1 });

// Apply sync middleware
applySyncMiddleware(settingsSchema, 'Settings');

export default mongoose.model("Settings", settingsSchema);
