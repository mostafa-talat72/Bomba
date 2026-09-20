import Logger from "../middleware/logger.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";

/**
 * Purge audit logs older than 24h from BOTH Local and Atlas.
 *
 * Two independent mechanisms (defense in depth):
 *  1. TTL index `{ createdAt: 1 } expireAfterSeconds: 86400` on BOTH dbs —
 *     MongoDB itself removes expired docs (DB-level, needs no app code).
 *  2. This scheduled retry — direct deletes in 1000-doc chunks.
 *
 * Deliberately NO tombstones: audit logs are ephemeral monitoring data.
 * Resurrection of a stale audit row is harmless and self-corrects, so we
 * keep the tombstone collection clean.
 *
 * Uses the native driver (bypasses Mongoose sync middleware on purpose —
 * Atlas is handled explicitly here, avoiding duplicate queue ops).
 * Bounded: at most `maxDeletedPerDb` docs per db per run.
 */
const AUDIT_RETENTION_MS = 24 * 60 * 60 * 1000;
const CHUNK_SIZE = 1000;
const MAX_ITERATIONS = 50;

async function ensureAuditTtlIndex(db, label) {
    try {
        await db.collection("auditlogs").createIndex(
            { createdAt: 1 },
            { expireAfterSeconds: 24 * 60 * 60 }
        );
    } catch (e) {
        // Index already exists (or equivalent) — not fatal.
        Logger.debug(`auditCleanup: TTL ensure on ${label}: ${e.message}`);
    }
}

async function purgeOneDb(db, label, maxTotal) {
    const coll = db.collection("auditlogs");
    await ensureAuditTtlIndex(db, label);

    let deleted = 0;
    let iterations = 0;
    for (;;) {
        if (deleted >= maxTotal || iterations >= MAX_ITERATIONS) break;
        iterations++;
        const cutoff = new Date(Date.now() - AUDIT_RETENTION_MS);
        const remaining = Math.min(CHUNK_SIZE, maxTotal - deleted);
        let batch = [];
        try {
            batch = await coll
                .find(
                    { createdAt: { $lt: cutoff } },
                    { projection: { _id: 1 } }
                )
                .sort({ _id: 1 })
                .limit(remaining)
                .toArray();
        } catch (e) {
            Logger.warn(`auditCleanup: find failed on ${label}: ${e.message}`);
            break;
        }
        if (!batch.length) break;

        try {
            const r = await coll.deleteMany({
                _id: { $in: batch.map((d) => d._id) },
            });
            const n = r.deletedCount || 0;
            deleted += n;
            if (n < batch.length) break; // rest vanished (TTL race) — stop spinning
        } catch (e) {
            Logger.warn(`auditCleanup: delete failed on ${label}: ${e.message}`);
            break;
        }
        if (batch.length < remaining) break; // drained
    }
    return deleted;
}

export async function cleanupAuditLogs({ maxDeletedPerDb = 10000 } = {}) {
    const started = Date.now();
    Logger.info("🧹 auditCleanup: purging audit logs older than 24h (Local + Atlas)...");

    let localDeleted = 0;
    try {
        const localConn = dualDatabaseManager.getLocalConnection();
        if (localConn?.db) {
            localDeleted = await purgeOneDb(localConn.db, "Local", maxDeletedPerDb);
        } else {
            Logger.warn("auditCleanup: Local db unavailable — skipping");
        }
    } catch (e) {
        Logger.warn(`auditCleanup: Local failed: ${e.message}`);
    }

    let atlasDeleted = 0;
    try {
        const atlasConn = dualDatabaseManager.getAtlasConnection();
        if (atlasConn && atlasConn.readyState === 1 && atlasConn.db) {
            atlasDeleted = await purgeOneDb(atlasConn.db, "Atlas", maxDeletedPerDb);
        } else {
            Logger.warn("auditCleanup: Atlas unavailable — TTL on Atlas + next hour retry cover it");
        }
    } catch (e) {
        Logger.warn(`auditCleanup: Atlas failed: ${e.message}`);
    }

    Logger.info(
        `✅ auditCleanup done in ${Date.now() - started}ms — Local deleted: ${localDeleted}, Atlas deleted: ${atlasDeleted}`
    );
    return { local: localDeleted, atlas: atlasDeleted };
}

export default { cleanupAuditLogs };
