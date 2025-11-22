import mongoose from "mongoose";

const menuCategorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "اسم الفئة مطلوب"],
            trim: true,
        },
        description: {
            type: String,
            default: null,
        },
        section: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MenuSection",
            required: [true, "القسم مطلوب"],
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
        isActive: {
            type: Boolean,
            default: true,
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
    }
);

// Indexes
menuCategorySchema.index({ name: 1 });
menuCategorySchema.index({ section: 1 });
menuCategorySchema.index({ organization: 1 });
menuCategorySchema.index({ sortOrder: 1 });

export default mongoose.model("MenuCategory", menuCategorySchema);

