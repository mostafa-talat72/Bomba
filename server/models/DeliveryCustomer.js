import mongoose from "mongoose";
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";

// دليل عميل واحد = رقم هاتف واحد (رقمنة متساهلة) لكل منشأة — آخر كتابة تفوز.
// يوحّد دليل الجهاز المحلي + سجل الفواتير + أي جهاز: عنوان/اسم جديد لنفس الرقم
// يحدّث في مكانه بلا تكرار، ويعمل Offline مع السقوط على السيرفر.
const deliveryCustomerSchema = new mongoose.Schema(
    {
        phoneDigits: {
            // أرقام فقط (بلا +/مسافات/شرطات) — مفتاح التفرد مع المنشأة.
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        phone: { type: String, required: true, trim: true },
        customerName: { type: String, default: null, trim: true },
        address: { type: String, default: null, trim: true },
        orderCount: { type: Number, default: 1, min: 1 },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            index: true,
        },
    },
    { timestamps: true }
);

deliveryCustomerSchema.index({ organization: 1, phoneDigits: 1 }, { unique: true });
deliveryCustomerSchema.index({ organization: 1, customerName: "text", address: "text" });

applySyncMiddleware(deliveryCustomerSchema, "DeliveryCustomer");

export default mongoose.model("DeliveryCustomer", deliveryCustomerSchema);
