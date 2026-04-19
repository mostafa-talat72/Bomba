import Logger from "../../middleware/logger.js";
import syncConfig from "../../config/syncConfig.js";
import syncQueueManager from "../../services/sync/syncQueueManager.js";
import OriginTracker from "../../services/sync/originTracker.js";

/**
 * Mongoose Sync Middleware
 * Intercepts database operations and queues them for Atlas synchronization
 * Uses post-hooks to ensure local operations complete before sync
 * Enhanced with origin tracking for bidirectional sync support
 */

// Create a singleton instance of OriginTracker
let originTracker = null;

/**
 * Get or create the OriginTracker instance
 * @returns {OriginTracker}
 */
function getOriginTracker() {
    if (!originTracker) {
        originTracker = new OriginTracker();
    }
    return originTracker;
}

/**
 * Check if a collection should be synced
 * @param {string} collectionName - Name of the collection
 * @returns {boolean}
 */
function shouldSync(collectionName) {
    // Check if sync is enabled
    if (!syncConfig.enabled) {
        return false;
    }

    // Check if collection is excluded
    if (syncConfig.excludedCollections.includes(collectionName)) {
        return false;
    }

    return true;
}

/**
 * Validate document before syncing
 * @param {Object} doc - Document to validate
 * @param {string} collectionName - Collection name
 * @returns {boolean} - True if valid, false otherwise
 */
function validateDocumentForSync(doc, collectionName) {
    // Special validation for devices collection
    if (collectionName === 'devices') {
        // Check required fields for devices
        if (!doc.name || (typeof doc.name === 'string' && doc.name.trim() === '')) {
            Logger.error(`🚫 Sync blocked: Device without name`, { docId: doc._id, doc });
            return false;
        }
        
        if (!doc.organization) {
            Logger.error(`🚫 Sync blocked: Device without organization`, { docId: doc._id, doc });
            return false;
        }
        
        if (!doc.number || (typeof doc.number === 'string' && doc.number.trim() === '')) {
            Logger.error(`🚫 Sync blocked: Device without number`, { docId: doc._id, doc });
            return false;
        }

        if (!doc.status) {
            Logger.error(`🚫 Sync blocked: Device without status`, { docId: doc._id, doc });
            return false;
        }

        // Check type-specific required fields
        if (doc.type === 'computer' && (!doc.hourlyRate || doc.hourlyRate <= 0)) {
            Logger.error(`🚫 Sync blocked: Computer device without valid hourlyRate`, { docId: doc._id, doc });
            return false;
        }

        if ((doc.type === 'playstation' || !doc.type) && (!doc.playstationRates || typeof doc.playstationRates !== 'object' || Object.keys(doc.playstationRates).length === 0)) {
            Logger.error(`🚫 Sync blocked: PlayStation device without valid playstationRates`, { docId: doc._id, doc });
            return false;
        }
    }
    
    // Special validation for bills collection
    if (collectionName === 'bills') {
        // Check required fields for bills
        if (!doc.organization) {
            Logger.error(`🚫 Sync blocked: Bill without organization`, { docId: doc._id, doc });
            return false;
        }
        
        if (!doc.createdBy) {
            Logger.error(`🚫 Sync blocked: Bill without createdBy`, { docId: doc._id, doc });
            return false;
        }

        // Check valid status
        const validStatuses = ['draft', 'partial', 'paid', 'cancelled', 'overdue'];
        if (doc.status && !validStatuses.includes(doc.status)) {
            Logger.error(`🚫 Sync blocked: Bill with invalid status`, { docId: doc._id, status: doc.status, doc });
            return false;
        }

        // Check valid type
        const validTypes = ['cafe', 'playstation', 'computer'];
        if (doc.type && !validTypes.includes(doc.type)) {
            Logger.error(`🚫 Sync blocked: Bill with invalid type`, { docId: doc._id, type: doc.type, doc });
            return false;
        }

        // Check numeric fields
        if (doc.subtotal !== undefined && (typeof doc.subtotal !== 'number' || doc.subtotal < 0)) {
            Logger.error(`🚫 Sync blocked: Bill with invalid subtotal`, { docId: doc._id, subtotal: doc.subtotal, doc });
            return false;
        }

        if (doc.total !== undefined && (typeof doc.total !== 'number' || doc.total < 0)) {
            Logger.error(`🚫 Sync blocked: Bill with invalid total`, { docId: doc._id, total: doc.total, doc });
            return false;
        }
    }
    
    // Add validation for other collections as needed
    
    return true;
}

