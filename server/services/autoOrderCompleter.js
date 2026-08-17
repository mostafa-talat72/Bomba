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
        let changed = false;

        for (const item of order.items) {
            const quantity = item.quantity || 0;
            const delivered = item.deliveredCount || 0;
            if (delivered >= quantity) continue;

            if ((item.preparedCount || 0) < quantity) {
                item.preparedCount = quantity;
                changed = true;
            }
            if (delivered < quantity) {
                item.deliveredCount = quantity;
                changed = true;
            }
        }

        if (!changed) continue;

        order.status = "delivered";
        order.deliveredTime = new Date();
        order.markModified("items");
        await order.save();

        if (io && typeof io.notifyOrderUpdate === "function") {
            try {
                io.notifyOrderUpdate("item-delivered", order);
            } catch (err) {
                Logger.error("[AutoComplete] Socket notify failed", err);
            }
        }

        completed++;
        console.log(
            `[AutoComplete] Order #${order.orderNumber} auto-prepared & delivered (${order.items.length} items, older than 24h)`
        );
    }

    if (completed > 0) {
        console.log(`[AutoComplete] Pass finished: ${completed} order(s) completed`);
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
    console.log("[AutoComplete] Scheduled job started (every 10 minutes, threshold 24h)");
};
