import { SyncMonitor } from "./syncMonitor.js";
import Logger from "../../middleware/logger.js";
import syncConfig from "../../config/syncConfig.js";

/**
 * BidirectionalSyncMonitor
 * Extends SyncMonitor to track bidirectional sync metrics
 * Monitors both Local→Atlas and Atlas→Local sync operations
 */
class BidirectionalSyncMonitor extends SyncMonitor {
    constructor() {
        super();

        // Atlas→Local metrics
        this.atlasToLocalMetrics = {
            totalOperations: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            avgProcessTime: 0,
            lastSyncTimestamp: null,
            changeStreamStatus: "disconnected", // disconnected, connected, reconnecting
            reconnectAttempts: 0,
            lastReconnectTime: null,
        };

        // Conflict metrics
        this.conflictMetrics = {
            totalConflicts: 0,
            resolvedConflicts: 0,
            conflictsByCollection: {},
            lastConflictTime: null,
        };

        // Store last 100 Atlas→Local process times for average calculation
        this.atlasProcessTimes = [];
        this.maxProcessTimeSamples = 100;

        // Bidirectional-specific warning thresholds
        this.bidirectionalThresholds = {
            atlasToLocalLag: syncConfig.lagWarningThreshold || 60000, // ms
            conflictRate: 5, // 5% conflict rate
            reconnectAttempts: 5, // Max reconnect attempts before warning
        };
    }

    /**
     * Record a successful Atlas→Local sync operation
     * @param {Object} change - The change that was synced
     * @param {number} duration - Time taken in milliseconds
     */
    recordAtlasToLocal(change, duration) {
        this.atlasToLocalMetrics.totalOperations++;
        this.atlasToLocalMetrics.successfulSyncs++;
        this.atlasToLocalMetrics.lastSyncTimestamp = new Date();

        // Update average process time
        this.atlasProcessTimes.push(duration);
        if (this.atlasProcessTimes.length > this.maxProcessTimeSamples) {
            this.atlasProcessTimes.shift();
        }

        this.atlasToLocalMetrics.avgProcessTime =
            this.atlasProcessTimes.reduce((a, b) => a + b, 0) /
            this.atlasProcessTimes.length;

        // Log detailed success for debugging (only in development)
        if (process.env.NODE_ENV === "development") {
            Logger.info(
                `✅ Atlas→Local sync: ${change.operationType} on ${change.ns?.coll} (${duration}ms)`
            );
        }
    }

    /**
     * Record a failed Atlas→Local sync operation
     * @param {Object} change - The change that failed
     * @param {Error} error - The error that occurred
     */
    recordAtlasToLocalFailure(change, error) {
        this.atlasToLocalMetrics.totalOperations++;
        this.atlasToLocalMetrics.failedSyncs++;

        Logger.error(
            `❌ Atlas→Local sync failure: ${change.operationType} on ${change.ns?.coll}`,
            {
                error: error.message,
                changeId: change._id,
                documentKey: change.documentKey,
            }
        );

        // Check if failure rate is high
        this.checkAtlasToLocalFailureRate();
    }

    /**
     * Record a conflict resolution
     * @param {Object} conflict - Conflict details
     */
    recordConflict(conflict) {
        this.conflictMetrics.totalConflicts++;
        this.conflictMetrics.resolvedConflicts++;
        this.conflictMetrics.lastConflictTime = new Date();

        // Track conflicts by collection
        const collection = conflict.collection || "unknown";
        if (!this.conflictMetrics.conflictsByCollection[collection]) {
            this.conflictMetrics.conflictsByCollection[collection] = 0;
        }
        this.conflictMetrics.conflictsByCollection[collection]++;

        Logger.warn(
            `⚠️ Conflict resolved: ${collection} document ${conflict.documentId}`,
            {
                strategy: conflict.strategy || "last-write-wins",
                winner: conflict.winner || "unknown",
            }
        );

        // Check if conflict rate is high
        this.checkConflictRate();
    }

    /**
     * Update Change Stream connection status
     * @param {string} status - Connection status (connected, disconnected, reconnecting)
     */
    updateChangeStreamStatus(status) {
        const previousStatus = this.atlasToLocalMetrics.changeStreamStatus;
        this.atlasToLocalMetrics.changeStreamStatus = status;

        if (status === "reconnecting") {
            this.atlasToLocalMetrics.reconnectAttempts++;
            this.atlasToLocalMetrics.lastReconnectTime = new Date();

            // Check if reconnect attempts exceed threshold
            if (
                this.atlasToLocalMetrics.reconnectAttempts >
                this.bidirectionalThresholds.reconnectAttempts
            ) {
                this.emitWarning(
                    "change_stream_reconnect",
                    `Change Stream reconnect attempts: ${this.atlasToLocalMetrics.reconnectAttempts}`
                );
            }
        } else if (status === "connected") {
            // Reset reconnect attempts on successful connection
            if (previousStatus === "reconnecting") {
                Logger.info(
                    `✅ Change Stream reconnected after ${this.atlasToLocalMetrics.reconnectAttempts} attempts`
                );
            }
            this.atlasToLocalMetrics.reconnectAttempts = 0;
        }

        Logger.info(`🔄 Change Stream status: ${status}`);
    }

