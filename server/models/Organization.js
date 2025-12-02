import mongoose from "mongoose";

const OrganizationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: {
        type: String,
        enum: ["cafe", "restaurant", "playstation"],
        default: "cafe", // جعل الحقل اختياري مع قيمة افتراضية
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    createdAt: { type: Date, default: Date.now },
});

// Apply sync middleware
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
applySyncMiddleware(OrganizationSchema);

export default mongoose.model("Organization", OrganizationSchema);
