import TableSection from "../models/TableSection.js";
import Table from "../models/Table.js";
import { createTombstone } from "../utils/tombstoneHelper.js";
import Logger from "../middleware/logger.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";

// Get all table sections
export const getAllTableSections = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(401).json({
                success: false,
                message: "يجب تسجيل الدخول للوصول إلى أقسام الطاولات",
            });
        }

        const sections = await TableSection.find({
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
            message: "خطأ في جلب أقسام الطاولات",
            error: error.message,
        });
    }
};

// Get table section by ID
export const getTableSectionById = async (req, res) => {
    try {
        const { id } = req.params;
        const section = await TableSection.findOne({
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

// Create new table section
export const createTableSection = async (req, res) => {
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

        const section = new TableSection(sectionData);
        await section.save();

        // Immediate dual-write to Atlas
        {
            const atlasConnection = dualDatabaseManager.getAtlasConnection();
            if (atlasConnection) {
                try {
                    const sectionObj = section.toObject ? section.toObject() : section;
                    await atlasConnection.collection('tablesections').updateOne(
                        { _id: section._id },
                        { $set: sectionObj },
                        { upsert: true }
                    );
                } catch (atlasErr) {
                    Logger.warn(`Atlas dual-write failed for tablesection create ${section._id}: ${atlasErr.message}`);
                }
            } else {
                Logger.warn("Atlas not available for tablesection create - will sync later");
            }
        }

        await section.populate("createdBy", "name");

        if (req.io) {
            try { req.io.notifyTableSectionUpdate("created", section, req.user.organization); } catch (e) {}
        }

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

// Update table section
export const updateTableSection = async (req, res) => {
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

        const section = await TableSection.findOneAndUpdate(
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

        // Immediate dual-write to Atlas
        {
            const atlasConnection = dualDatabaseManager.getAtlasConnection();
            if (atlasConnection) {
                try {
                    const sectionObj = section.toObject ? section.toObject({ depopulate: true }) : section;
                    await atlasConnection.collection('tablesections').updateOne(
                        { _id: section._id },
                        { $set: sectionObj },
                        { upsert: true }
                    );
                } catch (atlasErr) {
                    Logger.warn(`Atlas dual-write failed for tablesection update ${section._id}: ${atlasErr.message}`);
                }
            } else {
                Logger.warn("Atlas not available for tablesection update - will sync later");
            }
        }

        if (req.io) {
            try { req.io.notifyTableSectionUpdate("updated", section, req.user.organization); } catch (e) {}
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

// Delete table section
export const deleteTableSection = async (req, res) => {
    try {
        const { id } = req.params;

        // التحقق من وجود طاولات مرتبطة بهذا القسم
        const tablesCount = await Table.countDocuments({
            section: id,
            organization: req.user.organization,
        });

        if (tablesCount > 0) {
            return res.status(400).json({
                success: false,
                message: "لا يمكن حذف القسم لأنه يحتوي على طاولات. يرجى حذف الطاولات أولاً",
            });
        }

        const section = await TableSection.findOneAndDelete({
            _id: id,
            organization: req.user.organization,
        });

        if (!section) {
            return res.status(404).json({
                success: false,
                message: "القسم غير موجود",
            });
        }

        // Immediate dual-write delete to Atlas
        {
            const atlasConnection = dualDatabaseManager.getAtlasConnection();
            if (atlasConnection) {
                try {
                    await atlasConnection.collection('tablesections').deleteOne({ _id: section._id });
                } catch (atlasErr) {
                    Logger.warn(`Atlas dual-write failed for tablesection delete ${section._id}: ${atlasErr.message}`);
                }
            } else {
                Logger.warn("Atlas not available for tablesection delete - will sync later");
            }
        }

        try { await createTombstone('tablesections', section._id, req.user.organization, req.user._id); } catch (e) {}

        if (req.io) {
            try { req.io.notifyTableSectionUpdate("deleted", { _id: id }, req.user.organization); } catch (e) {}
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





