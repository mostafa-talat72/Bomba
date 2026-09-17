import mongoose from "mongoose";
import Logger from "../middleware/logger.js";

const MARKER_KEY = "fulfillment-backfill-v1";

// تعبئة نوع التنفيذ (fulfillmentType) للوثائق القديمة التي كُتبت قبله — مرة واحدة لكل قاعدة.
// القواعد (نفس منطق الإنشاء + إشارات الدليفري):
//   رسوم توصيل > 0 أو عنوان توصيل → delivery
//   مربوطة بطاولة أو فاتورة جلسات → dine_in
//   غير ذلك → takeaway
// آمنة: تمس فقط الوثائق بلا حقل، عبر updateMany (يطلق sync hooks فيصل Atlas)،
// وتُسجَّل في migrationFlags فلا تتكرر. الفواتير أولاً لأن الطلبات تعتمد عليها.
export async function backfillFulfillmentType() {
    try {
        const db = mongoose.connection?.db;
        if (!db) return;
        const flags = db.collection("migrationFlags");
        try {
            const existing = await flags.findOne({ key: MARKER_KEY });
            if (existing && existing.doneAt) return;
        } catch {}

        const Bill = mongoose.model("Bill");
        const Order = mongoose.model("Order");
        const num = (r) => (r && typeof r.modifiedCount === "number" ? r.modifiedCount : 0);

        // 1) الفواتير
        const bDelFee = await Bill.updateMany(
            { fulfillmentType: { $exists: false }, "deliveryInfo.deliveryFee": { $gt: 0 } },
            { $set: { fulfillmentType: "delivery" } }
        ).catch(() => null);
        const bDelAddr = await Bill.updateMany(
            { fulfillmentType: { $exists: false }, "deliveryInfo.address": { $exists: true, $nin: [null, ""] } },
            { $set: { fulfillmentType: "delivery" } }
        ).catch(() => null);
        const bDineTable = await Bill.updateMany(
            { fulfillmentType: { $exists: false }, table: { $exists: true, $ne: null } },
            { $set: { fulfillmentType: "dine_in" } }
        ).catch(() => null);
        const bDineSess = await Bill.updateMany(
            { fulfillmentType: { $exists: false }, "sessions.0": { $exists: true } },
            { $set: { fulfillmentType: "dine_in" } }
        ).catch(() => null);
        const bTake = await Bill.updateMany(
            { fulfillmentType: { $exists: false } },
            { $set: { fulfillmentType: "takeaway" } }
        ).catch(() => null);

        // 2) الطلبات بطاولة → dine_in (مضمون)
        const oDine = await Order.updateMany(
            { fulfillmentType: { $exists: false }, table: { $exists: true, $ne: null } },
            { $set: { fulfillmentType: "dine_in" } }
        ).catch(() => null);

        // 3) الباقي (بلا طاولة): من نوع فاتورته، وإلا takeaway
        let oFromBill = 0;
        let oTake = 0;
        try {
            const rest = await Order.find(
                { fulfillmentType: { $exists: false } },
                { bill: 1 }
            ).lean();
            if (rest.length > 0) {
                const billIds = [...new Set(rest.map((o) => String(o.bill || "")).filter(Boolean))];
                const bmap = new Map();
                if (billIds.length > 0) {
                    const bdocs = await Bill.find({ _id: { $in: billIds } }, { fulfillmentType: 1 }).lean().catch(() => []);
                    bdocs.forEach((b) => bmap.set(String(b._id), b.fulfillmentType || null));
                }
                const byType = new Map();
                for (const o of rest) {
                    const t = (o.bill && bmap.get(String(o.bill))) || "takeaway";
                    if (!byType.has(t)) byType.set(t, []);
                    byType.get(t).push(o._id);
                }
                for (const [t, ids] of byType) {
                    for (let i = 0; i < ids.length; i += 2000) {
                        const chunk = ids.slice(i, i + 2000);
                        try {
                            const r = await Order.updateMany({ _id: { $in: chunk } }, { $set: { fulfillmentType: t } });
                            if (t === "takeaway") oTake += num(r);
                            else oFromBill += num(r);
                        } catch {}
                    }
                }
            }
        } catch {}

        Logger.info(
            `🔧 backfill fulfillmentType: bills delivery=${num(bDelFee) + num(bDelAddr)} dine_in=${num(bDineTable) + num(bDineSess)} takeaway=${num(bTake)}; ` +
            `orders dine_in=${num(oDine)} fromBill=${oFromBill} takeaway=${oTake}`
        );

        try {
            await flags.updateOne({ key: MARKER_KEY }, { $set: { key: MARKER_KEY, doneAt: new Date() } }, { upsert: true });
        } catch {}
    } catch (e) {
        Logger.warn("backfill fulfillmentType skipped:", e?.message || e);
    }
}

export default backfillFulfillmentType;
