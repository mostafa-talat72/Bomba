import DeliveryCustomer from "../models/DeliveryCustomer.js";
import Bill from "../models/Bill.js";
import { organizationFilter } from "../utils/organization.js";

function digits(phone) {
    return String(phone || "").replace(/\D/g, "");
}

function canonicalPhone(phone) {
    const s = digits(phone);
    if (/^0020\d{10}$/.test(s)) return "0" + s.slice(4);
    if (/^20\d{10}$/.test(s)) return "0" + s.slice(2);
    return s;
}

// كل الصيغ الكاملة لنفس الرقم (محلي/دولي) — للمطابقة عبر الصيغ.
function fullVariantsOf(canonical) {
    const out = new Set([canonical]);
    if (/^01\d{9}$/.test(canonical)) {
        out.add("20" + canonical.slice(1));
        out.add("0020" + canonical.slice(1));
    }
    return Array.from(out);
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

// GET /api/delivery-customers/directory?page&limit&search=
// سجل العملاء مُثرى بإحصائيات الفواتير (طلبات/إجمالي/متوسط/آخر طلب) + ملخص عام.
export const getCustomersDirectory = async (req, res) => {
    try {
        const orgFilter = { ...organizationFilter(req.user) };
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
        const search = String(req.query.search || "").trim();

        const filter = { ...orgFilter };
        if (search) {
            const d = digits(search);
            const or = [];
            if (d.length >= 2) or.push({ phoneDigits: { $regex: d } });
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            or.push({ customerName: { $regex: escaped, $options: "i" } });
            or.push({ address: { $regex: escaped, $options: "i" } });
            filter.$or = or;
        }

        const [total, docs] = await Promise.all([
            DeliveryCustomer.countDocuments(filter),
            DeliveryCustomer.find(filter)
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
        ]);

        // إحصائيات الفواتير للصفحة الحالية (استعلام واحد، مطابقة عبر الصيغ).
        const variantSet = new Set();
        for (const doc of docs) {
            for (const v of fullVariantsOf(canonicalPhone(doc.phoneDigits || doc.phone))) {
                variantSet.add(v);
            }
        }
        const variants = Array.from(variantSet);
        const byCanonical = new Map();
        if (variants.length > 0) {
            const bills = await Bill.find({
                ...orgFilter,
                status: { $ne: "cancelled" },
                $or: [{ customerPhone: { $in: variants } }, { "deliveryInfo.phone": { $in: variants } }],
            })
                .select("customerPhone deliveryInfo.phone total createdAt")
                .lean();
            for (const b of bills) {
                const key = canonicalPhone(b?.deliveryInfo?.phone || b?.customerPhone);
                if (!key) continue;
                const agg = byCanonical.get(key) || { orders: 0, total: 0, lastAt: null };
                agg.orders += 1;
                agg.total += Number(b.total) || 0;
                const at = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                if (at && (!agg.lastAt || at > agg.lastAt)) agg.lastAt = at;
                byCanonical.set(key, agg);
            }
        }
        const data = docs.map((doc) => {
            const key = canonicalPhone(doc.phoneDigits || doc.phone);
            const st = byCanonical.get(key) || { orders: 0, total: 0, lastAt: null };
            return {
                ...doc,
                stats: {
                    orders: st.orders,
                    totalSpent: Math.round(st.total * 100) / 100,
                    avg: st.orders > 0 ? Math.round((st.total / st.orders) * 100) / 100 : 0,
                    lastOrderAt: st.lastAt ? new Date(st.lastAt).toISOString() : null,
                },
            };
        });

        // ملخص عام (كل العملاء — تجميع واحد بلا تجميع هواتف).
        const [customerCount, billAgg] = await Promise.all([
            DeliveryCustomer.countDocuments(orgFilter),
            Bill.aggregate([
                {
                    $match: {
                        ...orgFilter,
                        status: { $ne: "cancelled" },
                        $or: [
                            { customerPhone: { $exists: true, $ne: "" } },
                            { "deliveryInfo.phone": { $exists: true, $ne: "" } },
                        ],
                    },
                },
                { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: "$total" } } },
            ]),
        ]);
        const orders = Number(billAgg?.[0]?.orders) || 0;
        const revenue = Math.round((Number(billAgg?.[0]?.revenue) || 0) * 100) / 100;

        res.json({
            success: true,
            data,
            total,
            page,
            pages: Math.max(1, Math.ceil(total / limit)),
            summary: {
                customers: customerCount,
                orders,
                revenue,
                avg: orders > 0 ? Math.round((revenue / orders) * 100) / 100 : 0,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/delivery-customers — إضافة عميل يدويًا (عداد صفر).
export const createDeliveryCustomer = async (req, res) => {
    try {
        const phone = String(req.body?.phone || "").trim();
        const customerName = String(req.body?.customerName || "").trim() || null;
        const address = String(req.body?.address || "").trim() || null;
        const d = digits(phone);
        if (d.length < 7) {
            return res.status(400).json({ success: false, message: "رقم الهاتف غير صحيح" });
        }
        const orgFilter = { ...organizationFilter(req.user) };
        const clash = await DeliveryCustomer.findOne({
            ...orgFilter,
            phoneDigits: { $in: fullVariantsOf(canonicalPhone(d)) },
        }).lean();
        if (clash) {
            return res.status(409).json({ success: false, message: "العميل مسجل بالفعل", data: clash });
        }
        const doc = await DeliveryCustomer.create({
            ...orgFilter,
            phoneDigits: d,
            phone: phone.trim(),
            customerName,
            address,
            orderCount: 0,
        });
        res.status(201).json({ success: true, data: doc });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({ success: false, message: "العميل مسجل بالفعل" });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/delivery-customers/:id — تعديل (تغيير الرقم يدمج في الموجود عند التعارض).
export const updateDeliveryCustomer = async (req, res) => {
    try {
        const doc = await DeliveryCustomer.findOne({ _id: req.params.id, ...organizationFilter(req.user) });
        if (!doc) {
            return res.status(404).json({ success: false, message: "العميل غير موجود" });
        }
        const { customerName, address, phone } = req.body || {};
        if (customerName !== undefined) doc.customerName = String(customerName || "").trim() || null;
        if (address !== undefined) doc.address = String(address || "").trim() || null;
        if (phone !== undefined && String(phone).trim() && digits(phone) !== doc.phoneDigits) {
            const d = digits(phone);
            if (d.length < 7) {
                return res.status(400).json({ success: false, message: "رقم الهاتف غير صحيح" });
            }
            const clash = await DeliveryCustomer.findOne({
                organization: doc.organization,
                _id: { $ne: doc._id },
                phoneDigits: { $in: fullVariantsOf(canonicalPhone(d)) },
            });
            if (clash) {
                clash.orderCount = Math.max(0, (clash.orderCount || 0) + (doc.orderCount || 0));
                if (!clash.customerName && doc.customerName) clash.customerName = doc.customerName;
                if (!clash.address && doc.address) clash.address = doc.address;
                await clash.save();
                await DeliveryCustomer.deleteOne({ _id: doc._id });
                return res.json({ success: true, data: clash, merged: true });
            }
            doc.phoneDigits = d;
            doc.phone = String(phone).trim();
        }
        await doc.save();
        res.json({ success: true, data: doc });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/delivery-customers/:id — حذف سجل العميل (الفواتير لا تُمس).
export const deleteDeliveryCustomer = async (req, res) => {
    try {
        const doc = await DeliveryCustomer.findOne({ _id: req.params.id, ...organizationFilter(req.user) });
        if (!doc) {
            return res.status(404).json({ success: false, message: "العميل غير موجود" });
        }
        await DeliveryCustomer.deleteOne({ _id: doc._id });
        try {
            const { createTombstone } = await import("../utils/tombstoneHelper.js");
            await createTombstone("deliverycustomers", doc._id, doc.organization, req.user?._id);
        } catch {}
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
