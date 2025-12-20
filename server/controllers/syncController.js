import syncMonitor from "../services/sync/syncMonitor.js";
import syncWorker from "../services/sync/syncWorker.js";
import syncQueueManager from "../services/sync/syncQueueManager.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";
import syncConfig from "../config/syncConfig.js";
import Logger from "../middleware/logger.js";
import bidirectionalSyncMonitor from "../services/sync/bidirectionalSyncMonitor.js";

/**
 * Get sync system metrics
 * @route GET /api/sync/metrics
 * @access Private (Admin only)
 */
export const getMetrics = async (req, res) => {
    try {
        const metrics = syncMonitor.getMetrics();

        res.json({
            success: true,
            data: metrics,
        });
    } catch (error) {
        Logger.error("Error getting sync metrics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get sync metrics",
            error: error.message,
        });
    }
};

/**
 * Get sync system health status
 * @route GET /api/sync/health
 * @access Private (Admin only)
 */
export const getHealth = async (req, res) => {
    try {
        const health = syncMonitor.checkHealth();

        // Set appropriate status code based on health
        let statusCode = 200;
        if (health.status === "degraded") {
            statusCode = 200; // Still operational
        } else if (health.status === "unhealthy") {
            statusCode = 503; // Service unavailable
        }

        res.status(statusCode).json({
            success: true,
            data: health,
        });
    } catch (error) {
        Logger.error("Error checking sync health:", error);
        res.status(500).json({
            success: false,
            message: "Failed to check sync health",
            error: error.message,
        });
    }
};

/**
 * Get detailed sync report
 * @route GET /api/sync/report
 * @access Private (Admin only)
 */
export const getReport = async (req, res) => {
    try {
        const report = await syncMonitor.generateReport();

        res.json({
            success: true,
            data: report,
        });
    } catch (error) {
        Logger.error("Error generating sync report:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate sync report",
            error: error.message,
        });
    }
};

/**
 * Get sync queue status
 * @route GET /api/sync/queue
 * @access Private (Admin only)
 */
export const getQueueStatus = async (req, res) => {
    try {
        const queueStats = syncQueueManager.getStats();
        const syncLag = syncQueueManager.getSyncLag();

        res.json({
            success: true,
            data: {
                ...queueStats,
                syncLag: syncLag,
                syncLagSeconds: syncLag ? (syncLag / 1000).toFixed(2) : null,
                isLagging: syncQueueManager.isLagging(),
                oldestOperation: syncQueueManager.getOldestOperationTime(),
            },
        });
    } catch (error) {
        Logger.error("Error getting queue status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get queue status",
            error: error.message,
        });
    }
};

/**
 * Get sync worker status
 * @route GET /api/sync/worker
 * @access Private (Admin only)
 */
export const getWorkerStatus = async (req, res) => {
    try {
        const workerStats = syncWorker.getStats();
        const workerHealth = syncWorker.checkHealth();

        res.json({
            success: true,
            data: {
                stats: workerStats,
                health: workerHealth,
            },
        });
    } catch (error) {
        Logger.error("Error getting worker status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get worker status",
            error: error.message,
        });
    }
};

/**
 * Get database connection status
 * @route GET /api/sync/connections
 * @access Private (Admin only)
 */
export const getConnectionStatus = async (req, res) => {
    try {
        const status = dualDatabaseManager.getConnectionStatus();

        res.json({
            success: true,
            data: status,
        });
    } catch (error) {
        Logger.error("Error getting connection status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get connection status",
            error: error.message,
        });
    }
};

/**
 * Control sync worker (start/stop/pause/resume)
 * @route POST /api/sync/worker/control
 * @access Private (Admin only)
 */
export const controlWorker = async (req, res) => {
    try {
        const { action } = req.body;

        if (!action) {
            return res.status(400).json({
                success: false,
                message: "Action is required (start, stop, pause, resume)",
            });
        }

        switch (action) {
            case "start":
                syncWorker.start();
                break;
            case "stop":
                syncWorker.stop();
                break;
            case "pause":
                syncWorker.pause();
                break;
            case "resume":
                syncWorker.resume();
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: "Invalid action. Use: start, stop, pause, or resume",
                });
        }

        Logger.info(`Sync worker ${action} requested by user: ${req.user?.name}`);

        res.json({
            success: true,
            message: `Worker ${action} command executed`,
            data: syncWorker.getStats(),
        });
    } catch (error) {
        Logger.error("Error controlling worker:", error);
        res.status(500).json({
            success: false,
            message: "Failed to control worker",
            error: error.message,
        });
    }
};

/**
 * Clear sync queue
 * @route POST /api/sync/queue/clear
 * @access Private (Admin only)
 */
