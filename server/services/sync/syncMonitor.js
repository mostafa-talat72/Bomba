import Logger from "../../middleware/logger.js";
import syncConfig from "../../config/syncConfig.js";
import syncQueueManager from "./syncQueueManager.js";
import syncWorker from "./syncWorker.js";
import dualDatabaseManager from "../../config/dualDatabaseManager.js";

/**
 * SyncMonitor
 * Monitors synchronization health and metrics
 * Tracks success/failure rates, queue size, and sync lag
 */
class SyncMonitor {
    constructor() {
        this.metrics = {
            totalOperations: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            queueSize: 0,
            avgSyncTime: 0,
            lastSyncTimestamp: null,
            startTime: new Date(),
        };

        this.syncTimes = []; // Store last 100 sync times for average calculation
        this.maxSyncTimeSamples = 100;

        this.warningThresholds = {
            queueSize: syncConfig.queueWarningThreshold,
            syncLag: syncConfig.lagWarningThreshold,
            failureRate: 10, // 10% failure rate
        };

        this.lastWarningTime = {};
        this.warningCooldown = 60000; // 1 minute between same warnings
    }

    /**
     * Record a successful sync operation
     * @param {Object} operation - The operation that was synced
     * @param {number} duration - Time taken in milliseconds
     */
    recordSuccess(operation, duration) {
        this.metrics.totalOperations++;
        this.metrics.successfulSyncs++;
        this.metrics.lastSyncTimestamp = new Date();

        // Update average sync time
        this.syncTimes.push(duration);
        if (this.syncTimes.length > this.maxSyncTimeSamples) {
            this.syncTimes.shift();
        }

        this.metrics.avgSyncTime =
            this.syncTimes.reduce((a, b) => a + b, 0) / this.syncTimes.length;

        // Log detailed success for debugging (only in development)
        if (process.env.NODE_ENV === "development") {
            Logger.info(
                `✅ Sync success: ${operation.type} on ${operation.collection} (${duration}ms)`
            );
        }
    }

    /**
     * Record a failed sync operation
     * @param {Object} operation - The operation that failed
     * @param {Error} error - The error that occurred
     */
    recordFailure(operation, error) {
        this.metrics.totalOperations++;
        this.metrics.failedSyncs++;

        Logger.error(
            `❌ Sync failure: ${operation.type} on ${operation.collection}`,
            {
                error: error.message,
                operationId: operation.id,
                retryCount: operation.retryCount,
            }
        );

        // Check if failure rate is high
        this.checkFailureRate();
    }

    /**
     * Update queue size metric
     * @param {number} size - Current queue size
     */
    updateQueueSize(size) {
        this.metrics.queueSize = size;

        // Check if queue size exceeds threshold
        if (size > this.warningThresholds.queueSize) {
            this.emitWarning(
                "queue_size",
                `Queue size is large: ${size}/${syncConfig.queueMaxSize}`
            );
        }
    }

    /**
     * Get current metrics
     * @returns {Object}
     */
    getMetrics() {
        // Get real-time queue stats
        const queueStats = syncQueueManager.getStats();
        const workerStats = syncWorker.getStats();
        const connectionStatus = dualDatabaseManager.getConnectionStatus();
        const syncLag = syncQueueManager.getSyncLag();

        return {
            ...this.metrics,
            queueSize: queueStats.size,
            queueUtilization: queueStats.utilizationPercent,
            queueByType: queueStats.byType,
            queueByCollection: queueStats.byCollection,
            syncLag: syncLag,
            syncLagSeconds: syncLag ? (syncLag / 1000).toFixed(2) : null,
            workerStatus: {
                isRunning: workerStats.isRunning,
                isPaused: workerStats.isPaused,
                successRate: workerStats.successRate,
                failureRate: workerStats.failureRate,
            },
            connectionStatus: {
                local: connectionStatus.local.connected,
                atlas: connectionStatus.atlas.connected,
            },
            uptime: Date.now() - this.metrics.startTime.getTime(),
            uptimeFormatted: this.formatUptime(
                Date.now() - this.metrics.startTime.getTime()
            ),
        };
    }

