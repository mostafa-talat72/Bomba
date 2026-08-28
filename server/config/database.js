import Logger from "../middleware/logger.js";
import dualDatabaseManager from "./dualDatabaseManager.js";
import syncConfig, { validateSyncConfig } from "./syncConfig.js";

/**
 * Connect to databases using DualDatabaseManager
 * Connects to local MongoDB (primary) and optionally to Atlas (backup)
 */
const connectDB = async () => {
    try {
        // Validate sync configuration
        const validation = validateSyncConfig();
        if (!validation.isValid && syncConfig.enabled) {
            Logger.warn("⚠️ Sync configuration validation failed:");
            validation.errors.forEach((error) => Logger.warn(`  - ${error}`));
            Logger.warn("⚠️ Sync will be disabled");
        }

        // Determine local URI (backward compatible)
        const localUri = syncConfig.localUri || process.env.MONGODB_URI || "mongodb://localhost:27017/bomba";

        // Connect to local MongoDB (primary database) - CRITICAL
        // On first boot the bundled MongoDB replica set needs time to elect a
        // primary, so retry instead of dying on the first server-selection timeout.
        const maxAttempts = parseInt(process.env.LOCAL_DB_MAX_ATTEMPTS || "6", 10);
        const retryDelayMs = parseInt(process.env.LOCAL_DB_RETRY_DELAY_MS || "5000", 10);
        let localConnected = false;
        let lastError = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await dualDatabaseManager.connectLocal(localUri);
                localConnected = true;
                lastError = null;
                break;
            } catch (err) {
                lastError = err;
                Logger.warn(
                    `⚠️ Local MongoDB connection attempt ${attempt}/${maxAttempts} failed: ${err.message}`
                );
                if (attempt < maxAttempts) {
                    await new Promise((r) => setTimeout(r, retryDelayMs));
                }
            }
        }
        if (!localConnected) {
            throw lastError;
        }

        // Connect to Atlas (backup database) - NON-CRITICAL
        if (syncConfig.enabled && syncConfig.atlasUri) {
            Logger.info("🔄 Sync system enabled, connecting to Atlas...");
            await dualDatabaseManager.connectAtlas(syncConfig.atlasUri);
            
            if (dualDatabaseManager.isAtlasAvailable()) {
                Logger.info("✅ Dual MongoDB system initialized successfully");
                Logger.info("📊 Primary: Local MongoDB (fast operations)");
                Logger.info("☁️  Backup: MongoDB Atlas (cloud sync)");
                
                // Start connection monitoring
                dualDatabaseManager.startConnectionMonitoring();
                Logger.info("🔍 Atlas connection monitoring started");
            } else {
                Logger.warn("⚠️ Atlas connection failed, sync will be queued");
                Logger.warn("⚠️ Application will continue with local MongoDB only");
                
                // Start monitoring to attempt reconnection
                dualDatabaseManager.startConnectionMonitoring();
                Logger.info("🔍 Atlas connection monitoring started (will attempt reconnection)");
            }
        } else {
            Logger.info("ℹ️  Sync system disabled, using local MongoDB only");
        }

        // Log connection status
        const status = dualDatabaseManager.getConnectionStatus();
        Logger.info("\n📊 Database Connection Status:");
        Logger.info(`  Local:  ${status.local.connected ? "✅ Connected" : "❌ Disconnected"} - ${status.local.host}`);
        Logger.info(`  Atlas:  ${status.atlas.connected ? "✅ Connected" : "⚠️  Disconnected"} - ${status.atlas.host}`);

        // Setup graceful shutdown handlers
        setupGracefulShutdown();

    } catch (error) {
        Logger.error("\n❌ Database connection failed!");
        Logger.error("📝 Error details:", error.message);
        process.exit(1);
    }
};

/**
 * Setup graceful shutdown handlers for both connections
 */
function setupGracefulShutdown() {
    const shutdown = async (signal) => {
        Logger.info(`\n${signal} received, shutting down gracefully...`);
        try {
            await dualDatabaseManager.closeConnections();
            Logger.info("✅ Graceful shutdown completed");
            process.exit(0);
        } catch (error) {
            Logger.error("❌ Error during shutdown:", error.message);
            process.exit(1);
        }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}

/**
 * Get the dual database manager instance
 * @returns {DualDatabaseManager}
 */
export function getDatabaseManager() {
    return dualDatabaseManager;
}

export default connectDB;
