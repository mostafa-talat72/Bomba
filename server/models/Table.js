import mongoose from "mongoose";
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
import { auditPlugin } from "../utils/audit.js";
import { bumpVersion } from "../utils/cacheVersion.js";

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

// Soft delete fields - isDeleted, deletedAt, deletedBy
tableSchema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
});
// Apply sync middleware
applySyncMiddleware(tableSchema, 'Table');
auditPlugin(tableSchema, 'tables');

// Orders/bills GET responses embed table name/number. A table rename/status
// change must invalidate those caches too.
tableSchema.pre("save", () => { bumpVersion("orders"); bumpVersion("bills"); });
tableSchema.pre("findOneAndUpdate", () => { bumpVersion("orders"); bumpVersion("bills"); });
tableSchema.pre("updateOne", () => { bumpVersion("orders"); bumpVersion("bills"); });
tableSchema.pre("updateMany", () => { bumpVersion("orders"); bumpVersion("bills"); });
tableSchema.pre("deleteOne", () => { bumpVersion("orders"); bumpVersion("bills"); });
tableSchema.pre("deleteMany", () => { bumpVersion("orders"); bumpVersion("bills"); });
tableSchema.pre("findOneAndDelete", () => { bumpVersion("orders"); bumpVersion("bills"); });

export default mongoose.model("Table", tableSchema);