    /**
     * Check system health
     * @returns {Object}
     */
    checkHealth() {
        const metrics = this.getMetrics();
        const health = {
            status: "healthy",
            checks: {},
            warnings: [],
            errors: [],
        };

        // Check if sync is enabled
        health.checks.syncEnabled = {
            status: syncConfig.enabled ? "pass" : "info",
            message: syncConfig.enabled
                ? "Sync is enabled"
                : "Sync is disabled",
        };

        // Check local database connection
        health.checks.localDatabase = {
            status: metrics.connectionStatus.local ? "pass" : "fail",
            message: metrics.connectionStatus.local
                ? "Local database connected"
                : "Local database disconnected",
        };

        if (!metrics.connectionStatus.local) {
            health.status = "unhealthy";
            health.errors.push("Local database is disconnected");
        }

        // Check Atlas connection
        health.checks.atlasDatabase = {
            status: metrics.connectionStatus.atlas ? "pass" : "warn",
            message: metrics.connectionStatus.atlas
                ? "Atlas database connected"
                : "Atlas database disconnected",
        };

        if (!metrics.connectionStatus.atlas && syncConfig.enabled) {
            if (health.status === "healthy") health.status = "degraded";
            health.warnings.push("Atlas database is disconnected");
        }

        // Check worker status
        health.checks.worker = {
            status: metrics.workerStatus.isRunning ? "pass" : "warn",
            message: metrics.workerStatus.isRunning
                ? "Worker is running"
                : "Worker is not running",
        };

        if (!metrics.workerStatus.isRunning && syncConfig.enabled) {
            if (health.status === "healthy") health.status = "degraded";
            health.warnings.push("Sync worker is not running");
        }

        // Check queue size
        health.checks.queueSize = {
            status:
                metrics.queueSize > this.warningThresholds.queueSize
                    ? "warn"
                    : "pass",
            message: `Queue size: ${metrics.queueSize}/${syncConfig.queueMaxSize}`,
            value: metrics.queueSize,
        };

        if (metrics.queueSize > this.warningThresholds.queueSize) {
            if (health.status === "healthy") health.status = "degraded";
            health.warnings.push(
                `Queue size is large: ${metrics.queueSize}/${syncConfig.queueMaxSize}`
            );
        }

        // Check sync lag
        if (metrics.syncLag) {
            health.checks.syncLag = {
                status:
                    metrics.syncLag > this.warningThresholds.syncLag
                        ? "warn"
                        : "pass",
                message: `Sync lag: ${metrics.syncLagSeconds}s`,
                value: metrics.syncLag,
            };

            if (metrics.syncLag > this.warningThresholds.syncLag) {
                if (health.status === "healthy") health.status = "degraded";
                health.warnings.push(
                    `Sync lag is high: ${metrics.syncLagSeconds}s`
                );
            }
        }

        // Check failure rate
        const failureRate = parseFloat(metrics.workerStatus.failureRate);
        health.checks.failureRate = {
            status:
                failureRate > this.warningThresholds.failureRate
                    ? "warn"
                    : "pass",
            message: `Failure rate: ${failureRate}%`,
            value: failureRate,
        };

        if (failureRate > this.warningThresholds.failureRate) {
            if (health.status === "healthy") health.status = "degraded";
            health.warnings.push(`High failure rate: ${failureRate}%`);
        }

        return health;
    }

    /**
     * Check if failure rate is too high
     */
    checkFailureRate() {
        if (this.metrics.totalOperations < 10) {
            return; // Not enough data
        }

        const failureRate =
            (this.metrics.failedSyncs / this.metrics.totalOperations) * 100;

        if (failureRate > this.warningThresholds.failureRate) {
            this.emitWarning(
                "failure_rate",
                `High sync failure rate: ${failureRate.toFixed(2)}%`
            );
        }
    }

    /**
     * Emit a warning (with cooldown to avoid spam)
     * @param {string} type - Warning type
     * @param {string} message - Warning message
     */
    emitWarning(type, message) {
        const now = Date.now();
        const lastWarning = this.lastWarningTime[type] || 0;

        // Check cooldown
        if (now - lastWarning < this.warningCooldown) {
            return; // Skip warning (in cooldown period)
        }

        Logger.warn(`⚠️ Sync Monitor Warning [${type}]: ${message}`);
        this.lastWarningTime[type] = now;
    }

