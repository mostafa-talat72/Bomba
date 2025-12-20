import mongoose from "mongoose";

const costSchema = new mongoose.Schema(
    {
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CostCategory',
            required: [true, "فئة التكلفة مطلوبة"],
        },
        subcategory: {
            type: String,
            default: null,
        },
        description: {
            type: String,
            required: [true, "وصف التكلفة مطلوب"],
        },
        amount: {
            type: Number,
            required: [true, "المبلغ مطلوب"],
            min: 0,
        },
        paidAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        remainingAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        currency: {
            type: String,
            default: "EGP",
        },
        date: {
            type: Date,
            required: [true, "تاريخ التكلفة مطلوب"],
            default: Date.now,
        },
        dueDate: {
            type: Date,
            default: null,
        },
        status: {
            type: String,
            enum: ["pending", "paid", "partially_paid", "overdue", "cancelled"],
            default: "pending",
        },
        paymentMethod: {
            type: String,
            enum: ["cash", "card", "transfer", "check"],
            default: "cash",
        },
        receipt: {
            type: String,
            default: null,
        },
        receiptImage: {
            type: String,
            default: null,
        },
        vendor: {
            type: String,
            default: null,
        },
        vendorContact: {
            type: String,
            default: null,
        },
        isRecurring: {
            type: Boolean,
            default: false,
        },
        recurringPeriod: {
            type: String,
            enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
            default: null,
        },
        nextDueDate: {
            type: Date,
            default: null,
        },
        tags: [
            {
                type: String,
            },
        ],
        notes: {
            type: String,
            default: null,
        },
        paymentHistory: [
            {
                amount: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                paymentMethod: {
                    type: String,
                    enum: ["cash", "card", "transfer", "check"],
                    default: "cash",
                },
                paidBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    default: null,
                },
                paidAt: {
                    type: Date,
                    default: Date.now,
                },
                notes: {
                    type: String,
                    default: null,
                },
                receipt: {
                    type: String,
                    default: null,
                },
            },
        ],
        amountHistory: [
            {
                addedAmount: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                previousTotal: {
                    type: Number,
                    required: true,
                },
                newTotal: {
                    type: Number,
                    required: true,
                },
                addedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    default: null,
                },
                addedAt: {
                    type: Date,
                    default: Date.now,
                },
                reason: {
                    type: String,
                    default: null,
                },
            },
        ],
        attachments: [
            {
                filename: String,
                originalName: String,
                path: String,
                size: Number,
                mimetype: String,
                uploadedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        approvedAt: {
            type: Date,
            default: null,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
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

// Update status and remaining amount based on paid amount
costSchema.pre("save", function (next) {
    // Ensure paidAmount never exceeds amount
    if (this.paidAmount > this.amount) {
        this.paidAmount = this.amount;
    }

    // Calculate remaining amount
    this.remainingAmount = Math.max(0, this.amount - this.paidAmount);

    // Auto-update status based on payment
    if (this.paidAmount >= this.amount) {
        // Fully paid
        this.status = "paid";
        this.remainingAmount = 0;
    } else if (this.paidAmount > 0) {
        // Partially paid
        this.status = "partially_paid";
    } else {
        // Not paid
        this.status = "pending";
    }

    next();
});

// Method to add payment
costSchema.methods.addPayment = function (
    paymentAmount,
    paymentMethod = "cash",
    paidBy = null,
    notes = null
) {
    // Validate payment amount
    if (paymentAmount <= 0) {
        throw new Error("Payment amount must be greater than zero");
    }

    // Ensure payment doesn't exceed remaining amount
    const maxPayment = this.amount - this.paidAmount;
    if (paymentAmount > maxPayment) {
        throw new Error(`Payment amount cannot exceed remaining amount of ${maxPayment}`);
    }

    // Add to payment history
    this.paymentHistory.push({
        amount: paymentAmount,
        paymentMethod: paymentMethod,
        paidBy: paidBy,
        paidAt: new Date(),
        notes: notes,
    });

    // Update total paid amount
    this.paidAmount += paymentAmount;
    this.paymentMethod = paymentMethod; // Keep last payment method

    // The pre-save hook will automatically:
    // - Calculate remainingAmount
    // - Update status based on payment
    return this.save();
};

// Method to increase cost amount
costSchema.methods.increaseAmount = function (
    additionalAmount,
    addedBy = null,
    reason = null
) {
    // Validate additional amount
    if (additionalAmount <= 0) {
        throw new Error("Additional amount must be greater than zero");
    }

    const previousTotal = this.amount;
    const newTotal = previousTotal + additionalAmount;

    // Add to amount history
    this.amountHistory.push({
        addedAmount: additionalAmount,
        previousTotal: previousTotal,
        newTotal: newTotal,
        addedBy: addedBy,
        addedAt: new Date(),
        reason: reason,
    });

    // Update total amount
    this.amount = newTotal;

    // The pre-save hook will automatically:
    // - Calculate remainingAmount
    // - Update status if needed
    return this.save();
};

// Calculate next due date for recurring costs
costSchema.methods.calculateNextDueDate = function () {
    if (!this.isRecurring || !this.recurringPeriod) return null;

    const currentDate = this.dueDate || this.date;
    const nextDate = new Date(currentDate);

    switch (this.recurringPeriod) {
        case "daily":
            nextDate.setDate(nextDate.getDate() + 1);
            break;
        case "weekly":
            nextDate.setDate(nextDate.getDate() + 7);
            break;
        case "monthly":
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
        case "quarterly":
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
        case "yearly":
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
    }

    this.nextDueDate = nextDate;
    return nextDate;
};

// Indexes
costSchema.index({ category: 1 });
costSchema.index({ status: 1 });
costSchema.index({ date: 1 });
costSchema.index({ dueDate: 1 });
costSchema.index({ createdBy: 1 });

// Apply sync middleware
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
applySyncMiddleware(costSchema);

export default mongoose.model("Cost", costSchema);
