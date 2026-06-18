import mongoose from "mongoose";
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";

const warehouseItemSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "اسم المنتج مطلوب"],
            trim: true,
        },
        category: {
            type: String,
            required: [true, "فئة المنتج مطلوبة"],
        },
        currentStock: {
            type: Number,
            required: [true, "المخزون الحالي مطلوب"],
            min: 0,
            default: 0,
        },
        minStock: {
            type: Number,
            required: [true, "الحد الأدنى للمخزون مطلوب"],
            min: 0,
            default: 10,
        },
        maxStock: {
            type: Number,
            default: null,
            min: 0,
        },
        unit: {
            type: String,
            required: [true, "وحدة القياس مطلوبة"],
        },
        price: {
            type: Number,
            required: [true, "السعر مطلوب"],
            min: 0,
        },
        cost: {
            type: Number,
            default: 0,
            min: 0,
        },
        supplier: {
            type: String,
            default: null,
        },
        supplierContact: {
            type: String,
            default: null,
        },
        barcode: {
            type: String,
            default: null,
        },
        description: {
            type: String,
            default: null,
        },
        image: {
            type: String,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        isRawMaterial: {
            type: Boolean,
            default: false,
        },
        stockMovements: [
            {
                type: {
                    type: String,
                    enum: ["in", "out", "adjustment", "transfer_out", "transfer_in"],
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                },
                price: {
                    type: Number,
                    default: null,
                    min: 0,
                },
                totalCost: {
                    type: Number,
                    default: null,
                    min: 0,
                },
                reason: {
                    type: String,
                    required: true,
                },
                reference: {
                    type: String,
                    default: null,
                },
                referenceModel: {
                    type: String,
                    default: null,
                },
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        lastRestocked: {
            type: Date,
            default: null,
        },
        expiryDate: {
            type: Date,
            default: null,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

warehouseItemSchema.virtual("isLowStock").get(function () {
    return this.currentStock <= this.minStock;
});

warehouseItemSchema.virtual("isOutOfStock").get(function () {
    return this.currentStock === 0;
});

warehouseItemSchema.virtual("totalValue").get(function () {
    const inMovements = this.stockMovements
        .filter(m => m.type === 'in' && m.price)
        .sort((a, b) => {
            const aTime = new Date(a.timestamp || a.date).getTime();
            const bTime = new Date(b.timestamp || b.date).getTime();
            return aTime - bTime;
        });

    let totalQty = 0;
    let totalCost = 0;

    for (const movement of inMovements) {
        totalQty += movement.quantity;
        totalCost += movement.quantity * movement.price;
    }

    if (totalQty === 0) return 0;

    const avgPrice = totalCost / totalQty;
    return Math.round(this.currentStock * avgPrice * 100) / 100;
});

warehouseItemSchema.methods.addStockMovement = function (
    type,
    quantity,
    reason,
    user,
    reference = null,
    referenceModel = null,
    price = null,
    timestamp = null,
    totalCost = null
) {
    if (!type || !["in", "out", "adjustment", "transfer_out", "transfer_in"].includes(type)) {
        throw new Error("نوع الحركة غير صحيح");
    }

    if (!quantity || quantity <= 0) {
        throw new Error("الكمية يجب أن تكون أكبر من صفر");
    }

    if (!reason) {
        throw new Error("السبب مطلوب");
    }

    this.stockMovements.push({
        type,
        quantity,
        price,
        totalCost,
        reason,
        reference,
        referenceModel,
        user,
        timestamp: timestamp || new Date(),
    });

    if (type === "in" || type === "transfer_in") {
        this.currentStock += quantity;
        this.lastRestocked = new Date();
        if (price !== null && price > 0) {
            const inMovements = this.stockMovements
                .filter(m => (m.type === 'in' || m.type === 'transfer_in') && m.price)
                .sort((a, b) => {
                    const aTime = new Date(a.timestamp || a.date).getTime();
                    const bTime = new Date(b.timestamp || b.date).getTime();
                    return bTime - aTime;
                });
            if (inMovements.length > 0) {
                this.price = inMovements[0].price;
            }
        }
    } else if (type === "out" || type === "transfer_out") {
        if (this.currentStock < quantity) {
            throw new Error(`المخزون غير كافٍ. المتوفر: ${this.currentStock}, المطلوب: ${quantity}`);
        }
        this.currentStock = Math.max(0, this.currentStock - quantity);
    } else if (type === "adjustment") {
        this.currentStock = quantity;
    }

    return this.save();
};

warehouseItemSchema.index({ name: 1, organization: 1 });
warehouseItemSchema.index({ category: 1 });
warehouseItemSchema.index({ currentStock: 1 });
warehouseItemSchema.index({ isActive: 1 });
warehouseItemSchema.index({ barcode: 1 }, { sparse: true });
warehouseItemSchema.index({ "stockMovements.timestamp": -1 });

warehouseItemSchema.pre("save", function (next) {
    if (this.currentStock < 0) this.currentStock = 0;
    if (this.maxStock && this.minStock > this.maxStock) {
        return next(new Error("الحد الأدنى لا يمكن أن يكون أكبر من الحد الأقصى"));
    }
    if (this.price < 0) {
        return next(new Error("السعر يجب أن يكون موجباً"));
    }
    next();
});

applySyncMiddleware(warehouseItemSchema, "WarehouseItem");

export default mongoose.model("WarehouseItem", warehouseItemSchema);
