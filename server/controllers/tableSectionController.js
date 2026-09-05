import { getOrganizationId, organizationFilter } from '../utils/organization.js';
import TableSection from "../models/TableSection.js";
import Table from "../models/Table.js";
import { writeToAtlas } from "../utils/atlasWrite.js";
import Logger from "../middleware/logger.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";

// Get all table sections
export const getAllTableSections = async (req, res) => {
    try {
        if (!req.user || !getOrganizationId(req.user)) {
            return res.status(401).json({
                success: false,
                message: "يجب تسجيل الدخول للوصول إلى أقسام الطاولات",
            });
        }

        const sections = await TableSection.find({
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
            organization: getOrganizationId(req.user),
            createdBy: req.user.id,
        };

        const section = new TableSection(sectionData);
        await section.save();

        // Fire-and-forget Atlas write
        writeToAtlas('tablesections', 'upsert', section.toObject ? section.toObject() : section, { _id: section._id });

        // ── Real-time emit (<50ms) — before response ──
        if (req.io) {
            try {
                const orgId = getOrganizationId(req.user);
                const orgStr = String(orgId);
                req.io.to(`org:${orgStr}`).to(`org-${orgStr}`).emit('table-section-update', { type: 'created', section });
                req.io.to(`org:${orgStr}`).to(`org-${orgStr}`).emit('tableSection:created', section);
                req.io.to(`org:${orgStr}`).to(`org-${orgStr}`).emit('tableSection:updated', section);
                try { req.io.notifyTableSectionUpdate("created", section, getOrganizationId(req.user)); } catch {}
            } catch {}
        }

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

                if (req.io) {
                    try { req.io.notifyTableSectionUpdate("created", section, getOrganizationId(req.user)); } catch (e) {}
                }
            } catch (bgError) {
                Logger.error('Background tasks failed for createTableSection:', bgError);
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
        writeToAtlas('tablesections', 'upsert', section.toObject ? section.toObject() : section, { _id: section._id });

        // ── Real-time emit (<50ms) ──
        if (req.io) {
            try {
                const orgId = getOrganizationId(req.user);
                const orgStr = String(orgId);
                req.io.to(`org:${orgStr}`).to(`org-${orgStr}`).emit('table-section-update', { type: 'updated', section });
                req.io.to(`org:${orgStr}`).to(`org-${orgStr}`).emit('tableSection:updated', section);
                try { req.io.notifyTableSectionUpdate("updated", section, getOrganizationId(req.user)); } catch {}
            } catch {}
        }

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

                if (req.io) {
                    try { req.io.notifyTableSectionUpdate("updated", section, getOrganizationId(req.user)); } catch (e) {}
                }
            } catch (bgError) {
                Logger.error('Background tasks failed for updateTableSection:', bgError);
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

// Delete table section
export const deleteTableSection = async (req, res) => {
    try {
        const { id } = req.params;

        // التحقق من وجود طاولات مرتبطة بهذا القسم
        const tablesCount = await Table.countDocuments({
            section: id,
            ...organizationFilter(req.user),
        });

        if (tablesCount > 0) {
            return res.status(400).json({
                success: false,
                message: "لا يمكن حذف القسم لأنه يحتوي على طاولات. يرجى حذف الطاولات أولاً",
            });
        }

        const section = await TableSection.findOneAndDelete({
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
        writeToAtlas('tablesections', 'delete', null, { _id: section._id });

        // ── Real-time emit (<50ms) ──
        if (req.io) {
            try {
                const orgId = getOrganizationId(req.user);
                const orgStr = String(orgId);
                req.io.to(`org:${orgStr}`).to(`org-${orgStr}`).emit('table-section-update', { type: 'deleted', section: { _id: id } });
                req.io.to(`org:${orgStr}`).to(`org-${orgStr}`).emit('tableSection:deleted', { _id: id });
                try { req.io.notifyTableSectionUpdate("deleted", { _id: id }, getOrganizationId(req.user)); } catch {}
            } catch {}
        }

        // Return response IMMEDIATELY
        res.json({
            success: true,
            message: "تم حذف القسم بنجاح",
        });

        // All background work in setImmediate - non-blocking
        setImmediate(async () => {
            try {
                if (req.io) {
                    try { req.io.notifyTableSectionUpdate("deleted", { _id: id }, getOrganizationId(req.user)); } catch (e) {}
                }
            } catch (bgError) {
                Logger.error('Background tasks failed for deleteTableSection:', bgError);
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


