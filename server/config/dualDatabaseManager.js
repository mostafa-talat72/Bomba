import mongoose from "mongoose";
import Logger from "../middleware/logger.js";
import syncConfig from "./syncConfig.js";

/**
 * DualDatabaseManager
 * Manages connections to both local MongoDB and MongoDB Atlas
 * Local connection is primary for all operations
 * Atlas connection is used for backup synchronization
 */
class DualDatabaseManager {
    constructor() {
        this.localConnection = null;
        this.atlasConnection = null;
        this.isAtlasConnected = false;
        this.isLocalConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000; // 5 seconds
        this.hourlyRetryScheduled = false;
        this._atlasConnecting = false;
        this._reconnectScheduled = false;
        this.reconnectListeners = [];
        this.disconnectListeners = [];
        this.monitoringInterval = null;
        this.monitoringFrequency = 30000;
    }

    /**
     * Connect to local MongoDB instance
     * This is the primary database for all operations
     * @param {string} uri - MongoDB connection URI
     * @returns {Promise<mongoose.Connection>}
     */
    async connectLocal(uri) {
        try {
            Logger.info("🔄 Connecting to Local MongoDB...");

            const options = {
                maxPoolSize: 50,
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                family: 4,
                retryWrites: true,
                w: "majority",
            };

            // Use default mongoose connection for local (primary)
            await mongoose.connect(uri, options);
            this.localConnection = mongoose.connection;
            this.isLocalConnected = true;

            Logger.info(`✅ Local MongoDB Connected Successfully!`);
            Logger.info(`📊 Database: ${this.localConnection.name}`);
            Logger.info(`🌐 Host: ${this.localConnection.host}`);
            Logger.info(`🔌 Port: ${this.localConnection.port}`);

            // Test connection
            try {
                await this.localConnection.db.admin().ping();
                Logger.info("✅ Local database ping successful");
            } catch (pingError) {
                Logger.warn("⚠️ Local database ping failed, but connection established");
            }

            // Setup event handlers
            this.setupLocalEventHandlers();

            return this.localConnection;
        } catch (error) {
            this.isLocalConnected = false;
            Logger.error("❌ Local MongoDB connection failed!");
            Logger.error("📝 Error details:", error.message);
            this.logConnectionError(error, "local");
            throw error; // Local connection failure is critical
        }
    }

    /**
     * Connect to MongoDB Atlas instance
     * This is the backup database for synchronization
     * @param {string} uri - MongoDB Atlas connection URI
     * @returns {Promise<mongoose.Connection>}
     */
    async connectAtlas(uri) {
        if (!uri) {
            Logger.warn("⚠️ Atlas URI not provided, skipping Atlas connection");
            return null;
        }

        // Prevent concurrent connection attempts
        if (this._atlasConnecting) {
            Logger.debug("🔄 Atlas connection attempt already in progress, skipping");
            return null;
        }
        this._atlasConnecting = true;

        try {
            Logger.info("🔄 Connecting to MongoDB Atlas (Backup)...");

            const options = {
                maxPoolSize: 20,
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 15000,
                family: 4,
                retryWrites: true,
                w: "majority",
                minPoolSize: 1,
                maxIdleTimeMS: 30000
            };

            // Create separate connection for Atlas
            // Let mongoose resolve DNS SRV + handle timeouts — no TCP pre-probe needed
            this.atlasConnection = mongoose.createConnection(uri, options);
            
            // Wait for connection to be ready (mongoose handles DNS SRV resolution)
            await new Promise((resolve, reject) => {
                this.atlasConnection.once('open', resolve);
                this.atlasConnection.once('error', reject);
                setTimeout(() => reject(new Error('Atlas connection timeout after 15 seconds')), 15000);
            });
            
            this.isAtlasConnected = true;
            this.reconnectAttempts = 0;
            this.hourlyRetryScheduled = false;

            Logger.info(`✅ MongoDB Atlas Connected Successfully! (Backup)`);
            Logger.info(`📊 Database: ${this.atlasConnection.name}`);
            Logger.info(`🌐 Host: ${this.atlasConnection.host}`);

            // Test connection
            try {
                await this.atlasConnection.db.admin().ping();
                Logger.info("✅ Atlas database ping successful");
            } catch (pingError) {
                Logger.warn("⚠️ Atlas database ping failed, but connection established");
            }

            // Setup event handlers
            this.setupAtlasEventHandlers();

            return this.atlasConnection;
        } catch (error) {
            this.isAtlasConnected = false;
            Logger.warn(`⚠️ MongoDB Atlas connection failed: ${error.message}`);
            this.logConnectionError(error, "atlas");

            // Schedule reconnection only if not already scheduled by monitor
            if (!this._reconnectScheduled) {
                this.scheduleAtlasReconnect(uri);
            }

            return null;
        } finally {
            this._atlasConnecting = false;
        }
    }

