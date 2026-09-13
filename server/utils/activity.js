/**
 * بث النشاط اللحظي (activity:new): أي إضافة/تعديل/حذف للطلب/الفاتورة/الجلسة/الطاولة
 * يظهر فوراً لكل مستخدمي نفس المنشأة مع السياق العلاقي (طاولة/فاتورة/جهاز) والفاعل.
 * الفاعل من ALS (يُحقن في auth) أو صريح. لا يرمي أبداً.
 */
import Table from "../models/Table.js";
import Bill from "../models/Bill.js";
import { getRequestActor, getRequestRoute } from "../middleware/auditStamping.js";
import Logger from "../middleware/logger.js";

function pickId(v) {
    try {
        if (v === null || v === undefined) return null;
        if (typeof v === "object") return v._id ? String(v._id) : v.id ? String(v.id) : null;
        return String(v);
    } catch {
        return null;
    }
}

function normalizeOrg(organizationId) {
    try {
        if (!organizationId) return null;
        if (typeof organizationId === "object") return organizationId._id ? String(organizationId._id) : null;
        return String(organizationId);
    } catch {
        return null;
    }
}

// حل السياق العلاقي: أرقام الطاولة/الفاتورة واسم الجهاز — من الحقول المحملة
// أو باستعلام واحد خفيف عند الحاجة. يُستخدم للنشاط وصفوف الإشعارات معاً.
export async function resolveActivityContext(doc = {}, kind = "") {
    const ctx = { tableId: null, tableNumber: null, billId: null, billNumber: null, deviceName: null };
    try {
        const d = doc && typeof doc === "object" ? doc : {};
        let table = d.table;
        let bill = d.bill;
        if (kind === "table") table = d;
        if (table && typeof table === "object") {
            ctx.tableId = pickId(table);
            ctx.tableNumber = table.number ?? table.name ?? null;
        } else if (table !== null && table !== undefined) {
            ctx.tableId = String(table);
        }
        if (bill && typeof bill === "object") {
            ctx.billId = pickId(bill);
            ctx.billNumber = bill.billNumber ?? null;
        } else if (bill !== null && bill !== undefined) {
            ctx.billId = String(bill);
        }
        if (d.deviceName) ctx.deviceName = d.deviceName;
        // نوع الفاتورة/الطلب للعرض (دليفري/تيك أوي/صالة).
        if (d.fulfillmentType) ctx.fulfillment = d.fulfillmentType;
        // رقم طاولة المصدر (النقل) — يُمرر صريحاً ويُعرض في التوست والصف.
        if (d.fromTableNumber !== null && d.fromTableNumber !== undefined) {
            ctx.fromTableNumber = d.fromTableNumber;
        }
        if ((ctx.tableNumber === null || ctx.tableNumber === undefined) && ctx.tableId) {
            const t = await Table.findById(ctx.tableId).select("number name").lean().catch(() => null);
            if (t) ctx.tableNumber = t.number ?? t.name ?? null;
        }
        if (!ctx.billNumber && ctx.billId) {
            const b = await Bill.findById(ctx.billId).select("billNumber").lean().catch(() => null);
            if (b) ctx.billNumber = b.billNumber ?? null;
        }
    } catch {}
    return ctx;
}

// منع التوست المكرر: بعض التدفقات تبث نفس الحدث مرتين (فوري + legacy مكرر
// لعملاء اتصلوا أثناء الاستجابة) — نفس البصمة خلال 3 ثوانٍ تُبث مرة واحدة فقط.
const recentActivity = new Map();
const ACTIVITY_DEDUPE_MS = 3000;

function activityKey(kind, action, number, ctx, actorName) {
    return [kind, action, number ?? "", ctx.tableNumber ?? "", ctx.billNumber ?? "", ctx.deviceName ?? "", actorName || ""].join("|");
}

function pruneActivityCache() {
    try {
        if (recentActivity.size < 500) return;
        const cutoff = Date.now() - ACTIVITY_DEDUPE_MS;
        for (const [k, t] of recentActivity) {
            if (t < cutoff) recentActivity.delete(k);
        }
    } catch {}
}

const HELD_ACTIONS = new Set(["updated", "status-changed", "controllers-changed"]);
const pendingHeld = new Map(); // holdKey -> timeout — updated مؤجل يُلغى عند حدث مهم لنفس الكيان
const HELD_MS = 1200;

function holdKeyFor(kind, number, ctx) {
    return [kind, number ?? "", ctx.tableNumber ?? "", ctx.billNumber ?? "", ctx.deviceName ?? ""].join("|");
}

export function emitActivity(io, organizationId, { kind, action, doc = {}, number = null, actor = null, silent = false } = {}) {
    try {
        if (!io || !kind || !action) return;
        // خارج سياق طلب (مهام مجدولة/نظام) لا يوجد فاعل — يُنسب للنظام.
        const a = actor || getRequestActor() || { name: "النظام", source: "system" };
        const org = normalizeOrg(organizationId);
        resolveActivityContext(doc, kind)
            .then((ctx) => {
                const key = activityKey(kind, action, number, ctx, a.name);
                const now = Date.now();
                if ((recentActivity.get(key) || 0) > now - ACTIVITY_DEDUPE_MS) return;
                recentActivity.set(key, now);
                pruneActivityCache();
                const holdKey = holdKeyFor(kind, number, ctx);
                // دالة مرفوعة (function) — المؤقت يستدعيها بعد return مبكر بلا خطأ TDZ.
                function doEmit() {
                    try {
                        const d = doc && typeof doc === "object" ? doc : {};
                        const payload = {
                            kind,
                            action,
                            number,
                            status: d.status || null,
                            silent: silent === true,
                            ...ctx,
                            actor: {
                                name: a.name || null,
                                source: a.source || null,
                                userId: a.userId ?? null,
                            },
                            at: new Date().toISOString(),
                        };
                        Logger.info(`[activity] ${kind}:${action} ${number || ""} → org ${org || "all"} by ${payload.actor?.name || "?"} (${payload.actor?.source || "?"})${silent ? " (silent)" : ""} via ${getRequestRoute() || "?"}`);
                        if (org) {
                            io.to(`org-${org}`).emit("activity:new", payload);
                            io.to(`org:${org}`).emit("activity:new", payload);
                        } else {
                            io.emit("activity:new", payload);
                        }
                    } catch {}
                }
                // حدث مهم: يلغي أي updated معلق لنفس الكيان (دفعة تلغي "تعديل" المكرر معها) ويُبث فوراً.
                if (!HELD_ACTIONS.has(action)) {
                    const pending = pendingHeld.get(holdKey);
                    if (pending) {
                        clearTimeout(pending);
                        pendingHeld.delete(holdKey);
                    }
                    doEmit();
                } else if (!silent) {
                    // updated منخفض الأولوية: يُمهل 1.2ث لعل حدثاً مهماً يلغه (دمج الضجيج).
                    if (pendingHeld.has(holdKey)) return; // معلق بالفعل — لا تمديد
                    pendingHeld.set(
                        holdKey,
                        setTimeout(() => {
                            pendingHeld.delete(holdKey);
                            doEmit();
                        }, HELD_MS)
                    );
                    return;
                } else {
                    return; // silent: بيانات فقط بلا توست
                }
            })
            .catch(() => {});
    } catch {}
}
