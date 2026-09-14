import dualDatabaseManager from "../config/dualDatabaseManager.js";
import Logger from "../middleware/logger.js";
import { depopulateSyncPayload } from "./syncSanitize.js";

// Throttle "Atlas not available" warnings — log at most once per 30s
let _lastAtlasUnavailableLog = 0;
const ATLAS_UNAVAILABLE_LOG_THROTTLE_MS = 30000;

/**
 * Enqueue a failed Atlas write to sync queue for retry
 */
async function enqueueForRetry(collection, operation, data, filter) {
  try {
    const { default: syncQueueManager } = await import("../services/sync/syncQueueManager.js");
    const op = {
      type: operation === "insert" || operation === "upsert" ? "insert" : operation,
      collection,
      origin: "local",
      instanceId: "write-retry",
      timestamp: new Date(),
    };
    if (operation === "delete") {
      op.filter = filter || {};
    } else {
      op.data = data || {};
      op.filter = filter || {};
    }
    syncQueueManager.enqueue(op);
    Logger.debug(`📋 Atlas ${operation} enqueued for retry: ${collection}`);
  } catch (err) {
    Logger.error(`❌ Failed to enqueue Atlas write for retry: ${err.message}`);
  }
}

/**
 * Fire-and-forget Atlas write - does not block the response
 * On failure, enqueues to sync queue for retry when Atlas comes back
 * @param {string} collection - Collection name
 * @param {'insert'|'upsert'|'update'|'delete'} operation - Operation type
 * @param {Object} data - Document data (for insert/upsert/update)
 * @param {Object} filter - Filter for update/delete
 */
export function writeToAtlas(collection, operation, data, filter = {}) {
  // Depopulate first: callers often pass populated docs (bill.orders as
  // objects) — collapsed back to ObjectIds before any Atlas write/retry.
  if (operation !== "delete" && data && typeof data === "object") {
    try {
      data = depopulateSyncPayload(collection, data);
    } catch {}
  }
  const atlasConnection = dualDatabaseManager.getAtlasConnection();
  if (!atlasConnection || atlasConnection.readyState !== 1 || !atlasConnection.db) {
    const now = Date.now();
    if (now - _lastAtlasUnavailableLog > ATLAS_UNAVAILABLE_LOG_THROTTLE_MS) {
      Logger.warn(`Atlas not available for ${operation} on ${collection} — enqueueing for retry`);
      _lastAtlasUnavailableLog = now;
    }
    enqueueForRetry(collection, operation, data, filter);
    return Promise.resolve();
  }

  // Fire and forget — DECOUPLED: always return an already-resolved promise so
  // that even `await writeToAtlas(...)` can NEVER stall the caller on Atlas
  // latency. (The operation below settles only after the network round-trip,
  // so awaiting the raw promise would wait a full Atlas RTT.)
  const promise = (async () => {
    try {
      const db = atlasConnection.db;
      switch (operation) {
        case 'insert':
        case 'upsert':
          await db.collection(collection).updateOne(
            filter._id ? { _id: filter._id } : filter,
            { $set: data },
            { upsert: true }
          );
          break;
        case 'update':
          await db.collection(collection).updateOne(
            filter,
            { $set: data },
            { upsert: false }
          );
          break;
        case 'delete':
          await db.collection(collection).deleteOne(filter);
          break;
      }
    } catch (err) {
      Logger.warn(`Atlas ${operation} failed for ${collection}: ${err.message} - enqueueing for retry`);
      enqueueForRetry(collection, operation, data, filter);
    }
  })();

  promise.catch(() => {});
  return Promise.resolve();
}

/**
 * Fire-and-forget batch Atlas write
 */
export function writeBatchToAtlas(collection, operations) {
  // Depopulate first (same reason as writeToAtlas).
  try {
    for (const op of operations || []) {
      if (op && op.type !== "delete" && op.data && typeof op.data === "object") {
        op.data = depopulateSyncPayload(collection, op.data);
      }
    }
  } catch {}
  const atlasConnection = dualDatabaseManager.getAtlasConnection();
  if (!atlasConnection || atlasConnection.readyState !== 1 || !atlasConnection.db) {
    const now = Date.now();
    if (now - _lastAtlasUnavailableLog > ATLAS_UNAVAILABLE_LOG_THROTTLE_MS) {
      Logger.warn(`Atlas not available for batch write on ${collection} — enqueueing for retry`);
      _lastAtlasUnavailableLog = now;
    }
    (async () => {
      for (const op of operations) {
        await enqueueForRetry(collection, op.type, op.data, op.filter);
      }
    })();
    return;
  }

  (async () => {
    try {
      const bulkOps = operations.map(op => {
        switch (op.type) {
          case 'insert':
          case 'upsert':
            return {
              updateOne: {
                filter: op.filter || { _id: op.data._id },
                update: { $set: op.data },
                upsert: true
              }
            };
          case 'update':
            return {
              updateOne: {
                filter: op.filter,
                update: { $set: op.data },
                upsert: false
              }
            };
          case 'delete':
            return {
              deleteOne: {
                filter: op.filter
              }
            };
        }
      });

      if (bulkOps.length > 0) {
        await atlasConnection.db.collection(collection).bulkWrite(bulkOps, { ordered: false });
      }
    } catch (err) {
      const now = Date.now();
      if (now - _lastAtlasUnavailableLog > ATLAS_UNAVAILABLE_LOG_THROTTLE_MS) {
        Logger.warn(`Atlas batch write failed for ${collection}: ${err.message} — enqueueing for retry`);
        _lastAtlasUnavailableLog = now;
      }
      for (const op of operations) {
        await enqueueForRetry(collection, op.type, op.data, op.filter);
      }
    }
  })();
}