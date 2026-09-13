import DeliveryCustomer from "../models/DeliveryCustomer.js";
import Logger from "../middleware/logger.js";

function digits(phone) {
    return String(phone || "").replace(/\D/g, "");
}

function pickName(a, b) {
    const x = String(a || "").trim();
    const y = String(b || "").trim();
    if (!x) return y || null;
    if (!y) return x;
    if (y.toLowerCase() === x.toLowerCase()) return x;
    return y; // آخر كتابة تفوز (تصحيح الاسم)
}

function pickAddress(a, b) {
    const x = String(a || "").trim();
    const y = String(b || "").trim();
    if (!y) return x || null;
    return y; // آخر عنوان يفوز
}

// حفظ صامت: رقم واحد = سجل واحد. يُستدعى بعد كل دليفري في الخلفية (لا يرمي أبداً).
export async function upsertDeliveryCustomer({ phone, customerName, address, organization }) {
    try {
        const d = digits(phone);
        if (!d || !organization) return null;
        const existing = await DeliveryCustomer.findOne({ organization, phoneDigits: d });
        if (existing) {
            existing.phone = phone.trim();
            existing.customerName = pickName(existing.customerName, customerName);
            existing.address = pickAddress(existing.address, address);
            existing.orderCount = (existing.orderCount || 1) + 1;
            await existing.save();
            return existing;
        }
        const doc = new DeliveryCustomer({
            organization,
            phoneDigits: d,
            phone: phone.trim(),
            customerName: customerName ? String(customerName).trim() || null : null,
            address: address ? String(address).trim() || null : null,
            orderCount: 1,
        });
        await doc.save();
        return doc;
    } catch (error) {
        // احتكاك نادر لرقمين في نفس اللحظة: أعد المحاولة كتحديث.
        try {
            if (error?.code === 11000) {
                const d = digits(phone);
                const existing = await DeliveryCustomer.findOne({ organization, phoneDigits: d });
                if (existing) {
                    existing.phone = phone.trim();
                    existing.customerName = pickName(existing.customerName, customerName);
                    existing.address = pickAddress(existing.address, address);
                    existing.orderCount = (existing.orderCount || 1) + 1;
                    await existing.save();
                    return existing;
                }
            }
        } catch {}
        Logger.warn("upsertDeliveryCustomer failed:", error?.message || error);
        return null;
    }
}