    /**
     * Setup event handlers for local connection
     */
    setupLocalEventHandlers() {
        this.localConnection.on("error", (err) => {
            this.isLocalConnected = false;
            Logger.error("❌ Local MongoDB connection error:", err.message);
        });

        this.localConnection.on("disconnected", () => {
            this.isLocalConnected = false;
            Logger.warn("⚠️ Local MongoDB disconnected");
        });

        this.localConnection.on("reconnected", () => {
            this.isLocalConnected = true;
            Logger.info("✅ Local MongoDB reconnected");
        });

        this.localConnection.on("connected", () => {
            this.isLocalConnected = true;
            Logger.info("✅ Local MongoDB connected");
        });
    }

    /**
     * Setup event handlers for Atlas connection
     */
    setupAtlasEventHandlers() {
        if (!this.atlasConnection) return;

        // Remove any existing listeners to prevent duplicates
        this.atlasConnection.removeAllListeners("error");
        this.atlasConnection.removeAllListeners("disconnected");
        this.atlasConnection.removeAllListeners("reconnected");
        this.atlasConnection.removeAllListeners("connected");

        this.atlasConnection.on("error", (err) => {
            this.isAtlasConnected = false;
            Logger.error("❌ Atlas MongoDB connection error:", err.message);
        });

        this.atlasConnection.on("disconnected", () => {
            this.isAtlasConnected = false;
            this._reconnectScheduled = false;
            Logger.warn("⚠️ Atlas MongoDB disconnected");
            
            this.notifyAtlasDisconnected();
            
            if (syncConfig.enabled && syncConfig.atlasUri) {
                this.scheduleAtlasReconnect(syncConfig.atlasUri);
            }
        });

        this.atlasConnection.on("reconnected", () => {
            this.isAtlasConnected = true;
            this.reconnectAttempts = 0;
            this._reconnectScheduled = false;
            this.hourlyRetryScheduled = false;
            Logger.info("✅ Atlas MongoDB reconnected");
            
            this.notifyAtlasReconnected();
        });

        this.atlasConnection.on("connected", () => {
            this.isAtlasConnected = true;
            this.reconnectAttempts = 0;
            this._reconnectScheduled = false;
            this.hourlyRetryScheduled = false;
            Logger.info("✅ Atlas MongoDB connected");
            
            this.notifyAtlasReconnected();
        });
    }

