import { getOrganizationId, organizationFilter } from '../utils/organization.js';
import MenuSection from "../models/MenuSection.js";
import MenuCategory from "../models/MenuCategory.js";
import MenuItem from "../models/MenuItem.js";
import { writeToAtlas } from "../utils/atlasWrite.js";
import Logger from "../middleware/logger.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";

// Get all menu sections
export const getAllMenuSections = async (req, res) => {
    try {
        if (!req.user || !getOrganizationId(req.user)) {
            return res.status(401).json({
                success: false,
                message: "يجب تسجيل الدخول للوصول إلى أقسام المنيو",
            });
        }

        const sections = await MenuSection.find({
            ...organizationFilter(req.user),
        })
            .sort({ sortOrder: 1, name: 1 })
            .populate("createdBy", "name")
            .populate("updatedBy", "name");

        res.json({
            success: true,
            count: sections.length,
            data: sections,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب أقسام المنيو",
            error: error.message,
        });
    }
};

// Get menu section by ID
export const getMenuSectionById = async (req, res) => {
    try {
        const { id } = req.params;
        const section = await MenuSection.findOne({
            _id: id,
            ...organizationFilter(req.user),
        })
            .populate("createdBy", "name")
            .populate("updatedBy", "name");

        if (!section) {
            return res.status(404).json({
                success: false,
                message: "القسم غير موجود",
            });
        }

        res.json({
            success: true,
            data: section,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب القسم",
            error: error.message,
        });
    }
};

// Create new menu section
export const createMenuSection = async (req, res) => {
    try {
        const { name, description, sortOrder } = req.body;

        if (!name || name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "اسم القسم مطلوب",
            });
        }

        const sectionData = {
            name: name.trim(),
            description: description?.trim() || null,
            sortOrder: sortOrder || 0,
            organization: getOrganizationId(req.user),
            createdBy: req.user.id,
        };

        const section = new MenuSection(sectionData);
        await section.save();

        // Fire-and-forget Atlas write
        writeToAtlas('menusections', 'upsert', section.toObject ? section.toObject() : section, { _id: section._id });

        // Prepare minimal response data
        const responseData = {
            _id: section._id,
            name: section.name,
            description: section.description,
            sortOrder: section.sortOrder,
            createdAt: section.createdAt,
        };

        // Return response IMMEDIATELY
        res.status(201).json({
            success: true,
            message: "تم إنشاء القسم بنجاح",
            data: responseData,
        });

        // All background work in setImmediate - non-blocking
        setImmediate(async () => {
            try {
                await section.populate("createdBy", "name");
            } catch (bgError) {
                Logger.error('Background tasks failed for createMenuSection:', bgError);
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إنشاء القسم",
            error: error.message,
        });
    }
};

// Update menu section
export const updateMenuSection = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, sortOrder, isActive } = req.body;

        const updateData = {
            updatedBy: req.user.id,
        };

        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;
        if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
        if (isActive !== undefined) updateData.isActive = isActive;

        const section = await MenuSection.findOneAndUpdate(
            { _id: id, ...organizationFilter(req.user) },
            updateData,
            { new: true, runValidators: true }
        );

        if (!section) {
            return res.status(404).json({
                success: false,
                message: "القسم غير موجود",
            });
        }

        // Fire-and-forget Atlas write
        writeToAtlas('menusections', 'upsert', section.toObject ? section.toObject() : section, { _id: section._id });

        // Prepare minimal response data
        const responseData = {
            _id: section._id,
            name: section.name,
            description: section.description,
            sortOrder: section.sortOrder,
            isActive: section.isActive,
            updatedAt: section.updatedAt,
        };

        // Return response IMMEDIATELY
        res.json({
            success: true,
            message: "تم تحديث القسم بنجاح",
            data: responseData,
        });

        // All background work in setImmediate - non-blocking
        setImmediate(async () => {
            try {
                await section.populate("createdBy", "name");
                await section.populate("updatedBy", "name");
            } catch (bgError) {
                Logger.error('Background tasks failed for updateMenuSection:', bgError);
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث القسم",
            error: error.message,
        });
    }
};

// Delete menu section
export const deleteMenuSection = async (req, res) => {
    try {
        const { id } = req.params;

        // التحقق من وجود فئات مرتبطة بهذا القسم
        const categoriesCount = await MenuCategory.countDocuments({
            section: id,
            ...organizationFilter(req.user),
        });

        if (categoriesCount > 0) {
            return res.status(400).json({
                success: false,
                message: "لا يمكن حذف القسم لأنه يحتوي على فئات. يرجى حذف الفئات أولاً",
            });
        }

        const section = await MenuSection.findOneAndDelete({
            _id: id,
            ...organizationFilter(req.user),
        });

        if (!section) {
            return res.status(404).json({
                success: false,
                message: "القسم غير موجود",
            });
        }

        // Fire-and-forget Atlas write for delete
        writeToAtlas('menusections', 'delete', null, { _id: section._id });

        // Return response IMMEDIATELY
        res.json({
            success: true,
            message: "تم حذف القسم بنجاح",
        });

        // All background work in setImmediate - non-blocking
        setImmediate(async () => {
            try {
                // Background cleanup if needed
            } catch (bgError) {
                Logger.error('Background tasks failed for deleteMenuSection:', bgError);
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في حذف القسم",
            error: error.message,
        });
    }
};
