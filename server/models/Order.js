import mongoose from "mongoose";

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
        tableNumber: {
            type: Number,
            required: false,
            min: 1,
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
            enum: ["pending", "preparing", "ready", "delivered", "cancelled"],
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

// Create a unique index on orderNumber to prevent duplicates
orderSchema.index({ orderNumber: 1 }, { unique: true });

// Add pre-validate hook to ensure order number is set before validation
orderSchema.pre('validate', function(next) {
    if (!this.orderNumber) {
        // Set a temporary value to pass validation
        this.orderNumber = 'TEMP';
    }
    next();
});

// Combined pre-save hook for all operations
orderSchema.pre("save", async function (next) {
    try {
        // Generate order number if new or if it's temporary
        if (this.isNew || this.orderNumber === 'TEMP') {
            const now = new Date();
            
            // Format date and time
            const year = now.getFullYear().toString().slice(-2);
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
            
            // Create a unique identifier using the full timestamp
            const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;
            
            // Create order number using the timestamp
            this.orderNumber = `ORD-${timestamp}`;
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
        console.error("❌ Pre-save hook error:", error);
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
        console.error("❌ Order save error:", {
            error: error.message,
            orderData: doc
                ? {
                      customerName: doc.customerName,
                      itemsCount: doc.items ? doc.items.length : 0,
                      subtotal: doc.subtotal,
                  }
                : "No doc",
        });
    }
    next(error);
});

// Indexes
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ tableNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: 1 });
orderSchema.index({ bill: 1 });

export default mongoose.model("Order", orderSchema);
