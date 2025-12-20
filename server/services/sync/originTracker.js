import os from 'os';

/**
 * Origin Tracker
 * Tracks change origins to prevent sync loops in bidirectional sync
 */

class OriginTracker {
    constructor() {
        // Generate unique instance ID on initialization
        this.instanceId = this.generateInstanceId();
        
        // Map to track recent changes: documentId -> { origin, timestamp }
        this.recentChanges = new Map();
        
        // Cleanup interval: 1 minute
        this.cleanupInterval = 60000;
        
        // Start automatic cleanup
        this.cleanupTimer = null;
        this.startCleanup();
    }

    /**
     * Generate unique instance ID
     * Format: hostname-pid-timestamp
     * Requirements: 7.1, 9.2, 9.3
     */
    generateInstanceId() {
        try {
            const hostname = os.hostname();
            const pid = process.pid;
            const timestamp = Date.now();
            
            // Validate components
            if (!hostname || !pid || !timestamp) {
                console.warn('[OriginTracker] Missing components for instance ID, using fallback');
                return `unknown-${Math.random().toString(36).substring(7)}-${Date.now()}`;
            }
            
            return `${hostname}-${pid}-${timestamp}`;

        } catch (error) {
            console.error('[OriginTracker] Error generating instance ID:', error);
            // Fallback to random ID
            return `fallback-${Math.random().toString(36).substring(7)}-${Date.now()}`;
        }
    }

    /**
     * Mark a change as originating from Local
     * Requirements: 7.1, 9.2, 9.3
     * @param {string|ObjectId} documentId - The document ID
     */
    markLocalChange(documentId) {
        try {
            if (!documentId) {
                console.warn('[OriginTracker] Cannot mark null/undefined document ID');
                return;
            }

            const id = documentId.toString();
            this.recentChanges.set(id, {
                origin: 'local',
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('[OriginTracker] Error marking local change:', error);
            // Don't throw - tracking failures shouldn't break the sync process
        }
    }

    /**
     * Mark a change as originating from Atlas
     * Requirements: 7.1, 9.2, 9.3
     * @param {string|ObjectId} documentId - The document ID
     */
    markAtlasChange(documentId) {
        try {
            if (!documentId) {
                console.warn('[OriginTracker] Cannot mark null/undefined document ID');
                return;
            }

            const id = documentId.toString();
            this.recentChanges.set(id, {
                origin: 'atlas',
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('[OriginTracker] Error marking Atlas change:', error);
            // Don't throw - tracking failures shouldn't break the sync process
        }
    }

    /**
     * Check if a change originated from Local
     * Requirements: 7.1, 9.2, 9.3
     * @param {string|ObjectId} documentId - The document ID
     * @returns {boolean}
     */
    isLocalChange(documentId) {
        try {
            if (!documentId) {
                console.warn('[OriginTracker] Cannot check null/undefined document ID');
                return false;
            }

            const id = documentId.toString();
            const change = this.recentChanges.get(id);
            return change && change.origin === 'local';

        } catch (error) {
            console.error('[OriginTracker] Error checking if local change:', error);
            return false; // On error, assume not local
        }
    }

    /**
     * Check if a change originated from Atlas
     * Requirements: 7.1, 9.2, 9.3
     * @param {string|ObjectId} documentId - The document ID
     * @returns {boolean}
     */
    isAtlasChange(documentId) {
        try {
            if (!documentId) {
                console.warn('[OriginTracker] Cannot check null/undefined document ID');
                return false;
            }

            const id = documentId.toString();
            const change = this.recentChanges.get(id);
            return change && change.origin === 'atlas';

        } catch (error) {
            console.error('[OriginTracker] Error checking if Atlas change:', error);
            return false; // On error, assume not Atlas
        }
    }

    /**
     * Determine if sync should be skipped for this change
     * Requirements: 7.1, 9.2, 9.3
     * @param {string|ObjectId} documentId - The document ID
     * @param {string} origin - The origin of the current sync attempt ('local' or 'atlas')
     * @returns {boolean} - True if sync should be skipped
     */
    shouldSkipSync(documentId, origin) {
        try {
            if (!documentId) {
                console.warn('[OriginTracker] Cannot check skip sync for null/undefined document ID');
                return false; // Allow sync on error
            }

            if (!origin || (origin !== 'local' && origin !== 'atlas')) {
                console.warn('[OriginTracker] Invalid origin:', origin);
                return false; // Allow sync on invalid origin
            }

            const id = documentId.toString();
            const change = this.recentChanges.get(id);
            
            if (!change) {
                return false; // No tracking data, allow sync
            }
            
            // Skip if trying to sync back to the origin
            // e.g., if change came from Local, don't sync back to Local
            return change.origin === origin;

        } catch (error) {
            console.error('[OriginTracker] Error checking should skip sync:', error);
            return false; // On error, allow sync to proceed
        }
    }

    /**
     * Clean up old tracking data
     * Removes entries older than the cleanup interval
     * Requirements: 7.1, 9.2, 9.3
     */
    cleanup() {
        try {
            const now = Date.now();
            const maxAge = this.cleanupInterval;
            
            let cleanedCount = 0;
            
            for (const [id, change] of this.recentChanges.entries()) {
                try {
                    if (now - change.timestamp > maxAge) {
                        this.recentChanges.delete(id);
                        cleanedCount++;
                    }
                } catch (error) {
                    console.error('[OriginTracker] Error cleaning up entry:', id, error);
                    // Try to delete the problematic entry
                    try {
                        this.recentChanges.delete(id);
                    } catch (deleteError) {
                        console.error('[OriginTracker] Error deleting problematic entry:', deleteError);
                    }
                }
            }
            
            if (cleanedCount > 0) {
                // Cleanup completed silently
            }

        } catch (error) {
            console.error('[OriginTracker] Error during cleanup:', error);
            // Don't throw - cleanup failures shouldn't break the system
        }
    }

    /**
     * Start automatic cleanup timer
     * Requirements: 7.1, 9.2, 9.3
     */
    startCleanup() {
        try {
            if (this.cleanupTimer) {
                clearInterval(this.cleanupTimer);
            }
            
            this.cleanupTimer = setInterval(() => {
                try {
                    this.cleanup();
                } catch (error) {
                    console.error('[OriginTracker] Error in cleanup interval:', error);
                }
            }, this.cleanupInterval);
            
            // Don't prevent Node.js from exiting
            if (this.cleanupTimer.unref) {
                this.cleanupTimer.unref();
            }

        } catch (error) {
            console.error('[OriginTracker] Error starting cleanup timer:', error);
            // Don't throw - timer failures shouldn't break initialization
        }
    }

    /**
     * Stop automatic cleanup timer
     * Requirements: 7.1, 9.2, 9.3
     */
    stopCleanup() {
        try {
            if (this.cleanupTimer) {
                clearInterval(this.cleanupTimer);
                this.cleanupTimer = null;
            }

        } catch (error) {
            console.error('[OriginTracker] Error stopping cleanup timer:', error);
            // Don't throw - cleanup stop failures shouldn't break shutdown
        }
    }

    /**
     * Clear all tracking data
     */
    clear() {
        this.recentChanges.clear();
    }

    /**
     * Get the number of tracked changes
     * @returns {number}
     */
    size() {
        return this.recentChanges.size;
    }
}

export default OriginTracker;
