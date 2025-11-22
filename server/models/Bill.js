import mongoose from "mongoose";
import QRCode from "qrcode";

const billSchema = new mongoose.Schema(
    {
        billNumber: {
            type: String,
            required: false,
        },
        customerName: {
            type: String,
            default: null,
        },
        customerPhone: {
            type: String,
            default: null,
        },
        table: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Table",
            required: false,
            default: null,
        },
        orders: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Order",
            },
        ],
        sessions: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Session",
            },
        ],
        subtotal: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        discount: {
            type: Number,
            default: 0,
            min: 0,
        },
        discountPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        tax: {
            type: Number,
            default: 0,
            min: 0,
        },
        total: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        paid: {
            type: Number,
            default: 0,
            min: 0,
        },
        remaining: {
            type: Number,
            default: 0,
            min: 0,
        },
        status: {
            type: String,
            enum: ["draft", "partial", "paid", "cancelled", "overdue"],
            default: "draft",
        },
        paymentMethod: {
            type: String,
            enum: ["cash", "card", "transfer", "mixed"],
            default: "cash",
        },
        payments: [
            {
                amount: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                method: {
                    type: String,
                    enum: ["cash", "card", "transfer"],
                    required: true,
                },
                reference: {
                    type: String,
                    default: null,
                },
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
            },
        ],
        // تتبع المدفوعات الجزئية للمشروبات
        partialPayments: [
            {
                orderId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Order",
                    required: true,
                },
                orderNumber: {
                    type: String,
                    required: true,
                },
                items: [
                    {
                        itemName: {
                            type: String,
                            required: true,
                        },
                        price: {
                            type: Number,
                            required: true,
                        },
                        quantity: {
                            type: Number,
                            required: true,
                            default: 1,
                        },
                        paidAt: {
                            type: Date,
                            default: Date.now,
                        },
                        paidBy: {
                            type: mongoose.Schema.Types.ObjectId,
                            ref: "User",
                            required: true,
                        },
                        paymentMethod: {
                            type: String,
                            enum: ["cash", "card", "transfer"],
                            required: true,
                        },
                    },
                ],
                totalPaid: {
                    type: Number,
                    required: true,
                    default: 0,
                },
            },
        ],
        qrCode: {
            type: String,
            default: null,
        },
        qrCodeUrl: {
            type: String,
            default: null,
        },
        notes: {
            type: String,
            default: null,
        },
        billType: {
            type: String,
            enum: ["cafe", "playstation", "computer"],
            default: "cafe",
            required: true,
        },
        dueDate: {
            type: Date,
            default: null,
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
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Generate bill number with full timestamp
billSchema.pre("save", async function (next) {
    if (this.isNew && !this.billNumber) {
        try {
            const now = new Date();

            // Format date and time components
            const year = now.getFullYear().toString().slice(-2);
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");
            const hours = String(now.getHours()).padStart(2, "0");
            const minutes = String(now.getMinutes()).padStart(2, "0");
            const seconds = String(now.getSeconds()).padStart(2, "0");
            const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

            // Create a unique identifier using the full timestamp
            const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;

            // Create bill number using the timestamp
            this.billNumber = `BILL-${timestamp}`;
        } catch (error) {
            // Fallback bill number
            this.billNumber = `INV-${Date.now()}`;
        }
    }
    next();
});

// Calculate totals and status
billSchema.pre("save", function (next) {
    // حساب المبلغ المتبقي
    this.remaining = this.total - this.paid;

    // تحديد حالة الفاتورة بناءً على المبلغ المتبقي
    // لا نعيد تحديد الحالة إذا كانت ملغية
    if (this.status !== "cancelled") {
        if (this.remaining === 0 && this.paid > 0) {
            // إذا كان المبلغ المتبقي = صفر وتم دفع شيء، تصبح مدفوعة بالكامل
            this.status = "paid";
        } else if (this.paid > 0 && this.paid < this.total) {
            // إذا تم دفع جزء من المبلغ، تصبح مدفوعة جزئياً
            this.status = "partial";
        } else if (this.paid === 0) {
            // إذا لم يتم دفع أي شيء، تبقى مسودة
            this.status = "draft";
        }

        // التحقق من التأخير (إذا كان هناك تاريخ استحقاق)
        if (
            this.dueDate &&
            this.dueDate < new Date() &&
            this.status !== "paid"
        ) {
            this.status = "overdue";
        }
    } else {
    }

    next();
});

// Method to generate QR code
billSchema.methods.generateQRCode = async function () {
    if (!this.qrCode && this._id) {
        try {
            const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
            const qrData = {
                billId: this._id,
                billNumber: this.billNumber,
                total: this.total,
                url: `${baseUrl}/bill/${this._id}`,
            };

            const qrCodeDataURL = await QRCode.toDataURL(
                JSON.stringify(qrData)
            );

            this.qrCode = qrCodeDataURL;
            this.qrCodeUrl = qrData.url;
        } catch (error) {}
    }
    return this;
};

// Generate QR Code after save
billSchema.post("save", async function (doc) {
    // Only generate QR code if it doesn't exist
    if (!doc.qrCode && doc._id) {
        try {
            await doc.generateQRCode();

            // Use updateOne to save without triggering hooks again
            await this.constructor.updateOne(
                { _id: doc._id },
                {
                    $set: {
                        qrCode: doc.qrCode,
                        qrCodeUrl: doc.qrCodeUrl,
                    },
                },
                { timestamps: false } // Don't update timestamps
            );
        } catch (error) {}
    }
});

// Add payment
billSchema.methods.addPayment = function (
    amount,
    method,
    user,
    reference = null,
    isPartial = false,
    discountPercentage = undefined
) {
    // Update discount percentage if provided
    if (discountPercentage !== undefined) {
        this.discountPercentage = parseFloat(discountPercentage);
        // Recalculate total with new discount (synchronous)
        const subtotal = this.subtotal || 0;
        const discount = (subtotal * this.discountPercentage) / 100;
        this.discount = discount;
        this.total = subtotal - discount + (this.tax || 0);
    }

    // If this is not a partial payment, update the paid amount
    if (!isPartial) {
        // Add the payment to the payments array
        this.payments.push({
            amount,
            method,
            reference,
            user,
            timestamp: new Date(),
        });

        // Update paid amount (add to existing paid amount)
        this.paid = (this.paid || 0) + amount;
    }

    // Calculate remaining amount (can't be negative)
    this.remaining = Math.max(0, this.total - this.paid);

    // Update status based on payment
    if (this.paid >= this.total) {
        this.status = "paid";
        this.remaining = 0; // Ensure remaining is 0 if fully paid
        this.paid = this.total; // Ensure we don't overpay
    } else if (this.paid > 0) {
        this.status = "partial";
    } else {
        this.status = "draft";
    }

    // Note: Don't save here, let the controller handle saving
    // to avoid double saves
    return this;
};

// Add partial payment for specific items
billSchema.methods.addPartialPayment = function (
    orderId,
    orderNumber,
    items,
    user,
    paymentMethod
) {
    // حساب المبلغ المدفوع: سعر الصنف + مجموع أسعار الإضافات لكل قطعة
    const totalPaid = items.reduce((sum, item) => {
        // حساب سعر العنصر الأساسي
        const itemTotal = item.price * item.quantity;

        return sum + itemTotal;
    }, 0);

    this.partialPayments.push({
        orderId,
        orderNumber,
        items: items.map((item) => ({
            itemName: item.itemName,
            price: item.price,
            quantity: item.quantity,
            paidAt: item.paidAt,
            paidBy: user._id,
            paymentMethod,
        })),
        totalPaid,
    });

    this.paid += totalPaid;

    // Update status based on payment
    if (this.paid >= this.total) {
        this.status = "paid";
        this.remaining = 0;
        this.paid = this.total;
    } else if (this.paid > 0) {
        this.status = "partial";
        this.remaining = this.total - this.paid;
    }

    return this;
};

// Get partial payments summary
billSchema.methods.getPartialPaymentsSummary = function () {
    const summary = {
        totalPaid: 0,
        orders: {},
    };

    this.partialPayments.forEach((payment) => {
        summary.totalPaid += payment.totalPaid;
        if (!summary.orders[payment.orderId]) {
            summary.orders[payment.orderId] = {
                orderNumber: payment.orderNumber,
                items: [],
                totalPaid: 0,
            };
        }
        summary.orders[payment.orderId].items.push(...payment.items);
        summary.orders[payment.orderId].totalPaid += payment.totalPaid;
    });

    return summary;
};

// Calculate subtotal from orders and sessions
billSchema.methods.calculateSubtotal = async function () {
    try {
        // Try to populate, but don't fail if models aren't available
        try {
            await this.populate(["orders", "sessions"]);
        } catch (populateError) {}

        let subtotal = 0;

        // Add orders total
        if (this.orders && this.orders.length > 0) {
            subtotal += this.orders
                .filter((order) => order.status !== "cancelled")
                .reduce((sum, order) => {
                    const orderAmount =
                        order.finalAmount || order.totalAmount || 0;
                    return sum + orderAmount;
                }, 0);
        }

        // Add sessions total (استخدم breakdown الفعلي)
        if (this.sessions && this.sessions.length > 0) {
            for (const session of this.sessions) {
                if (typeof session.getCostBreakdownAsync === "function") {
                    const { totalCost } = await session.getCostBreakdownAsync();
                    subtotal += totalCost;
                } else {
                    const sessionAmount =
                        session.finalCost || session.totalCost || 0;
                    subtotal += sessionAmount;
                }
            }
        }

        this.subtotal = subtotal;

        // Calculate discount amount based on percentage if provided
        let discountAmount = 0;
        if (this.discountPercentage && this.discountPercentage > 0) {
            // Only calculate discount if percentage is provided and greater than 0
            discountAmount = Math.round(
                (this.subtotal * this.discountPercentage) / 100
            );
            this.discount = discountAmount; // Store the calculated discount amount
        } else {
            // If no discount percentage, use the direct discount amount if provided
            discountAmount = this.discount || 0;
        }

        // Calculate total after discount and tax (ensure it doesn't go below 0)
        this.total = Math.max(
            0,
            this.subtotal + (this.tax || 0) - discountAmount
        );

        // If this is a new bill or being recalculated, set paid to 0 if not set
        if (this.isNew && this.paid === undefined) {
            this.paid = 0;
        }

        // Calculate remaining amount (can't be negative)
        this.remaining = Math.max(0, this.total - (this.paid || 0));

        // Update status based on payment, but only if this is not a new bill
        if (!this.isNew) {
            if (this.paid >= this.total) {
                this.status = "paid";
                this.remaining = 0; // Ensure remaining is 0 if fully paid
            } else if (this.paid > 0) {
                this.status = "partial";
            } else {
                this.status = this.status || "draft";
            }
        }

        return this.save();
    } catch (error) {
        // Set default values if calculation fails
        this.subtotal = this.subtotal || 0;
        this.total = this.total || 0;
    }
};

// Indexes for better query performance
billSchema.index({ billNumber: 1 }, { unique: true });
billSchema.index({ table: 1 }); // Index for table field query performance
billSchema.index({ table: 1, status: 1 }); // Index for table-status queries

// Compound indexes for common query patterns (optimized for performance)
billSchema.index({ organization: 1, status: 1, createdAt: -1 });
billSchema.index({ organization: 1, table: 1, createdAt: -1 });
billSchema.index({ organization: 1, createdAt: -1 });
billSchema.index({ billType: 1, organization: 1 });
billSchema.index({ status: 1, createdAt: -1 }); // Index for status-based queries

// Text index for customer name search
billSchema.index({ customerName: "text" });

// Pre-remove hook to delete associated orders when bill is deleted
billSchema.pre("remove", async function (next) {
    try {
        // Import Order model dynamically to avoid circular dependency
        const Order = mongoose.model("Order");

        // Delete all orders associated with this bill
        await Order.deleteMany({ bill: this._id });

        next();
    } catch (error) {
        next(error);
    }
});

// Pre-deleteOne hook
billSchema.pre(
    "deleteOne",
    { document: true, query: false },
    async function (next) {
        try {
            const Order = mongoose.model("Order");
            await Order.deleteMany({ bill: this._id });
            next();
        } catch (error) {
            next(error);
        }
    }
);

// Pre-findOneAndDelete hook
billSchema.pre("findOneAndDelete", async function (next) {
    try {
        const Order = mongoose.model("Order");
        const bill = await this.model.findOne(this.getQuery());
        if (bill) {
            await Order.deleteMany({ bill: bill._id });
        }
        next();
    } catch (error) {
        next(error);
    }
});

export default mongoose.model("Bill", billSchema);
