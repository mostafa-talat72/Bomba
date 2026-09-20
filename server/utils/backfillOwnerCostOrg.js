import mongoose from "mongoose";
import Logger from "../middleware/logger.js";

const MARKER_KEY = "owner-costorg-backfill-v1";
const MARKER_PERMS_KEY = "perms-sanitize-backfill-v1";

// معالجة إقلاع لمرة واحدة (marker يمنع التكرار):
// 1) منشآت بلا مالك (organization.owner ناقص) → تعيين أقدم مدير بصلاحية كاملة.
//    بدون مالك يفشل كل فحص "مالك المنشأة" (تعديل/حذف المديرين) بأخطاء 500/403.
// 2) مصروفات بلا organization → إسنادها للمنشأة الوحيدة إن وُجدت واحدة فقط.
//    بدونها تظهر القائمة (find يتسامح) بينما التجميعات (aggregate) تُرجع أصفاراً.
export async function backfillOwnerAndCostOrg() {
    try {
        const db = mongoose.connection?.db;
        if (!db) return;
        try {
            const existing = await db.collection("migrationFlags").findOne({ key: MARKER_KEY });
            if (existing && existing.doneAt) return;
        } catch {}

        const Organization = mongoose.model("Organization");
        const User = mongoose.model("User");
        const Cost = mongoose.model("Cost");

        // 1) Missing organization owners
        let ownersFixed = 0;
        try {
            const ownerless = await Organization.find({
                $or: [{ owner: { $exists: false } }, { owner: null }],
            }).select("_id name");
            for (const org of ownerless) {
                // أقدم مدير نشط بصلاحية كاملة في نفس المنشأة (الأقرب للمؤسس)
                const candidate = await User.findOne({
                    organization: org._id,
                    role: "admin",
                    status: "active",
                    permissions: "all",
                }).sort({ createdAt: 1 }).select("_id name");
                if (candidate) {
                    await Organization.updateOne(
                        { _id: org._id },
                        { $set: { owner: candidate._id } }
                    );
                    ownersFixed++;
                    Logger.info(`backfill: organization '${org.name}' owner set to '${candidate.name}' (${candidate._id})`);
                } else {
                    Logger.warn(`backfill: organization '${org.name}' has no owner and no eligible admin — manual fix needed`);
                }
            }
        } catch (error) {
            Logger.error("backfill: owner pass failed", error);
        }

        // 2) Orphan costs (missing organization) → single-org DBs only
        let costsFixed = 0;
        try {
            const orgCount = await Organization.countDocuments();
            if (orgCount === 1) {
                const onlyOrg = await Organization.findOne().select("_id");
                if (onlyOrg) {
                    const r = await Cost.updateMany(
                        { $or: [{ organization: { $exists: false } }, { organization: null }] },
                        { $set: { organization: onlyOrg._id } }
                    ).catch(() => null);
                    costsFixed = r && typeof r.modifiedCount === "number" ? r.modifiedCount : 0;
                    if (costsFixed > 0) {
                        Logger.info(`backfill: assigned ${costsFixed} orphan costs to the single organization`);
                    }
                }
            }
        } catch (error) {
            Logger.error("backfill: cost-org pass failed", error);
        }

        try {
            await db.collection("migrationFlags").updateOne(
                { key: MARKER_KEY },
                { $set: { doneAt: new Date(), ownersFixed, costsFixed } },
                { upsert: true }
            );
        } catch {}
    } catch (error) {
        Logger.error("backfillOwnerAndCostOrg failed", error);
    }
}

export default backfillOwnerAndCostOrg;

// إزالة قيم الصلاحيات المجهولة (قديمة/ملغاة/مدخلة يدوياً) من كل المستخدمين.
// تعمل مرة واحدة (marker مستقل) — بعدها أي حفظ يطهّر تلقائياً عبر sanitizePermissions.
export async function backfillPermissionSanitize() {
    try {
        const db = mongoose.connection?.db;
        if (!db) return;
        try {
            const existing = await db.collection("migrationFlags").findOne({ key: MARKER_PERMS_KEY });
            if (existing && existing.doneAt) return;
        } catch {}

        const User = mongoose.model("User");
        let allowed = [];
        try {
            allowed = User.schema.path("permissions").caster.enumValues || [];
        } catch {}
        const set = new Set(allowed);
        if (set.size === 0) return;

        const users = await User.find({}).select("_id username email permissions");
        let fixed = 0;
        let droppedTotal = 0;
        for (const u of users) {
            const list = Array.isArray(u.permissions) ? u.permissions : [];
            const clean = list.filter((p) => typeof p === "string" && set.has(p));
            if (clean.length !== list.length) {
                const dropped = list.filter((p) => !clean.includes(p));
                // كتابة مباشرة بدون validation (القيم الحالية نفسها سبب المشكلة)
                await User.updateOne({ _id: u._id }, { $set: { permissions: clean } });
                fixed++;
                droppedTotal += dropped.length;
                Logger.info(`backfill: user '${u.username || u.email}' permissions cleaned, dropped: ${dropped.join(",")}`);
            }
        }

        try {
            await db.collection("migrationFlags").updateOne(
                { key: MARKER_PERMS_KEY },
                { $set: { doneAt: new Date(), usersFixed: fixed, valuesDropped: droppedTotal } },
                { upsert: true }
            );
        } catch {}
        if (fixed > 0) Logger.info(`backfill: permission sanitize done — ${fixed} users, ${droppedTotal} values dropped`);
    } catch (error) {
        Logger.error("backfillPermissionSanitize failed", error);
    }
}
