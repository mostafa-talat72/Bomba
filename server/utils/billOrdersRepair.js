import mongoose from "mongoose";
import Logger from "../middleware/logger.js";

/**
 * إصلاح تلقائي: يحول bill.orders و bill.sessions و bill.table المدمجة كـ objects إلى ObjectIds + يزيل التكرار
 * لا يضيف ولا يحذف روابط — فقط تطبيع
 */

let isRunning = false;
let lastRunAt = null;

export const runBillOrdersAutoRepair = async ({ silent = false, dryRun = false } = {}) => {
    if (isRunning) {
        if (!silent) Logger.info("🔧 billOrdersRepair: already running, skipping");
        return { skipped: true };
    }
    isRunning = true;
    const started = Date.now();
    try {
        const Bill = (await import("../models/Bill.js")).default;

        let normalizedCount = 0;
        let dedupedCount = 0;
        let normalizedSessionsCount = 0;
        let dedupedSessionsCount = 0;
        let normalizedTableCount = 0;
        const affectedBillIds = new Set();

        // ── المرحلة 1: تطبيع bill.orders + bill.sessions + bill.table (object → ObjectId) وإزالة التكرار
        const bills = await Bill.collection.find({}, { projection: { orders: 1, sessions: 1, table: 1 } }).toArray();
        const bulkNormalize = [];
        for (const bill of bills) {
            let changed = false;
            // orders
            let normalizedOrders = bill.orders;
            if (bill.orders && Array.isArray(bill.orders) && bill.orders.length > 0) {
                const seen = new Set();
                normalizedOrders = [];
                for (const elem of bill.orders) {
                    let id = null;
                    if (elem instanceof mongoose.Types.ObjectId) {
                        id = elem;
                    } else if (elem && typeof elem === "object" && elem._bsontype === "ObjectID") {
                        id = elem;
                    } else if (elem && typeof elem === "object" && elem._id) {
                        id = elem._id;
                        changed = true;
                        normalizedCount++;
                    } else if (elem && typeof elem === "object" && elem.$oid) {
                        id = new mongoose.Types.ObjectId(elem.$oid);
                        changed = true;
                    } else if (typeof elem === "string" && mongoose.Types.ObjectId.isValid(elem)) {
                        id = new mongoose.Types.ObjectId(elem);
                        changed = true;
                    } else {
                        try { if (mongoose.Types.ObjectId.isValid(elem)) id = new mongoose.Types.ObjectId(String(elem)); else id = elem; } catch { id = elem; }
                    }
                    if (!id) continue;
                    const str = String(id);
                    if (seen.has(str)) { dedupedCount++; changed = true; continue; }
                    seen.add(str);
                    try { id = new mongoose.Types.ObjectId(str); } catch {}
                    normalizedOrders.push(id);
                }
            }
            // sessions
            let normalizedSessions = bill.sessions;
            if (bill.sessions && Array.isArray(bill.sessions) && bill.sessions.length > 0) {
                const seen = new Set();
                normalizedSessions = [];
                for (const elem of bill.sessions) {
                    let id = null;
                    if (elem instanceof mongoose.Types.ObjectId) {
                        id = elem;
                    } else if (elem && typeof elem === "object" && elem._bsontype === "ObjectID") {
                        id = elem;
                    } else if (elem && typeof elem === "object" && elem._id) {
                        id = elem._id;
                        changed = true;
                        normalizedSessionsCount++;
                    } else if (elem && typeof elem === "object" && elem.$oid) {
                        id = new mongoose.Types.ObjectId(elem.$oid);
                        changed = true;
                    } else if (typeof elem === "string" && mongoose.Types.ObjectId.isValid(elem)) {
                        id = new mongoose.Types.ObjectId(elem);
                        changed = true;
                    } else {
                        try { if (mongoose.Types.ObjectId.isValid(elem)) id = new mongoose.Types.ObjectId(String(elem)); else id = elem; } catch { id = elem; }
                    }
                    if (!id) continue;
                    const str = String(id);
                    if (seen.has(str)) { dedupedSessionsCount++; changed = true; continue; }
                    seen.add(str);
                    try { id = new mongoose.Types.ObjectId(str); } catch {}
                    normalizedSessions.push(id);
                }
            }
            // table
            let normalizedTable = bill.table;
            if (bill.table && typeof bill.table === "object" && bill.table._id) {
                normalizedTable = bill.table._id;
                normalizedTableCount++;
            }
            if (changed) {
                const updateDoc = {};
                if (normalizedOrders !== bill.orders) updateDoc.orders = normalizedOrders;
                if (normalizedSessions !== bill.sessions) updateDoc.sessions = normalizedSessions;
                if (normalizedTable !== bill.table) updateDoc.table = normalizedTable;
                if (Object.keys(updateDoc).length > 0) {
                    bulkNormalize.push({
                        updateOne: {
                            filter: { _id: bill._id },
                            update: { $set: updateDoc },
                        },
                    });
                    affectedBillIds.add(String(bill._id));
                }
            }
        }
        if (bulkNormalize.length > 0 && !dryRun) {
            // لا نلمس updatedAt — إصلاح صامت لا يغيّر توقيت الفاتورة
            const CHUNK = 500;
            for (let i = 0; i < bulkNormalize.length; i += CHUNK) {
                await Bill.collection.bulkWrite(bulkNormalize.slice(i, i + CHUNK), { ordered: false });
            }
        }

        const duration = Date.now() - started;
        lastRunAt = new Date();
        const result = {
            normalized: normalizedCount,
            deduped: dedupedCount,
            normalizedSessions: normalizedSessionsCount,
            dedupedSessions: dedupedSessionsCount,
            normalizedTable: normalizedTableCount,
            affectedBills: affectedBillIds.size,
            billsFixed: bulkNormalize.length,
            durationMs: duration,
            dryRun,
        };
        if (!silent) {
            if (result.billsFixed > 0) {
                Logger.info(`✅ billOrdersRepair done in ${duration}ms`, result);
            } else if (!silent) {
                Logger.info(`✅ billOrdersRepair: no changes needed (${duration}ms)`);
            }
        }
        return result;
    } catch (e) {
        Logger.error("❌ billOrdersRepair failed:", e.message);
        throw e;
    } finally {
        isRunning = false;
    }
};

export const getBillOrdersRepairStatus = () => ({ isRunning, lastRunAt });

// تشغيل دوري كل ساعة (اختياري)
let intervalId = null;
export const scheduleBillOrdersRepair = (intervalMs = 60 * 60 * 1000) => {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
        runBillOrdersAutoRepair({ silent: false }).catch(() => {});
    }, intervalMs);
    if (intervalId.unref) intervalId.unref();
    return intervalId;
};