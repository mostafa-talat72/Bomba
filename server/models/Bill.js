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
        // تتبع الدفع على مستوى الأصناف - نظام محسّن
        itemPayments: [
            {
                orderId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Order",
                    required: true,
                },
                itemId: {
                    type: String,
                    required: true,
                },
                itemName: {
                    type: String,
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 1,
                },
                paidQuantity: {
                    type: Number,
                    default: 0,
                    min: 0,
                },
                pricePerUnit: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                totalPrice: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                paidAmount: {
                    type: Number,
                    default: 0,
                    min: 0,
                },
                isPaid: {
                    type: Boolean,
                    default: false,
                },
                paidAt: {
                    type: Date,
                },
                paidBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                paymentHistory: [
                    {
                        quantity: {
                            type: Number,
                            required: true,
                            min: 0,
                        },
                        amount: {
                            type: Number,
                            required: true,
                            min: 0,
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
                        method: {
                            type: String,
                            enum: ["cash", "card", "transfer"],
                            required: true,
                        },
                    },
                ],
            },
        ],
        // تتبع الدفع الجزئي للجلسات
        sessionPayments: [
            {
                sessionId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Session",
                    required: true,
                },
                sessionCost: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                paidAmount: {
                    type: Number,
                    default: 0,
                    min: 0,
                },
                remainingAmount: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                payments: [
                    {
                        amount: {
                            type: Number,
                            required: true,
                            min: 0,
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
                        method: {
                            type: String,
                            enum: ["cash", "card", "transfer"],
                            required: true,
                        },
                    },
                ],
            },
        ],
        // سجل الدفعات المحسّن
        paymentHistory: [
            {
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
                amount: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                method: {
                    type: String,
                    enum: ["cash", "card", "transfer", "mixed"],
                    required: true,
                },
                paidBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                type: {
                    type: String,
                    enum: ["full", "partial-items", "partial-session", "mixed"],
                    required: true,
                },
                details: {
                    paidItems: [
                        {
                            itemName: String,
                            quantity: Number,
                            amount: Number,
                        },
                    ],
                    paidSessions: [
                        {
                            sessionId: mongoose.Schema.Types.ObjectId,
                            amount: Number,
                            remainingAfter: Number,
                        },
                    ],
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
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual field for remainingQuantity in itemPayments
billSchema.virtual('itemPayments.remainingQuantity').get(function() {
    if (this.itemPayments && Array.isArray(this.itemPayments)) {
        return this.itemPayments.map(item => ({
            ...item.toObject ? item.toObject() : item,
            remainingQuantity: (item.quantity || 0) - (item.paidQuantity || 0)
        }));
    }
    return [];
});

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

// Initialize itemPayments and sessionPayments for new bills or when orders/sessions change
billSchema.pre("save", async function (next) {
    // تهيئة itemPayments و sessionPayments فقط للفواتير الجديدة أو عند تغيير الطلبات/الجلسات
    if (
        this.isNew ||
        this.isModified("orders") ||
        this.isModified("sessions")
    ) {
        // تهيئة itemPayments من الطلبات
        if (
            this.orders &&
            this.orders.length > 0 &&
            (!this.itemPayments || this.itemPayments.length === 0)
        ) {
            try {
                await this.populate("orders");
                this.itemPayments = [];

                this.orders.forEach((order) => {
                    if (order.items && order.items.length > 0) {
                        order.items.forEach((item, index) => {
                            const itemName =
                                item.menuItem?.name ||
                                item.menuItem?.arabicName ||
                                item.name ||
                                "Unknown";
                            const price = item.price || 0;
                            const quantity = item.quantity || 1;

                            this.itemPayments.push({
                                orderId: order._id,
                                itemId: `${order._id}-${index}`,
                                itemName,
                                quantity,
                                paidQuantity: 0,
                                pricePerUnit: price,
                                totalPrice: price * quantity,
                                paidAmount: 0,
                                isPaid: false,
                                paymentHistory: [],
                            });
                        });
                    }
                });
            } catch (error) {
                // إذا فشل populate، نستمر بدون تهيئة itemPayments
                console.error("Error initializing itemPayments:", error);
            }
        }

        // تهيئة sessionPayments من الجلسات
        if (
            this.sessions &&
            this.sessions.length > 0 &&
            (!this.sessionPayments || this.sessionPayments.length === 0)
        ) {
            try {
                await this.populate("sessions");
                this.sessionPayments = [];

                for (const session of this.sessions) {
                    const sessionCost =
                        session.finalCost || session.totalCost || 0;
                    this.sessionPayments.push({
                        sessionId: session._id,
                        sessionCost,
                        paidAmount: 0,
                        remainingAmount: sessionCost,
                        payments: [],
                    });
                }
            } catch (error) {
                // إذا فشل populate، نستمر بدون تهيئة sessionPayments
                console.error("Error initializing sessionPayments:", error);
            }
        }
    }
    next();
});

// Update isPaid and paidAmount based on paidQuantity
billSchema.pre("save", function (next) {
    // تحديث isPaid و paidAmount لكل صنف بناءً على paidQuantity
    if (this.itemPayments && this.itemPayments.length > 0) {
        this.itemPayments.forEach((item) => {
            // تحديث isPaid بناءً على المقارنة بين paidQuantity و quantity
            item.isPaid = (item.paidQuantity || 0) >= (item.quantity || 0);
            
            // تحديث paidAmount بناءً على paidQuantity
            item.paidAmount = (item.paidQuantity || 0) * (item.pricePerUnit || 0);
        });
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
        // Check if we have itemPayments to determine status based on quantities
        if (this.itemPayments && this.itemPayments.length > 0) {
            // Count fully paid items and partially paid items
            let allItemsFullyPaid = true;
            let someItemsPartiallyPaid = false;
            
            for (const item of this.itemPayments) {
                const paidQty = item.paidQuantity || 0;
                const totalQty = item.quantity || 0;
                
                if (paidQty < totalQty) {
                    // Item is not fully paid
                    allItemsFullyPaid = false;
                    
                    if (paidQty > 0) {
                        // Item is partially paid
                        someItemsPartiallyPaid = true;
                    }
                }
            }
            
            // Also check sessionPayments if they exist
            if (this.sessionPayments && this.sessionPayments.length > 0) {
                for (const session of this.sessionPayments) {
                    const remaining = session.remainingAmount || 0;
                    const paid = session.paidAmount || 0;
                    
                    if (remaining > 0) {
                        allItemsFullyPaid = false;
                        
                        if (paid > 0) {
                            someItemsPartiallyPaid = true;
                        }
                    }
                }
            }
            
            // Set status based on item payment status
            if (allItemsFullyPaid && this.paid > 0) {
                // All items fully paid
                this.status = "paid";
            } else if (someItemsPartiallyPaid || this.paid > 0) {
                // Some items partially paid
                this.status = "partial";
            } else {
                // No items paid
                this.status = "draft";
            }
        } else {
            // Fallback to old logic if no itemPayments (backward compatibility)
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
        }

        // التحقق من التأخير (إذا كان هناك تاريخ استحقاق)
        if (
            this.dueDate &&
            this.dueDate < new Date() &&
            this.status !== "paid"
        ) {
            this.status = "overdue";
        }
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

// Calculate remaining amount based on all payment types
billSchema.methods.calculateRemainingAmount = function () {
    let totalPaid = 0;

    // جمع المدفوع من الأصناف (النظام الجديد)
    if (this.itemPayments && this.itemPayments.length > 0) {
        this.itemPayments.forEach((item) => {
            totalPaid += item.paidAmount || 0;
        });
    }

    // جمع المدفوع من الجلسات (النظام الجديد)
    if (this.sessionPayments && this.sessionPayments.length > 0) {
        this.sessionPayments.forEach((session) => {
            totalPaid += session.paidAmount || 0;
        });
    }

    // جمع الدفعات الكاملة (النظام القديم - للتوافق)
    if (this.payments && this.payments.length > 0) {
        this.payments.forEach((payment) => {
            totalPaid += payment.amount || 0;
        });
    }

    // تحديث المبلغ المدفوع والمتبقي
    this.paid = totalPaid;
    this.remaining = Math.max(0, this.total - totalPaid);

    return this.remaining;
};

// Pay for specific items with quantities
billSchema.methods.payForItems = function (items, paymentMethod, userId) {
    // Validate input: items should be array of {itemId, quantity}
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error("يجب تحديد الأصناف والكميات المراد دفعها");
    }

    const paidItems = [];
    let totalAmount = 0;

    items.forEach((paymentItem) => {
        // Handle both {itemId, quantity} objects and plain itemId for backward compatibility
        let itemId, quantity;
        
        if (typeof paymentItem === 'object' && paymentItem !== null && !paymentItem._bsontype) {
            // It's an object with itemId and quantity
            itemId = paymentItem.itemId;
            quantity = paymentItem.quantity;
        } else {
            // It's a plain itemId (backward compatibility - pay full remaining quantity)
            itemId = paymentItem;
            quantity = null; // Will be set to remaining quantity
        }

        // Find the item in itemPayments
        const item = this.itemPayments.find(
            (i) => i._id.toString() === itemId.toString()
        );

        if (!item) {
            throw new Error(`الصنف ${itemId} غير موجود في الفاتورة`);
        }

        // Calculate remaining quantity
        const remainingQuantity = (item.quantity || 0) - (item.paidQuantity || 0);

        // Check if item is already fully paid
        if (remainingQuantity === 0) {
            throw new Error(`الصنف "${item.itemName}" مدفوع بالكامل`);
        }

        // If quantity not specified, pay for all remaining quantity
        if (quantity === null || quantity === undefined) {
            quantity = remainingQuantity;
        }

        // Validate quantity
        if (!quantity || quantity <= 0) {
            throw new Error(`يجب إدخال كمية صحيحة أكبر من صفر للصنف "${item.itemName}"`);
        }

        // Check if quantity exceeds remaining
        if (quantity > remainingQuantity) {
            throw new Error(
                `الكمية المطلوبة (${quantity}) أكبر من الكمية المتبقية (${remainingQuantity}) للصنف "${item.itemName}"`
            );
        }

        // Calculate payment amount for this quantity
        const paymentAmount = quantity * (item.pricePerUnit || 0);

        // Update paid quantity
        item.paidQuantity = (item.paidQuantity || 0) + quantity;
        
        // Update paid amount (will also be updated by pre-save hook, but we do it here for immediate use)
        item.paidAmount = item.paidQuantity * (item.pricePerUnit || 0);
        
        // Update isPaid status
        item.isPaid = item.paidQuantity >= (item.quantity || 0);
        
        // Update timestamps and user
        item.paidAt = new Date();
        item.paidBy = userId;

        // Add to payment history for this item
        if (!item.paymentHistory) {
            item.paymentHistory = [];
        }
        item.paymentHistory.push({
            quantity: quantity,
            amount: paymentAmount,
            paidAt: new Date(),
            paidBy: userId,
            method: paymentMethod,
        });

        // Add to paid items list for response
        paidItems.push({
            itemName: item.itemName,
            quantity: quantity,
            amount: paymentAmount,
            remainingQuantity: (item.quantity || 0) - item.paidQuantity,
        });

        totalAmount += paymentAmount;
    });

    // إضافة إلى سجل الدفعات العام للفاتورة
    this.paymentHistory.push({
        amount: totalAmount,
        method: paymentMethod,
        paidBy: userId,
        type: "partial-items",
        details: { paidItems, paidSessions: [] },
    });

    // إعادة حساب المبلغ المتبقي
    this.calculateRemainingAmount();

    return { paidItems, totalAmount };
};

// Pay partial amount for a session
billSchema.methods.paySessionPartial = function (
    sessionId,
    amount,
    paymentMethod,
    userId
) {
    if (!sessionId) {
        throw new Error("يجب تحديد الجلسة");
    }

    if (!amount || amount <= 0) {
        throw new Error("يجب إدخال مبلغ صحيح");
    }

    const sessionPayment = this.sessionPayments.find(
        (s) => s.sessionId.toString() === sessionId.toString()
    );

    if (!sessionPayment) {
        throw new Error("الجلسة غير موجودة في الفاتورة");
    }

    if (amount > sessionPayment.remainingAmount) {
        throw new Error(
            `المبلغ (${amount}) أكبر من المبلغ المتبقي (${sessionPayment.remainingAmount})`
        );
    }

    // إضافة الدفعة للجلسة
    sessionPayment.payments.push({
        amount,
        paidBy: userId,
        method: paymentMethod,
        paidAt: new Date(),
    });

    sessionPayment.paidAmount += amount;
    sessionPayment.remainingAmount -= amount;

    // إضافة إلى سجل الدفعات
    this.paymentHistory.push({
        amount,
        method: paymentMethod,
        paidBy: userId,
        type: "partial-session",
        details: {
            paidItems: [],
            paidSessions: [
                {
                    sessionId,
                    amount,
                    remainingAfter: sessionPayment.remainingAmount,
                },
            ],
        },
    });

    // إعادة حساب المبلغ المتبقي
    this.calculateRemainingAmount();

    return {
        sessionId,
        paidAmount: amount,
        remaining: sessionPayment.remainingAmount,
    };
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
            // Check if all items are paid (for partial payment system)
            const allItemsPaid = this.itemPayments && this.itemPayments.length > 0
                ? this.itemPayments.every(item => item.isPaid)
                : true; // If no itemPayments, consider items as paid
            
            // Check if all sessions are paid (for partial payment system)
            const allSessionsPaid = this.sessionPayments && this.sessionPayments.length > 0
                ? this.sessionPayments.every(session => session.remainingAmount === 0)
                : true; // If no sessionPayments, consider sessions as paid
            
            if (this.paid >= this.total && allItemsPaid && allSessionsPaid) {
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

/**
 * Helper function to update table status based on unpaid bills
 * @param {ObjectId} tableId - The table ID to update
 * @returns {Promise<string>} The new table status
 */
async function updateTableStatus(tableId) {
    if (!tableId) {
        return null;
    }

    // Check if mongoose is connected before attempting database operations
    if (mongoose.connection.readyState !== 1) {
        return null;
    }

    try {
        const Table = mongoose.model("Table");
        const Bill = mongoose.model("Bill");

        // Find all unpaid bills for this table (draft, partial, or overdue status)
        const unpaidBills = await Bill.find({
            table: tableId,
            status: { $in: ["draft", "partial", "overdue"] },
        });

        // Determine new status: occupied if there are unpaid bills, empty otherwise
        const newStatus = unpaidBills.length > 0 ? "occupied" : "empty";

        // Update table status
        await Table.findByIdAndUpdate(tableId, { status: newStatus });

        return newStatus;
    } catch (error) {
        // Don't throw error - table status update failure shouldn't break bill operations
        return null;
    }
}

// Post-save hook to update table status when bill is created or updated
billSchema.post("save", async function (doc) {
    if (doc.table) {
        await updateTableStatus(doc.table);
    }
});

// Post-findOneAndUpdate hook to update table status when bill is updated via findOneAndUpdate
billSchema.post("findOneAndUpdate", async function (doc) {
    if (doc && doc.table) {
        await updateTableStatus(doc.table);
    }
});

// Post-findOneAndDelete hook to update table status when bill is deleted (Requirement 2.5)
billSchema.post("findOneAndDelete", async function (doc) {
    if (doc && doc.table) {
        await updateTableStatus(doc.table);
    }
});

// Post-deleteOne hook to update table status when bill is deleted (Requirement 2.5)
billSchema.post("deleteOne", { document: true, query: false }, async function (doc) {
    if (doc && doc.table) {
        await updateTableStatus(doc.table);
    }
});

// Apply sync middleware
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
applySyncMiddleware(billSchema);

export default mongoose.model("Bill", billSchema);
