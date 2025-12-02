import Logger from '../../middleware/logger.js';
import syncConfig from '../../config/syncConfig.js';
import ResumeTokenStorage from './resumeTokenStorage.js';

/**
 * Atlas Change Stream Listener
 * Monitors MongoDB Atlas for changes and processes them for bidirectional sync
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5, 7.1, 7.2, 7.3, 7.4, 8.2
 */

class AtlasChangeListener {
    constructor(databaseManager, changeProcessor, originTracker) {
        this.databaseManager = databaseManager;
        this.changeProcessor = changeProcessor;
        this.originTracker = originTracker;
        this.resumeTokenStorage = new ResumeTokenStorage(databaseManager);
        
        // Change Stream state
        this.changeStream = null;
        this.isRunning = false;
        this.resumeToken = null;
        this.instanceId = originTracker?.instanceId || null;
        
        // Reconnection state
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = syncConfig.bidirectionalSync?.changeStream?.maxReconnectAttempts || 10;
        this.reconnectInterval = syncConfig.bidirectionalSync?.changeStream?.reconnectInterval || 5000;
        this.reconnectTimer = null;
        
        // Batching state
        this.changeBatch = [];
        this.batchTimer = null;
        this.batchTimeout = 1000; // Process batch after 1 second of inactivity
        this.isBatchProcessing = false;
        
        // Statistics
        this.stats = {
            totalChanges: 0,
            processedChanges: 0,
            failedChanges: 0,
            skippedChanges: 0,
            reconnections: 0,
            batchesProcessed: 0,
            lastChangeTime: null,
            startTime: null
        };
        
        // Configuration
        this.batchSize = syncConfig.bidirectionalSync?.changeStream?.batchSize || 100;
        this.excludedCollections = syncConfig.bidirectionalSync?.excludedCollections || [];
    }

    /**
     * Start listening to Atlas Change Stream
     * Requirements: 1.5, 7.1, 7.2, 8.2
     */
    async start() {
        if (this.isRunning) {
            Logger.warn('[AtlasChangeListener] Already running');
            return;
        }

        try {
            Logger.info('[AtlasChangeListener] Starting Atlas Change Stream listener...');

            // Check if Atlas is available
            if (!this.databaseManager.isAtlasAvailable()) {
                throw new Error('Atlas connection not available');
            }

            // Load resume token if exists with error handling
            try {
                this.resumeToken = await this.resumeTokenStorage.load();
                if (this.resumeToken) {
                    Logger.info('[AtlasChangeListener] Resume token loaded from storage');
                } else {
                    Logger.info('[AtlasChangeListener] No resume token found, starting fresh');
                }
            } catch (error) {
                Logger.error('[AtlasChangeListener] Error loading resume token:', error);
                Logger.info('[AtlasChangeListener] Starting without resume token');
                this.resumeToken = null;
            }

            // Get Atlas connection
            const atlasConnection = this.databaseManager.getAtlasConnection();
            if (!atlasConnection) {
                throw new Error('Atlas connection is null');
            }

            // Build Change Stream options
            const options = {
                fullDocument: 'updateLookup', // Get full document on updates
                batchSize: this.batchSize
            };

            // Add resume token if available
            if (this.resumeToken) {
                options.resumeAfter = this.resumeToken;
                Logger.info('[AtlasChangeListener] Resuming from saved token');
            }

            // Build pipeline to filter excluded collections
            const pipeline = [];
            if (this.excludedCollections.length > 0) {
                pipeline.push({
                    $match: {
                        'ns.coll': { $nin: this.excludedCollections }
                    }
                });
                Logger.info(`[AtlasChangeListener] Excluding collections: ${this.excludedCollections.join(', ')}`);
            }

            // Watch the entire database
            this.changeStream = atlasConnection.db.watch(pipeline, options);

            // Setup event handlers
            this.setupEventHandlers();

            // Mark as running
            this.isRunning = true;
            this.stats.startTime = new Date();
            this.reconnectAttempts = 0;

            Logger.info('[AtlasChangeListener] ✅ Change Stream started successfully');
            Logger.info(`[AtlasChangeListener] Instance ID: ${this.instanceId}`);
            Logger.info(`[AtlasChangeListener] Batch size: ${this.batchSize}`);

        } catch (error) {
            Logger.error('[AtlasChangeListener] Failed to start Change Stream:', error);
            this.isRunning = false;
            
            // Schedule reconnection
            await this.scheduleReconnect();
            
            throw error;
        }
    }

