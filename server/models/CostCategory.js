import mongoose from 'mongoose';

const costCategorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        icon: {
            type: String,
            required: true,
            default: 'DollarSign',
        },
        color: {
            type: String,
            default: '#3B82F6',
        },
        description: {
            type: String,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        sortOrder: {
            type: Number,
            default: 0,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Index for faster queries
costCategorySchema.index({ organization: 1, isActive: 1, sortOrder: 1 });

// Unique index for organization + name combination (Requirement 1.3)
costCategorySchema.index({ organization: 1, name: 1 }, { unique: true });

// Apply sync middleware
import { applySyncMiddleware } from '../middleware/sync/syncMiddleware.js';
applySyncMiddleware(costCategorySchema);

const CostCategory = mongoose.model('CostCategory', costCategorySchema);

export default CostCategory;
