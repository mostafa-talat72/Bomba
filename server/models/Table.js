import mongoose from "mongoose";

const tableSchema = new mongoose.Schema(
    {
        number: {
            type: mongoose.Schema.Types.Mixed, // يقبل نصوص وأرقام
            required: [true, "رقم/اسم الطاولة مطلوب"],
        },
        section: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "TableSection",
            required: [true, "القسم مطلوب"],
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        status: {
            type: String,
            enum: ["empty", "occupied", "reserved"],
            default: "empty",
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

// Indexes - ensure unique table number per section and organization
tableSchema.index({ number: 1, section: 1, organization: 1 }, { unique: true });
tableSchema.index({ section: 1 });
tableSchema.index({ organization: 1 });
tableSchema.index({ isActive: 1 });

// Apply sync middleware
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
applySyncMiddleware(tableSchema);

export default mongoose.model("Table", tableSchema);
