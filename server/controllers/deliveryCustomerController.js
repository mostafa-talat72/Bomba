import DeliveryCustomer from "../models/DeliveryCustomer.js";
import { organizationFilter } from "../utils/organization.js";

function digits(phone) {
    return String(phone || "").replace(/\D/g, "");
}

// GET /api/delivery-customers/search?q=011...
export const searchDeliveryCustomers = async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();
        if (!q || q.length < 2) {
            return res.json({ success: true, data: [] });
        }
        const d = digits(q);
        const query = { ...organizationFilter(req.user) };
        if (d.length >= 2) {
            // رقم أو جزء منه + اسم/عنوان بالبحث النصي
            const or = [{ phoneDigits: { $regex: d } }];
            if (q.length >= 2) {
                // نص: اسم/عنوان (case-insensitive)
                const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                or.push({ customerName: { $regex: escaped, $options: "i" } });
                or.push({ address: { $regex: escaped, $options: "i" } });
            }
            query.$or = or;
        } else {
            const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query.$or = [
                { customerName: { $regex: escaped, $options: "i" } },
                { address: { $regex: escaped, $options: "i" } },
            ];
        }
        const docs = await DeliveryCustomer.find(query).sort({ updatedAt: -1 }).limit(8).lean();
        res.json({ success: true, data: docs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const listDeliveryCustomers = async (req, res) => {
    try {
        const docs = await DeliveryCustomer.find({ ...organizationFilter(req.user) })
            .sort({ updatedAt: -1 })
            .limit(50)
            .lean();
        res.json({ success: true, data: docs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
