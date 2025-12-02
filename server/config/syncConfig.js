import dotenv from "dotenv";

dotenv.config();

/**
 * Centralized configuration for MongoDB dual sync system
 * Controls behavior of local MongoDB and Atlas synchronization
 */
const syncConfig = {
    // Enable/disable sync system
    enabled: process.env.SYNC_ENABLED === "true",

    // Database connection URIs
    localUri:
        process.env.MONGODB_LOCAL_URI || "mongodb://localhost:27017/bomba",
    atlasUri: process.env.MONGODB_ATLAS_URI || "",

    // Queue configuration
    queueMaxSize: parseInt(process.env.SYNC_QUEUE_MAX_SIZE) || 10000,
    workerInterval: parseInt(process.env.SYNC_WORKER_INTERVAL) || 100, // ms

    // Retry configuration
    maxRetries: parseInt(process.env.SYNC_MAX_RETRIES) || 5,
    retryDelays: [1000, 5000, 15000, 30000, 60000], // exponential backoff in ms

    // Queue persistence
    persistQueue: process.env.SYNC_PERSIST_QUEUE === "true",
    queuePersistencePath: process.env.SYNC_QUEUE_PATH || "./data/sync-queue.json",

    // Collection filtering
    excludedCollections: (process.env.SYNC_EXCLUDED_COLLECTIONS || "")
        .split(",")
        .filter(Boolean),

    // Batch processing
    batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 100,

    // Monitoring thresholds
    queueWarningThreshold: parseInt(process.env.SYNC_QUEUE_WARNING_THRESHOLD) || 5000,
    lagWarningThreshold: parseInt(process.env.SYNC_LAG_WARNING_THRESHOLD) || 60000, // ms

    // Bidirectional sync configuration
    bidirectionalSync: {
        // Enable/disable bidirectional sync (Atlas → Local)
        enabled: process.env.BIDIRECTIONAL_SYNC_ENABLED === "true",

        // Change Stream configuration
        changeStream: {
            batchSize: parseInt(process.env.ATLAS_CHANGE_STREAM_BATCH_SIZE) || 100,
            reconnectInterval: parseInt(process.env.CHANGE_STREAM_RECONNECT_INTERVAL) || 5000,
            maxReconnectAttempts: parseInt(process.env.CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS) || 10,
        },

        // Collections excluded from bidirectional sync (one-way only: Local → Atlas)
        excludedCollections: (process.env.BIDIRECTIONAL_EXCLUDED_COLLECTIONS || "")
            .split(",")
            .filter(Boolean),

        // Conflict resolution strategy
        conflictResolution: {
            strategy: process.env.CONFLICT_RESOLUTION_STRATEGY || "last-write-wins",
        },

        // Origin tracking configuration
        originTracking: {
            cleanupInterval: parseInt(process.env.ORIGIN_TRACKING_CLEANUP_INTERVAL) || 60000,
        },
    },
};

/**
 * Validate sync configuration
 * @returns {Object} Validation result with isValid flag and errors array
 */
