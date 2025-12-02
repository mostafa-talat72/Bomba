# Bidirectional Sync Server Integration

## Overview

This document describes the integration of bidirectional sync components into the Bomba server initialization process.

## Implementation Summary

### Task 11.1: Integrate Bidirectional Sync into server.js

**Components Initialized:**

1. **Origin Tracker** - Tracks change origins to prevent sync loops
   - Generates unique instance ID on initialization
   - Tracks recent changes by origin (local/atlas)
   - Automatic cleanup of old tracking data

2. **Conflict Resolver** - Resolves conflicts using Last Write Wins strategy
   - Compares document timestamps
   - Logs conflicts for monitoring
   - Provides conflict statistics

3. **Change Processor** - Applies Atlas changes to Local MongoDB
   - Validates incoming changes
   - Checks origin tracking to prevent loops
   - Applies insert, update, delete, and replace operations
   - Bypasses sync middleware when applying changes

4. **Atlas Change Listener** - Monitors Atlas for changes
   - Connects to Atlas Change Stream
   - Handles change events (insert, update, delete, replace)
   - Implements resume token management
   - Automatic reconnection with exponential backoff
   - Batch processing for efficiency

5. **Bidirectional Sync Monitor** - Tracks bidirectional sync metrics
   - Monitors both Local→Atlas and Atlas→Local operations
   - Tracks conflict metrics
   - Provides health checks
   - Generates detailed reports

**Initialization Flow:**

```javascript
// After database connection and one-way sync initialization
if (syncConfig.bidirectionalSync.enabled) {
    // 1. Initialize Origin Tracker
    originTracker = new OriginTracker();
    
    // 2. Initialize Conflict Resolver
    conflictResolver = new ConflictResolver();
    
    // 3. Initialize Change Processor
    changeProcessor = new ChangeProcessor(originTracker, conflictResolver, dualDatabaseManager);
    
    // 4. Initialize Atlas Change Listener
    atlasChangeListener = new AtlasChangeListener(dualDatabaseManager, changeProcessor, originTracker);
    
    // 5. Start Atlas Change Listener
    await atlasChangeListener.start();
    
    // 6. Update monitoring
    bidirectionalSyncMonitor.updateChangeStreamStatus('connected');
}
```

**Graceful Shutdown:**

The graceful shutdown process now includes:

1. Stop Atlas Change Listener
   - Processes remaining changes in batch
   - Closes Change Stream connection
   - Saves resume token for recovery

2. Stop Origin Tracker cleanup timer

3. Log final bidirectional sync statistics

4. Continue with existing shutdown procedures (sync worker, database connections, etc.)

### Task 11.2: Add Startup Verification

**Verification Steps:**

1. **Configuration Verification**
   - Validates bidirectional sync configuration
   - Checks conflict resolution strategy
   - Verifies Change Stream configuration
   - Logs configuration details

2. **Atlas Change Stream Availability**
   - Checks if Atlas connection is available
   - Verifies Atlas connection is ready (readyState === 1)
   - Validates connection can support Change Streams
   - Logs Atlas connection details

3. **Resume Token Check**
   - Attempts to load resume token from storage
   - Logs whether resume token is available
   - If available, Change Stream will resume from last position
   - If not available, Change Stream starts fresh

4. **Startup Status Logging**
   - Comprehensive status display on successful initialization
   - Shows instance ID, conflict resolution strategy, Change Stream status
   - Lists excluded collections if any
   - Displays batch size and reconnection settings

5. **Error Handling and Fallback**
   - Catches initialization errors
   - Logs detailed error information
   - Falls back to one-way sync (Local → Atlas)
   - Updates monitoring status appropriately

**Status Display Example:**

