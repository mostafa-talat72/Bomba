import Reservation from "../models/Reservation.js";
import Table from "../models/Table.js";
import { getOrganizationId, organizationFilter } from "../utils/organization.js";
import Logger from "../middleware/logger.js";

// @desc    Get all reservations (with optional date filter)
// @route   GET /api/reservations
// @access  Private
export const getReservations = async (req, res) => {
    try {
        const { date, status } = req.query;
        const query = { ...organizationFilter(req.user) };

        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }

        if (status) {
            query.status = status;
        }

        const reservations = await Reservation.find(query)
            .populate("table", "number name section")
            .populate("createdBy", "name")
            .sort({ date: 1, time: 1 });

        res.json({
            success: true,
            data: reservations,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الحجوزات",
            error: error.message,
        });
    }
};

// @desc    Create a new reservation
// @route   POST /api/reservations
// @access  Private
export const createReservation = async (req, res) => {
    try {
        const { table, customerName, phone, date, time, guests, notes } = req.body;

        if (!table || !customerName || !date || !time) {
            return res.status(400).json({
                success: false,
                message: "بيانات الحجز غير مكتملة",
            });
        }

        // Check table exists and belongs to same org
        const tableDoc = await Table.findOne({ _id: table, ...organizationFilter(req.user) });
        if (!tableDoc) {
            return res.status(404).json({ success: false, message: "الطاولة غير موجودة" });
        }

        // Check for overlapping reservations (same table, same date, not cancelled/no_show)
        const reservationDate = new Date(date);
        reservationDate.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const overlapping = await Reservation.findOne({
            table,
            date: { $gte: reservationDate, $lte: endOfDay },
            status: { $in: ["confirmed", "seated"] },
            ...organizationFilter(req.user),
        });

        if (overlapping) {
            return res.status(409).json({
                success: false,
                message: "الطاولة محجوزة في هذا الوقت",
            });
        }

        // Set table to reserved
        tableDoc.status = "reserved";
        await tableDoc.save();

        const reservation = await Reservation.create({
            table,
            customerName,
            phone: phone || null,
            date: reservationDate,
            time,
            guests: guests || 2,
            notes: notes || null,
            organization: getOrganizationId(req.user),
            createdBy: req.user._id,
        });

        Logger.info(`✓ تم إنشاء حجز: ${customerName} - طاولة ${tableDoc.number} - ${date} ${time}`);

        const populated = await reservation.populate("table", "number name section");

        res.status(201).json({
            success: true,
            message: "تم إنشاء الحجز بنجاح",
            data: populated,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إنشاء الحجز",
            error: error.message,
        });
    }
};

// @desc    Seat a reservation (confirmed → seated)
// @route   POST /api/reservations/:id/seat
// @access  Private
export const seatReservation = async (req, res) => {
    try {
        const reservation = await Reservation.findOne({ _id: req.params.id, ...organizationFilter(req.user) });
        if (!reservation) {
            return res.status(404).json({ success: false, message: "الحجز غير موجود" });
        }

        if (reservation.status !== "confirmed") {
            return res.status(400).json({ success: false, message: "لا يمكن جلوس حجز غير مؤكد" });
        }

        reservation.status = "seated";
        reservation.updatedBy = req.user._id;
        await reservation.save();

        // Update table status to occupied
        const tableDoc = await Table.findOne({ _id: reservation.table, ...organizationFilter(req.user) });
        if (tableDoc) {
            tableDoc.status = "occupied";
            await tableDoc.save();
        }

        Logger.info(`✓ تم جلوس حجز: ${reservation.customerName} - طاولة ${tableDoc?.number}`);

        res.json({
            success: true,
            message: "تم جلوس الحجز",
            data: reservation,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلوس الحجز",
            error: error.message,
        });
    }
};

// @desc    Cancel a reservation
// @route   POST /api/reservations/:id/cancel
// @access  Private
export const cancelReservation = async (req, res) => {
    try {
        const reservation = await Reservation.findOne({ _id: req.params.id, ...organizationFilter(req.user) });
        if (!reservation) {
            return res.status(404).json({ success: false, message: "الحجز غير موجود" });
        }

        if (reservation.status === "cancelled" || reservation.status === "no_show") {
            return res.status(400).json({ success: false, message: "الحجز ملغى بالفعل" });
        }

        reservation.status = "cancelled";
        reservation.updatedBy = req.user._id;
        await reservation.save();

        // Free the table if it was reserved for this reservation
        const tableDoc = await Table.findOne({ _id: reservation.table, ...organizationFilter(req.user) });
        if (tableDoc && tableDoc.status === "reserved") {
            tableDoc.status = "empty";
            await tableDoc.save();
        }

        Logger.info(`✓ تم إلغاء حجز: ${reservation.customerName}`);

        res.json({
            success: true,
            message: "تم إلغاء الحجز",
            data: reservation,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إلغاء الحجز",
            error: error.message,
        });
    }
};

// @desc    Mark reservation as no-show
// @route   POST /api/reservations/:id/no-show
// @access  Private
export const markNoShow = async (req, res) => {
    try {
        const reservation = await Reservation.findOne({ _id: req.params.id, ...organizationFilter(req.user) });
        if (!reservation) {
            return res.status(404).json({ success: false, message: "الحجز غير موجود" });
        }

        if (reservation.status !== "confirmed") {
            return res.status(400).json({ success: false, message: "لا يمكن تحديد حجز كـ 'لم يحضر' إلا إذا كان مؤكد" });
        }

        reservation.status = "no_show";
        reservation.updatedBy = req.user._id;
        await reservation.save();

        // Free the table
        const tableDoc = await Table.findOne({ _id: reservation.table, ...organizationFilter(req.user) });
        if (tableDoc && tableDoc.status === "reserved") {
            tableDoc.status = "empty";
            await tableDoc.save();
        }

        res.json({
            success: true,
            message: "تم تحديد الحجز كـ 'لم يحضر'",
            data: reservation,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث الحجز",
            error: error.message,
        });
    }
};

// @desc    Auto-expire old reservations (cron or scheduled)
// @access  Internal
export const expireOldReservations = async (organizationId) => {
    try {
        const now = new Date();
        const expired = await Reservation.updateMany(
            {
                status: "confirmed",
                date: { $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
                ...(organizationId ? { organization: organizationId } : {}),
            },
            { $set: { status: "no_show" } }
        );

        if (expired.modifiedCount > 0) {
            Logger.info(`⏰ تم انتهاء ${expired.modifiedCount} حجوزات تلقائياً`);
        }

        return expired.modifiedCount;
    } catch (error) {
        Logger.error("خطأ في انتهاء الحجوزات التلقائية:", error);
        return 0;
    }
};