export const clearQueue = async (req, res) => {
    try {
        const sizeBefore = syncQueueManager.size();
        syncQueueManager.clear();

        Logger.warn(
            `Sync queue cleared by user: ${req.user?.name} (${sizeBefore} operations removed)`
        );

        res.json({
            success: true,
            message: `Queue cleared (${sizeBefore} operations removed)`,
            data: {
                operationsRemoved: sizeBefore,
            },
        });
    } catch (error) {
        Logger.error("Error clearing queue:", error);
        res.status(500).json({
            success: false,
            message: "Failed to clear queue",
            error: error.message,
        });
    }
};

/**
 * Reset sync statistics
 * @route POST /api/sync/stats/reset
 * @access Private (Admin only)
 */
export const resetStats = async (req, res) => {
    try {
        syncMonitor.resetMetrics();
        syncWorker.resetStats();

        Logger.info(`Sync statistics reset by user: ${req.user?.name}`);

        res.json({
            success: true,
            message: "Statistics reset successfully",
        });
    } catch (error) {
        Logger.error("Error resetting stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to reset statistics",
            error: error.message,
        });
    }
};

/**
 * Get sync configuration
 * @route GET /api/sync/config
 * @access Private (Admin only)
 */
export const getConfig = async (req, res) => {
    try {
        // Return config without sensitive data
        const config = {
            enabled: syncConfig.enabled,
            queueMaxSize: syncConfig.queueMaxSize,
            workerInterval: syncConfig.workerInterval,
            maxRetries: syncConfig.maxRetries,
            persistQueue: syncConfig.persistQueue,
            excludedCollections: syncConfig.excludedCollections,
            batchSize: syncConfig.batchSize,
            queueWarningThreshold: syncConfig.queueWarningThreshold,
            lagWarningThreshold: syncConfig.lagWarningThreshold,
        };

        res.json({
            success: true,
            data: config,
        });
    } catch (error) {
        Logger.error("Error getting sync config:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get sync configuration",
            error: error.message,
        });
    }
};

/**
 * Get bidirectional sync metrics
 * @route GET /api/sync/bidirectional/metrics
 * @access Private (Admin only)
 */
export const getBidirectionalMetrics = async (req, res) => {
    try {
        // Check if bidirectional sync is enabled
        if (!syncConfig.bidirectionalSync.enabled) {
            return res.status(200).json({
                success: true,
                data: {
                    enabled: false,
                    message: "Bidirectional sync is not enabled",
                },
            });
        }

        const metrics = bidirectionalSyncMonitor.getDirectionalMetrics();

        res.json({
            success: true,
            data: {
                enabled: true,
                ...metrics,
            },
        });
    } catch (error) {
        Logger.error("Error getting bidirectional sync metrics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get bidirectional sync metrics",
            error: error.message,
        });
    }
};

/**
 * Get bidirectional sync health status
 * @route GET /api/sync/bidirectional/health
 * @access Private (Admin only)
 */
export const getBidirectionalHealth = async (req, res) => {
    try {
        // Check if bidirectional sync is enabled
        if (!syncConfig.bidirectionalSync.enabled) {
            return res.status(200).json({
                success: true,
                data: {
                    enabled: false,
                    status: "disabled",
                    message: "Bidirectional sync is not enabled",
                },
            });
        }

        const health = bidirectionalSyncMonitor.checkBidirectionalHealth();

        // Set appropriate status code based on health
        let statusCode = 200;
        if (health.status === "degraded") {
            statusCode = 200; // Still operational
        } else if (health.status === "unhealthy") {
            statusCode = 503; // Service unavailable
        }

        res.status(statusCode).json({
            success: true,
            data: {
                enabled: true,
                ...health,
            },
        });
    } catch (error) {
        Logger.error("Error checking bidirectional sync health:", error);
        res.status(500).json({
            success: false,
            message: "Failed to check bidirectional sync health",
            error: error.message,
        });
    }
};

/**
 * Get bidirectional sync conflicts
 * @route GET /api/sync/bidirectional/conflicts
 * @access Private (Admin only)
 */
export const getBidirectionalConflicts = async (req, res) => {
    try {
        // Check if bidirectional sync is enabled
        if (!syncConfig.bidirectionalSync.enabled) {
            return res.status(200).json({
                success: true,
                data: {
                    enabled: false,
                    conflicts: [],
                    message: "Bidirectional sync is not enabled",
                },
            });
        }

        const metrics = bidirectionalSyncMonitor.getDirectionalMetrics();
        const conflictMetrics = metrics.atlasToLocal?.conflicts || {};

        res.json({
            success: true,
            data: {
                enabled: true,
                totalConflicts: conflictMetrics.total || 0,
                resolvedConflicts: conflictMetrics.resolved || 0,
                conflictRate: conflictMetrics.rate || 0,
                lastConflict: conflictMetrics.lastConflict || null,
                conflictsByCollection: conflictMetrics.byCollection || {},
            },
        });
    } catch (error) {
        Logger.error("Error getting bidirectional sync conflicts:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get bidirectional sync conflicts",
            error: error.message,
        });
    }
};