    /**
     * Generate a detailed report
     * @returns {Promise<Object>}
     */
    async generateReport() {
        const metrics = this.getMetrics();
        const health = this.checkHealth();
        const queueStats = syncQueueManager.getStats();

        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                status: health.status,
                uptime: metrics.uptimeFormatted,
                totalOperations: metrics.totalOperations,
                successRate: `${(
                    (metrics.successfulSyncs / metrics.totalOperations) *
                    100
                ).toFixed(2)}%`,
                queueSize: metrics.queueSize,
                syncLag: metrics.syncLagSeconds
                    ? `${metrics.syncLagSeconds}s`
                    : "N/A",
            },
            metrics: metrics,
            health: health,
            queue: {
                size: queueStats.size,
                maxSize: queueStats.maxSize,
                utilization: `${queueStats.utilizationPercent}%`,
                byType: queueStats.byType,
                byCollection: queueStats.byCollection,
                avgRetries: queueStats.avgRetries,
            },
            recommendations: this.generateRecommendations(health, metrics),
        };

        return report;
    }

    /**
     * Generate recommendations based on health and metrics
     * @param {Object} health - Health check results
     * @param {Object} metrics - Current metrics
     * @returns {Array}
     */
    generateRecommendations(health, metrics) {
        const recommendations = [];

        if (!metrics.connectionStatus.atlas && syncConfig.enabled) {
            recommendations.push({
                priority: "high",
                message: "Atlas connection is down. Check network and credentials.",
                action: "Verify MONGODB_ATLAS_URI and network connectivity",
            });
        }

        if (metrics.queueSize > this.warningThresholds.queueSize) {
            recommendations.push({
                priority: "medium",
                message: "Queue size is large. Consider increasing worker interval or checking Atlas performance.",
                action: "Review SYNC_WORKER_INTERVAL and Atlas connection speed",
            });
        }

        if (metrics.syncLag && metrics.syncLag > this.warningThresholds.syncLag) {
            recommendations.push({
                priority: "medium",
                message: "Sync lag is high. Operations are taking longer than expected.",
                action: "Check Atlas performance and consider optimizing operations",
            });
        }

        const failureRate = parseFloat(metrics.workerStatus.failureRate);
        if (failureRate > this.warningThresholds.failureRate) {
            recommendations.push({
                priority: "high",
                message: "High failure rate detected. Review error logs.",
                action: "Check application logs for sync errors and fix underlying issues",
            });
        }

        if (!metrics.workerStatus.isRunning && syncConfig.enabled) {
            recommendations.push({
                priority: "critical",
                message: "Sync worker is not running. Sync operations are not being processed.",
                action: "Restart the sync worker or check for errors in startup",
            });
        }

        return recommendations;
    }

    /**
     * Format uptime in human-readable format
     * @param {number} ms - Uptime in milliseconds
     * @returns {string}
     */
    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Reset all metrics
     */
    resetMetrics() {
        this.metrics = {
            totalOperations: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            queueSize: 0,
            avgSyncTime: 0,
            lastSyncTimestamp: null,
            startTime: new Date(),
        };
        this.syncTimes = [];
        Logger.info("📊 Sync monitor metrics reset");
    }

    /**
     * Log current status
     */
    logStatus() {
        const metrics = this.getMetrics();
        const health = this.checkHealth();

        Logger.info("\n📊 Sync Monitor Status:");
        Logger.info(`   Health: ${health.status.toUpperCase()}`);
        Logger.info(`   Uptime: ${metrics.uptimeFormatted}`);
        Logger.info(`   Total Operations: ${metrics.totalOperations}`);
        Logger.info(
            `   Successful: ${metrics.successfulSyncs} (${(
                (metrics.successfulSyncs / metrics.totalOperations) *
                100
            ).toFixed(2)}%)`
        );
        Logger.info(
            `   Failed: ${metrics.failedSyncs} (${(
                (metrics.failedSyncs / metrics.totalOperations) *
                100
            ).toFixed(2)}%)`
        );
        Logger.info(`   Queue Size: ${metrics.queueSize}`);
        Logger.info(
            `   Sync Lag: ${metrics.syncLagSeconds ? metrics.syncLagSeconds + "s" : "N/A"}`
        );
        Logger.info(
            `   Avg Sync Time: ${metrics.avgSyncTime.toFixed(2)}ms`
        );

        if (health.warnings.length > 0) {
            Logger.warn("\n⚠️  Warnings:");
            health.warnings.forEach((warning) => Logger.warn(`   - ${warning}`));
        }

        if (health.errors.length > 0) {
            Logger.error("\n❌ Errors:");
            health.errors.forEach((error) => Logger.error(`   - ${error}`));
        }
    }
}

// Export singleton instance
const syncMonitor = new SyncMonitor();
export default syncMonitor;

// Also export the class for extension
export { SyncMonitor };
