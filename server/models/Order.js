import mongoose from "mongoose";
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";

const orderItemSchema = new mongoose.Schema({
    menuItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MenuItem",
        required: false,
    },
    name: {
        type: String,
        required: [true, "اسم المنتج مطلوب"],
    },
    arabicName: {
        type: String,
        required: false,
    },
    price: {
        type: Number,
        required: [true, "سعر المنتج مطلوب"],
        min: 0,
    },
    quantity: {
        type: Number,
        required: [true, "الكمية مطلوبة"],
        min: 1,
    },
    preparedCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    itemTotal: {
        type: Number,
        required: true,
        min: 0,
    },
    notes: {
        type: String,
        default: null,
    },
    preparationTime: {
        type: Number, // in minutes
        default: 5,
    },
    section: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MenuSection",
        default: null,
    },
    deliveredCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    isReady: {
        type: Boolean,
        default: false,
    },
    wasEverReady: {
        type: Boolean,
        default: false,
    },
    readyTime: {
        type: Date,
        default: null,
    },
});

const orderSchema = new mongoose.Schema(
    {
        orderNumber: {
            type: String,
            required: true,
        },
        table: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Table",
            required: false,
            default: null,
        },
        customerName: {
            type: String,
            default: null,
        },
        customerPhone: {
            type: String,
            default: null,
        },
        items: [orderItemSchema],
        status: {
            type: String,
            enum: ["draft", "confirmed", "pending", "preparing", "ready", "delivered", "cancelled"], // confirmed: يخصم المخزون لكن لا يظهر في المطبخ
            default: "pending",
        },
        subtotal: {
            type: Number,
            required: [true, "المبلغ الفرعي مطلوب"],
            min: 0,
        },
        discount: {
            type: Number,
            default: 0,
            min: 0,
        },
        finalAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        totalCost: {
            type: Number,
            default: 0,
            min: 0,
        },
        notes: {
            type: String,
            default: null,
        },
        estimatedReadyTime: {
            type: Date,
            default: null,
        },
        actualReadyTime: {
            type: Date,
            default: null,
        },
        deliveredTime: {
            type: Date,
            default: null,
        },
        bill: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bill",
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
        preparedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        deliveredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Add pre-validate hook to ensure order number is set before validation
orderSchema.pre("validate", function (next) {
    if (!this.orderNumber) {
        // Set a temporary value to pass validation
        this.orderNumber = "TEMP";
    }
    next();
});

// Combined pre-save hook for all operations
orderSchema.pre("save", async function (next) {
    try {
        // Generate order number if new or if it's temporary (atomic counter)
        if (this.isNew || this.orderNumber === "TEMP") {
            const now = new Date();
            const year = now.getFullYear().toString().slice(-2);
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");
            const dateStr = `${year}${month}${day}`;
            const counterId = `order_${dateStr}`;
            if (!mongoose.models.OrderCounter) {
                const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
                mongoose.model('OrderCounter', counterSchema);
            }
            // Initialize counter with current max from existing orders (first run only)
            const lastOrder = await this.constructor.findOne({ orderNumber: { $regex: `^ORD-${dateStr}-` } })
                .sort({ orderNumber: -1 })
                .select('orderNumber');
            const startSeq = lastOrder ? parseInt(lastOrder.orderNumber.split('-')[2]) : 0;
            await mongoose.models.OrderCounter.updateOne(
                { _id: counterId },
                { $setOnInsert: { seq: startSeq } },
                { upsert: true }
            );
            const counter = await mongoose.models.OrderCounter.findByIdAndUpdate(
                counterId,
                { $inc: { seq: 1 } },
                { new: true }
            );
            this.orderNumber = `ORD-${dateStr}-${counter.seq}`;
        }

        // Calculate item totals and subtotal
        if (this.items && this.items.length > 0) {
            this.subtotal = this.items.reduce((total, item) => {
                const itemTotal = item.price * item.quantity;
                item.itemTotal = itemTotal;
                return total + itemTotal;
            }, 0);
        }

        // Calculate final amount
        this.finalAmount = this.subtotal - (this.discount || 0);

        // Update status timestamps
        if (this.isModified("status")) {
            const now = new Date();

            switch (this.status) {
                case "preparing":
                    // Calculate estimated ready time based on longest preparation time
                    if (this.items && this.items.length > 0) {
                        const maxPrepTime = Math.max(
                            ...this.items.map(
                                (item) => item.preparationTime || 5
                            )
                        );
                        this.estimatedReadyTime = new Date(
                            now.getTime() + maxPrepTime * 60000
                        );
                    }
                    break;
                case "ready":
                    this.actualReadyTime = now;
                    break;
                case "delivered":
                    this.deliveredTime = now;
                    break;
            }
        }

        next();
    } catch (error) {
        next(error);
    }
});

// Add post-save hook for logging
orderSchema.post("save", function (doc, next) {
    if (doc) {
    }
    next();
});

// Add post-save hook for error logging
orderSchema.post("save", function (error, doc, next) {
    if (error) {
    }
    next(error);
});

// Indexes for performance optimization
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ bill: 1 });
orderSchema.index({ table: 1 }); // Index for table field query performance

// Compound indexes for common query patterns
orderSchema.index({ organization: 1, status: 1, createdAt: -1 });
orderSchema.index({ organization: 1, table: 1, createdAt: -1 });
orderSchema.index({ organization: 1, createdAt: -1 });
orderSchema.index({ table: 1, status: 1 }); // Index for table-status queries

// Apply sync middleware BEFORE creating the model
applySyncMiddleware(orderSchema, 'Order');

// Create the model AFTER middleware is applied
const Order = mongoose.model("Order", orderSchema);

export default Order;
