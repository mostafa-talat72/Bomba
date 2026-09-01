import Table from "../models/Table.js";
import Order from "../models/Order.js";
import Bill from "../models/Bill.js";
import { writeToAtlas } from "../utils/atlasWrite.js";
import Logger from "../middleware/logger.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";

// Get all tables
export const getAllTables = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(401).json({
                success: false,
                message: "يجب تسجيل الدخول للوصول إلى الطاولات",
            });
        }

        const { section } = req.query;
        const query = {
            organization: req.user.organization,
        };

        if (section) {
            query.section = section;
        }

        const tables = await Table.find(query)
            .populate("section", "name")
            .populate("createdBy", "name")
            .populate("updatedBy", "name")
            .sort({ section: 1, number: 1 });

        res.json({
            success: true,
            count: tables.length,
            data: tables,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الطاولات",
            error: error.message,
        });
    }
};

// Get table by ID
export const getTableById = async (req, res) => {
    try {
        const { id } = req.params;
        const table = await Table.findOne({
            _id: id,
            organization: req.user.organization,
        })
            .populate("section", "name")
            .populate("createdBy", "name")
            .populate("updatedBy", "name");

        if (!table) {
            return res.status(404).json({
                success: false,
                message: "الطاولة غير موجودة",
            });
        }

        res.json({
            success: true,
            data: table,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الطاولة",
            error: error.message,
        });
    }
};

// Get table status (whether it has unpaid orders)
export const getTableStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const table = await Table.findOne({
            _id: id,
            organization: req.user.organization,
        });

        if (!table) {
            return res.status(404).json({
                success: false,
                message: "الطاولة غير موجودة",
            });
        }

        // Find all orders for this table that are not cancelled
        const orders = await Order.find({
            table: table._id,
            organization: req.user.organization,
            status: { $ne: "cancelled" },
        })
        .populate({
            path: "bill",
            select: "status billNumber total paid remaining"
        })
        .populate("table", "number name");
        
        // Also check for orders with tableNumber (old format) - for backward compatibility
        const oldFormatOrders = await Order.find({
            tableNumber: table.number,
            organization: req.user.organization,
            status: { $ne: "cancelled" },
        })
        .populate({
            path: "bill",
            select: "status billNumber total paid remaining"
        });
        
        // Combine both old and new format orders
        const allOrders = [...orders, ...oldFormatOrders];

        // Find all bills (including playstation bills) linked to this table
        const bills = await Bill.find({
            table: table._id,
            organization: req.user.organization,
            status: { $nin: ["paid", "cancelled"] },
        }).populate({
            path: "sessions",
            select: "status deviceType"
        });

        // Also check for bills with tableNumber (old format)
        const oldFormatBills = await Bill.find({
            tableNumber: table.number,
            organization: req.user.organization,
            status: { $nin: ["paid", "cancelled"] },
        }).populate({
            path: "sessions",
            select: "status deviceType"
        });

        const allBills = [...bills, ...oldFormatBills];

        // Check if any order has an unpaid bill
        let hasUnpaidOrders = false;
        const tableOrders = [];

        for (const order of allOrders) {
            if (order.bill) {
                // Bill is populated, check status directly
                const bill = order.bill;
                if (bill && bill.status && bill.status !== "paid") {
                    hasUnpaidOrders = true;
                    // Only include order if bill is not paid
                    tableOrders.push(order);
                }
                // If bill is paid, don't include the order
            } else {
                // If order has no bill, consider it unpaid and include it
                hasUnpaidOrders = true;
                tableOrders.push(order);
            }
        }

        // Check if any bill (including playstation) linked to this table is unpaid
        for (const bill of allBills) {
            if (bill.status !== "paid" && bill.status !== "cancelled") {
                hasUnpaidOrders = true;
            }
        }

        res.json({
            success: true,
            data: {
                table,
                hasUnpaidOrders,
                orders: tableOrders,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب حالة الطاولة",
            error: error.message,
        });
    }
};