/**
 * Post-save hook for insert operations
 * Triggered after a document is saved to local database
 */
function postSaveHook(doc, next) {
    try {
        const collectionName = this.collection.name;
        
        // 🔍 DEBUG: Log that middleware was triggered
        Logger.info(`🔍 [MIDDLEWARE] postSaveHook triggered for ${collectionName} (${doc._id})`);

        if (!shouldSync(collectionName)) {
            Logger.info(`⏭️  [MIDDLEWARE] Skipping sync for ${collectionName} (not in sync list)`);
            return next();
        }

        // Validate document before syncing
        const docData = doc.toObject ? doc.toObject() : doc;
        if (!validateDocumentForSync(docData, collectionName)) {
            Logger.warn(`🚫 Skipping sync for invalid ${collectionName} document`, { docId: doc._id });
            return next();
        }

        const tracker = getOriginTracker();
        
        // Mark this change as originating from Local
        tracker.markLocalChange(doc._id);

        // Queue insert operation with origin metadata
        const operation = {
            type: "insert",
            collection: collectionName,
            data: docData,
            timestamp: new Date(),
            origin: 'local',
            instanceId: tracker.instanceId,
        };

        syncQueueManager.enqueue(operation);
        
        // 🔍 DEBUG: Confirm operation was queued
        Logger.info(`✅ [MIDDLEWARE] Operation queued: insert on ${collectionName} (${doc._id})`);
        Logger.info(`📊 [MIDDLEWARE] Queue size now: ${syncQueueManager.size()}`);
    } catch (error) {
        // Log error but don't block the operation
        Logger.error("❌ Sync middleware error (post-save):", error.message);
    }

    next();
}

/**
 * Post-update hook for update operations
 * Triggered after a document is updated in local database
 */
function postUpdateHook(result, next) {
    try {
        const collectionName = this.model.collection.name;
        
        // 🔍 DEBUG: Log that middleware was triggered
        Logger.info(`🔍 [MIDDLEWARE] postUpdateHook triggered for ${collectionName}`);

        if (!shouldSync(collectionName)) {
            Logger.info(`⏭️  [MIDDLEWARE] Skipping sync for ${collectionName} (not in sync list)`);
            return next();
        }

        const tracker = getOriginTracker();

        // Get the filter used for the update
        const filter = this.getFilter();
        
        // Get the update data
        const update = this.getUpdate();

        // Validate update data for devices collection
        if (collectionName === 'devices' && update.$set) {
            // Check if the update would create invalid data
            if (update.$set.name === '' || update.$set.name === null) {
                Logger.warn(`🚫 Sync blocked: Update would clear device name`, { filter });
                return next();
            }
            if (update.$set.organization === null) {
                Logger.warn(`🚫 Sync blocked: Update would clear device organization`, { filter });
                return next();
            }
        }

        // Mark this change as originating from Local (if we have _id in filter)
        if (filter._id) {
            tracker.markLocalChange(filter._id);
        }

        // Queue update operation with origin metadata
        const operation = {
            type: "update",
            collection: collectionName,
            filter: filter,
            data: update.$set || update,
            timestamp: new Date(),
            origin: 'local',
            instanceId: tracker.instanceId,
        };

        syncQueueManager.enqueue(operation);
        
        // 🔍 DEBUG: Confirm operation was queued
        Logger.info(`✅ [MIDDLEWARE] Operation queued: update on ${collectionName}`);
        Logger.info(`📊 [MIDDLEWARE] Queue size now: ${syncQueueManager.size()}`);
    } catch (error) {
        Logger.error("❌ Sync middleware error (post-update):", error.message);
    }

    next();
}

