import DeliveryCustomer from "../models/DeliveryCustomer.js";
import Logger from "../middleware/logger.js";

function digits(phone) {
    return String(phone || "").replace(/\D/g, "");
}

// الصيغة القياسية المحلية للمقارنة (01 ↔ 20 ↔ 0020 تعتبر نفس الرقم).
function canonicalPhone(phone) {
    const s = digits(phone);
    if (/^0020\d{10}$/.test(s)) return "0" + s.slice(4);
    if (/^20\d{10}$/.test(s)) return "0" + s.slice(2);
    return s;
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

// إنقاص عداد طلبات العميل (حذف فاتورة) — أرضية صفر، ولا يحذف السجل نفسه.
export async function decrementDeliveryCustomer({ phone, organization }) {
    try {
        const d = digits(phone);
        if (!d || !organization) return null;
        const existing = await DeliveryCustomer.findOne({ organization, phoneDigits: d });
        if (!existing) return null;
        existing.orderCount = Math.max(0, (existing.orderCount || 1) - 1);
        await existing.save();
        return existing;
    } catch (error) {
        Logger.warn("decrementDeliveryCustomer failed:", error?.message || error);
        return null;
    }
}

// ضبط السجل عند تغير رقم العميل في فاتورة قائمة:
// - نفس الرقم (بالمقارنة القياسية) → تحديث الاسم/العنوان فقط بلا مساس بالعداد.
// - رقم مختلف → إنقاص القديم + إنشاء/زيادة الجديد.
export async function adjustDeliveryCustomerOnPhoneChange({ oldPhone, newPhone, customerName, address, organization }) {
    try {
        const oldC = canonicalPhone(oldPhone);
        const newC = canonicalPhone(newPhone);
        if (!newC || !organization) return null;
        if (oldC && oldC === newC) {
            const newD = digits(newPhone);
            let existing = await DeliveryCustomer.findOne({ organization, phoneDigits: newD });
            if (!existing && digits(oldPhone) !== newD) {
                existing = await DeliveryCustomer.findOne({ organization, phoneDigits: digits(oldPhone) });
            }
            if (existing) {
                const nm = String(customerName || "").trim();
                const ad = String(address || "").trim();
                let touched = false;
                // phoneDigits يبقى مفتاح الهوية ثابتًا (تجنب كسر unique) — نحدث العرض فقط.
                if (String(newPhone || "").trim() && existing.phone !== String(newPhone).trim()) { existing.phone = String(newPhone).trim(); touched = true; }
                if (nm && nm !== existing.customerName) { existing.customerName = nm; touched = true; }
                if (ad && ad !== existing.address) { existing.address = ad; touched = true; }
                if (touched) await existing.save();
                return existing;
            }
            return upsertDeliveryCustomer({ phone: newPhone, customerName, address, organization });
        }
        if (oldC) {
            await decrementDeliveryCustomer({ phone: oldPhone, organization });
        }
        return upsertDeliveryCustomer({ phone: newPhone, customerName, address, organization });
    } catch (error) {
        Logger.warn("adjustDeliveryCustomerOnPhoneChange failed:", error?.message || error);
        return null;
    }
}