    /**
     * Setup event handlers for Change Stream
     */
    setupEventHandlers() {
        if (!this.changeStream) {
            return;
        }

        // Handle change events
        this.changeStream.on('change', async (change) => {
            await this.handleChange(change);
        });

        // Handle errors
        // Requirements: 7.1, 9.2, 9.3
        this.changeStream.on('error', async (error) => {
            Logger.error('[AtlasChangeListener] Change Stream error:', error);
            this.isRunning = false;
            
            // Check if error is due to invalid resume token
            if (error.code === 286 || error.codeName === 'ChangeStreamHistoryLost' || 
                error.message?.includes('resume token') || error.message?.includes('resume point')) {
                Logger.error('[AtlasChangeListener] Resume token error detected, clearing token');
                
                try {
                    await this.resumeTokenStorage.handleInvalidToken('Resume token expired or invalid');
                    this.resumeToken = null;
                } catch (clearError) {
                    Logger.error('[AtlasChangeListener] Error clearing invalid resume token:', clearError);
                }
            }
            
            // Schedule reconnection
            this.scheduleReconnect();
        });

        // Handle close
        this.changeStream.on('close', () => {
            Logger.warn('[AtlasChangeListener] Change Stream closed');
            this.isRunning = false;
            
            // Schedule reconnection if not intentionally stopped
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            }
        });