/**
 * Post-findOneAndUpdate hook
 * Triggered after findOneAndUpdate operation
 */
function postFindOneAndUpdateHook(doc, next) {
    try {
        if (!doc) {
            return next();
        }

        const collectionName = this.model.collection.name;

        if (!shouldSync(collectionName)) {
            return next();
        }

        const tracker = getOriginTracker();

        // Get the filter used
        const filter = this.getFilter();

        // Mark this change as originating from Local
        tracker.markLocalChange(doc._id);

        // Queue update operation with the document data and origin metadata
        const operation = {
            type: "update",
            collection: collectionName,
            filter: filter,
            data: doc.toObject ? doc.toObject() : doc,
            timestamp: new Date(),
            origin: 'local',
            instanceId: tracker.instanceId,
        };

        syncQueueManager.enqueue(operation);
    } catch (error) {
        Logger.error(
            "❌ Sync middleware error (post-findOneAndUpdate):",
            error.message
        );
    }

    next();
}

/**
 * Post-remove hook for delete operations
 * Triggered after a document is removed from local database
 */
function postRemoveHook(doc, next) {
    try {
        const collectionName = this.collection.name;

        if (!shouldSync(collectionName)) {
            return next();
        }

        const tracker = getOriginTracker();

        // Mark this change as originating from Local
        tracker.markLocalChange(doc._id);

        // Queue delete operation with origin metadata
        const operation = {
            type: "delete",
            collection: collectionName,
            filter: { _id: doc._id },
            timestamp: new Date(),
            origin: 'local',
            instanceId: tracker.instanceId,
        };

        syncQueueManager.enqueue(operation);
    } catch (error) {
        Logger.error("❌ Sync middleware error (post-remove):", error.message);
    }

    next();
}

/**
 * Post-findOneAndDelete hook
 * Triggered after findOneAndDelete operation
 */
function postFindOneAndDeleteHook(doc, next) {
    try {
        if (!doc) {
            return next();
        }

        const collectionName = this.model.collection.name;

        if (!shouldSync(collectionName)) {
            return next();
        }

        const tracker = getOriginTracker();

        // Mark this change as originating from Local
        tracker.markLocalChange(doc._id);

        // Queue delete operation with origin metadata
        const operation = {
            type: "delete",
            collection: collectionName,
            filter: { _id: doc._id },
            timestamp: new Date(),
            origin: 'local',
            instanceId: tracker.instanceId,
        };

        syncQueueManager.enqueue(operation);
    } catch (error) {
        Logger.error(
            "❌ Sync middleware error (post-findOneAndDelete):",
            error.message
        );
    }

    next();
}

/**
 * Post-deleteOne hook
 * Triggered after deleteOne operation
 */
function postDeleteOneHook(result, next) {
    try {
        const collectionName = this.model.collection.name;

        if (!shouldSync(collectionName)) {
            return next();
        }

        const tracker = getOriginTracker();

        // Get the filter used for deletion
        const filter = this.getFilter();

        // Mark this change as originating from Local (if we have _id in filter)
        if (filter._id) {
            tracker.markLocalChange(filter._id);
        }

        // Queue delete operation with origin metadata
        const operation = {
            type: "delete",
            collection: collectionName,
            filter: filter,
            timestamp: new Date(),
            origin: 'local',
            instanceId: tracker.instanceId,
        };

        syncQueueManager.enqueue(operation);
    } catch (error) {
        Logger.error(
            "❌ Sync middleware error (post-deleteOne):",
            error.message
        );
    }

    next();
}

/**
 * Post-deleteMany hook
 * Triggered after deleteMany operation
 */