    /**
     * Get directional metrics (Local→Atlas and Atlas→Local)
     * @returns {Object}
     */
    getDirectionalMetrics() {
        const baseMetrics = super.getMetrics();

        return {
            localToAtlas: {
                totalOperations: baseMetrics.totalOperations,
                successfulSyncs: baseMetrics.successfulSyncs,
                failedSyncs: baseMetrics.failedSyncs,
                avgSyncTime: baseMetrics.avgSyncTime,
                lastSyncTimestamp: baseMetrics.lastSyncTimestamp,
                successRate:
                    baseMetrics.totalOperations > 0
                        ? (
                              (baseMetrics.successfulSyncs /
                                  baseMetrics.totalOperations) *
                              100
                          ).toFixed(2) + "%"
                        : "N/A",
            },
            atlasToLocal: {
                totalOperations: this.atlasToLocalMetrics.totalOperations,
                successfulSyncs: this.atlasToLocalMetrics.successfulSyncs,
                failedSyncs: this.atlasToLocalMetrics.failedSyncs,
                avgProcessTime: this.atlasToLocalMetrics.avgProcessTime,
                lastSyncTimestamp: this.atlasToLocalMetrics.lastSyncTimestamp,
                changeStreamStatus:
                    this.atlasToLocalMetrics.changeStreamStatus,
                reconnectAttempts: this.atlasToLocalMetrics.reconnectAttempts,
                successRate:
                    this.atlasToLocalMetrics.totalOperations > 0
                        ? (
                              (this.atlasToLocalMetrics.successfulSyncs /
                                  this.atlasToLocalMetrics.totalOperations) *
                              100
                          ).toFixed(2) + "%"
                        : "N/A",
            },
            conflicts: {
                totalConflicts: this.conflictMetrics.totalConflicts,
                resolvedConflicts: this.conflictMetrics.resolvedConflicts,
                conflictsByCollection:
                    this.conflictMetrics.conflictsByCollection,
                lastConflictTime: this.conflictMetrics.lastConflictTime,
                conflictRate:
                    this.atlasToLocalMetrics.totalOperations > 0
                        ? (
                              (this.conflictMetrics.totalConflicts /
                                  this.atlasToLocalMetrics.totalOperations) *
                              100
                          ).toFixed(2) + "%"
                        : "N/A",
            },
        };
    }

