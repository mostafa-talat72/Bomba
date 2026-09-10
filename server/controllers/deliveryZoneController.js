import DeliveryZone from "../models/DeliveryZone.js";
import { getOrganizationId } from "../utils/organization.js";

// @desc    List delivery zones
// @route   GET /api/delivery-zones
export const getDeliveryZones = async (req, res) => {
    try {
        const zones = await DeliveryZone.find({ organization: getOrganizationId(req.user), isActive: true }).sort({ name: 1 }).lean();
        res.json({ success: true, data: zones });
    } catch (error) {
        res.status(500).json({ success: false, message: "فشل جلب مناطق التوصيل", error: error.message });
    }
};

// @desc    Create delivery zone
// @route   POST /api/delivery-zones
export const createDeliveryZone = async (req, res) => {
    try {
        const { name, fee } = req.body;
        if (!name || !String(name).trim()) {
            return res.status(400).json({ success: false, message: "اسم المنطقة مطلوب" });
        }
        const zone = await DeliveryZone.create({
            name: String(name).trim(),
            fee: Math.max(0, Number(fee) || 0),
            organization: getOrganizationId(req.user),
            createdBy: req.user._id,
        });
        if (req.io) req.io.notifyBillUpdate("delivery-zones-changed", zone, getOrganizationId(req.user));
        try { req.io?.emit?.("delivery-zones-changed", { _id: zone._id, name: zone.name, fee: zone.fee }); } catch {}
        res.status(201).json({ success: true, data: zone });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "المنطقة موجودة بالفعل" });
        }
        res.status(500).json({ success: false, message: "فشل إنشاء المنطقة", error: error.message });
    }
};

// @desc    Delete delivery zone
// @route   DELETE /api/delivery-zones/:id
export const deleteDeliveryZone = async (req, res) => {
    try {
        const zone = await DeliveryZone.findOneAndDelete({ _id: req.params.id, organization: getOrganizationId(req.user) });
        if (!zone) return res.status(404).json({ success: false, message: "المنطقة غير موجودة" });
        if (req.io) req.io.notifyBillUpdate("delivery-zones-changed", zone, getOrganizationId(req.user));
        try { req.io?.emit?.("delivery-zones-changed", { _id: zone._id, deleted: true }); } catch {}
        res.json({ success: true, message: "تم حذف المنطقة" });
    } catch (error) {
        res.status(500).json({ success: false, message: "فشل حذف المنطقة", error: error.message });
    }
};