        // Handle end
        this.changeStream.on('end', () => {
            Logger.warn('[AtlasChangeListener] Change Stream ended');
            this.isRunning = false;
        });
    }

    /**
     * Stop listening to Atlas Change Stream
     */
    async stop() {
        if (!this.isRunning) {
            Logger.warn('[AtlasChangeListener] Not running');
            return;
        }

        try {
            Logger.info('[AtlasChangeListener] Stopping Change Stream...');

            // Clear reconnect timer if any
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }

            // Clear batch timer if any
            if (this.batchTimer) {
                clearTimeout(this.batchTimer);
                this.batchTimer = null;
            }

            // Process any remaining changes in batch before stopping
            if (this.changeBatch.length > 0) {
                Logger.info(`[AtlasChangeListener] Processing ${this.changeBatch.length} remaining changes before stopping`);
                await this.processBatch();
            }

            // Close Change Stream
            if (this.changeStream) {
                await this.changeStream.close();
                this.changeStream = null;
            }

            // Mark as stopped
            this.isRunning = false;

            Logger.info('[AtlasChangeListener] ✅ Change Stream stopped successfully');

        } catch (error) {
            Logger.error('[AtlasChangeListener] Error stopping Change Stream:', error);
            throw error;
        }
    }

    /**
     * Handle incoming change event from Atlas
     * Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3, 9.2, 9.3
     * 
     * @param {Object} change - Change event from Atlas
     */
    async handleChange(change) {
        try {
            this.stats.totalChanges++;
            this.stats.lastChangeTime = new Date();

            // Log change details
            Logger.debug(`[AtlasChangeListener] Received ${change.operationType} on ${change.ns?.coll}`);

            // Save resume token for recovery with error handling
            // Requirements: 7.1, 9.2, 9.3
            if (change._id) {
                this.resumeToken = change._id;
                
                try {
                    const saved = await this.resumeTokenStorage.save(this.resumeToken, this.instanceId);
                    if (!saved) {
                        Logger.warn('[AtlasChangeListener] Failed to save resume token, will retry on next change');
                    }
                } catch (error) {
                    Logger.error('[AtlasChangeListener] Error saving resume token:', error);
                    // Continue processing - token save failure shouldn't stop change processing
                }
            }

            // Check if this change originated from this instance
            const documentId = change.documentKey?._id;
            if (documentId && this.originTracker) {
                // If this change was made by this instance, skip it
                if (this.originTracker.isLocalChange(documentId)) {
                    Logger.debug(`[AtlasChangeListener] Skipping change from same instance: ${documentId}`);
                    this.stats.skippedChanges++;
                    return;
                }
            }

            // Add change to batch for efficient processing
            this.addChangeToBatch(change);

        } catch (error) {
            this.stats.failedChanges++;
            Logger.error('[AtlasChangeListener] Error handling change:', error);
        }
    }

    /**
     * Add change to batch for efficient processing
     * Requirements: 6.1, 6.2, 6.3
     * 
     * @param {Object} change - Change event from Atlas
     */
    addChangeToBatch(change) {
        // Add change to batch
        this.changeBatch.push(change);

        // Clear existing batch timer
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        // If batch is full, process immediately
        if (this.changeBatch.length >= this.batchSize) {
            Logger.debug(`[AtlasChangeListener] Batch full (${this.changeBatch.length} changes), processing immediately`);
            this.processBatch();
        } else {
            // Otherwise, schedule batch processing after timeout
            this.batchTimer = setTimeout(() => {
                this.batchTimer = null;
                this.processBatch();
            }, this.batchTimeout);
        }
    }

    /**
     * Process accumulated batch of changes
     * Requirements: 6.1, 6.2, 6.3, 9.2, 9.3
     */
    async processBatch() {
        // Prevent concurrent batch processing
        if (this.isBatchProcessing || this.changeBatch.length === 0) {
            return;
        }

        this.isBatchProcessing = true;

        try {
            // Get current batch and clear for new changes
            const batch = [...this.changeBatch];
            this.changeBatch = [];

            Logger.debug(`[AtlasChangeListener] Processing batch of ${batch.length} changes`);

            // Process changes in parallel with retry logic
            const results = await Promise.allSettled(
                batch.map(change => this.processChangeWithRetry(change))
            );

            // Update statistics
            let successful = 0;
            let failed = 0;

            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value.success) {
                    successful++;
                    this.stats.processedChanges++;
                } else {
                    failed++;
                    this.stats.failedChanges++;
                    
                    const change = batch[index];
                    const error = result.status === 'rejected' 
                        ? result.reason 
                        : result.value.reason || result.value.error;
                    
                    Logger.warn(
                        `[AtlasChangeListener] Change processing failed: ${change.operationType} on ` +
                        `${change.ns?.coll}:${change.documentKey?._id} - ${error}`
                    );
                }
            });

            this.stats.batchesProcessed++;

            Logger.info(
                `[AtlasChangeListener] Batch processed: ${successful} successful, ${failed} failed ` +
                `(total batches: ${this.stats.batchesProcessed})`
            );

        } catch (error) {
            Logger.error('[AtlasChangeListener] Error processing batch:', error);
        } finally {
            this.isBatchProcessing = false;

            // If more changes accumulated during processing, schedule another batch
            if (this.changeBatch.length > 0) {
                this.batchTimer = setTimeout(() => {
                    this.batchTimer = null;
                    this.processBatch();
                }, this.batchTimeout);
            }
        }
    }

    /**
     * Process change with retry logic and exponential backoff
     * Requirements: 6.1, 6.2, 6.3, 9.2, 9.3
     * 
     * @param {Object} change - Change event from Atlas
     * @param {number} attempt - Current retry attempt (default: 0)
     * @returns {Promise<Object>} - Processing result
     */
    async processChangeWithRetry(change, attempt = 0) {
        const maxRetries = syncConfig.maxRetries || 5;
        const retryDelays = syncConfig.retryDelays || [1000, 5000, 15000, 30000, 60000];

        try {
            // Attempt to process the change
            const result = await this.changeProcessor.processChange(change);

            // If successful or skipped, return immediately
            if (result.success || result.reason === 'Change skipped (origin tracking)') {
                return result;
            }

            // If failed and we have retries left, retry with exponential backoff
            if (attempt < maxRetries) {
                const delay = retryDelays[attempt] || retryDelays[retryDelays.length - 1];
                
                Logger.warn(
                    `[AtlasChangeListener] Change processing failed (attempt ${attempt + 1}/${maxRetries}), ` +
                    `retrying in ${delay}ms: ${result.reason || result.error}`
                );

                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay));

                // Retry
                return await this.processChangeWithRetry(change, attempt + 1);
            }

            // Max retries reached
            Logger.error(
                `[AtlasChangeListener] Change processing failed after ${maxRetries} attempts: ` +
                `${result.reason || result.error}`
            );

            return result;

        } catch (error) {
            // If we have retries left, retry
            if (attempt < maxRetries) {
                const delay = retryDelays[attempt] || retryDelays[retryDelays.length - 1];
                
                Logger.warn(
                    `[AtlasChangeListener] Error processing change (attempt ${attempt + 1}/${maxRetries}), ` +
                    `retrying in ${delay}ms: ${error.message}`
                );

                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay));

                // Retry
                return await this.processChangeWithRetry(change, attempt + 1);
            }

            // Max retries reached
            Logger.error(
                `[AtlasChangeListener] Error processing change after ${maxRetries} attempts: ${error.message}`
            );

            return {
                success: false,
                error: error.message,
                change
            };
        }
    }

    /**
     * Reconnect to Atlas Change Stream with exponential backoff
     * Requirements: 7.1, 7.2
     */
    async reconnect() {
        // Clear any existing reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Check if max attempts reached
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            Logger.error(`[AtlasChangeListener] Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
            return;
        }

        this.reconnectAttempts++;
        this.stats.reconnections++;

        // Calculate delay with exponential backoff
        const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
        
        Logger.info(`[AtlasChangeListener] Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

        try {
            // Close existing Change Stream if any
            if (this.changeStream) {
                try {
                    await this.changeStream.close();
                } catch (error) {
                    Logger.warn('[AtlasChangeListener] Error closing existing Change Stream:', error.message);
                }
                this.changeStream = null;
            }

            // Wait for delay
            await new Promise(resolve => setTimeout(resolve, delay));

            // Attempt to start again
            await this.start();

            Logger.info('[AtlasChangeListener] ✅ Reconnection successful');

        } catch (error) {
            Logger.error('[AtlasChangeListener] Reconnection failed:', error);
            
            // Schedule another reconnection attempt
            await this.scheduleReconnect();
        }
    }

    /**
     * Schedule a reconnection attempt
     */
    async scheduleReconnect() {
        // Don't schedule if already scheduled or max attempts reached
        if (this.reconnectTimer || this.reconnectAttempts >= this.maxReconnectAttempts) {
            return;
        }

        const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts);
        
        Logger.info(`[AtlasChangeListener] Scheduling reconnection in ${delay}ms`);
        
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            await this.reconnect();
        }, delay);
    }

    /**
     * Validate resume token
     * Requirements: 7.4
     * 
     * @param {Object} token - Resume token to validate
     * @returns {boolean} - True if valid
     */
    validateResumeToken(token) {
        return this.resumeTokenStorage.validate(token);
    }

    /**
     * Clear resume token (useful for full sync)
     */
    async clearResumeToken() {
        const cleared = await this.resumeTokenStorage.clear();
        if (cleared) {
            this.resumeToken = null;
        }
    }

    /**
     * Get listener statistics
     * 
     * @returns {Object} - Statistics
     */
    getStats() {
        const uptime = this.stats.startTime 
            ? Date.now() - this.stats.startTime.getTime()
            : 0;

        return {
            ...this.stats,
            isRunning: this.isRunning,
            reconnectAttempts: this.reconnectAttempts,
            hasResumeToken: !!this.resumeToken,
            pendingBatchSize: this.changeBatch.length,
            isBatchProcessing: this.isBatchProcessing,
            uptime: uptime,
            uptimeFormatted: this.formatUptime(uptime)
        };
    }

    /**
     * Format uptime in human-readable format
     * 
     * @param {number} ms - Uptime in milliseconds
     * @returns {string} - Formatted uptime
     */
    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalChanges: 0,
            processedChanges: 0,
            failedChanges: 0,
            skippedChanges: 0,
            reconnections: 0,
            batchesProcessed: 0,
            lastChangeTime: null,
            startTime: this.isRunning ? new Date() : null
        };
    }

    /**
     * Check if listener is healthy
     * 
     * @returns {boolean} - True if healthy
     */
    isHealthy() {
        return this.isRunning && 
               this.changeStream !== null && 
               this.reconnectAttempts < this.maxReconnectAttempts;
    }

    /**
     * Get health status
     * 
     * @returns {Object} - Health status
     */
    getHealthStatus() {
        return {
            healthy: this.isHealthy(),
            running: this.isRunning,
            hasChangeStream: this.changeStream !== null,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            lastChangeTime: this.stats.lastChangeTime,
            uptime: this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0
        };
    }

    /**
     * Update excluded collections dynamically
     * Requirements: 8.4, 8.5
     * 
     * @param {string[]} collections - Array of collection names to exclude
     * @returns {Promise<Object>} - Result with success flag
     */
    async updateExcludedCollections(collections) {
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

            // Update the exclusion list
            this.excludedCollections = collections;

            Logger.info(`[AtlasChangeListener] Updated excluded collections: ${collections.join(', ') || 'none'}`);

            // If Change Stream is running, restart it to apply new filters
            if (this.isRunning) {
                Logger.info('[AtlasChangeListener] Restarting Change Stream to apply new exclusions...');
                
                await this.stop();
                await this.start();

                Logger.info('[AtlasChangeListener] ✅ Change Stream restarted with new exclusions');
            }

            return {
                success: true,
                message: 'Excluded collections updated successfully',
                excludedCollections: this.excludedCollections
            };

        } catch (error) {
            Logger.error('[AtlasChangeListener] Error updating excluded collections:', error);
            return {
                success: false,
                message: `Error updating excluded collections: ${error.message}`
            };
        }
    }

    /**
     * Get current excluded collections
     * 
     * @returns {string[]} - Array of excluded collection names
     */
    getExcludedCollections() {
        return [...this.excludedCollections];
    }
}

export default AtlasChangeListener;