    /**
     * Check bidirectional sync health
     * @returns {Object}
     */
    checkBidirectionalHealth() {
        const baseHealth = super.checkHealth();
        const directionalMetrics = this.getDirectionalMetrics();

        // Add bidirectional-specific checks
        const bidirectionalChecks = {};

        // Check if bidirectional sync is enabled
        bidirectionalChecks.bidirectionalSyncEnabled = {
            status: syncConfig.bidirectionalSync.enabled ? "pass" : "info",
            message: syncConfig.bidirectionalSync.enabled
                ? "Bidirectional sync is enabled"
                : "Bidirectional sync is disabled",
        };

        // Check Change Stream status
        if (syncConfig.bidirectionalSync.enabled) {
            const changeStreamStatus =
                this.atlasToLocalMetrics.changeStreamStatus;
            bidirectionalChecks.changeStream = {
                status:
                    changeStreamStatus === "connected"
                        ? "pass"
                        : changeStreamStatus === "reconnecting"
                          ? "warn"
                          : "fail",
                message: `Change Stream: ${changeStreamStatus}`,
                reconnectAttempts:
                    this.atlasToLocalMetrics.reconnectAttempts,
            };

            if (changeStreamStatus === "disconnected") {
                baseHealth.status = "unhealthy";
                baseHealth.errors.push("Change Stream is disconnected");
            } else if (changeStreamStatus === "reconnecting") {
                if (baseHealth.status === "healthy")
                    baseHealth.status = "degraded";
                baseHealth.warnings.push("Change Stream is reconnecting");
            }

            // Check Atlas→Local failure rate
            const atlasToLocalFailureRate =
                this.atlasToLocalMetrics.totalOperations > 0
                    ? (this.atlasToLocalMetrics.failedSyncs /
                          this.atlasToLocalMetrics.totalOperations) *
                      100
                    : 0;

            bidirectionalChecks.atlasToLocalFailureRate = {
                status:
                    atlasToLocalFailureRate > this.warningThresholds.failureRate
                        ? "warn"
                        : "pass",
                message: `Atlas→Local failure rate: ${atlasToLocalFailureRate.toFixed(2)}%`,
                value: atlasToLocalFailureRate,
            };

            if (atlasToLocalFailureRate > this.warningThresholds.failureRate) {
                if (baseHealth.status === "healthy")
                    baseHealth.status = "degraded";
                baseHealth.warnings.push(
                    `High Atlas→Local failure rate: ${atlasToLocalFailureRate.toFixed(2)}%`
                );
            }

            // Check conflict rate
            const conflictRate =
                this.atlasToLocalMetrics.totalOperations > 0
                    ? (this.conflictMetrics.totalConflicts /
                          this.atlasToLocalMetrics.totalOperations) *
                      100
                    : 0;

            bidirectionalChecks.conflictRate = {
                status:
                    conflictRate > this.bidirectionalThresholds.conflictRate
                        ? "warn"
                        : "pass",
                message: `Conflict rate: ${conflictRate.toFixed(2)}%`,
                value: conflictRate,
            };

            if (conflictRate > this.bidirectionalThresholds.conflictRate) {
                if (baseHealth.status === "healthy")
                    baseHealth.status = "degraded";
                baseHealth.warnings.push(
                    `High conflict rate: ${conflictRate.toFixed(2)}%`
                );
            }

            // Check reconnect attempts
            if (
                this.atlasToLocalMetrics.reconnectAttempts >
                this.bidirectionalThresholds.reconnectAttempts
            ) {
                bidirectionalChecks.reconnectAttempts = {
                    status: "warn",
                    message: `High reconnect attempts: ${this.atlasToLocalMetrics.reconnectAttempts}`,
                    value: this.atlasToLocalMetrics.reconnectAttempts,
                };

                if (baseHealth.status === "healthy")
                    baseHealth.status = "degraded";
                baseHealth.warnings.push(
                    `Change Stream reconnect attempts: ${this.atlasToLocalMetrics.reconnectAttempts}`
                );
            }
        }

        return {
            ...baseHealth,
            checks: {
                ...baseHealth.checks,
                ...bidirectionalChecks,
            },
            directionalMetrics: directionalMetrics,
        };
    }

    /**
     * Check if Atlas→Local failure rate is too high
     */
    checkAtlasToLocalFailureRate() {
        if (this.atlasToLocalMetrics.totalOperations < 10) {
            return; // Not enough data
        }

        const failureRate =
            (this.atlasToLocalMetrics.failedSyncs /
                this.atlasToLocalMetrics.totalOperations) *
            100;

        if (failureRate > this.warningThresholds.failureRate) {
            this.emitWarning(
                "atlas_to_local_failure_rate",
                `High Atlas→Local failure rate: ${failureRate.toFixed(2)}%`
            );
        }
    }

    /**
     * Check if conflict rate is too high
     */
    checkConflictRate() {
        if (this.atlasToLocalMetrics.totalOperations < 10) {
            return; // Not enough data
        }

        const conflictRate =
            (this.conflictMetrics.totalConflicts /
                this.atlasToLocalMetrics.totalOperations) *
            100;

        if (conflictRate > this.bidirectionalThresholds.conflictRate) {
            this.emitWarning(
                "conflict_rate",
                `High conflict rate: ${conflictRate.toFixed(2)}%`
            );
        }
    }

    /**
     * Generate a detailed bidirectional report
     * @returns {Promise<Object>}
     */
    async generateBidirectionalReport() {
        const baseReport = await super.generateReport();
        const directionalMetrics = this.getDirectionalMetrics();
        const bidirectionalHealth = this.checkBidirectionalHealth();

        const bidirectionalReport = {
            ...baseReport,
            bidirectional: {
                enabled: syncConfig.bidirectionalSync.enabled,
                directionalMetrics: directionalMetrics,
                health: bidirectionalHealth,
                changeStream: {
                    status: this.atlasToLocalMetrics.changeStreamStatus,
                    reconnectAttempts:
                        this.atlasToLocalMetrics.reconnectAttempts,
                    lastReconnectTime:
                        this.atlasToLocalMetrics.lastReconnectTime,
                },
                conflicts: {
                    total: this.conflictMetrics.totalConflicts,
                    resolved: this.conflictMetrics.resolvedConflicts,
                    byCollection: this.conflictMetrics.conflictsByCollection,
                    lastConflictTime: this.conflictMetrics.lastConflictTime,
                },
            },
            recommendations: [
                ...baseReport.recommendations,
                ...this.generateBidirectionalRecommendations(
                    bidirectionalHealth,
                    directionalMetrics
                ),
            ],
        };

        return bidirectionalReport;
    }

