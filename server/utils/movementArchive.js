import mongoose from "mongoose";
import Logger from "../middleware/logger.js";
import StockMovementArchive from "../models/StockMovementArchive.js";
import InventoryItem from "../models/InventoryItem.js";
import WarehouseItem from "../models/WarehouseItem.js";
import User from "../models/User.js";

// أي حركة أقدم من هذا الحد تُنقل للأرشيف (المستخدم طلب: شهر)
export const ARCHIVE_AFTER_DAYS = 30;

const MODELS = {
    inventory: InventoryItem,
    warehouse: WarehouseItem,
};

export const sortByTimeAsc = (arr) =>
    [...arr].sort(
        (a, b) =>
            new Date(a.timestamp || a.date).getTime() -
            new Date(b.timestamp || b.date).getTime()
    );

// نفس قواعد حساب الرصيد في كل القراءات والمحاكاة (لا تُغيرها في مكان واحد فقط)
export const replayBalance = (sortedMovements, startBalance = 0) => {
    let balance = startBalance;
    return sortedMovements.map((m) => {
        const qty = Number(m.quantity) || 0;
        if (m.type === "in" || m.type === "transfer_in") balance += qty;
        else if (m.type === "out" || m.type === "transfer_out") balance -= qty;
        else if (m.type === "adjustment") balance = qty;
        return { ...m, balanceAfter: balance };
    });
};

const toPlain = (m) => (m && typeof m.toObject === "function" ? m.toObject() : { ...m });

const movementTime = (m) => new Date(m.timestamp || m.date).getTime();

export const getArchiveFor = (organization, itemType, itemId) =>
    StockMovementArchive.findOne({ organization, itemType, itemId }).lean();

export const getSnapshotBalance = async (organization, itemType, itemId) => {
    try {
        const archive = await getArchiveFor(organization, itemType, itemId);
        return archive?.snapshotBalance || 0;
    } catch {
        return 0;
    }
};

// هل للصنف حركات مؤرشفة؟ (لمنع منطق "الأقدم" من العمل على الحي فقط)
export const hasArchivedMovements = async (organization, itemType, itemId) => {
    try {
        const archive = await getArchiveFor(organization, itemType, itemId);
        return !!archive && (archive.movements || []).length > 0;
    } catch {
        return false;
    }
};

// القراءة المدمجة (الأحدث أولاً كما كانت الـ API): أرشيف + حي بأرصدة صحيحة.
// الحركات المؤرشفة تحمل archived:true ولقطة الرصيد أساس تراكم الحية.
export const getMergedMovements = async ({ organization, itemType, item }) => {
    const archive = await getArchiveFor(organization, itemType, item._id);
    const archivedRaw = archive?.movements || [];

    // أسماء المستخدمين للحركات المؤرشفة (غير مُعبأة لأنها كائنات عادية)
    let userNames = {};
    try {
        const userIds = [
            ...new Set(
                archivedRaw
                    .map((m) => String(m.user?._id || m.user || ""))
                    .filter(Boolean)
            ),
        ];
        if (userIds.length > 0) {
            const users = await User.find({ _id: { $in: userIds } })
                .select("name")
                .lean();
            userNames = Object.fromEntries(
                users.map((u) => [String(u._id), u.name])
            );
        }
    } catch {
        userNames = {};
    }

    const archived = sortByTimeAsc(archivedRaw).map((m) => {
        const plain = { ...m };
        const uid = String(plain.user?._id || plain.user || "");
        if (uid && !plain.user?.name) {
            plain.user = userNames[uid]
                ? { _id: plain.user, name: userNames[uid] }
                : plain.user;
        }
        return { ...plain, archived: true };
    });

    const live = sortByTimeAsc((item.stockMovements || []).map(toPlain));
    const seed = archive?.snapshotBalance || 0;
    const liveWithBalance = replayBalance(live, seed).map((m) => ({
        ...m,
        archived: false,
    }));

    return [...archived, ...liveWithBalance]
        .sort((a, b) => movementTime(b) - movementTime(a));
};

// مهمة الأرشفة: تنقل الحركات الأقدم من الحد للأرشيف مع لقطة رصيد.
// Idempotent: إعادة التشغيل بنفس القطع لا تُضاعف شيئاً (كل حركة في مكان واحد).
export const archiveOldStockMovements = async (
    olderThanDays = ARCHIVE_AFTER_DAYS
) => {
    const cutOff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    let archivedCount = 0;

    for (const [itemType, Model] of Object.entries(MODELS)) {
        let items = [];
        try {
            items = await Model.find({
                $or: [
                    { "stockMovements.timestamp": { $lt: cutOff } },
                    { "stockMovements.date": { $lt: cutOff } },
                ],
            }).select("_id organization stockMovements");
        } catch (error) {
            Logger.error(`Movement archive: failed listing ${itemType} items`, error);
            continue;
        }

        for (const item of items) {
            try {
                const org = item.organization;
                const existing = await StockMovementArchive.findOne({
                    organization: org,
                    itemType,
                    itemId: item._id,
                });

                const full = sortByTimeAsc([
                    ...((existing?.movements || []).map((m) => ({ ...m }))),
                    ...item.stockMovements.map(toPlain),
                ]);

                // حماية من التكرار: نفس _id مرة واحدة
                const seen = new Set();
                const deduped = full.filter((m) => {
                    const key = String(m._id || `${m.timestamp}-${m.type}-${m.quantity}`);
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });

                const toArchive = deduped.filter(
                    (m) => movementTime(m) < cutOff.getTime()
                );
                const live = deduped.filter(
                    (m) => !(movementTime(m) < cutOff.getTime())
                );
                if (toArchive.length === 0) continue;

                const replayed = replayBalance(sortByTimeAsc(deduped), 0);
                const archivedPart = replayed
                    .filter((m) => movementTime(m) < cutOff.getTime())
                    .map((m) => {
                        const { archived, ...rest } = m;
                        return { ...rest, archived: true, archivedAt: new Date() };
                    });
                const livePart = replayed
                    .filter((m) => !(movementTime(m) < cutOff.getTime()))
                    .map((m) => {
                        // إسقاط الحقول المحسوبة قبل الحفظ (الـ schema يتجاهلها أيضاً)
                        const {
                            balanceAfter,
                            archived,
                            archivedAt,
                            ...rest
                        } = m;
                        return rest;
                    });
                const snapshotBalance =
                    archivedPart.length > 0
                        ? archivedPart[archivedPart.length - 1].balanceAfter
                        : 0;

                await StockMovementArchive.findOneAndUpdate(
                    { organization: org, itemType, itemId: item._id },
                    {
                        $set: {
                            movements: archivedPart,
                            snapshotBalance,
                            snapshotDate: cutOff,
                        },
                    },
                    { upsert: true, new: true }
                );

                item.stockMovements = livePart;
                await item.save();

                archivedCount +=
                    archivedPart.length - (existing?.movements?.length || 0);
            } catch (error) {
                Logger.error(
                    `Movement archive: failed for ${itemType} ${item._id}`,
                    error
                );
            }
        }
    }

    return archivedCount;
};