```
📊 Bidirectional Sync Status:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Status: ACTIVE
🔄 Direction: Local ⇄ Atlas (bidirectional)
🆔 Instance ID: hostname-pid-timestamp
⚙️  Conflict Resolution: last-write-wins
📡 Change Stream: Connected
🔄 Resume Token: Available
📦 Batch Size: 100
🔁 Max Reconnect Attempts: 10
🚫 Excluded Collections: sessions, logs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Requirements Validated

### Requirement 1.5
✅ THE Bomba System SHALL continue monitoring Atlas changes continuously while running
- Atlas Change Listener runs continuously once started
- Automatic reconnection on disconnection
- Resume token ensures no changes are missed

### Requirement 5.2
✅ WHEN bidirectional sync is disabled THEN the Bomba System SHALL continue one-way sync (Local→Atlas)
- Bidirectional sync only initializes if enabled in configuration
- Falls back to one-way sync on initialization errors
- One-way sync continues to work independently

### Requirement 5.3
✅ WHEN bidirectional sync is enabled THEN the Bomba System SHALL start Atlas Change Stream listener
- Atlas Change Listener starts automatically when enabled
- Verification ensures Atlas is available before starting
- Proper error handling if start fails

### Requirement 5.4
✅ THE Bomba System SHALL validate configuration on startup
- Comprehensive configuration validation
- Checks all required configuration fields
- Logs validation results
- Uses safe defaults on validation failure

### Requirement 7.5
✅ THE Bomba System SHALL persist resume tokens to survive application restarts
- Resume token loaded on startup
- Resume token saved after each change
- Stored in Local MongoDB for persistence
- Allows seamless recovery after restart

## Testing

### Integration Test

A comprehensive integration test is available at:
`server/scripts/testBidirectionalSyncIntegration.js`

**Test Coverage:**
1. Configuration verification
2. Origin Tracker initialization
3. Conflict Resolver initialization
4. Change Processor initialization
5. Atlas Change Listener initialization
6. Atlas availability check
7. Resume token check
8. Bidirectional Sync Monitor
9. Graceful shutdown simulation

**Running the Test:**
```bash
node server/scripts/testBidirectionalSyncIntegration.js
```

### Manual Testing

To test the full bidirectional sync in a real environment:

1. Ensure Atlas connection is configured in `.env`:
   ```
   MONGODB_ATLAS_URI=mongodb+srv://...
   ```

2. Enable bidirectional sync in `.env`:
   ```
   BIDIRECTIONAL_SYNC_ENABLED=true
   ```

3. Start the server:
   ```bash
   npm run server:dev
   ```

4. Check the startup logs for bidirectional sync status

5. Make changes on Atlas from another device/instance

6. Verify changes appear on Local MongoDB

## Configuration

### Environment Variables

```env
# Bidirectional Sync
BIDIRECTIONAL_SYNC_ENABLED=true

# Change Stream batch size
ATLAS_CHANGE_STREAM_BATCH_SIZE=100

# Excluded collections for bidirectional sync (comma-separated)
BIDIRECTIONAL_EXCLUDED_COLLECTIONS=sessions,logs

# Conflict resolution strategy
CONFLICT_RESOLUTION_STRATEGY=last-write-wins

# Origin tracking cleanup interval (ms)
ORIGIN_TRACKING_CLEANUP_INTERVAL=60000

# Change Stream reconnection settings
CHANGE_STREAM_RECONNECT_INTERVAL=5000
CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS=10
```

## Error Handling

### Initialization Errors

If bidirectional sync fails to initialize:
1. Error is logged with full details
2. System falls back to one-way sync
3. Application continues to run normally
4. Change Stream status set to 'disconnected'

### Runtime Errors

If Change Stream disconnects during runtime:
1. Automatic reconnection with exponential backoff
2. Resume token used to continue from last position
3. Monitoring status updated to 'reconnecting'
4. Alerts logged if max reconnect attempts reached

## Monitoring

### Metrics Available

- **Local→Atlas Metrics**: Total operations, success rate, average sync time
- **Atlas→Local Metrics**: Total operations, success rate, average process time
- **Conflict Metrics**: Total conflicts, resolution statistics, conflicts by collection
- **Change Stream Status**: Connection status, reconnect attempts, uptime

### Health Checks

Bidirectional sync health can be checked via:
- Startup logs
- `bidirectionalSyncMonitor.checkBidirectionalHealth()`
- API endpoint (when implemented): `GET /api/sync/bidirectional/health`

## Next Steps

1. **Task 12**: Implement API endpoints for bidirectional sync
   - GET /api/sync/bidirectional/metrics
   - GET /api/sync/bidirectional/health
   - GET /api/sync/bidirectional/conflicts
   - POST /api/sync/bidirectional/toggle

2. **Task 13**: Checkpoint - Test basic bidirectional sync

3. **Task 14**: Implement excluded collections handling

4. **Task 15**: Implement data validation and safety

5. **Task 16**: Implement comprehensive error handling

## Files Modified

- `server/server.js` - Main server initialization file
  - Added bidirectional sync imports
  - Added component initialization
  - Added startup verification
  - Updated graceful shutdown

## Files Created

- `server/scripts/testBidirectionalSyncIntegration.js` - Integration test
- `server/docs/BIDIRECTIONAL_SYNC_SERVER_INTEGRATION.md` - This document

## Dependencies

All required components were implemented in previous tasks:
- OriginTracker (Task 2.1)
- ConflictResolver (Task 3.1)
- ChangeProcessor (Task 4.1)
- AtlasChangeListener (Task 5.1)
- BidirectionalSyncMonitor (Task 7.1)
- ResumeTokenStorage (Task 10.1)

## Conclusion

Task 11 has been successfully completed. The bidirectional sync system is now fully integrated into the server initialization process with comprehensive verification and error handling. The system can:

- Initialize all bidirectional sync components on startup
- Verify configuration and Atlas availability
- Load and use resume tokens for recovery
- Handle initialization errors gracefully
- Shut down cleanly with proper cleanup
- Fall back to one-way sync if needed

The implementation follows all requirements and provides a solid foundation for the remaining bidirectional sync tasks.