    /**
     * Generate bidirectional-specific recommendations
     * @param {Object} health - Health check results
     * @param {Object} metrics - Directional metrics
     * @returns {Array}
     */
    generateBidirectionalRecommendations(health, metrics) {
        const recommendations = [];

        if (
            syncConfig.bidirectionalSync.enabled &&
            this.atlasToLocalMetrics.changeStreamStatus === "disconnected"
        ) {
            recommendations.push({
                priority: "critical",
                message:
                    "Change Stream is disconnected. Atlas→Local sync is not working.",
                action: "Check Atlas connection and Change Stream configuration",
            });
        }

        if (
            this.atlasToLocalMetrics.reconnectAttempts >
            this.bidirectionalThresholds.reconnectAttempts
        ) {
            recommendations.push({
                priority: "high",
                message:
                    "Change Stream is experiencing frequent reconnections.",
                action: "Check network stability and Atlas cluster health",
            });
        }

        const conflictRate =
            this.atlasToLocalMetrics.totalOperations > 0
                ? (this.conflictMetrics.totalConflicts /
                      this.atlasToLocalMetrics.totalOperations) *
                  100
                : 0;

        if (conflictRate > this.bidirectionalThresholds.conflictRate) {
            recommendations.push({
                priority: "medium",
                message: `High conflict rate detected: ${conflictRate.toFixed(2)}%`,
                action: "Review concurrent modification patterns and consider optimizing update frequency",
            });
        }

        const atlasToLocalFailureRate =
            this.atlasToLocalMetrics.totalOperations > 0
                ? (this.atlasToLocalMetrics.failedSyncs /
                      this.atlasToLocalMetrics.totalOperations) *
                  100
                : 0;

        if (atlasToLocalFailureRate > this.warningThresholds.failureRate) {
            recommendations.push({
                priority: "high",
                message: `High Atlas→Local failure rate: ${atlasToLocalFailureRate.toFixed(2)}%`,
                action: "Review error logs for Atlas→Local sync failures and fix underlying issues",
            });
        }

        return recommendations;
    }

    /**
     * Log bidirectional status
     */
    logBidirectionalStatus() {
        super.logStatus();

        if (syncConfig.bidirectionalSync.enabled) {
            const directionalMetrics = this.getDirectionalMetrics();

            Logger.info("\n🔄 Bidirectional Sync Status:");
            Logger.info(
                `   Change Stream: ${this.atlasToLocalMetrics.changeStreamStatus.toUpperCase()}`
            );
            Logger.info(
                `   Atlas→Local Operations: ${this.atlasToLocalMetrics.totalOperations}`
            );
            Logger.info(
                `   Atlas→Local Success Rate: ${directionalMetrics.atlasToLocal.successRate}`
            );
            Logger.info(
                `   Avg Process Time: ${this.atlasToLocalMetrics.avgProcessTime.toFixed(2)}ms`
            );
            Logger.info(
                `   Total Conflicts: ${this.conflictMetrics.totalConflicts}`
            );
            Logger.info(
                `   Conflict Rate: ${directionalMetrics.conflicts.conflictRate}`
            );

            if (this.atlasToLocalMetrics.reconnectAttempts > 0) {
                Logger.warn(
                    `   Reconnect Attempts: ${this.atlasToLocalMetrics.reconnectAttempts}`
                );
            }
        }
    }

    /**
     * Reset all metrics including bidirectional metrics
     */
    resetMetrics() {
        super.resetMetrics();

        this.atlasToLocalMetrics = {
            totalOperations: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            avgProcessTime: 0,
            lastSyncTimestamp: null,
            changeStreamStatus: this.atlasToLocalMetrics.changeStreamStatus, // Keep connection status
            reconnectAttempts: 0,
            lastReconnectTime: null,
        };

        this.conflictMetrics = {
            totalConflicts: 0,
            resolvedConflicts: 0,
            conflictsByCollection: {},
            lastConflictTime: null,
        };

        this.atlasProcessTimes = [];

        Logger.info("📊 Bidirectional sync monitor metrics reset");
    }
}

// Export singleton instance
const bidirectionalSyncMonitor = new BidirectionalSyncMonitor();
export default bidirectionalSyncMonitor;

// Also export the class for testing
export { BidirectionalSyncMonitor };
