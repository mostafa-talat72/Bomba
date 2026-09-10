import mongoose from "mongoose";
import Shift from "../models/Shift.js";
import Bill from "../models/Bill.js";
import { logAudit } from "../utils/auditHelper.js";

const getOrgId = (req) => req.user.organization?._id || req.user.organization;
const deviceIdOf = (req) => req.headers?.["x-instance-id"] || null;

// Sum payments inside [from, to] grouped by method (single aggregation).
const summarizePayments = async (orgId, from, to) => {
    const rows = await Bill.aggregate([
        { $match: { organization: new mongoose.Types.ObjectId(orgId) } },
        { $unwind: "$payments" },
        {
            $match: {
                "payments.timestamp": { $gte: new Date(from), $lte: new Date(to) },
                "payments.amount": { $gt: 0 },
            },
        },
        {
            $group: {
                _id: "$payments.method",
                total: { $sum: "$payments.amount" },
                count: { $sum: 1 },
                bills: { $addToSet: "$_id" },
            },
        },
    ]);
    const byMethod = { cash: 0, card: 0, transfer: 0, other: 0 };
    let paymentsCount = 0;
    const billIds = new Set();
    for (const r of rows) {
        const method = ["cash", "card", "transfer"].includes(r._id) ? r._id : "other";
        byMethod[method] += r.total || 0;
        paymentsCount += r.count || 0;
        for (const id of r.bills || []) billIds.add(String(id));
    }
    return { byMethod, paymentsCount, billsCount: billIds.size };
};

// @desc    Get current open shift (if any)
// @route   GET /api/shifts/current
export const getCurrentShift = async (req, res) => {
    try {
        const shift = await Shift.findOne({ organization: getOrgId(req), status: "open" })
            .populate("openedBy", "name")
            .sort({ openedAt: -1 })
            .lean();
        res.json({ success: true, data: shift });
    } catch (error) {
        res.status(500).json({ success: false, message: "فشل جلب الوردية الحالية", error: error.message });
    }
};

// @desc    Open a new shift
// @route   POST /api/shifts/open  { openingCash?, notes? }
export const openShift = async (req, res) => {
    try {
        const orgId = getOrgId(req);
        const existing = await Shift.findOne({ organization: orgId, status: "open" });
        if (existing) {
            return res.status(400).json({ success: false, message: "توجد وردية مفتوحة بالفعل — أغلقها أولاً" });
        }
        const openingCash = Math.max(0, Number(req.body?.openingCash) || 0);
        const shift = await Shift.create({
            organization: orgId,
            openedBy: req.user._id,
            openedByName: req.user.name || null,
            openingCash,
            notes: req.body?.notes || null,
        });
        logAudit({
            action: "shift.opened", collection: "shifts", documentId: shift._id,
            user: req.user, organization: orgId, deviceId: deviceIdOf(req),
            details: { openingCash },
        }).catch(() => {});
        res.status(201).json({ success: true, message: "تم فتح الوردية", data: shift });
    } catch (error) {
        res.status(500).json({ success: false, message: "فشل فتح الوردية", error: error.message });
    }
};

// @desc    Close the open shift (computes expected vs actual)
// @route   POST /api/shifts/close  { actualCash, notes? }
export const closeShift = async (req, res) => {
    try {
        const orgId = getOrgId(req);
        const shift = await Shift.findOne({ organization: orgId, status: "open" });
        if (!shift) {
            return res.status(400).json({ success: false, message: "لا توجد وردية مفتوحة" });
        }
        const closedAt = new Date();
        const { byMethod, paymentsCount, billsCount } = await summarizePayments(orgId, shift.openedAt, closedAt);
        const actualCash = Number(req.body?.actualCash);
        if (!Number.isFinite(actualCash) || actualCash < 0) {
            return res.status(400).json({ success: false, message: "المبلغ الفعلي غير صالح" });
        }
        const expectedCash = (shift.openingCash || 0) + byMethod.cash;
        shift.status = "closed";
        shift.closedBy = req.user._id;
        shift.closedByName = req.user.name || null;
        shift.closedAt = closedAt;
        shift.expectedCash = Math.round(expectedCash * 100) / 100;
        shift.cashPayments = byMethod.cash;
        shift.cardPayments = byMethod.card;
        shift.transferPayments = byMethod.transfer;
        shift.otherPayments = byMethod.other;
        shift.paymentsCount = paymentsCount;
        shift.billsCount = billsCount;
        shift.actualCash = actualCash;
        shift.difference = Math.round((actualCash - expectedCash) * 100) / 100;
        if (req.body?.notes !== undefined) shift.notes = req.body.notes;
        await shift.save();
        logAudit({
            action: "shift.closed", collection: "shifts", documentId: shift._id,
            user: req.user, organization: orgId, deviceId: deviceIdOf(req),
            details: { expectedCash: shift.expectedCash, actualCash, difference: shift.difference, billsCount },
        }).catch(() => {});
        res.json({ success: true, message: "تم إغلاق الوردية", data: shift });
    } catch (error) {
        res.status(500).json({ success: false, message: "فشل إغلاق الوردية", error: error.message });
    }
};

// @desc    Shift history (closed first)
// @route   GET /api/shifts?page=&limit=
export const listShifts = async (req, res) => {
    try {
        const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const query = { organization: getOrgId(req) };
        const [total, shifts] = await Promise.all([
            Shift.countDocuments(query),
            Shift.find(query)
                .sort({ openedAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .populate("openedBy", "name")
                .populate("closedBy", "name")
                .lean(),
        ]);
        res.json({ success: true, data: shifts, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
    } catch (error) {
        res.status(500).json({ success: false, message: "فشل جلب الورديات", error: error.message });
    }
};
