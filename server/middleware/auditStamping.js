import { AsyncLocalStorage } from "node:async_hooks";

// Carries the acting user (from authenticateToken) across the async chain so
// Mongoose hooks can stamp updatedBy on Order/Bill saves — without touching
// ~20 payment/update controller paths. Fail-open: no context (sockets, cron,
// LAN-sync applier) => no stamping, request unaffected.
const als = new AsyncLocalStorage();

export function runWithAuditUser(userId, fn) {
    return als.run({ userId: userId ? String(userId) : null }, fn);
}

export function getAuditUserId() {
    try {
        return als.getStore()?.userId || null;
    } catch {
        return null;
    }
}

// Stamp helper shared by model hooks (save + findOneAndUpdate).
export function stampUpdatedBy(docOrUpdate) {
    try {
        const userId = getAuditUserId();
        if (!userId) return;
        if (typeof docOrUpdate?.getUpdate === "function") {
            // Query (findOneAndUpdate): merge into $set without clobbering.
            // NOTE: check getUpdate (query-only), NOT set() — Mongoose
            // documents also have .set() but no .getUpdate().
            const cur = docOrUpdate.getUpdate() || {};
            if (cur.updatedBy || cur.$set?.updatedBy) return; // explicit wins
            docOrUpdate.set({ updatedBy: userId });
        } else if (docOrUpdate && typeof docOrUpdate === "object") {
            // Document (save)
            docOrUpdate.updatedBy = userId;
        }
    } catch {}
}
