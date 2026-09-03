import Bill from "../models/Bill.js";
import Table from "../models/Table.js";
import Logger from "../middleware/logger.js";

/**
 * Helper function to update table status based on unpaid bills (efficient: uses exists)
 * @param {ObjectId|Object} tableId - The table ID or table object to update
 * @param {ObjectId} organizationId - The organization ID for filtering bills
 * @param {Object} io - Socket.IO instance for emitting events (optional)
 * @returns {Promise<string|null>} The new table status or null if no table
 */
export async function updateTableStatusIfNeeded(tableId, organizationId, io = null) {
    if (!tableId) {
        return null;
    }

    const actualTableId = tableId._id || tableId;

    try {
        // Efficient: use exists instead of fetching all bills
        const hasUnpaid = await Bill.exists({
            table: actualTableId,
            status: { $in: ["draft", "partial", "overdue"] },
            organization: organizationId,
        });

        const newStatus = hasUnpaid ? "occupied" : "empty";

        await Table.findOneAndUpdate(
            { _id: actualTableId, organization: organizationId },
            { $set: { status: newStatus } }
        );

        Logger.info(
            `✓ Table status updated to '${newStatus}' for table: ${actualTableId} (${hasUnpaid ? 'has' : 'no'} unpaid bills)`
        );

        if (io) {
            const org = String(organizationId?._id || organizationId);
            const payload = { tableId: actualTableId, status: newStatus };
            if (typeof io.notifyTableStatusUpdate === "function") {
                io.notifyTableStatusUpdate(payload, organizationId);
            } else if (typeof io.to === "function" && organizationId) {
                io.to(`org:${org}`).to(`org-${org}`).emit("table-status-update", payload);
                io.to(`org:${org}`).to(`org-${org}`).emit("table:statusChanged", payload);
            } else {
                io.emit("table-status-update", payload);
            }
        }

        return newStatus;
    } catch (error) {
        Logger.error("خطأ في تحديث حالة الطاولة", error);
        return null;
    }
}

/**
 * Efficient batch fix for all table statuses.
 * For each table, checks Bill.exists({ table, status: { $in: ['draft','partial','overdue'] }, organization })
 * and corrects status via bulkWrite. Logs only if fixes needed when silentIfNoFix=true.
 *
 * @param {Object} options
 * @param {import('mongoose').Types.ObjectId|string|null} options.organizationId - filter by organization (optional)
 * @param {boolean} options.logResults - whether to log results
 * @param {boolean} options.silentIfNoFix - if true, log only when fixes were needed (for periodic job)
 * @returns {Promise<{total:number,fixed:number,occupied:number,empty:number,details:Array}>}
 */
export async function fixAllTableStatuses({ organizationId = null, logResults = true, silentIfNoFix = false } = {}) {
    try {
        const query = {};
        if (organizationId) query.organization = organizationId;

        const tables = await Table.find(query).select("_id number status organization").lean();

        if (tables.length === 0) {
            if (logResults && !silentIfNoFix) {
                Logger.info("🔧 Table status auto-fix: no tables found");
            }
            return { total: 0, fixed: 0, occupied: 0, empty: 0, details: [] };
        }

        const bulkOps = [];
        let occupied = 0;
        let empty = 0;
        const details = [];

        for (const table of tables) {
            // Efficient per-table check: exists instead of find
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
                });
            }
        }

        let fixed = 0;
        if (bulkOps.length > 0) {
            const result = await Table.bulkWrite(bulkOps);
            fixed = result.modifiedCount ?? bulkOps.length;
        }

        if (logResults) {
            const shouldLog = silentIfNoFix ? fixed > 0 : true;
            if (shouldLog) {
                if (fixed > 0) {
                    Logger.info(`🔧 Table status auto-fix: fixed ${fixed}/${tables.length} tables (occupied:${occupied} empty:${empty})`);
                    details.forEach((d) => {
                        Logger.info(`  ✓ Table ${d.number} (${d.tableId}) ${d.oldStatus} -> ${d.newStatus}`);
                    });
                } else {
                    Logger.info(`✅ Table status auto-fix: all ${tables.length} tables correct (occupied:${occupied} empty:${empty})`);
                }
            }
        }

        return { total: tables.length, fixed, occupied, empty, details };
    } catch (error) {
        Logger.error("❌ Table status auto-fix failed:", error.message);
        throw error;
    }
}

export default { updateTableStatusIfNeeded, fixAllTableStatuses };
