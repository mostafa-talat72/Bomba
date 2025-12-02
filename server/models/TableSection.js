import mongoose from "mongoose";

const tableSectionSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "اسم القسم مطلوب"],
            trim: true,
        },
        description: {
            type: String,
            default: null,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        sortOrder: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
tableSectionSchema.index({ name: 1 });
tableSectionSchema.index({ organization: 1 });
tableSectionSchema.index({ sortOrder: 1 });

// Apply sync middleware
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
applySyncMiddleware(tableSectionSchema);

export default mongoose.model("TableSection", tableSectionSchema);