function postDeleteManyHook(result, next) {
    try {
        const collectionName = this.model.collection.name;

        if (!shouldSync(collectionName)) {
            return next();
        }

        const tracker = getOriginTracker();

        // Get the filter used for deletion
        const filter = this.getFilter();

        // Mark this change as originating from Local (if we have _id in filter)
        if (filter._id) {
            tracker.markLocalChange(filter._id);
        }

        // Queue delete operation with origin metadata
        const operation = {
            type: "delete",
            collection: collectionName,
            filter: filter,
            timestamp: new Date(),
            origin: 'local',
            instanceId: tracker.instanceId,
        };

        syncQueueManager.enqueue(operation);
    } catch (error) {
        Logger.error(
            "❌ Sync middleware error (post-deleteMany):",
            error.message
        );
    }

    next();
}

/**
 * Apply sync middleware to a Mongoose schema
 * @param {mongoose.Schema} schema - Mongoose schema to apply middleware to
 * @param {string} collectionName - Name of the collection (optional, for logging)
 */
export function applySyncMiddleware(schema, collectionName = 'Unknown') {
    if (!syncConfig.enabled) {
        Logger.info(`ℹ️  [MIDDLEWARE] Sync disabled, not applying to ${collectionName}`);
        return;
    }

    Logger.info(`✅ [MIDDLEWARE] Applying sync middleware to ${collectionName}`);

    // Post-save hook (for inserts and saves)
    schema.post("save", postSaveHook);

    // Post-update hooks
    schema.post("updateOne", postUpdateHook);
    schema.post("updateMany", postUpdateHook);
    schema.post("findOneAndUpdate", postFindOneAndUpdateHook);

    // Post-delete hooks
    schema.post("remove", postRemoveHook);
    schema.post("deleteOne", postDeleteOneHook);
    schema.post("deleteMany", postDeleteManyHook);
    schema.post("findOneAndDelete", postFindOneAndDeleteHook);
    schema.post("findOneAndRemove", postFindOneAndDeleteHook);
    
    Logger.info(`✅ [MIDDLEWARE] Successfully applied sync hooks to ${collectionName}`);
}

/**
 * Create sync middleware configuration for manual application
 * @returns {Object} Middleware functions
 */
export function createSyncMiddleware() {
    return {
        postSave: postSaveHook,
        postUpdate: postUpdateHook,
        postFindOneAndUpdate: postFindOneAndUpdateHook,
        postRemove: postRemoveHook,
        postDeleteOne: postDeleteOneHook,
        postDeleteMany: postDeleteManyHook,
        postFindOneAndDelete: postFindOneAndDeleteHook,
    };
}

/**
 * Apply sync middleware to all models in a Mongoose connection
 * @param {mongoose.Connection} connection - Mongoose connection
 */
export function applySyncMiddlewareToAllModels(connection) {
    if (!syncConfig.enabled) {
        Logger.info("ℹ️  Sync disabled, middleware not applied");
        return;
    }

    const modelNames = connection.modelNames();
    let appliedCount = 0;

    modelNames.forEach((modelName) => {
        const model = connection.model(modelName);
        const collectionName = model.collection.name;

        // Skip if collection is excluded
        if (syncConfig.excludedCollections.includes(collectionName)) {
            Logger.info(`⏭️  Skipping sync middleware for: ${collectionName}`);
            return;
        }

        applySyncMiddleware(model.schema);
        appliedCount++;
    });

    Logger.info(
        `✅ Sync middleware applied to ${appliedCount}/${modelNames.length} models`
    );

    if (syncConfig.excludedCollections.length > 0) {
        Logger.info(
            `ℹ️  Excluded collections: ${syncConfig.excludedCollections.join(", ")}`
        );
    }
}

// Export getOriginTracker as named export for external use
export { getOriginTracker };

export default {
    applySyncMiddleware,
    createSyncMiddleware,
    applySyncMiddlewareToAllModels,
    getOriginTracker,
};
