/**
 * Resilient Sync Manager
 * 
 * Manages sync operations with enhanced error handling and recovery
 * Ensures sync continues working even with network issues
 */

import Logger from '../../middleware/logger.js';
import syncConfig from '../../config/syncConfig.js';

class ResilientSyncManager {
    constructor() {
        this.connectionRetries = 0;
        this.maxConnectionRetries = 10;
        this.retryDelay = 5000; // Start with 5 seconds
        this.maxRetryDelay = 60000; // Max 1 minute
        this.isRecovering = false;
        this.lastSuccessfulSync = new Date();
        this.failedOperations = [];
        
        // Health check interval
        this.healthCheckInterval = null;
        this.startHealthCheck();
    }

    /**
     * Start health check monitoring
     */
    startHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        // Check every 30 seconds
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000);
        
        Logger.info('🏥 Sync health monitoring started');
    }

    /**
     * Perform health check
     */
    async performHealthCheck() {
        try {
            const timeSinceLastSync = Date.now() - this.lastSuccessfulSync.getTime();
            const maxAllowedGap = 5 * 60 * 1000; // 5 minutes
            
            if (timeSinceLastSync > maxAllowedGap && !this.isRecovering) {
                Logger.warn(`⚠️ Sync health check: No successful sync for ${Math.floor(timeSinceLastSync / 1000)} seconds`);
                this.initiateRecovery();
            }
            
            // Log health status periodically
            if (timeSinceLastSync < 60000) { // Less than 1 minute
                Logger.debug('💚 Sync health: Good');
            }
            
        } catch (error) {
            Logger.error('❌ Health check failed:', error);
        }
    }

    /**
     * Handle sync operation with resilience
     */
    async handleSyncOperation(operation, retryCount = 0) {
        try {
            // Execute the operation
            const result = await this.executeSyncOperation(operation);
            
            if (result.success) {
                this.onSyncSuccess();
                return result;
            } else {
                return this.handleSyncFailure(operation, result.error, retryCount);
            }
            
        } catch (error) {
            return this.handleSyncFailure(operation, error, retryCount);
        }
    }

    /**
     * Execute sync operation (to be implemented by specific sync services)
     */
    async executeSyncOperation(operation) {
        // This will be overridden by specific implementations
        throw new Error('executeSyncOperation must be implemented by subclass');
    }

    /**
     * Handle successful sync
     */
    onSyncSuccess() {
        this.lastSuccessfulSync = new Date();
        this.connectionRetries = 0;
        this.retryDelay = 5000; // Reset delay
        
        if (this.isRecovering) {
            this.isRecovering = false;
            Logger.info('✅ Sync recovery successful');
        }
    }

    /**
     * Handle sync failure with smart retry
     */
    async handleSyncFailure(operation, error, retryCount) {
        const isNetworkError = this.isNetworkError(error);
        const isTimeoutError = this.isTimeoutError(error);
        
        Logger.warn(`⚠️ Sync operation failed (attempt ${retryCount + 1}):`, {
            error: error.message,
            isNetworkError,
            isTimeoutError,
            operation: operation.type
        });

        // For network/timeout errors, use exponential backoff retry
        if ((isNetworkError || isTimeoutError) && retryCount < syncConfig.maxRetries) {
            const delay = this.calculateRetryDelay(retryCount);
            Logger.info(`🔄 Retrying sync operation in ${delay}ms...`);
            
            await this.sleep(delay);
            return this.handleSyncOperation(operation, retryCount + 1);
        }

        // For validation errors, don't retry but log for investigation
        if (this.isValidationError(error)) {
            Logger.error('❌ Sync validation error (not retrying):', {
                error: error.message,
                operation
            });
            return { success: false, reason: 'validation_error', error };
        }

        // Max retries reached or non-recoverable error
        Logger.error('❌ Sync operation failed permanently:', {
            error: error.message,
            retryCount,
            operation
        });

        // Store failed operation for later retry
        this.storeFailedOperation(operation);
        
        return { success: false, reason: 'max_retries_exceeded', error };
    }

    /**
     * Check if error is network-related
     */
    isNetworkError(error) {
        const networkErrorMessages = [
            'connection timed out',
            'ECONNREFUSED',
            'ENOTFOUND',
            'ETIMEDOUT',
            'network error',
            'connection refused'
        ];
        
        return networkErrorMessages.some(msg => 
            error.message.toLowerCase().includes(msg.toLowerCase())
        );
    }

    /**
     * Check if error is timeout-related
     */
    isTimeoutError(error) {
        const timeoutMessages = [
            'timed out',
            'timeout',
            'ETIMEDOUT'
        ];
        
        return timeoutMessages.some(msg => 
            error.message.toLowerCase().includes(msg.toLowerCase())
        );
    }

    /**
     * Check if error is validation-related
     */
    isValidationError(error) {
        const validationMessages = [
            'validation failed',
            'required field',
            'invalid enum',
            'document validation'
        ];
        
        return validationMessages.some(msg => 
            error.message.toLowerCase().includes(msg.toLowerCase())
        );
    }

    /**
     * Calculate retry delay with exponential backoff
     */
    calculateRetryDelay(retryCount) {
        const baseDelay = this.retryDelay;
        const exponentialDelay = baseDelay * Math.pow(2, retryCount);
        const jitteredDelay = exponentialDelay + (Math.random() * 1000); // Add jitter
        
        return Math.min(jitteredDelay, this.maxRetryDelay);
    }

    /**
     * Store failed operation for later retry
     */
    storeFailedOperation(operation) {
        this.failedOperations.push({
            ...operation,
            failedAt: new Date(),
            retryCount: 0
        });
        
        // Limit stored operations to prevent memory issues
        if (this.failedOperations.length > 1000) {
            this.failedOperations = this.failedOperations.slice(-500);
            Logger.warn('⚠️ Failed operations queue trimmed to prevent memory issues');
        }
    }

    /**
     * Initiate recovery process
     */
    async initiateRecovery() {
        if (this.isRecovering) {
            return;
        }
        
        this.isRecovering = true;
        Logger.info('🔄 Initiating sync recovery process...');
        
        try {
            // Try to reconnect
            await this.attemptReconnection();
            
            // Retry failed operations
            await this.retryFailedOperations();
            
        } catch (error) {
            Logger.error('❌ Recovery process failed:', error);
            
            // Schedule another recovery attempt
            setTimeout(() => {
                this.isRecovering = false;
                this.initiateRecovery();
            }, 60000); // Try again in 1 minute
        }
    }

    /**
     * Attempt to reconnect to Atlas
     */
    async attemptReconnection() {
        Logger.info('🔌 Attempting to reconnect to Atlas...');
        
        // This will be implemented by specific sync services
        // For now, just log the attempt
        Logger.info('🔌 Reconnection attempt logged');
    }

    /**
     * Retry failed operations
     */
    async retryFailedOperations() {
        if (this.failedOperations.length === 0) {
            return;
        }
        
        Logger.info(`🔄 Retrying ${this.failedOperations.length} failed operations...`);
        
        const operationsToRetry = [...this.failedOperations];
        this.failedOperations = [];
        
        for (const operation of operationsToRetry) {
            try {
                const result = await this.handleSyncOperation(operation);
                if (result.success) {
                    Logger.debug('✅ Failed operation retry successful');
                }
            } catch (error) {
                Logger.warn('⚠️ Failed operation retry failed:', error.message);
            }
            
            // Small delay between retries
            await this.sleep(100);
        }
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get sync statistics
     */
    getStats() {
        return {
            lastSuccessfulSync: this.lastSuccessfulSync,
            connectionRetries: this.connectionRetries,
            isRecovering: this.isRecovering,
            failedOperationsCount: this.failedOperations.length,
            timeSinceLastSync: Date.now() - this.lastSuccessfulSync.getTime()
        };
    }

    /**
     * Stop health monitoring
     */
    stop() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        Logger.info('🛑 Sync health monitoring stopped');
    }
}

export default ResilientSyncManager;