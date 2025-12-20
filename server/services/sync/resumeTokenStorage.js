import Logger from '../../middleware/logger.js';

/**
 * Resume Token Storage
 * Manages persistence of Atlas Change Stream resume tokens
 * 
 * Requirements: 7.3, 7.4, 7.5
 */

class ResumeTokenStorage {
    constructor(databaseManager) {
        this.databaseManager = databaseManager;
        this.collectionName = '_sync_metadata';
        this.tokenId = 'atlas-resume-token';
    }

    /**
     * Save resume token to Local MongoDB
     * Requirements: 7.3, 7.1, 9.2, 9.3
     * 
     * @param {Object} token - Resume token from Change Stream
     * @param {string} instanceId - Instance identifier
     * @returns {Promise<boolean>} - True if saved successfully
     */
    async save(token, instanceId) {
        if (!token) {
            Logger.warn('[ResumeTokenStorage] Cannot save null/undefined token');
            return false;
        }

        // Retry configuration
        const maxRetries = 3;
        const retryDelays = [1000, 2000, 5000]; // Exponential backoff

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Validate token before saving
                if (!this.validate(token)) {
                    Logger.error('[ResumeTokenStorage] Token validation failed, not saving');
                    return false;
                }

                // Get local connection with error handling
                const localConnection = this.databaseManager.getLocalConnection();
                if (!localConnection) {
                    Logger.warn('[ResumeTokenStorage] Local connection not available');
                    
                    // Retry if not last attempt
                    if (attempt < maxRetries - 1) {
                        const delay = retryDelays[attempt];
                        Logger.info(`[ResumeTokenStorage] Retrying save in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    
                    return false;
                }

                // Get metadata collection with error handling
                let metadataCollection;
                try {
                    metadataCollection = localConnection.db.collection(this.collectionName);
                } catch (error) {
                    Logger.error('[ResumeTokenStorage] Error accessing metadata collection:', error);
                    
                    if (attempt < maxRetries - 1) {
                        const delay = retryDelays[attempt];
                        Logger.info(`[ResumeTokenStorage] Retrying save in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    
                    throw error;
                }
                
                // Save token with metadata
                await metadataCollection.updateOne(
                    { _id: this.tokenId },
                    {
                        $set: {
                            token: token,
                            timestamp: new Date(),
                            instanceId: instanceId || 'unknown',
                            saveAttempts: attempt + 1
                        }
                    },
                    { upsert: true }
                );

                Logger.debug('[ResumeTokenStorage] Resume token saved successfully');
                return true;

            } catch (error) {
                Logger.error(`[ResumeTokenStorage] Error saving resume token (attempt ${attempt + 1}/${maxRetries}):`, error);
                
                // Retry with exponential backoff if not last attempt
                if (attempt < maxRetries - 1) {
                    const delay = retryDelays[attempt];
                    Logger.info(`[ResumeTokenStorage] Retrying save in ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    Logger.error('[ResumeTokenStorage] Max retries reached, token save failed');
                    return false;
                }
            }
        }

        return false;
    }

    /**
     * Load resume token from Local MongoDB
     * Requirements: 7.3, 7.5, 7.1, 9.2, 9.3
     * 
     * @returns {Promise<Object|null>} - Resume token or null if not found
     */
    async load() {
        // Retry configuration
        const maxRetries = 3;
        const retryDelays = [1000, 2000, 5000]; // Exponential backoff

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Get local connection with error handling
                const localConnection = this.databaseManager.getLocalConnection();
                if (!localConnection) {
                    Logger.warn('[ResumeTokenStorage] Local connection not available');
                    
                    // Retry if not last attempt
                    if (attempt < maxRetries - 1) {
                        const delay = retryDelays[attempt];
                        Logger.info(`[ResumeTokenStorage] Retrying load in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    
                    return null;
                }

                // Get metadata collection with error handling
                let metadataCollection;
                try {
                    metadataCollection = localConnection.db.collection(this.collectionName);
                } catch (error) {
                    Logger.error('[ResumeTokenStorage] Error accessing metadata collection:', error);
                    
                    if (attempt < maxRetries - 1) {
                        const delay = retryDelays[attempt];
                        Logger.info(`[ResumeTokenStorage] Retrying load in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    
                    throw error;
                }
                
                // Load token document
                const doc = await metadataCollection.findOne({ _id: this.tokenId });
                
                if (!doc || !doc.token) {
                    Logger.debug('[ResumeTokenStorage] No resume token found');
                    return null;
                }

                // Validate token before returning
                if (!this.validate(doc.token)) {
                    Logger.warn('[ResumeTokenStorage] Stored token is invalid, clearing it');
                    
                    // Clear invalid token
                    try {
                        await this.clear();
                    } catch (clearError) {
                        Logger.error('[ResumeTokenStorage] Error clearing invalid token:', clearError);
                    }
                    
                    return null;
                }

                // Check token age - if too old, might be expired
                const tokenAge = Date.now() - new Date(doc.timestamp).getTime();
                const maxTokenAge = 7 * 24 * 60 * 60 * 1000; // 7 days
                
                if (tokenAge > maxTokenAge) {
                    Logger.warn(`[ResumeTokenStorage] Token is ${Math.floor(tokenAge / (24 * 60 * 60 * 1000))} days old, might be expired`);
                    // Don't clear automatically, let Change Stream handle it
                }

                Logger.debug('[ResumeTokenStorage] Resume token loaded successfully');
                Logger.debug(`[ResumeTokenStorage] Token timestamp: ${doc.timestamp}`);
                Logger.debug(`[ResumeTokenStorage] Token instance: ${doc.instanceId}`);
                Logger.debug(`[ResumeTokenStorage] Token age: ${Math.floor(tokenAge / 1000)}s`);

                return doc.token;

            } catch (error) {
                Logger.error(`[ResumeTokenStorage] Error loading resume token (attempt ${attempt + 1}/${maxRetries}):`, error);
                
                // Retry with exponential backoff if not last attempt
                if (attempt < maxRetries - 1) {
                    const delay = retryDelays[attempt];
                    Logger.info(`[ResumeTokenStorage] Retrying load in ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    Logger.error('[ResumeTokenStorage] Max retries reached, token load failed');
                    return null;
                }
            }
        }

        return null;
    }

    /**
     * Validate resume token structure
     * Requirements: 7.4, 7.1, 9.2, 9.3
     * 
     * @param {Object} token - Resume token to validate
     * @returns {boolean} - True if valid
     */
    validate(token) {
        try {
            if (!token) {
                Logger.debug('[ResumeTokenStorage] Token is null or undefined');
                return false;
            }

            // Resume token should be an object with _data field
            if (typeof token !== 'object') {
                Logger.debug('[ResumeTokenStorage] Token is not an object');
                return false;
            }

            if (!token._data) {
                Logger.debug('[ResumeTokenStorage] Token missing _data field');
                return false;
            }

            // _data should be a string
            if (typeof token._data !== 'string') {
                Logger.debug('[ResumeTokenStorage] Token _data is not a string');
                return false;
            }

            // _data should not be empty
            if (token._data.trim() === '') {
                Logger.debug('[ResumeTokenStorage] Token _data is empty');
                return false;
            }

            // Additional validation: _data should be a valid base64-like string
            // MongoDB resume tokens are typically base64 encoded
            if (!/^[A-Za-z0-9+/=]+$/.test(token._data)) {
                Logger.debug('[ResumeTokenStorage] Token _data has invalid format');
                return false;
            }

            return true;

        } catch (error) {
            Logger.error('[ResumeTokenStorage] Error validating token:', error);
            return false;
        }
    }

    /**
     * Clear resume token from storage
     * Useful for forcing full sync or handling expired tokens
     * Requirements: 7.4, 7.5, 7.1, 9.2, 9.3
     * 
     * @returns {Promise<boolean>} - True if cleared successfully
     */
    async clear() {
        // Retry configuration
        const maxRetries = 3;
        const retryDelays = [1000, 2000, 5000]; // Exponential backoff

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Get local connection with error handling
                const localConnection = this.databaseManager.getLocalConnection();
                if (!localConnection) {
                    Logger.warn('[ResumeTokenStorage] Local connection not available');
                    
                    // Retry if not last attempt
                    if (attempt < maxRetries - 1) {
                        const delay = retryDelays[attempt];
                        Logger.info(`[ResumeTokenStorage] Retrying clear in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    
                    return false;
                }

                // Get metadata collection with error handling
                let metadataCollection;
                try {
                    metadataCollection = localConnection.db.collection(this.collectionName);
                } catch (error) {
                    Logger.error('[ResumeTokenStorage] Error accessing metadata collection:', error);
                    
                    if (attempt < maxRetries - 1) {
                        const delay = retryDelays[attempt];
                        Logger.info(`[ResumeTokenStorage] Retrying clear in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    
                    throw error;
                }
                
                // Delete token document
                const result = await metadataCollection.deleteOne({ _id: this.tokenId });
                
                if (result.deletedCount > 0) {
                    Logger.info('[ResumeTokenStorage] Resume token cleared successfully');
                } else {
                    Logger.info('[ResumeTokenStorage] No resume token found to clear');
                }
                
                return true;

            } catch (error) {
                Logger.error(`[ResumeTokenStorage] Error clearing resume token (attempt ${attempt + 1}/${maxRetries}):`, error);
                
                // Retry with exponential backoff if not last attempt
                if (attempt < maxRetries - 1) {
                    const delay = retryDelays[attempt];
                    Logger.info(`[ResumeTokenStorage] Retrying clear in ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    Logger.error('[ResumeTokenStorage] Max retries reached, token clear failed');
                    return false;
                }
            }
        }

        return false;
    }

    /**
     * Get token metadata without the token itself
     * Useful for debugging and monitoring
     * 
     * @returns {Promise<Object|null>} - Token metadata or null
     */
    async getMetadata() {
        try {
            // Get local connection
            const localConnection = this.databaseManager.getLocalConnection();
            if (!localConnection) {
                return null;
            }

            // Get metadata collection
            const metadataCollection = localConnection.db.collection(this.collectionName);
            
            // Load token document
            const doc = await metadataCollection.findOne({ _id: this.tokenId });
            
            if (!doc) {
                return null;
            }

            return {
                exists: true,
                timestamp: doc.timestamp,
                instanceId: doc.instanceId,
                isValid: this.validate(doc.token)
            };

        } catch (error) {
            Logger.error('[ResumeTokenStorage] Error getting token metadata:', error);
            return null;
        }
    }

    /**
     * Check if a resume token exists in storage
     * 
     * @returns {Promise<boolean>} - True if token exists
     */
    async exists() {
        try {
            const metadata = await this.getMetadata();
            return metadata !== null && metadata.exists;
        } catch (error) {
            Logger.error('[ResumeTokenStorage] Error checking token existence:', error);
            return false;
        }
    }

    /**
     * Handle invalid or expired token
     * Clears the token and logs the issue
     * Requirements: 7.4, 7.5, 7.1, 9.2, 9.3
     * 
     * @param {string} reason - Reason for invalidation
     * @returns {Promise<boolean>} - True if handled successfully
     */
    async handleInvalidToken(reason = 'Token invalid or expired') {
        Logger.warn(`[ResumeTokenStorage] ${reason}, clearing token`);
        
        // Retry configuration
        const maxRetries = 3;
        const retryDelays = [1000, 2000, 5000]; // Exponential backoff

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const cleared = await this.clear();
                
                if (cleared) {
                    Logger.info('[ResumeTokenStorage] Invalid token cleared, will perform full sync on next start');
                    return true;
                } else {
                    Logger.warn('[ResumeTokenStorage] Failed to clear invalid token');
                    
                    // Retry if not last attempt
                    if (attempt < maxRetries - 1) {
                        const delay = retryDelays[attempt];
                        Logger.info(`[ResumeTokenStorage] Retrying handleInvalidToken in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    
                    return false;
                }

            } catch (error) {
                Logger.error(`[ResumeTokenStorage] Error handling invalid token (attempt ${attempt + 1}/${maxRetries}):`, error);
                
                // Retry with exponential backoff if not last attempt
                if (attempt < maxRetries - 1) {
                    const delay = retryDelays[attempt];
                    Logger.info(`[ResumeTokenStorage] Retrying handleInvalidToken in ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    Logger.error('[ResumeTokenStorage] Max retries reached, handleInvalidToken failed');
                    return false;
                }
            }
        }

        return false;
    }
}

export default ResumeTokenStorage;
