import mongoose from "mongoose";

const inventoryItemSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "اسم المنتج مطلوب"],
            trim: true,
        },
        category: {
            type: String,
            required: [true, "فئة المنتج مطلوبة"],
            // Remove enum to allow dynamic categories from menu
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
            // Remove enum to allow dynamic units
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
        recipe: [
            {
                ingredient: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "InventoryItem",
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                unit: {
                    type: String,
                    required: true,
                },
            },
        ],
        stockMovements: [
            {
                type: {
                    type: String,
                    enum: ["in", "out", "adjustment"],
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

// Check if item is low stock
inventoryItemSchema.virtual("isLowStock").get(function () {
    return this.currentStock <= this.minStock;
});

// Check if item is out of stock
inventoryItemSchema.virtual("isOutOfStock").get(function () {
    return this.currentStock === 0;
});

// Calculate profit margin
inventoryItemSchema.virtual("profitMargin").get(function () {
    if (this.cost === 0) return 0;
    return ((this.price - this.cost) / this.cost) * 100;
});

// Calculate total inventory value based on actual purchase prices with FIFO
inventoryItemSchema.virtual("totalValue").get(function () {
    // Sort all movements by timestamp (oldest first)
    const allMovements = this.stockMovements
        .map(m => ({
            type: m.type,
            quantity: m.quantity,
            price: m.price,
            timestamp: new Date(m.timestamp || m.date).getTime()
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
    
    // Track remaining quantity from each 'in' movement
    const batches = [];
    
    for (const movement of allMovements) {
        if (movement.type === 'in' && movement.price) {
            // Add new batch
            batches.push({
                quantity: movement.quantity,
                price: movement.price,
                remaining: movement.quantity
            });
        } else if (movement.type === 'out') {
            // Deduct from oldest batches first (FIFO)
            let toDeduct = movement.quantity;
            
            for (const batch of batches) {
                if (toDeduct <= 0) break;
                
                const deductFromBatch = Math.min(batch.remaining, toDeduct);
                batch.remaining -= deductFromBatch;
                toDeduct -= deductFromBatch;
            }
        } else if (movement.type === 'adjustment') {
            // For adjustment, recalculate all batches proportionally
            const totalRemaining = batches.reduce((sum, b) => sum + b.remaining, 0);
            
            if (totalRemaining > 0) {
                const ratio = movement.quantity / totalRemaining;
                batches.forEach(batch => {
                    batch.remaining = batch.remaining * ratio;
                });
            }
        }
    }
    
    // Calculate total value from remaining batches
    let totalValue = 0;
    for (const batch of batches) {
        if (batch.remaining > 0) {
            totalValue += batch.remaining * batch.price;
        }
    }
    
    return Math.round(totalValue * 100) / 100; // Round to 2 decimal places
});

// Calculate weighted average purchase price
inventoryItemSchema.virtual("averagePurchasePrice").get(function () {
    const inMovements = this.stockMovements.filter(m => m.type === 'in' && m.price);
    
    if (inMovements.length === 0) {
        return this.price;
    }
    
    let totalCost = 0;
    let totalQuantity = 0;
    
    for (const movement of inMovements) {
        totalCost += movement.quantity * movement.price;
        totalQuantity += movement.quantity;
    }
    
    return totalQuantity > 0 ? Math.round((totalCost / totalQuantity) * 100) / 100 : this.price;
});

// Add stock movement
inventoryItemSchema.methods.addStockMovement = function (
    type,
    quantity,
    reason,
    user,
    reference = null,
    price = null,
    timestamp = null,
    totalCost = null
) {
    // Validate inputs
    if (!type || !['in', 'out', 'adjustment'].includes(type)) {
        throw new Error('نوع الحركة غير صحيح');
    }
    
    if (!quantity || quantity <= 0) {
        throw new Error('الكمية يجب أن تكون أكبر من صفر');
    }
    
    if (type === 'in' && price !== null && price < 0) {
        throw new Error('السعر يجب أن يكون موجباً');
    }
    
    if (!reason) {
        throw new Error('السبب مطلوب');
    }

    this.stockMovements.push({
        type,
        quantity,
        price,
        totalCost,
        reason,
        reference,
        user,
        timestamp: timestamp || new Date(),
    });

    if (type === "in") {
        this.currentStock += quantity;
        this.lastRestocked = new Date();
        
        // Update price to be from the most recent 'in' movement by date
        if (price !== null && price > 0) {
            const inMovements = this.stockMovements
                .filter(m => m.type === 'in' && m.price)
                .sort((a, b) => {
                    const aTime = new Date(a.timestamp || a.date).getTime();
                    const bTime = new Date(b.timestamp || b.date).getTime();
                    return bTime - aTime; // Descending: newest first
                });
            
            if (inMovements.length > 0) {
                this.price = inMovements[0].price;
            }
        }
        
        // Update reasons: oldest movement should be "المخزون الأولي", others "شراء مخزون جديد"
        const inMovements = this.stockMovements
            .filter(m => m.type === 'in')
            .sort((a, b) => {
                const aTime = new Date(a.timestamp || a.date).getTime();
                const bTime = new Date(b.timestamp || b.date).getTime();
                return aTime - bTime; // Ascending: oldest first
            });
        
        // Update all movements
        inMovements.forEach((movement, index) => {
            if (index === 0) {
                // Oldest movement = المخزون الأولي
                if (movement.reason === "شراء مخزون جديد" || movement.reason === "المخزون الأولي") {
                    movement.reason = "المخزون الأولي";
                }
            } else {
                // All other movements = شراء مخزون جديد
                if (movement.reason === "المخزون الأولي") {
                    movement.reason = "شراء مخزون جديد";
                }
            }
        });
    } else if (type === "out") {
        if (this.currentStock < quantity) {
            throw new Error(`المخزون غير كافٍ. المتوفر: ${this.currentStock}, المطلوب: ${quantity}`);
        }
        this.currentStock = Math.max(0, this.currentStock - quantity);
    } else if (type === "adjustment") {
        this.currentStock = quantity;
    }

    return this.save();
};

// Consume ingredients for recipe
inventoryItemSchema.methods.consumeIngredients = async function (quantity = 1) {
    if (!this.recipe || this.recipe.length === 0) return;

    for (const ingredient of this.recipe) {
        const item = await this.constructor.findById(ingredient.ingredient);
        if (item) {
            const consumeQty = ingredient.quantity * quantity;
            await item.addStockMovement(
                "out",
                consumeQty,
                `استهلاك لتحضير ${this.name}`,
                null,
                this._id.toString()
            );
        }
    }
};

// Calculate weighted average purchase price
inventoryItemSchema.methods.getWeightedAveragePrice = function () {
    const inMovements = this.stockMovements.filter(m => m.type === 'in' && m.price);
    
    if (inMovements.length === 0) {
        return this.price;
    }
    
    let totalCost = 0;
    let totalQuantity = 0;
    
    for (const movement of inMovements) {
        totalCost += movement.quantity * movement.price;
        totalQuantity += movement.quantity;
    }
    
    return totalQuantity > 0 ? totalCost / totalQuantity : this.price;
};

// Get purchase history summary
inventoryItemSchema.methods.getPurchaseHistory = function () {
    const inMovements = this.stockMovements.filter(m => m.type === 'in' && m.price);
    
    return inMovements.map(m => ({
        date: m.timestamp,
        quantity: m.quantity,
        price: m.price,
        total: m.quantity * m.price,
        reason: m.reason
    }));
};

// Indexes
inventoryItemSchema.index({ name: 1, organization: 1 }); // Compound index for name + organization
inventoryItemSchema.index({ category: 1 });
inventoryItemSchema.index({ currentStock: 1 });
inventoryItemSchema.index({ isActive: 1 });
inventoryItemSchema.index({ barcode: 1 }, { sparse: true });
inventoryItemSchema.index({ "stockMovements.timestamp": -1 }); // Index for stock movements sorting

// Pre-save hook for validation
inventoryItemSchema.pre('save', function(next) {
    // Ensure currentStock is never negative
    if (this.currentStock < 0) {
        this.currentStock = 0;
    }
    
    // Ensure minStock is not greater than maxStock
    if (this.maxStock && this.minStock > this.maxStock) {
        return next(new Error('الحد الأدنى لا يمكن أن يكون أكبر من الحد الأقصى'));
    }
    
    // Ensure price is positive
    if (this.price < 0) {
        return next(new Error('السعر يجب أن يكون موجباً'));
    }
    
    next();
});

// Apply sync middleware
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
applySyncMiddleware(inventoryItemSchema);

export default mongoose.model("InventoryItem", inventoryItemSchema);
