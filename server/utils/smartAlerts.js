/**
 * الملخص والتنبيهات الذكية للإشعارات:
 * 1) ملخص كل ساعة: أعداد الطلبات/الفواتير المدفوعة/الجلسات (صف واحد، يُتجاهل عند خلو الساعة).
 * 2) تنبيهات ذكية كل 15 دقيقة: طاولة مشغولة بلا نشاط + فاتورة مفتوحة كبيرة.
 * العتبات من إعدادات الإشعارات (Settings/category=notifications): idleTableMinutes (45)،
 * bigBillAmount (500). منع التكرار بالاستعلام عن صف حديث مماثل. لا ترمي أبداً.
 */
import cron from "node-cron";
import Logger from "../middleware/logger.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Bill from "../models/Bill.js";
import Session from "../models/Session.js";
import Table from "../models/Table.js";
import Settings from "../models/Settings.js";
import Notification from "../models/Notification.js";
import NotificationService from "../services/notificationService.js";

const HOUR = 60 * 60 * 1000;

async function orgAdminId(orgId) {
    try {
        const admin = await User.findOne({ organization: orgId, role: "admin", status: "active" })
            .select("_id")
            .lean();
        return admin?._id || null;
    } catch {
        return null;
    }
}

async function readThresholds(orgId) {
    const defaults = { idleTableMinutes: 45, bigBillAmount: 500 };
    try {
        const doc = await Settings.findOne({ category: "notifications", organization: orgId }).lean();
        const s = doc?.settings || {};
        return {
            idleTableMinutes: Number(s.idleTableMinutes) > 0 ? Number(s.idleTableMinutes) : defaults.idleTableMinutes,
            bigBillAmount: Number(s.bigBillAmount) > 0 ? Number(s.bigBillAmount) : defaults.bigBillAmount,
        };
    } catch {
        return defaults;
    }
}

async function allOrgIds() {
    try {
        const orgs = await Organization.find({}).select("_id").lean();
        return orgs.map((o) => o._id);
    } catch {
        return [];
    }
}

// ── 1) ملخص الساعة ──────────────────────────────────────────────
export async function runHourlyDigest() {
    try {
        const since = new Date(Date.now() - HOUR);
        for (const orgId of await allOrgIds()) {
            try {
                const [orders, billsPaid, sessions] = await Promise.all([
                    Order.countDocuments({ organization: orgId, createdAt: { $gte: since } }),
                    Bill.aggregate([
                        { $match: { organization: orgId, status: "paid", updatedAt: { $gte: since } } },
                        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$total" } } },
                    ]),
                    Session.countDocuments({ organization: orgId, createdAt: { $gte: since } }),
                ]);
                const paidCount = billsPaid?.[0]?.count || 0;
                const paidTotal = billsPaid?.[0]?.total || 0;
                if (!orders && !paidCount && !sessions) continue; // ساعة خالية — بلا صف
                const createdBy = await orgAdminId(orgId);
                if (!createdBy) continue;
                const range = new Date(since);
                const hh = String(range.getHours()).padStart(2, "0");
                const title = { ar: `ملخص الساعة ${hh}`, en: `Hour ${hh} summary` };
                const message = {
                    ar: `${orders} طلب • ${paidCount} فاتورة مدفوعة (${paidTotal}) • ${sessions} جلسة`,
                    en: `${orders} orders • ${paidCount} bills paid (${paidTotal}) • ${sessions} sessions`,
                };
                await NotificationService.createNotification(
                    {
                        title: title.ar,
                        message: message.ar,
                        type: "info",
                        category: "system",
                        priority: "low",
                        targetRoles: ["admin", "cashier"],
                        targetPermissions: ["dashboard"],
                        metadata: {
                            digest: { orders, paidCount, paidTotal, sessions, hour: hh },
                            translations: {
                                ar: { title: title.ar, message: message.ar },
                                en: { title: title.en, message: message.en },
                            },
                        },
                        expiresAt: new Date(Date.now() + 7 * 24 * HOUR),
                        createdBy,
                    },
                    { organization: orgId }
                );
            } catch {}
        }
    } catch (error) {
        Logger.error("Hourly digest failed:", error?.message || error);
    }
}

