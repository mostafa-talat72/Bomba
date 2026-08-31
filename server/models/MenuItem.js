import mongoose from "mongoose";
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";

const variantSchema = new mongoose.Schema(
    {
        size: {
            type: String,
            required: [true, "اسم الحجم مطلوب"],
            trim: true,
        },
        price: {
            type: Number,
            required: [true, "سعر الحجم مطلوب"],
            min: 0,
        },
        sku: {
            type: String,
            trim: true,
            default: null,
        },
        barcode: {
            type: String,
            trim: true,
            default: null,
        },
    },
    { _id: false }
);

const menuItemSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "اسم المنتج مطلوب"],
            trim: true,
        },
        // تم حذف arabicName نهائياً
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MenuCategory",
            required: [true, "فئة المنتج مطلوبة"],
        },
        description: {
            type: String,
            default: null,
        },
        price: {
            type: Number,
            min: 0,
            required: false,
            default: null,
        },
        variants: {
            type: [variantSchema],
            default: undefined,
            validate: {
                validator: function (v) {
                    if (!v || v.length === 0) return true;
                    return v.every(variant => variant.size && variant.price != null && variant.price >= 0);
                },
                message: "كل حجم يجب أن يحتوي على اسم وسعر صحيح",
            },
        },
        image: {
            type: String,
            default: null,
        },
        isAvailable: {
            type: Boolean,
            default: true,
        },
        isPopular: {
            type: Boolean,
            default: false,
        },
        preparationTime: {
            type: Number, // in minutes
            default: 5,
            min: 1,
        },
        notes: {
            type: String,
            default: null,
        },
        allergens: [
            {
                type: String,
                enum: [
                    "حليب",
                    "بيض",
                    "فول سوداني",
                    "مكسرات",
                    "سمك",
                    "محار",
                    "قمح",
                    "صويا",
                ],
            },
        ],
        ingredients: [
            {
                item: {
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
        nutritionalInfo: {
            calories: {
                type: Number,
                default: null,
            },
            protein: {
                type: Number,
                default: null,
            },
            carbs: {
                type: Number,
                default: null,
            },
            fat: {
                type: Number,
                default: null,
            },
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        sortOrder: {
            type: Number,
            default: 0,
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
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Helper to sync price/variants before validation
function syncPriceAndVariants(doc) {
    const hasVariants = doc.variants && Array.isArray(doc.variants) && doc.variants.length > 0;
    const hasPrice = doc.price != null && !isNaN(doc.price);
    if (hasVariants) {
        // Ensure price reflects first variant for backward compatibility
        const firstPrice = doc.variants[0]?.price;
        if (firstPrice != null && !isNaN(firstPrice)) {
            doc.price = firstPrice;
        }
    } else if (hasPrice) {
        // Auto-create single variant for migration / legacy price-only items
        doc.variants = [{ size: "عادي", price: doc.price }];
    }
}

menuItemSchema.pre("validate", function (next) {
    try {
        syncPriceAndVariants(this);
        // After sync, ensure price exists if variants exist
        if ((!this.variants || this.variants.length === 0) && (this.price == null || isNaN(this.price))) {
            // Let mongoose required validation handle missing price if needed, but we keep price optional now
            // Ensure at least variants or price? Validation will pass because price is optional, but we want to ensure one exists
            // If neither, let it fail via custom validation below
        }
        next();
    } catch (e) {
        next(e);
    }
});

menuItemSchema.pre("save", function (next) {
    try {
        syncPriceAndVariants(this);
        next();
    } catch (e) {
        next(e);
    }
});

// Ensure price is populated on findOneAndUpdate operations via middleware
menuItemSchema.pre("findOneAndUpdate", function (next) {
    const update = this.getUpdate();
    if (!update) return next();
    const set = update.$set || update;
    // If variants provided in update, sync price
    if (set.variants && Array.isArray(set.variants) && set.variants.length > 0) {
        const firstPrice = set.variants[0]?.price;
        if (firstPrice != null) {
            if (update.$set) update.$set.price = firstPrice;
            else update.price = firstPrice;
        }
    } else if (set.price != null && (!set.variants || set.variants.length === 0)) {
        // If price provided but no variants in update, ensure variants created
        // Only if existing doc check? We'll handle in controller for full doc; here we ensure variants if not present
        // Check if variants not being set at all, create single variant
        if (!set.variants) {
            const variant = { size: "عادي", price: set.price };
            if (update.$set) update.$set.variants = [variant];
            else update.variants = [variant];
        }
    }
    next();
});

// Virtual for legacy compatibility: effectivePrice returns first variant price or price field
menuItemSchema.virtual("effectivePrice").get(function () {
    if (this.variants && this.variants.length > 0) return this.variants[0].price;
    return this.price;
});

// Ensure price validation: if no variants, price must exist
menuItemSchema.pre("validate", function (next) {
    if ((!this.variants || this.variants.length === 0) && (this.price == null || isNaN(this.price))) {
        this.invalidate("price", "السعر مطلوب (أو يجب إضافة حجم واحد على الأقل)");
    }
    if (this.variants && this.variants.length > 0) {
        for (let i = 0; i < this.variants.length; i++) {
            const v = this.variants[i];
            if (!v.size || String(v.size).trim() === "") {
                this.invalidate(`variants.${i}.size`, "اسم الحجم مطلوب");
            }
            if (v.price == null || isNaN(v.price) || v.price < 0) {
                this.invalidate(`variants.${i}.price`, "سعر الحجم يجب أن يكون رقم موجب");
            }
        }
    }
    next();
});

// Indexes for better query performance
menuItemSchema.index({ name: 1, organization: 1 });
menuItemSchema.index({ category: 1, organization: 1, isAvailable: 1 }); // للبحث عن العناصر المتاحة
menuItemSchema.index({ organization: 1, isAvailable: 1, sortOrder: 1 }); // للعرض المرتب
menuItemSchema.index({ isPopular: 1, organization: 1 }); // للعناصر الشائعة
menuItemSchema.index({ section: 1, organization: 1 }); // للبحث حسب القسم

// Soft delete fields - isDeleted, deletedAt, deletedBy
menuItemSchema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
});
// Apply sync middleware
applySyncMiddleware(menuItemSchema, 'MenuItem');

export default mongoose.model("MenuItem", menuItemSchema);
