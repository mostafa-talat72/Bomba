import dualDatabaseManager from "../config/dualDatabaseManager.js";
import Logger from "../middleware/logger.js";

/**
 * Fire-and-forget Atlas write - does not block the response
 * @param {string} collection - Collection name
 * @param {'insert'|'upsert'|'update'|'delete'} operation - Operation type
 * @param {Object} data - Document data (for insert/upsert/update)
 * @param {Object} filter - Filter for update/delete
 */
export function writeToAtlas(collection, operation, data, filter = {}) {
  const atlasConnection = dualDatabaseManager.getAtlasConnection();
  if (!atlasConnection) {
    Logger.warn(`Atlas not available for ${operation} on ${collection} - will sync later`);
    return;
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
      Logger.warn(`Atlas ${operation} failed for ${collection}: ${err.message}`);
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
    Logger.warn(`Atlas not available for batch write on ${collection} - will sync later`);
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
      Logger.warn(`Atlas batch write failed for ${collection}: ${err.message}`);
    }
  })();
}