export function validateSyncConfig() {
    const errors = [];
    const warnings = [];

    if (syncConfig.enabled) {
        if (!syncConfig.atlasUri) {
            errors.push("MONGODB_ATLAS_URI is required when sync is enabled");
        }

        if (syncConfig.queueMaxSize < 100) {
            errors.push("SYNC_QUEUE_MAX_SIZE must be at least 100");
        }

        if (syncConfig.workerInterval < 10) {
            errors.push("SYNC_WORKER_INTERVAL must be at least 10ms");
        }

        if (syncConfig.maxRetries < 1 || syncConfig.maxRetries > 10) {
            errors.push("SYNC_MAX_RETRIES must be between 1 and 10");
        }

        if (syncConfig.batchSize < 1 || syncConfig.batchSize > 1000) {
            errors.push("SYNC_BATCH_SIZE must be between 1 and 1000");
        }

        // Validate excluded collections
        if (syncConfig.excludedCollections.length > 0) {
            syncConfig.excludedCollections.forEach(coll => {
                if (typeof coll !== 'string' || coll.trim() === '') {
                    errors.push(`Invalid collection name in SYNC_EXCLUDED_COLLECTIONS: "${coll}"`);
                }
            });
        }

        // Validate bidirectional sync configuration
        if (syncConfig.bidirectionalSync.enabled) {
            if (!syncConfig.atlasUri) {
                errors.push("MONGODB_ATLAS_URI is required when bidirectional sync is enabled");
            }

            if (syncConfig.bidirectionalSync.changeStream.batchSize < 1 || 
                syncConfig.bidirectionalSync.changeStream.batchSize > 1000) {
                errors.push("ATLAS_CHANGE_STREAM_BATCH_SIZE must be between 1 and 1000");
            }

            if (syncConfig.bidirectionalSync.changeStream.reconnectInterval < 1000) {
                errors.push("CHANGE_STREAM_RECONNECT_INTERVAL must be at least 1000ms");
            }

            if (syncConfig.bidirectionalSync.changeStream.maxReconnectAttempts < 1 || 
                syncConfig.bidirectionalSync.changeStream.maxReconnectAttempts > 100) {
                errors.push("CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS must be between 1 and 100");
            }

            const validStrategies = ['last-write-wins'];
            if (!validStrategies.includes(syncConfig.bidirectionalSync.conflictResolution.strategy)) {
                errors.push(`CONFLICT_RESOLUTION_STRATEGY must be one of: ${validStrategies.join(', ')}`);
            }

            if (syncConfig.bidirectionalSync.originTracking.cleanupInterval < 10000) {
                errors.push("ORIGIN_TRACKING_CLEANUP_INTERVAL must be at least 10000ms (10 seconds)");
            }

            // Validate bidirectional excluded collections
            if (syncConfig.bidirectionalSync.excludedCollections.length > 0) {
                syncConfig.bidirectionalSync.excludedCollections.forEach(coll => {
                    if (typeof coll !== 'string' || coll.trim() === '') {
                        errors.push(`Invalid collection name in BIDIRECTIONAL_EXCLUDED_COLLECTIONS: "${coll}"`);
                    }
                });

                // Warn if excluded collections are also in general excluded collections
                const generalExcluded = new Set(syncConfig.excludedCollections);
                syncConfig.bidirectionalSync.excludedCollections.forEach(coll => {
                    if (generalExcluded.has(coll)) {
                        warnings.push(
                            `Collection "${coll}" is excluded from both one-way and bidirectional sync. ` +
                            `It will not be synced at all.`
                        );
                    }
                });
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Get safe configuration with defaults applied
 * @returns {Object} Safe configuration object
 */
export function getSafeConfig() {
    const validation = validateSyncConfig();

    if (!validation.isValid) {
        console.warn("⚠️ Sync configuration validation failed:");
        validation.errors.forEach((error) => console.warn(`  - ${error}`));
        console.warn("⚠️ Using safe defaults");

        return {
            ...syncConfig,
            enabled: false, // Disable sync if config is invalid
        };
    }

    // Log warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
        console.warn("⚠️ Sync configuration warnings:");
        validation.warnings.forEach((warning) => console.warn(`  - ${warning}`));
    }

    return syncConfig;
}

/**
 * Update excluded collections dynamically
 * @param {string[]} collections - Array of collection names to exclude
 * @param {boolean} bidirectional - If true, updates bidirectional exclusions; otherwise updates one-way exclusions
 * @returns {Object} Result with success flag and message
 */
export function updateExcludedCollections(collections, bidirectional = false) {
    try {
        // Validate input
        if (!Array.isArray(collections)) {
            return {
                success: false,
                message: 'Collections must be an array'
            };
        }

        // Validate each collection name
        for (const coll of collections) {
            if (typeof coll !== 'string' || coll.trim() === '') {
                return {
                    success: false,
                    message: `Invalid collection name: "${coll}"`
                };
            }
        }

        // Update the appropriate exclusion list
        if (bidirectional) {
            syncConfig.bidirectionalSync.excludedCollections = collections;
        } else {
            syncConfig.excludedCollections = collections;
        }

        // Validate the new configuration
        const validation = validateSyncConfig();
        if (!validation.isValid) {
            return {
                success: false,
                message: 'Updated configuration is invalid',
                errors: validation.errors
            };
        }

        return {
            success: true,
            message: `Successfully updated ${bidirectional ? 'bidirectional' : 'one-way'} excluded collections`,
            warnings: validation.warnings || []
        };

    } catch (error) {
        return {
            success: false,
            message: `Error updating excluded collections: ${error.message}`
        };
    }
}

/**
 * Get current excluded collections
 * @returns {Object} Object with one-way and bidirectional exclusions
 */
export function getExcludedCollections() {
    return {
        oneWay: [...syncConfig.excludedCollections],
        bidirectional: [...(syncConfig.bidirectionalSync.excludedCollections || [])],
        combined: [
            ...new Set([
                ...syncConfig.excludedCollections,
                ...(syncConfig.bidirectionalSync.excludedCollections || [])
            ])
        ]
    };
}

export default syncConfig;
