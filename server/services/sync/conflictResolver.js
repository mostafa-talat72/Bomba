/**
 * Conflict Resolver
 * Resolves conflicts using Last Write Wins strategy for bidirectional sync
 */

class ConflictResolver {
    constructor() {
        // Conflict resolution strategy
        this.strategy = 'last-write-wins';
        
        // Conflict log for monitoring and debugging
        this.conflictLog = [];
        
        // Maximum number of conflicts to keep in memory
        this.maxLogSize = 1000;
        
        // Conflict statistics
        this.stats = {
            totalConflicts: 0,
            resolvedByLocal: 0,
            resolvedByAtlas: 0,
            lastConflictTime: null
        };
    }

    /**
     * Resolve conflict between local document and Atlas change
     * Uses Last Write Wins strategy based on timestamps
     * Requirements: 7.1, 9.2, 9.3
     * 
     * @param {Object} localDoc - The current local document
     * @param {Object} atlasChange - The Atlas change event
     * @returns {Object} - Resolution result { shouldApply: boolean, winner: 'local'|'atlas', reason: string }
     */
    resolveConflict(localDoc, atlasChange) {
        try {
            // Validate inputs
            if (!localDoc) {
                console.error('[ConflictResolver] Error: localDoc is null or undefined');
                return {
                    shouldApply: true,
                    winner: 'atlas',
                    reason: 'Local document missing, applying Atlas change',
                    error: 'Local document is null'
                };
            }

            if (!atlasChange) {
                console.error('[ConflictResolver] Error: atlasChange is null or undefined');
                return {
                    shouldApply: false,
                    winner: 'local',
                    reason: 'Atlas change missing, keeping local document',
                    error: 'Atlas change is null'
                };
            }

            // Extract timestamps with error handling
            let localTimestamp, atlasTimestamp;
            
            try {
                localTimestamp = this.extractTimestamp(localDoc);
            } catch (error) {
                console.error('[ConflictResolver] Error extracting local timestamp:', error);
                localTimestamp = new Date(0); // Use epoch as fallback
            }

            try {
                atlasTimestamp = this.extractTimestamp(atlasChange);
            } catch (error) {
                console.error('[ConflictResolver] Error extracting Atlas timestamp:', error);
                atlasTimestamp = new Date(); // Use current time as fallback
            }
            
            // Compare timestamps with error handling
            let comparison;
            try {
                comparison = this.compareTimestamps(localTimestamp, atlasTimestamp);
            } catch (error) {
                console.error('[ConflictResolver] Error comparing timestamps:', error);
                // On comparison error, prefer Atlas as source of truth
                comparison = -1;
            }
            
            let resolution;
            
            if (comparison > 0) {
                // Local is newer - keep local
                resolution = {
                    shouldApply: false,
                    winner: 'local',
                    reason: 'Local document has newer timestamp',
                    localTimestamp,
                    atlasTimestamp
                };
                this.stats.resolvedByLocal++;
            } else if (comparison < 0) {
                // Atlas is newer - apply Atlas change
                resolution = {
                    shouldApply: true,
                    winner: 'atlas',
                    reason: 'Atlas change has newer timestamp',
                    localTimestamp,
                    atlasTimestamp
                };
                this.stats.resolvedByAtlas++;
            } else {
                // Timestamps are equal - prefer Atlas as source of truth
                resolution = {
                    shouldApply: true,
                    winner: 'atlas',
                    reason: 'Timestamps equal, Atlas preferred as source of truth',
                    localTimestamp,
                    atlasTimestamp
                };
                this.stats.resolvedByAtlas++;
            }
            
            // Log the conflict with error handling
            try {
                this.logConflict({
                    documentId: localDoc._id,
                    collectionName: atlasChange.ns?.coll || 'unknown',
                    resolution,
                    timestamp: new Date()
                });
            } catch (error) {
                console.error('[ConflictResolver] Error logging conflict:', error);
                // Continue even if logging fails
            }
            
            // Update statistics
            this.stats.totalConflicts++;
            this.stats.lastConflictTime = new Date();
            
            return resolution;

        } catch (error) {
            // Catch-all error handler
            console.error('[ConflictResolver] Unexpected error in resolveConflict:', error);
            
            // On any error, prefer Atlas as source of truth
            return {
                shouldApply: true,
                winner: 'atlas',
                reason: 'Error during conflict resolution, applying Atlas change',
                error: error.message
            };
        }
    }

