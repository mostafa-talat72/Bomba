import mongoose from "mongoose";
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
import { auditPlugin } from "../utils/audit.js";

const reservationSchema = new mongoose.Schema(
    {
        table: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Table",
            required: [true, "الطاولة مطلوبة"],
        },
        customerName: {
            type: String,
            required: [true, "اسم العميل مطلوب"],
            trim: true,
        },
        phone: {
            type: String,
            default: null,
            trim: true,
        },
        date: {
            type: Date,
            required: [true, "تاريخ الحجز مطلوب"],
        },
        time: {
            type: String,
            required: [true, "وقت الحجز مطلوب"],
            trim: true,
        },
        guests: {
            type: Number,
            default: 2,
            min: 1,
        },
        status: {
            type: String,
            enum: ["confirmed", "seated", "cancelled", "no_show"],
            default: "confirmed",
        },
        notes: {
            type: String,
            default: null,
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
reservationSchema.index({ table: 1, date: 1, status: 1 });
reservationSchema.index({ organization: 1, date: 1 });
reservationSchema.index({ organization: 1, status: 1 });

// Apply sync middleware
applySyncMiddleware(reservationSchema, 'Reservation');
auditPlugin(reservationSchema, 'reservations');

export default mongoose.model("Reservation", reservationSchema);
