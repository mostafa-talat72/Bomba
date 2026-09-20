import mongoose from "mongoose";

// أرشيف حركات المخزون/المخزن الأقدم من حد الأرشفة (30 يوماً).
// تُنقل الحركات القديمة هنا مع لقطة رصيد بتاريخ القطع:
// - لا تُفقد (تُعرض مدمجة مع الحي)
// - لا تُحتسب مرتين (كل حركة في مكان واحد + اللقطة أساس التراكم)
const archivedMovementSchema = new mongoose.Schema(
    {
        type: { type: String },
        quantity: { type: Number },
        price: { type: Number, default: null },
        totalCost: { type: Number, default: null },
        reason: { type: String },
        reasonCode: { type: String, default: null },
        reference: { type: String, default: null },
        referenceModel: { type: String, default: null },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        timestamp: { type: Date },
        transferId: { type: mongoose.Schema.Types.ObjectId, default: null },
        orderId: { type: mongoose.Schema.Types.ObjectId, default: null },
        billId: { type: mongoose.Schema.Types.ObjectId, default: null },
        balanceAfter: { type: Number },
        archivedAt: { type: Date, default: Date.now },
    },
    { _id: true }
);

const stockMovementArchiveSchema = new mongoose.Schema(
    {
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            index: true,
        },
        itemType: {
            type: String,
            enum: ["inventory", "warehouse"],
            required: true,
        },
        itemId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        movements: [archivedMovementSchema],
        // رصيد اللقطة بتاريخ القطع — أساس تراكم الحركات الحية (لا يُعاد حساب القديم)
        snapshotBalance: { type: Number, default: 0 },
        snapshotDate: { type: Date, default: null },
    },
    { timestamps: true }
);

stockMovementArchiveSchema.index(
    { organization: 1, itemType: 1, itemId: 1 },
    { unique: true }
);

export default mongoose.model("StockMovementArchive", stockMovementArchiveSchema);
