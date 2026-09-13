import dualDatabaseManager from "../config/dualDatabaseManager.js";
import Logger from "../middleware/logger.js";

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
  const atlasConnection = dualDatabaseManager.getAtlasConnection();
  if (!atlasConnection) {
    const now = Date.now();
    if (now - _lastAtlasUnavailableLog > ATLAS_UNAVAILABLE_LOG_THROTTLE_MS) {
      Logger.warn(`Atlas not available for ${operation} on ${collection} — enqueueing for retry`);
      _lastAtlasUnavailableLog = now;
    }
    enqueueForRetry(collection, operation, data, filter);
    return Promise.resolve();
  }

  // Fire and forget - don't await
  const promise = (async () => {
    try {
      switch (operation) {
        case 'insert':
        case 'upsert':
          await atlasConnection.collection(collection).updateOne(
            filter._id ? { _id: filter._id } : filter,
            { $set: data },
            { upsert: true }
          );
          break;
        case 'update':
          await atlasConnection.collection(collection).updateOne(
            filter,
            { $set: data },
            { upsert: false }
          );
          break;
        case 'delete':
          await atlasConnection.collection(collection).deleteOne(filter);
          break;
      }
    } catch (err) {
      Logger.warn(`Atlas ${operation} failed for ${collection}: ${err.message} - enqueueing for retry`);
      enqueueForRetry(collection, operation, data, filter);
    }
  })();

  return promise;
}

/**
 * Fire-and-forget batch Atlas write
 */
export function writeBatchToAtlas(collection, operations) {
  const atlasConnection = dualDatabaseManager.getAtlasConnection();
  if (!atlasConnection) {
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
        await atlasConnection.collection(collection).bulkWrite(bulkOps, { ordered: false });
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