    /**
     * Extract timestamp from document or change event
     * Tries multiple timestamp fields in order of preference
     * Requirements: 7.1, 9.2, 9.3
     * 
     * @param {Object} docOrChange - Document or change event
     * @returns {Date} - Extracted timestamp or current time as fallback
     */
    extractTimestamp(docOrChange) {
        try {
            if (!docOrChange) {
                console.warn('[ConflictResolver] Cannot extract timestamp from null/undefined document');
                return new Date();
            }

            // Try different timestamp fields
            const timestamp = 
                docOrChange.updatedAt ||
                docOrChange.clusterTime ||
                docOrChange._syncMeta?.lastModified ||
                docOrChange.fullDocument?.updatedAt ||
                docOrChange.fullDocument?._syncMeta?.lastModified ||
                new Date();
            
            // Convert to Date object if needed
            if (timestamp instanceof Date) {
                // Validate the date is not invalid
                if (isNaN(timestamp.getTime())) {
                    console.warn('[ConflictResolver] Invalid Date object, using current time');
                    return new Date();
                }
                return timestamp;
            }
            
            // Handle MongoDB Timestamp type
            if (timestamp && typeof timestamp.getHighBits === 'function') {
                try {
                    const date = new Date(timestamp.getHighBits() * 1000);
                    if (isNaN(date.getTime())) {
                        console.warn('[ConflictResolver] Invalid MongoDB Timestamp, using current time');
                        return new Date();
                    }
                    return date;
                } catch (error) {
                    console.error('[ConflictResolver] Error converting MongoDB Timestamp:', error);
                    return new Date();
                }
            }
            
            // Try to parse as date string or number
            if (typeof timestamp === 'string' || typeof timestamp === 'number') {
                try {
                    const date = new Date(timestamp);
                    if (isNaN(date.getTime())) {
                        console.warn('[ConflictResolver] Invalid date string/number, using current time');
                        return new Date();
                    }
                    return date;
                } catch (error) {
                    console.error('[ConflictResolver] Error parsing timestamp:', error);
                    return new Date();
                }
            }
            
            // Fallback to current time
            return new Date();

        } catch (error) {
            console.error('[ConflictResolver] Unexpected error extracting timestamp:', error);
            return new Date();
        }
    }

    /**
     * Compare two timestamps
     * Requirements: 7.1, 9.2, 9.3
     * 
     * @param {Date} timestamp1 - First timestamp
     * @param {Date} timestamp2 - Second timestamp
     * @returns {number} - Negative if timestamp1 < timestamp2, positive if timestamp1 > timestamp2, 0 if equal
     */
    compareTimestamps(timestamp1, timestamp2) {
        try {
            // Validate inputs
            if (!(timestamp1 instanceof Date) || !(timestamp2 instanceof Date)) {
                console.error('[ConflictResolver] Invalid timestamp types for comparison');
                throw new Error('Timestamps must be Date objects');
            }

            const time1 = timestamp1.getTime();
            const time2 = timestamp2.getTime();
            
            // Check for invalid times
            if (isNaN(time1) || isNaN(time2)) {
                console.error('[ConflictResolver] Invalid timestamp values');
                throw new Error('Invalid timestamp values');
            }
            
            return time1 - time2;

        } catch (error) {
            console.error('[ConflictResolver] Error comparing timestamps:', error);
            throw error;
        }
    }

    /**
     * Log a conflict for monitoring and debugging
     * Requirements: 7.1, 9.2, 9.3
     * 
     * @param {Object} conflict - Conflict details
     */
    logConflict(conflict) {
        try {
            // Validate conflict object
            if (!conflict) {
                console.warn('[ConflictResolver] Cannot log null/undefined conflict');
                return;
            }

            // Add to conflict log with error handling
            try {
                this.conflictLog.push(conflict);
            } catch (error) {
                console.error('[ConflictResolver] Error adding conflict to log:', error);
                // Try to clear some space and retry
                if (this.conflictLog.length >= this.maxLogSize) {
                    this.conflictLog = this.conflictLog.slice(-Math.floor(this.maxLogSize / 2));
                    this.conflictLog.push(conflict);
                }
            }
            
            // Trim log if it exceeds max size
            if (this.conflictLog.length > this.maxLogSize) {
                this.conflictLog.shift(); // Remove oldest entry
            }
            
            // Log to console for immediate visibility with error handling
            try {
                console.log('[ConflictResolver] Conflict detected:', {
                    documentId: conflict.documentId,
                    collection: conflict.collectionName,
                    winner: conflict.resolution?.winner || 'unknown',
                    reason: conflict.resolution?.reason || 'unknown',
                    localTime: conflict.resolution?.localTimestamp,
                    atlasTime: conflict.resolution?.atlasTimestamp
                });
            } catch (error) {
                console.error('[ConflictResolver] Error logging conflict to console:', error);
            }

        } catch (error) {
            console.error('[ConflictResolver] Unexpected error in logConflict:', error);
            // Don't throw - logging failures shouldn't break the sync process
        }
    }

    /**
     * Get conflict statistics
     * 
     * @returns {Object} - Conflict statistics
     */
    getConflictStats() {
        return {
            ...this.stats,
            recentConflicts: this.conflictLog.slice(-10), // Last 10 conflicts
            conflictLogSize: this.conflictLog.length
        };
    }

    /**
     * Get recent conflicts
     * 
     * @param {number} limit - Maximum number of conflicts to return
     * @returns {Array} - Array of recent conflicts
     */
    getRecentConflicts(limit = 10) {
        return this.conflictLog.slice(-limit);
    }

    /**
     * Get all conflicts for a specific document
     * 
     * @param {string|ObjectId} documentId - The document ID
     * @returns {Array} - Array of conflicts for the document
     */
    getConflictsForDocument(documentId) {
        const id = documentId.toString();
        return this.conflictLog.filter(conflict => 
            conflict.documentId.toString() === id
        );
    }

    /**
     * Clear conflict log
     */
    clearLog() {
        this.conflictLog = [];
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalConflicts: 0,
            resolvedByLocal: 0,
            resolvedByAtlas: 0,
            lastConflictTime: null
        };
    }

    /**
     * Get conflict resolution strategy
     * 
     * @returns {string} - Current strategy
     */
    getStrategy() {
        return this.strategy;
    }
}

export default ConflictResolver;
