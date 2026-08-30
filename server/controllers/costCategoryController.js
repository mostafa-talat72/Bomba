import CostCategory from '../models/CostCategory.js';
import { writeToAtlas } from "../utils/atlasWrite.js";
import Logger from '../middleware/logger.js';
import dualDatabaseManager from '../config/dualDatabaseManager.js';

// @desc    Get all cost categories
// @route   GET /api/cost-categories
// @access  Private
export const getCostCategories = async (req, res) => {
    try {
        const categories = await CostCategory.find({
            organization: req.user.organization,
        })
            .sort({ sortOrder: 1, name: 1 })
            .lean();

        res.json({
            success: true,
            data: categories,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب أقسام التكاليف',
            error: error.message,
        });
    }
};

// @desc    Get single cost category
// @route   GET /api/cost-categories/:id
// @access  Private
export const getCostCategory = async (req, res) => {
    try {
        const category = await CostCategory.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'القسم غير موجود',
            });
        }

        res.json({
            success: true,
            data: category,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب القسم',
            error: error.message,
        });
    }
};

// @desc    Create cost category
// @route   POST /api/cost-categories
// @access  Private
export const createCostCategory = async (req, res) => {
    try {
        const { name, icon, color, description, sortOrder } = req.body;

        // Check if category with same name exists
        const existingCategory = await CostCategory.findOne({
            name: name.trim(),
            organization: req.user.organization,
        });

        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: 'يوجد قسم بنفس الاسم بالفعل',
            });
        }

        const category = await CostCategory.create({
            name: name.trim(),
            icon: icon || 'DollarSign',
            color: color || '#3B82F6',
            description,
            sortOrder: sortOrder || 0,
            organization: req.user.organization,
            createdBy: req.user._id,
        });

        // Fire-and-forget Atlas write
        writeToAtlas('costcategories', 'upsert', category.toObject ? category.toObject() : category, { _id: category._id });

        // Prepare minimal response data
        const responseData = {
            _id: category._id,
            name: category.name,
            icon: category.icon,
            color: category.color,
            description: category.description,
            sortOrder: category.sortOrder,
            createdAt: category.createdAt,
        };

        // Return response IMMEDIATELY
        res.status(201).json({
            success: true,
            message: 'تم إنشاء القسم بنجاح',
            data: responseData,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'خطأ في إنشاء القسم',
            error: error.message,
        });
    }
};

// @desc    Update cost category
// @route   PUT /api/cost-categories/:id
// @access  Private
export const updateCostCategory = async (req, res) => {
    try {
        const category = await CostCategory.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'القسم غير موجود',
            });
        }

        const { name, icon, color, description, sortOrder, isActive } = req.body;

        // Check if new name conflicts with existing category
        if (name && name.trim() !== category.name) {
            const existingCategory = await CostCategory.findOne({
                name: name.trim(),
                organization: req.user.organization,
                _id: { $ne: category._id },
            });

            if (existingCategory) {
                return res.status(400).json({
                    success: false,
                    message: 'يوجد قسم بنفس الاسم بالفعل',
                });
            }
        }

        if (name) category.name = name.trim();
        if (icon) category.icon = icon;
        if (color) category.color = color;
        if (description !== undefined) category.description = description;
        if (sortOrder !== undefined) category.sortOrder = sortOrder;
        if (isActive !== undefined) category.isActive = isActive;

        await category.save();

        // Fire-and-forget Atlas write
        writeToAtlas('costcategories', 'upsert', category.toObject ? category.toObject() : category, { _id: category._id });

        // Prepare minimal response data
        const responseData = {
            _id: category._id,
            name: category.name,
            icon: category.icon,
            color: category.color,
            description: category.description,
            sortOrder: category.sortOrder,
            isActive: category.isActive,
            updatedAt: category.updatedAt,
        };

        // Return response IMMEDIATELY
        res.json({
            success: true,
            message: 'تم تحديث القسم بنجاح',
            data: responseData,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'خطأ في تحديث القسم',
            error: error.message,
        });
    }
};

// @desc    Delete cost category
// @route   DELETE /api/cost-categories/:id
// @access  Private
export const deleteCostCategory = async (req, res) => {
    try {
        const category = await CostCategory.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'القسم غير موجود',
            });
        }

        // Check if category has costs
        const Cost = (await import('../models/Cost.js')).default;
        const costsCount = await Cost.countDocuments({
            category: category._id,
            organization: req.user.organization,
        });

        if (costsCount > 0) {
            return res.status(400).json({
                success: false,
                message: `لا يمكن حذف القسم لأنه يحتوي على ${costsCount} تكلفة`,
            });
        }

        const categoryId = category._id;
        await category.deleteOne();

        // Fire-and-forget Atlas write for delete
        writeToAtlas('costcategories', 'delete', null, { _id: categoryId });

        // Return response IMMEDIATELY
        res.json({
            success: true,
            message: 'تم حذف القسم بنجاح',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'خطأ في حذف القسم',
            error: error.message,
        });
    }
};
