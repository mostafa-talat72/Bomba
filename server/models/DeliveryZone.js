import mongoose from "mongoose";
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";

const deliveryZoneSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        fee: { type: Number, default: 0, min: 0 },
        isActive: { type: Boolean, default: true },
        organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

deliveryZoneSchema.index({ organization: 1, name: 1 }, { unique: true });
deliveryZoneSchema.index({ organization: 1, isActive: 1 });

// Sync (Atlas queue + LAN mesh push) like all other collections
applySyncMiddleware(deliveryZoneSchema, 'DeliveryZone');

export default mongoose.models.DeliveryZone || mongoose.model("DeliveryZone", deliveryZoneSchema);
