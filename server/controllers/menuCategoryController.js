import MenuCategory from "../models/MenuCategory.js";
import MenuItem from "../models/MenuItem.js";
import { writeToAtlas } from "../utils/atlasWrite.js";
import Logger from "../middleware/logger.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";

// Get all menu categories
export const getAllMenuCategories = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(401).json({
                success: false,
                message: "يجب تسجيل الدخول للوصول إلى فئات المنيو",
            });
        }

        const { section } = req.query;

        const filter = {
            organization: req.user.organization,
        };

        if (section) {
            filter.section = section;
        }

        const categories = await MenuCategory.find(filter)
            .sort({ sortOrder: 1, name: 1 })
            .populate("section", "name")
            .populate("createdBy", "name")
            .populate("updatedBy", "name");

        res.json({
            success: true,
            count: categories.length,
            data: categories,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب فئات المنيو",
            error: error.message,
        });
    }
};

// Get menu category by ID
export const getMenuCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await MenuCategory.findOne({
            _id: id,
            organization: req.user.organization,
        })
            .populate("section", "name")
            .populate("createdBy", "name")
            .populate("updatedBy", "name");

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "الفئة غير موجودة",
            });
        }

        res.json({
            success: true,
            data: category,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الفئة",
            error: error.message,
        });
    }
};

// Create new menu category
export const createMenuCategory = async (req, res) => {
    try {
        const { name, description, section, sortOrder } = req.body;

        if (!name || name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "اسم الفئة مطلوب",
            });
        }

        if (!section) {
            return res.status(400).json({
                success: false,
                message: "القسم مطلوب",
            });
        }

        const categoryData = {
            name: name.trim(),
            description: description?.trim() || null,
            section: section,
            sortOrder: sortOrder || 0,
            organization: req.user.organization,
            createdBy: req.user.id,
        };

        const category = new MenuCategory(categoryData);
        await category.save();

        // Fire-and-forget Atlas write
        writeToAtlas('menucategories', 'upsert', category.toObject ? category.toObject() : category, { _id: category._id });

        // Prepare minimal response data
        const responseData = {
            _id: category._id,
            name: category.name,
            description: category.description,
            section: category.section,
            sortOrder: category.sortOrder,
            createdAt: category.createdAt,
        };

        // Return response IMMEDIATELY
        res.status(201).json({
            success: true,
            message: "تم إنشاء الفئة بنجاح",
            data: responseData,
        });

        // All background work in setImmediate - non-blocking
        setImmediate(async () => {
            try {
                await category.populate("section", "name");
                await category.populate("createdBy", "name");
            } catch (bgError) {
                Logger.error('Background tasks failed for createMenuCategory:', bgError);
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إنشاء الفئة",
            error: error.message,
        });
    }
};

// Update menu category
export const updateMenuCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, section, sortOrder, isActive } = req.body;

        const updateData = {
            updatedBy: req.user.id,
        };

        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;
        if (section !== undefined) updateData.section = section;
        if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
        if (isActive !== undefined) updateData.isActive = isActive;

        const category = await MenuCategory.findOneAndUpdate(
            { _id: id, organization: req.user.organization },
            updateData,
            { new: true, runValidators: true }
        );

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "الفئة غير موجودة",
            });
        }

        // Fire-and-forget Atlas write
        writeToAtlas('menucategories', 'upsert', category.toObject ? category.toObject() : category, { _id: category._id });

        // Prepare minimal response data
        const responseData = {
            _id: category._id,
            name: category.name,
            description: category.description,
            section: category.section,
            sortOrder: category.sortOrder,
            isActive: category.isActive,
            updatedAt: category.updatedAt,
        };

        // Return response IMMEDIATELY
        res.json({
            success: true,
            message: "تم تحديث الفئة بنجاح",
            data: responseData,
        });

        // All background work in setImmediate - non-blocking
        setImmediate(async () => {
            try {
                await category.populate("section", "name");
                await category.populate("createdBy", "name");
                await category.populate("updatedBy", "name");
            } catch (bgError) {
                Logger.error('Background tasks failed for updateMenuCategory:', bgError);
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث الفئة",
            error: error.message,
        });
    }
};

// Delete menu category
export const deleteMenuCategory = async (req, res) => {
    try {
        const { id } = req.params;

        // التحقق من وجود عناصر مرتبطة بهذه الفئة
        const itemsCount = await MenuItem.countDocuments({
            category: id,
            organization: req.user.organization,
        });

        if (itemsCount > 0) {
            return res.status(400).json({
                success: false,
                message: "لا يمكن حذف الفئة لأنها تحتوي على عناصر. يرجى حذف العناصر أولاً",
            });
        }

        const category = await MenuCategory.findOneAndDelete({
            _id: id,
            organization: req.user.organization,
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "الفئة غير موجودة",
            });
        }

        // Fire-and-forget Atlas write for delete
        writeToAtlas('menucategories', 'delete', null, { _id: category._id });

        // Return response IMMEDIATELY
        res.json({
            success: true,
            message: "تم حذف الفئة بنجاح",
        });

        // All background work in setImmediate - non-blocking
        setImmediate(async () => {
            try {
                // Background cleanup if needed
            } catch (bgError) {
                Logger.error('Background tasks failed for deleteMenuCategory:', bgError);
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في حذف الفئة",
            error: error.message,
        });
    }
};

