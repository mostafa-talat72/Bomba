import mongoose from "mongoose";

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

// Apply sync middleware
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
applySyncMiddleware(settingsSchema);

export default mongoose.model("Settings", settingsSchema);