    /**
     * Schedule Atlas reconnection attempt with exponential backoff
     * @param {string} uri - Atlas connection URI
     */
    scheduleAtlasReconnect(uri) {
        // Prevent duplicate scheduled reconnects
        if (this._reconnectScheduled) {
            Logger.debug("🔄 Atlas reconnection already scheduled, skipping");
            return;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            if (this.hourlyRetryScheduled) return;
            this.hourlyRetryScheduled = true;
            Logger.error(
                `❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached — switching to hourly retry`
            );
            setTimeout(() => {
                this.hourlyRetryScheduled = false;
                this._reconnectScheduled = false;
                this.reconnectAttempts = 0;
                this.scheduleAtlasReconnect(uri);
            }, 3600000);
            return;
        }

        this._reconnectScheduled = true;
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        Logger.info(
            `🔄 Atlas reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
        );

        setTimeout(async () => {
            this._reconnectScheduled = false;
            try {
                await this.connectAtlas(uri);
            } catch (error) {
                Logger.warn("⚠️ Atlas reconnection attempt failed");
            }
        }, delay);
    }

    /**
     * Log detailed connection error information
     * @param {Error} error - Connection error
     * @param {string} type - Connection type ('local' or 'atlas')
     */
    logConnectionError(error, type) {
        const isLocal = type === "local";
        const dbName = isLocal ? "Local MongoDB" : "MongoDB Atlas";

        if (error.message.includes("authentication failed")) {
            Logger.error(`\n🔐 ${dbName} Authentication Error:`);
            Logger.error("- Check your username and password in the connection string");
            Logger.error("- Make sure the database user has proper permissions");
        } else if (
            error.message.includes("ENOTFOUND") ||
            error.message.includes("getaddrinfo")
        ) {
            Logger.error(`\n🌐 ${dbName} Network Error:`);
            Logger.error("- Check your internet connection");
            if (!isLocal) {
                Logger.error("- Verify the cluster hostname in your connection string");
            } else {
                Logger.error("- Make sure MongoDB is running locally");
            }
        } else if (
            error.message.includes("timeout") ||
            error.message.includes("Could not connect to any servers")
        ) {
            Logger.error(`\n⏰ ${dbName} Connection Timeout:`);
            if (!isLocal) {
                Logger.error("- This is likely an IP whitelisting issue for Atlas");
                Logger.error("- Add your current IP to MongoDB Atlas Network Access");
                Logger.error("- Or add 0.0.0.0/0 for development (not recommended for production)");
            } else {
                Logger.error("- Make sure MongoDB service is running");
                Logger.error("- Check if port 27017 is available");
            }
        } else if (error.message.includes("ECONNREFUSED")) {
            Logger.error(`\n🔌 ${dbName} Connection Refused:`);
            if (isLocal) {
                Logger.error("- Make sure MongoDB is running locally");
                Logger.error("- Start MongoDB service: mongod");
                Logger.error("- Or use Docker: docker run -d -p 27017:27017 --name mongodb mongo");
            }
        }

        if (isLocal) {
            Logger.error("\n🔧 Local MongoDB Setup:");
            Logger.error("1. Install MongoDB Community Server");
            Logger.error("2. Start MongoDB service: mongod");
            Logger.error("3. Or use Docker: docker run -d -p 27017:27017 --name mongodb mongo");
        } else {
            Logger.error("\n🔧 Atlas Setup Instructions:");
            Logger.error("1. Go to https://cloud.mongodb.com/");
            Logger.error("2. Create a cluster or use existing one");
            Logger.error("3. Go to Database Access and create a user");
            Logger.error("4. Go to Network Access and add your IP (or 0.0.0.0/0 for development)");
            Logger.error("5. Get connection string from Connect > Connect your application");
        }
    }

    /**
     * Get local connection (primary database)
     * @returns {mongoose.Connection}
     */
    getLocalConnection() {
        return this.localConnection;
    }

    /**
     * Get Atlas connection (backup database)
     * @returns {mongoose.Connection|null}
     */
    getAtlasConnection() {
        return this.atlasConnection;
    }

    /**
     * Check if Atlas is available for sync operations
     * @returns {boolean}
     */
    isAtlasAvailable() {
        return this.isAtlasConnected && this.atlasConnection !== null;
    }

    /**
     * Check if local database is connected
     * @returns {boolean}
     */
    isLocalAvailable() {
        return this.isLocalConnected && this.localConnection !== null;
    }

    /**
     * Get connection status for both databases
     * @returns {Object}
     */
    getConnectionStatus() {
        return {
            local: {
                connected: this.isLocalConnected,
                readyState: this.localConnection?.readyState || 0,
                host: this.localConnection?.host || "N/A",
                name: this.localConnection?.name || "N/A",
            },
            atlas: {
                connected: this.isAtlasConnected,
                readyState: this.atlasConnection?.readyState || 0,
                host: this.atlasConnection?.host || "N/A",
                name: this.atlasConnection?.name || "N/A",
                reconnectAttempts: this.reconnectAttempts,
            },
        };
    }

    /**
     * Register a listener for Atlas reconnection events
     * @param {Function} callback - Function to call when Atlas reconnects
     */
    onAtlasReconnected(callback) {
        if (typeof callback === 'function') {
            this.reconnectListeners.push(callback);
        }
    }

    /**
     * Register a listener for Atlas disconnection events
     * @param {Function} callback - Function to call when Atlas disconnects
     */
    onAtlasDisconnected(callback) {
        if (typeof callback === 'function') {
            this.disconnectListeners.push(callback);
        }
    }

    /**
     * Notify all listeners about Atlas reconnection
     */
    notifyAtlasReconnected() {
        Logger.info(`📢 Notifying ${this.reconnectListeners.length} listeners about Atlas reconnection`);
        this.reconnectListeners.forEach(callback => {
            try {
                callback();
            } catch (error) {
                Logger.error("❌ Error in reconnection listener:", error.message);
            }
        });
    }

    /**
     * Notify all listeners about Atlas disconnection
     */
    notifyAtlasDisconnected() {
        Logger.info(`📢 Notifying ${this.disconnectListeners.length} listeners about Atlas disconnection`);
        this.disconnectListeners.forEach(callback => {
            try {
                callback();
            } catch (error) {
                Logger.error("❌ Error in disconnection listener:", error.message);
            }
        });
    }

    /**
     * Start monitoring Atlas connection health
     */
    startConnectionMonitoring() {
        if (this.monitoringInterval) {
            Logger.warn("⚠️ Connection monitoring already started");
            return;
        }

        Logger.info("🔍 Starting Atlas connection monitoring");
        
        this.monitoringInterval = setInterval(async () => {
            await this.checkAtlasConnection();
        }, this.monitoringFrequency);
    }

    /**
     * Stop monitoring Atlas connection health
     */
    stopConnectionMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            Logger.info("🛑 Stopped Atlas connection monitoring");
        }
    }

    /**
     * Check Atlas connection health and attempt reconnection if needed
     */
    async checkAtlasConnection() {
        if (!syncConfig.enabled || !syncConfig.atlasUri) {
            return;
        }

        // If Atlas is connected, verify with ping
        if (this.isAtlasConnected && this.atlasConnection) {
            try {
                await this.atlasConnection.db.admin().ping();
                // Connection is healthy — reset reconnect state
                this.reconnectAttempts = 0;
                this._reconnectScheduled = false;
                this.hourlyRetryScheduled = false;
            } catch (error) {
                Logger.warn("⚠️ Atlas ping failed, marking disconnected");
                this.isAtlasConnected = false;
                this.notifyAtlasDisconnected();
                // Only schedule reconnect if not already scheduled
                if (!this._reconnectScheduled && !this.hourlyRetryScheduled) {
                    this.reconnectAttempts = 0; // Reset to start fresh backoff
                    this.scheduleAtlasReconnect(syncConfig.atlasUri);
                }
            }
            return;
        }

        // Atlas is not connected — only try if no reconnect is already scheduled
        if (!this.isAtlasConnected && !this._reconnectScheduled && !this.hourlyRetryScheduled) {
            Logger.info("🔍 Monitor: Atlas disconnected, scheduling reconnect");
            this.scheduleAtlasReconnect(syncConfig.atlasUri);
        }
    }

    /**
     * Attempt to reconnect to Atlas immediately
     * @returns {Promise<boolean>} - Success status
     */
    async attemptAtlasReconnect() {
        if (!syncConfig.atlasUri) {
            return false;
        }

        // Don't attempt if already connecting or reconnect scheduled
        if (this._atlasConnecting || this._reconnectScheduled) {
            return false;
        }

        try {
            // Close existing connection if any
            if (this.atlasConnection) {
                try {
                    await this.atlasConnection.close();
                } catch (error) {
                    // Ignore close errors
                }
                this.atlasConnection = null;
            }

            // Attempt new connection
            await this.connectAtlas(syncConfig.atlasUri);
            return this.isAtlasConnected;
        } catch (error) {
            return false;
        }
    }

    /**
     * Close both database connections gracefully
     * @returns {Promise<void>}
     */
    async closeConnections() {
        Logger.info("🔒 Closing database connections...");

        // Stop connection monitoring
        this.stopConnectionMonitoring();

        const closePromises = [];

        // Close local connection
        if (this.localConnection) {
            closePromises.push(
                this.localConnection.close().then(() => {
                    this.isLocalConnected = false;
                    Logger.info("✅ Local MongoDB connection closed");
                }).catch((error) => {
                    Logger.error("❌ Error closing local connection:", error.message);
                })
            );
        }

        // Close Atlas connection
        if (this.atlasConnection) {
            closePromises.push(
                this.atlasConnection.close().then(() => {
                    this.isAtlasConnected = false;
                    Logger.info("✅ Atlas MongoDB connection closed");
                }).catch((error) => {
                    Logger.error("❌ Error closing Atlas connection:", error.message);
                })
            );
        }

        await Promise.all(closePromises);
        Logger.info("✅ All database connections closed");
    }
}

// Export singleton instance
const dualDatabaseManager = new DualDatabaseManager();
export default dualDatabaseManager;
