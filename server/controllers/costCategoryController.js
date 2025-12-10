import CostCategory from '../models/CostCategory.js';

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

        res.status(201).json({
            success: true,
            message: 'تم إنشاء القسم بنجاح',
            data: category,
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

        res.json({
            success: true,
            message: 'تم تحديث القسم بنجاح',
            data: category,
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

        await category.deleteOne();

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