/**
 * Toggle bidirectional sync on/off
 * @route POST /api/sync/bidirectional/toggle
 * @access Private (Admin only)
 */
export const toggleBidirectionalSync = async (req, res) => {
    try {
        const { enabled } = req.body;

        if (typeof enabled !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "enabled field is required and must be a boolean",
            });
        }

        // Note: This is a runtime toggle. For persistent changes, update .env file
        const previousState = syncConfig.bidirectionalSync.enabled;
        
        if (enabled === previousState) {
            return res.status(200).json({
                success: true,
                message: `Bidirectional sync is already ${enabled ? "enabled" : "disabled"}`,
                data: {
                    enabled: syncConfig.bidirectionalSync.enabled,
                },
            });
        }

        // This is a runtime-only change
        // For production, this should trigger a proper restart with updated configuration
        Logger.warn(
            `⚠️ Bidirectional sync toggle requested by user: ${req.user?.name} (${previousState} → ${enabled})`
        );
        Logger.warn(
            "⚠️ Note: This is a runtime change only. For persistent changes, update BIDIRECTIONAL_SYNC_ENABLED in .env and restart the server."
        );

        res.json({
            success: true,
            message: `Bidirectional sync toggle requested. Please restart the server with BIDIRECTIONAL_SYNC_ENABLED=${enabled} for changes to take effect.`,
            data: {
                currentState: previousState,
                requestedState: enabled,
                requiresRestart: true,
            },
        });
    } catch (error) {
        Logger.error("Error toggling bidirectional sync:", error);
        res.status(500).json({
            success: false,
            message: "Failed to toggle bidirectional sync",
            error: error.message,
        });
    }
};

/**
 * Get excluded collections
 * @route GET /api/sync/bidirectional/excluded-collections
 * @access Private (Admin only)
 */
export const getExcludedCollections = async (req, res) => {
    try {
        const { getExcludedCollections } = await import("../config/syncConfig.js");
        const exclusions = getExcludedCollections();

        res.json({
            success: true,
            data: {
                oneWay: exclusions.oneWay,
                bidirectional: exclusions.bidirectional,
                combined: exclusions.combined,
                bidirectionalSyncEnabled: syncConfig.bidirectionalSync.enabled,
            },
        });
    } catch (error) {
        Logger.error("Error getting excluded collections:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get excluded collections",
            error: error.message,
        });
    }
};

/**
 * Update excluded collections dynamically
 * @route PUT /api/sync/bidirectional/excluded-collections
 * @access Private (Admin only)
 */
export const updateExcludedCollections = async (req, res) => {
    try {
        const { collections, bidirectional } = req.body;

        // Validate input
        if (!Array.isArray(collections)) {
            return res.status(400).json({
                success: false,
                message: "collections field is required and must be an array",
            });
        }

        if (typeof bidirectional !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "bidirectional field is required and must be a boolean",
            });
        }

        // Update config
        const { updateExcludedCollections: updateConfig } = await import("../config/syncConfig.js");
        const configResult = updateConfig(collections, bidirectional);

        if (!configResult.success) {
            return res.status(400).json(configResult);
        }

        // If bidirectional sync is enabled and we're updating bidirectional exclusions,
        // update the Atlas listener and change processor
        if (syncConfig.bidirectionalSync.enabled && bidirectional) {
            // Get the Atlas listener and change processor from server.js
            // We'll need to access them through the global scope or pass them as dependencies
            const { atlasChangeListener, changeProcessor } = global;

            if (atlasChangeListener) {
                const listenerResult = await atlasChangeListener.updateExcludedCollections(collections);
                if (!listenerResult.success) {
                    Logger.warn("Failed to update Atlas listener exclusions:", listenerResult.message);
                }
            }

            if (changeProcessor) {
                const processorResult = changeProcessor.updateExcludedCollections(collections);
                if (!processorResult.success) {
                    Logger.warn("Failed to update change processor exclusions:", processorResult.message);
                }
            }
        }

        Logger.info(
            `Excluded collections updated by user: ${req.user?.name} ` +
            `(${bidirectional ? "bidirectional" : "one-way"}: ${collections.join(", ") || "none"})`
        );

        res.json({
            success: true,
            message: configResult.message,
            data: {
                collections,
                bidirectional,
                warnings: configResult.warnings || [],
                restartRequired: !bidirectional, // One-way exclusions require restart
            },
        });
    } catch (error) {
        Logger.error("Error updating excluded collections:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update excluded collections",
            error: error.message,
        });
    }
};

export default {
    getMetrics,
    getHealth,
    getReport,
    getQueueStatus,
    getWorkerStatus,
    getConnectionStatus,
    controlWorker,
    clearQueue,
    resetStats,
    getConfig,
    getBidirectionalMetrics,
    getBidirectionalHealth,
    getBidirectionalConflicts,
    toggleBidirectionalSync,
    getExcludedCollections,
    updateExcludedCollections,
};
