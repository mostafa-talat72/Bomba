import Order from "../models/Order.js";
import Logger from "../middleware/logger.js";

// الطلبات اللي ما اتمش تجهيزها أو توصيلها خلال 24 ساعة من إنشائها
// بتتجهز وتتوصّل أوتوماتيكيًا حتى لو شاشة المطبخ مقفولة.
const AUTO_COMPLETE_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60 * 1000;

export const runAutoOrderCompleteOnce = async (io) => {
    const cutoff = new Date(Date.now() - AUTO_COMPLETE_MS);
    const orders = await Order.find({
        status: { $in: ["pending", "preparing", "ready"] },
        createdAt: { $lt: cutoff },
    });

    let completed = 0;
    for (const order of orders) {
        const now = new Date();
        const updateFields = {
            status: "delivered",
            deliveredTime: now,
            updatedBy: order.updatedBy || "system",
        };

        // Build updated items array with preparedCount/deliveredCount bumped
        const updatedItems = order.items.map((item) => {
            const quantity = item.quantity || 0;
            const delivered = item.deliveredCount || 0;
            if (delivered >= quantity) return item.toObject();

            return {
                ...item.toObject(),
                preparedCount: quantity,
                deliveredCount: quantity,
            };
        });

        // Check if anything actually changed
        const changed = updatedItems.some(
            (item, i) =>
                item.preparedCount !== (order.items[i].preparedCount || 0) ||
                item.deliveredCount !== (order.items[i].deliveredCount || 0)
        );

        if (!changed) continue;

        updateFields.items = updatedItems;

        // Use findOneAndUpdate (atomic, no version check) to avoid
        // VersionError conflicts with sync middleware
        const result = await Order.findOneAndUpdate(
            { _id: order._id, status: { $in: ["pending", "preparing", "ready"] } },
            { $set: updateFields, $inc: { __v: 1 } },
            { new: true }
        );

        if (!result) continue;

        if (io && typeof io.notifyOrderUpdate === "function") {
            try {
                io.notifyOrderUpdate("item-delivered", result, result.organization);
            } catch (err) {
                Logger.error("[AutoComplete] Socket notify failed", err);
            }
        }

        completed++;
        Logger.info(
            `[AutoComplete] Order #${result.orderNumber} auto-prepared & delivered (${result.items.length} items, older than 24h)`
        );
    }

    if (completed > 0) {
        Logger.info(`[AutoComplete] Pass finished: ${completed} order(s) completed`);
    }
    return completed;
};

export const startAutoOrderCompleter = (io) => {
    const run = async () => {
        try {
            await runAutoOrderCompleteOnce(io);
        } catch (err) {
            Logger.error("[AutoComplete] Pass failed", err);
        }
    };

    setTimeout(run, FIRST_RUN_DELAY_MS);
    setInterval(run, CHECK_INTERVAL_MS);
    Logger.info("[AutoComplete] Scheduled job started (every 10 minutes, threshold 24h)");
};
