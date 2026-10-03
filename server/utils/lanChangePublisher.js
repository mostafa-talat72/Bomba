import mongoose from "mongoose";
import Logger from "../middleware/logger.js";
import { pushLanOp } from "./lanPeerSync.js";

/**
 * ناشر لحظي واحد لكل الكتابات (A):
 * Change Stream على الداتابيز المحلية يلتقط أي تغيير أيًا كان مصدره
 * (كنترولرز، إعادة تشغيل المزامنة، تنظيف تلقائي، استعادة نسخ، سكربتات)
 * ويدفعه للجيران عبر pushLanOp — بدل الاعتماد على تذكر كل مسار.
 *
 * منع الصدى: المستندات المطبقة من الجار موسومة LAN في originTracker
 * (تُمسح بعد ~60ث) — أي حدث عليها يُتجاهل ولا يُعاد نشره.
 * يتطلب replica set (موجود rs0) — وبدونه يُعطَّل بهدوء ويبقى B+N الحالي.
 */

let changeStream = null;
let started = false;
let retryTimer = null;

async function isEcho(docId) {
    try {
        if (!docId) return false;
        // Try originTracker singleton (same process model registry)
        const { default: OriginTracker } = await import("../services/sync/originTracker.js");
        const tracker =
            typeof OriginTracker?.getInstance === "function"
                ? OriginTracker.getInstance()
                : global.__originTracker || null;
        if (!tracker || typeof tracker.isLanChange !== "function") return false;
        return tracker.isLanChange(docId) === true;
    } catch {
        return false;
    }
}

function collectionOf(change) {
    try {
        return change?.ns?.coll || null;
    } catch {
        return null;
    }
}

// إخماد التكرار: الـ middleware القديم يدفع نفس الكتابة أيضًا —
// لا تدفع نفس (مجموعة:معرف:لحظة) مرتين خلال نافذة قصيرة.
const recentlyPushed = new Map();
const DEDUP_MS = 3000;

function pushedRecently(coll, id, ts) {
    try {
        const key = `${coll}:${String(id)}:${String(ts || "")}`;
        const now = Date.now();
        const last = recentlyPushed.get(key);
        if (last && now - last < DEDUP_MS) return true;
        recentlyPushed.set(key, now);
        if (recentlyPushed.size > 2000) {
            const cutoff = now - DEDUP_MS;
            for (const [k, v] of recentlyPushed) {
                if (v < cutoff) recentlyPushed.delete(k);
            }
        }
        return false;
    } catch {
        return false;
    }
}

async function handleChange(change) {
    try {
        const op = change?.operationType;
        if (!op || op === "invalidate") return;
        const coll = collectionOf(change);
        if (!coll || coll.startsWith("system.")) return;

        const id = change?.documentKey?._id;
        if (id === undefined || id === null) return;

        // صدى؟ مطبق من جار منذ لحظات -> تجاهل
        if (await isEcho(id)) return;

        if (op === "delete") {
            pushLanOp({ collection: coll, type: "delete", data: { _id: id } });
            return;
        }

        let doc = change?.fullDocument || null;
        if (!doc) {
            // نادر (update بلا lookup) — اقرأ النسخة الكاملة (رخيص ونادر)
            try {
                const db = mongoose.connection?.db;
                if (!db) return;
                doc = await db.collection(coll).findOne({ _id: id });
            } catch {}
            if (!doc) return;
        }
        if (pushedRecently(coll, doc._id ?? id, doc.updatedAt)) return;
        pushLanOp({
            collection: coll,
            type: op === "insert" ? "insert" : "update",
            data: doc,
        });
    } catch (err) {
        Logger.warn("[LanPublisher] handle change failed:", err?.message || err);
    }
}

function attach(stream) {
    stream.on("change", (change) => {
        void handleChange(change).catch(() => {});
    });
    stream.on("error", (err) => {
        Logger.warn("[LanPublisher] change stream error (retry in 30s):", err?.message || err);
        scheduleRetry();
    });
    stream.on("close", () => {
        Logger.warn("[LanPublisher] change stream closed (retry in 30s)");
        scheduleRetry();
    });
}

function scheduleRetry() {
    try {
        if (changeStream) {
            try { changeStream.close().catch(() => {}); } catch {}
            changeStream = null;
        }
    } catch {}
    started = false;
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
        retryTimer = null;
        void startLanChangePublisher().catch(() => {});
    }, 30000);
    if (retryTimer.unref) retryTimer.unref();
}

export async function startLanChangePublisher() {
    if (started) return true;
    if (process.env.LAN_PEER_SYNC_ENABLED === "false") return false;
    const db = mongoose.connection?.db;
    if (!db) {
        Logger.warn("[LanPublisher] local DB not ready, skipping");
        return false;
    }
    // حتمي: لا replica set (مثل 4.4 مستقل) = لا change streams = تعطيل هادئ بلا spam
    try {
        const hello = await db.admin().command({ hello: 1 });
        if (!hello || !hello.setName) {
            Logger.warn("[LanPublisher] disabled: local Mongo is standalone (needs replica set; 4.4 needs rs init)");
            return false;
        }
    } catch (err) {
        Logger.warn("[LanPublisher] hello check failed, skipping:", err?.message || err);
        return false;
    }
    try {
        changeStream = db.watch([], { fullDocument: "updateLookup" });
        attach(changeStream);
        started = true;
        Logger.info("[LanPublisher] LAN change-stream publisher started");
        return true;
    } catch (err) {
        try { if (changeStream) await changeStream.close().catch(() => {}); } catch {}
        changeStream = null;
        Logger.warn("[LanPublisher] disabled:", err?.message || err);
        return false;
    }
}

export function stopLanChangePublisher() {
    try {
        if (changeStream) {
            try { changeStream.close().catch(() => {}); } catch {}
            changeStream = null;
        }
    } catch {}
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
    started = false;
}

export default { startLanChangePublisher, stopLanChangePublisher };
