import mongoose from "mongoose";
import Logger from "../middleware/logger.js";

/**
 * إصلاح تلقائي عند الإقلاع: دفعات مكررة حرفيًا (نفس المبلغ+الطريقة مرتين+)
 * على فاتورة مدفوعة بالكامل — غالبًا ضغطة مزدوجة أو إعادة تطبيق.
 *
 * الأمان:
 * - يُبقي أقدم سجل ويحذف الزوائد فقط.
 * - بعد الحذف يُعاد الحساب (calculateRemainingAmount) ولا يُحفظ إلا إذا
 *   ظلت الفاتورة مسددة بالكامل (paid + remaining صفر) — وإلا يُتخطى.
 * - لا يمس الفواتير غير المدفوعة ولا السجلات الفريدة.
 */
export async function healDuplicatePayments() {
    const res = { checked: 0, fixed: 0, removed: 0, skipped: [], errors: 0 };
    try {
        const Bill = mongoose.model("Bill");

        // فواتير مدفوعة فيها (مبلغ+طريقة) متكرر
        const dupGroups = await Bill.aggregate([
            { $match: { status: "paid" } },
            { $project: { p: "$payments" } },
            { $unwind: "$p" },
            {
                $group: {
                    _id: { b: "$_id", amt: "$p.amount", m: "$p.method" },
                    n: { $sum: 1 },
                },
            },
            { $match: { n: { $gt: 1 } } },
        ]);

        const byBill = new Map();
        for (const g of dupGroups) {
            const bid = String(g._id.b);
            if (!byBill.has(bid)) byBill.set(bid, []);
            byBill.get(bid).push({ amount: g._id.amt, method: g._id.m, count: g.n });
        }
        res.checked = byBill.size;
        if (byBill.size === 0) return res;

        for (const [bid, groups] of byBill) {
            try {
                const bill = await Bill.findById(bid);
                if (!bill || bill.status !== "paid") continue;
                let removedHere = 0;
                for (const g of groups) {
                    const matches = (bill.payments || [])
                        .filter(
                            (p) =>
                                Number(p.amount) === Number(g.amount) &&
                                String(p.method || "") === String(g.method || "")
                        )
                        .sort(
                            (a, b) =>
                                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                        );
                    // أبقِ الأقدم فقط
                    for (let i = 1; i < matches.length; i++) {
                        bill.payments.pull(matches[i]._id);
                        removedHere++;
                    }
                }
                if (removedHere === 0) continue;
                // حساب استباقي من المصفوفات بعد الحذف — لا حفظ إلا بتغطية كاملة مثبتة
                if (typeof bill.calculateRemainingAmount === "function") {
                    bill.calculateRemainingAmount();
                }
                if ((bill.remaining || 0) <= 0.01 && (bill.paid || 0) > 0) {
                    bill.status = "paid";
                    await bill.save();
                    res.fixed++;
                    res.removed += removedHere;
                    Logger.info(
                        `[PaymentHeal] ${bill.billNumber || bid}: removed ${removedHere} duplicate payment(s)`
                    );
                } else {
                    res.skipped.push(String(bill.billNumber || bid));
                }
            } catch (e) {
                res.errors++;
                Logger.error("[PaymentHeal] bill failed:", e?.message || e);
            }
        }
    } catch (e) {
        res.errors++;
        Logger.error("[PaymentHeal] failed:", e?.message || e);
    }
    return res;
}

export default { healDuplicatePayments };