// Create new table
export const createTable = async (req, res) => {
    try {
        const { number, section } = req.body;

        // Validate that number/name is provided
        if (!number || (typeof number === 'string' && number.trim() === '')) {
            return res.status(400).json({
                success: false,
                message: "رقم/اسم الطاولة مطلوب",
            });
        }

        if (!section) {
            return res.status(400).json({
                success: false,
                message: "القسم مطلوب",
            });
        }

        // Check if table number already exists in this section
        const existingTable = await Table.findOne({
            number,
            section,
            organization: req.user.organization,
        });

        if (existingTable) {
            return res.status(400).json({
                success: false,
                message: "رقم/اسم الطاولة موجود بالفعل في هذا القسم",
            });
        }

        // Keep the number as is (text or number)
        const tableData = {
            number: typeof number === 'string' ? number.trim() : number,
            section,
            organization: req.user.organization,
            createdBy: req.user.id,
        };


        const table = new Table(tableData);
        await table.save();

        // Fire-and-forget Atlas write
        writeToAtlas('tables', 'upsert', table.toObject ? table.toObject() : table, { _id: table._id });

        // ── Real-time emit (<100ms) — before response ──
        if (req.io) {
            try {
                const orgId = req.user.organization?._id || req.user.organization;
                const orgStr = String(orgId);
                req.io.to(`org:${orgStr}`).to(`org-${orgStr}`).emit('table:created', table);
                req.io.to(`org:${orgStr}`).to(`org-${orgStr}`).emit('table:updated', table);
                try { req.io.notifyTableUpdate("created", table, req.user.organization); } catch {}
            } catch {}
        }

        // Prepare minimal response data
        const responseData = {
            _id: table._id,
            number: table.number,
            section: table.section,
            status: table.status,
            createdAt: table.createdAt,
        };

        // Return response IMMEDIATELY
        res.status(201).json({
            success: true,
            message: "تم إنشاء الطاولة بنجاح",
            data: responseData,
        });

        // All background work in setImmediate - non-blocking
        setImmediate(async () => {
            try {
                await table.populate("section", "name");
                await table.populate("createdBy", "name");

                if (req.io) {
                    try { req.io.notifyTableUpdate("created", table, req.user.organization); } catch (e) {}
                }
            } catch (bgError) {
                Logger.error('Background tasks failed for createTable:', bgError);
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إنشاء الطاولة",
            error: error.message,
        });
    }
};

// Update table
export const updateTable = async (req, res) => {
    try {
        const { id } = req.params;
        const { number, section, isActive } = req.body;

        const updateData = {
            updatedBy: req.user.id,
        };

        if (number !== undefined) {
            // Keep the number as is (text or number)
            updateData.number = typeof number === 'string' ? number.trim() : number;
        }
        if (section !== undefined) {
            updateData.section = section;
        }
        if (isActive !== undefined) {
            updateData.isActive = isActive;
        }

        // If number or section is being updated, check for duplicates
        if (number !== undefined || section !== undefined) {
            const table = await Table.findById(id);
            if (!table) {
                return res.status(404).json({
                    success: false,
                    message: "الطاولة غير موجودة",
                });
            }

            const finalNumber = number !== undefined ? (typeof number === 'string' ? number.trim() : number) : table.number;
            const finalSection = section !== undefined ? section : table.section;

            const existingTable = await Table.findOne({
                _id: { $ne: id },
                number: finalNumber,
                section: finalSection,
                organization: req.user.organization,
            });

            if (existingTable) {
                return res.status(400).json({
                    success: false,
                    message: "رقم/اسم الطاولة موجود بالفعل في هذا القسم",
                });
            }
        }

        const table = await Table.findOneAndUpdate(
            { _id: id, organization: req.user.organization },
            updateData,
            { new: true, runValidators: true }
        );

        if (!table) {
            return res.status(404).json({
                success: false,
                message: "الطاولة غير موجودة",
            });
        }

        // Fire-and-forget Atlas write
        writeToAtlas('tables', 'upsert', table.toObject ? table.toObject() : table, { _id: table._id });

        // ── Real-time emit (<100ms) ──
        if (req.io) {
            try {
                const orgId = req.user.organization?._id || req.user.organization;
                const orgStr = String(orgId);
                req.io.to(`org:${orgStr}`).to(`org-${orgStr}`).emit('table:updated', table);
                try { req.io.notifyTableUpdate("updated", table, req.user.organization); } catch {}
            } catch {}
        }

        // Prepare minimal response data
        const responseData = {
            _id: table._id,
            number: table.number,
            section: table.section,
            status: table.status,
            isActive: table.isActive,
            updatedAt: table.updatedAt,
        };

        // Return response IMMEDIATELY
        res.json({
            success: true,
            message: "تم تحديث الطاولة بنجاح",
            data: responseData,
        });

        // All background work in setImmediate - non-blocking
        setImmediate(async () => {
            try {
                await table.populate("section", "name");
                await table.populate("createdBy", "name");
                await table.populate("updatedBy", "name");

                if (req.io) {
                    try { req.io.notifyTableUpdate("updated", table, req.user.organization); } catch (e) {}
                }
            } catch (bgError) {
                Logger.error('Background tasks failed for updateTable:', bgError);
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث الطاولة",
            error: error.message,
        });
    }
};

// Delete table
export const deleteTable = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if table has active orders
        const table = await Table.findById(id);
        if (!table) {
            return res.status(404).json({
                success: false,
                message: "الطاولة غير موجودة",
            });
        }

        const activeOrders = await Order.countDocuments({
            table: table._id,
            organization: req.user.organization,
            status: { $ne: "cancelled" },
        });

        if (activeOrders > 0) {
            return res.status(400).json({
                success: false,
                message: "لا يمكن حذف الطاولة لأنها تحتوي على طلبات نشطة",
            });
        }

        const deletedTable = await Table.findOneAndDelete({
            _id: id,
            organization: req.user.organization,
        });

        if (!deletedTable) {
            return res.status(404).json({
                success: false,
                message: "الطاولة غير موجودة",
            });
        }

        // Fire-and-forget Atlas write for delete
        writeToAtlas('tables', 'delete', null, { _id: deletedTable._id });

        // ── Real-time emit (<100ms) ──
        if (req.io) {
            try {
                const orgId = req.user.organization?._id || req.user.organization;
                const orgStr = String(orgId);
                req.io.to(`org:${orgStr}`).to(`org-${orgStr}`).emit('table:deleted', { _id: id });
                req.io.to(`org:${orgStr}`).to(`org-${orgStr}`).emit('table:updated', { _id: id, _deleted: true });
                try { req.io.notifyTableUpdate("deleted", { _id: id }, req.user.organization); } catch {}
            } catch {}
        }

        // Return response IMMEDIATELY
        res.json({
            success: true,
            message: "تم حذف الطاولة بنجاح",
        });

        // All background work in setImmediate - non-blocking
        setImmediate(async () => {
            try {
                if (req.io) {
                    try { req.io.notifyTableUpdate("deleted", { _id: id }, req.user.organization); } catch (e) {}
                }
            } catch (bgError) {
                Logger.error('Background tasks failed for deleteTable:', bgError);
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في حذف الطاولة",
            error: error.message,
        });
    }
};

// Fix table statuses - one-time correction for stuck tables (admin only)
// Also reused by auto-fix jobs; efficient: uses Bill.exists + bulkWrite
export const fixTableStatuses = async (req, res) => {
    try {
        const tables = await Table.find({ organization: req.user.organization }).select("_id number status organization").lean();

        let occupied = 0;
        let empty = 0;
        const details = [];
        const bulkOps = [];
        const emitQueue = [];

        for (const table of tables) {
            // Efficient: use exists instead of fetching all bills
            const hasUnpaid = await Bill.exists({
                table: table._id,
                status: { $in: ["draft", "partial", "overdue"] },
                organization: table.organization,
            });

            const newStatus = hasUnpaid ? "occupied" : "empty";

            if (newStatus === "occupied") occupied++;
            else empty++;

            if (table.status !== newStatus) {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: table._id },
                        update: { $set: { status: newStatus } },
                    },
                });
                details.push({
                    tableId: table._id,
                    number: table.number,
                    oldStatus: table.status,
                    newStatus,
                    hasUnpaid: !!hasUnpaid,
                });
                emitQueue.push({ tableId: table._id, status: newStatus });
                Logger.info(`✓ Table ${table.number} status fixed: ${table.status} -> ${newStatus} (${hasUnpaid ? 'has unpaid' : 'no unpaid'})`);
            }
        }

        let fixed = 0;
        if (bulkOps.length > 0) {
            const result = await Table.bulkWrite(bulkOps);
            fixed = result.modifiedCount ?? bulkOps.length;

            // Emit updates for fixed tables — scoped to org, both event names
            if (req.io) {
                const orgId = req.user.organization?._id || req.user.organization;
                const orgStr = orgId ? String(orgId) : null;
                for (const e of emitQueue) {
                    try {
                        const payload = { tableId: e.tableId, status: e.status };
                        if (orgStr) {
                            req.io.to(`org:${orgStr}`).to(`org-${orgStr}`).emit("table-status-update", payload);
                            req.io.to(`org:${orgStr}`).to(`org-${orgStr}`).emit("table:statusChanged", payload);
                            try { req.io.notifyTableStatusUpdate(payload, req.user.organization); } catch {}
                        } else {
                            req.io.emit("table-status-update", payload);
                        }
                    } catch (_) {}
                }
            }
        }

        res.json({
            success: true,
            message: `تم إصلاح ${fixed} من أصل ${tables.length} طاولة`,
            data: {
                total: tables.length,
                fixed,
                occupied,
                empty,
                details,
            },
        });
    } catch (error) {
        Logger.error("خطأ في إصلاح حالات الطاولات", error);
        res.status(500).json({
            success: false,
            message: "خطأ في إصلاح حالات الطاولات",
            error: error.message,
        });
    }
};



