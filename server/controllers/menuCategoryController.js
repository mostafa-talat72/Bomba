import MenuCategory from "../models/MenuCategory.js";
import MenuItem from "../models/MenuItem.js";
import { createTombstone } from "../utils/tombstoneHelper.js";
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

        // Immediate dual-write to Atlas
        {
            const atlasConnection = dualDatabaseManager.getAtlasConnection();
            if (atlasConnection) {
                try {
                    const categoryObj = category.toObject ? category.toObject() : category;
                    await atlasConnection.collection('menucategories').updateOne(
                        { _id: category._id },
                        { $set: categoryObj },
                        { upsert: true }
                    );
                } catch (atlasErr) {
                    Logger.warn(`Atlas dual-write failed for menuCategory create ${category._id}: ${atlasErr.message}`);
                }
            } else {
                Logger.warn("Atlas not available for menuCategory create - will sync later");
            }
        }

        await category.populate("section", "name");
        await category.populate("createdBy", "name");

        res.status(201).json({
            success: true,
            message: "تم إنشاء الفئة بنجاح",
            data: category,
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
        )
            .populate("section", "name")
            .populate("createdBy", "name")
            .populate("updatedBy", "name");

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "الفئة غير موجودة",
            });
        }

        // Immediate dual-write to Atlas
        {
            const atlasConnection = dualDatabaseManager.getAtlasConnection();
            if (atlasConnection) {
                try {
                    const categoryObj = category.toObject ? category.toObject({ depopulate: true }) : category;
                    await atlasConnection.collection('menucategories').updateOne(
                        { _id: category._id },
                        { $set: categoryObj },
                        { upsert: true }
                    );
                } catch (atlasErr) {
                    Logger.warn(`Atlas dual-write failed for menuCategory update ${category._id}: ${atlasErr.message}`);
                }
            } else {
                Logger.warn("Atlas not available for menuCategory update - will sync later");
            }
        }

        res.json({
            success: true,
            message: "تم تحديث الفئة بنجاح",
            data: category,
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

        // Immediate dual-write delete to Atlas
        {
            const atlasConnection = dualDatabaseManager.getAtlasConnection();
            if (atlasConnection) {
                try {
                    await atlasConnection.collection('menucategories').deleteOne({ _id: category._id });
                } catch (atlasErr) {
                    Logger.warn(`Atlas dual-write failed for menuCategory delete ${category._id}: ${atlasErr.message}`);
                }
            } else {
                Logger.warn("Atlas not available for menuCategory delete - will sync later");
            }
        }

        try { await createTombstone('menucategories', category._id, req.user.organization, req.user._id); } catch (e) {}

        res.json({
            success: true,
            message: "تم حذف الفئة بنجاح",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في حذف الفئة",
            error: error.message,
        });
    }
};

