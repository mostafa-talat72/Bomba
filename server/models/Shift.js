import mongoose from "mongoose";
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";

// Cash shift: expected cash (from bill payments in window) vs actual counted cash.
const shiftSchema = new mongoose.Schema(
    {
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ["open", "closed"],
            default: "open",
            index: true,
        },
        openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        openedByName: { type: String, default: null },
        openedAt: { type: Date, default: Date.now, required: true },
        openingCash: { type: Number, default: 0, min: 0 }, // cash in drawer at open
        closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        closedByName: { type: String, default: null },
        closedAt: { type: Date, default: null },
        // Computed at close from Bill.payments[] timestamps inside [openedAt, closedAt]
        expectedCash: { type: Number, default: 0 }, // openingCash + cash payments
        cashPayments: { type: Number, default: 0 },
        cardPayments: { type: Number, default: 0 },
        transferPayments: { type: Number, default: 0 },
        otherPayments: { type: Number, default: 0 },
        paymentsCount: { type: Number, default: 0 },
        billsCount: { type: Number, default: 0 },
        actualCash: { type: Number, default: null }, // counted by cashier at close
        difference: { type: Number, default: null }, // actualCash - expectedCash
        notes: { type: String, default: null },
    },
    { timestamps: true }
);

shiftSchema.index({ organization: 1, status: 1, openedAt: -1 });

applySyncMiddleware(shiftSchema, 'Shift');

export default mongoose.model("Shift", shiftSchema);