// ── 2) تنبيهات ذكية ─────────────────────────────────────────────
export async function runSmartAlerts() {
    try {
        for (const orgId of await allOrgIds()) {
            try {
                const { idleTableMinutes, bigBillAmount } = await readThresholds(orgId);
                const createdBy = await orgAdminId(orgId);
                if (!createdBy) continue;
                const now = Date.now();

                // أ) طاولة مشغولة بلا نشاط منذ X دقيقة
                try {
                    const tables = await Table.find({ organization: orgId, status: "occupied" })
                        .select("_id number updatedAt")
                        .lean();
                    for (const t of tables) {
                        try {
                            const lastOrder = await Order.findOne({ organization: orgId, table: t._id })
                                .sort({ createdAt: -1 })
                                .select("createdAt")
                                .lean();
                            const ref = lastOrder?.createdAt || t.updatedAt || null;
                            if (!ref) continue;
                            const idleMin = Math.floor((now - new Date(ref).getTime()) / 60000);
                            if (idleMin < idleTableMinutes) continue;
                            const recent = await Notification.exists({
                                organization: orgId,
                                category: "system",
                                "metadata.smartAlert": "idle-table",
                                "metadata.tableId": String(t._id),
                                createdAt: { $gte: new Date(now - 2 * HOUR) },
                            });
                            if (recent) continue;
                            await NotificationService.createNotification(
                                {
                                    title: "طاولة بلا نشاط",
                                    message: `طاولة ${t.number ?? ""} مشغولة منذ ${idleMin} دقيقة بلا طلب جديد`,
                                    type: "warning",
                                    category: "system",
                                    priority: "medium",
                                    targetRoles: ["admin", "cashier", "staff"],
                                    metadata: {
                                        smartAlert: "idle-table",
                                        tableId: String(t._id),
                                        tableNumber: t.number ?? null,
                                        idleMinutes: idleMin,
                                        translations: {
                                            ar: { title: "طاولة بلا نشاط", message: `طاولة ${t.number ?? ""} مشغولة منذ ${idleMin} دقيقة بلا طلب جديد` },
                                            en: { title: "Idle table", message: `Table ${t.number ?? ""} occupied for ${idleMin} min with no new order` },
                                        },
                                    },
                                    expiresAt: new Date(now + 24 * HOUR),
                                    createdBy,
                                },
                                { organization: orgId }
                            );
                        } catch {}
                    }
                } catch {}

                // ب) فاتورة مفتوحة كبيرة
                try {
                    const bills = await Bill.find({
                        organization: orgId,
                        status: { $in: ["draft", "partial", "overdue"] },
                        total: { $gte: bigBillAmount },
                    })
                        .select("_id billNumber total table")
                        .lean();
                    for (const b of bills) {
                        try {
                            const recent = await Notification.exists({
                                organization: orgId,
                                category: "system",
                                "metadata.smartAlert": "big-bill",
                                "metadata.billId": String(b._id),
                                createdAt: { $gte: new Date(now - 4 * HOUR) },
                            });
                            if (recent) continue;
                            let tableNumber = null;
                            try {
                                const t = b.table
                                    ? await Table.findById(b.table).select("number").lean()
                                    : null;
                                tableNumber = t?.number ?? null;
                            } catch {}
                            await NotificationService.createNotification(
                                {
                                    title: "فاتورة مفتوحة كبيرة",
                                    message: `فاتورة ${b.billNumber} مفتوحة بمبلغ ${b.total}${tableNumber !== null ? ` — طاولة ${tableNumber}` : ""}`,
                                    type: "warning",
                                    category: "system",
                                    priority: "high",
                                    targetRoles: ["admin", "cashier"],
                                    targetPermissions: ["billing"],
                                    metadata: {
                                        smartAlert: "big-bill",
                                        billId: String(b._id),
                                        billNumber: b.billNumber,
                                        amount: b.total,
                                        tableNumber,
                                        translations: {
                                            ar: { title: "فاتورة مفتوحة كبيرة", message: `فاتورة ${b.billNumber} مفتوحة بمبلغ ${b.total}` },
                                            en: { title: "Large open bill", message: `Bill ${b.billNumber} open at ${b.total}` },
                                        },
                                    },
                                    expiresAt: new Date(now + 24 * HOUR),
                                    createdBy,
                                },
                                { organization: orgId }
                            );
                        } catch {}
                    }
                } catch {}
            } catch {}
        }
    } catch (error) {
        Logger.error("Smart alerts failed:", error?.message || error);
    }
}

export function setupSmartAlertsScheduler() {
    try {
        cron.schedule("0 * * * *", () => {
            runHourlyDigest().catch(() => {});
        });
        Logger.info("✅ Hourly activity digest scheduled");
    } catch {}
    try {
        cron.schedule("*/15 * * * *", () => {
            runSmartAlerts().catch(() => {});
        });
        Logger.info("✅ Smart alerts scheduled: every 15 minutes");
    } catch {}
}
