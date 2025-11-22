import MenuSection from "../models/MenuSection.js";
import MenuCategory from "../models/MenuCategory.js";
import MenuItem from "../models/MenuItem.js";

// Get all menu sections
export const getAllMenuSections = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(401).json({
                success: false,
                message: "يجب تسجيل الدخول للوصول إلى أقسام المنيو",
            });
        }

        const sections = await MenuSection.find({
            organization: req.user.organization,
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
            organization: req.user.organization,
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
            organization: req.user.organization,
            createdBy: req.user.id,
        };

        const section = new MenuSection(sectionData);
        await section.save();

        await section.populate("createdBy", "name");

        res.status(201).json({
            success: true,
            message: "تم إنشاء القسم بنجاح",
            data: section,
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
            { _id: id, organization: req.user.organization },
            updateData,
            { new: true, runValidators: true }
        )
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
            message: "تم تحديث القسم بنجاح",
            data: section,
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
            organization: req.user.organization,
        });

        if (categoriesCount > 0) {
            return res.status(400).json({
                success: false,
                message: "لا يمكن حذف القسم لأنه يحتوي على فئات. يرجى حذف الفئات أولاً",
            });
        }

        const section = await MenuSection.findOneAndDelete({
            _id: id,
            organization: req.user.organization,
        });

        if (!section) {
            return res.status(404).json({
                success: false,
                message: "القسم غير موجود",
            });
        }

        res.json({
            success: true,
            message: "تم حذف القسم بنجاح",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في حذف القسم",
            error: error.message,
        });
    }
};

