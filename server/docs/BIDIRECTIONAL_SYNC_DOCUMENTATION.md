# Bidirectional Sync Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Configuration](#configuration)
5. [Conflict Resolution](#conflict-resolution)
6. [Troubleshooting](#troubleshooting)
7. [Examples and Use Cases](#examples-and-use-cases)
8. [API Reference](#api-reference)

---

## Overview

### What is Bidirectional Sync?

Bidirectional Sync enables automatic data synchronization between Local MongoDB and MongoDB Atlas in both directions. This allows multiple devices to work with the same data while maintaining consistency across all instances.

**Key Benefits:**
- **Multi-device Support**: Work from multiple locations with automatic sync
- **Real-time Updates**: Changes appear on all devices within seconds
- **Conflict Resolution**: Automatic handling of simultaneous modifications
- **Resilience**: Resume capability after network interruptions
- **Business Logic Preservation**: All Mongoose hooks and validations execute on replicated data

### How It Works

```
Device A (Local) ──────► MongoDB Atlas ──────► Device B (Local)
       ▲                                              │
       │                                              │
       └──────────────────────────────────────────────┘
                    Bidirectional Sync
```

1. **Local → Atlas**: Changes made locally are queued and synced to Atlas
2. **Atlas → Local**: Changes from other devices are detected via Change Streams and applied locally
3. **Loop Prevention**: Origin tracking ensures changes don't sync back to their source
4. **Conflict Resolution**: Last Write Wins strategy resolves simultaneous modifications

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Bomba Application                        │
│                  (Multiple Instances)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Mongoose Models                             │
│            (with origin tracking)                           │
└────────┬────────────────────────────────┬───────────────────┘
         │                                │
         ▼                                ▼
┌──────────────────┐           ┌──────────────────────┐
│  Local MongoDB   │◄─────────►│   MongoDB Atlas      │
│  (Primary DB)    │           │   (Shared DB)        │
└────────┬─────────┘           └──────────┬───────────┘
         │                                │
         │ Local Changes                  │ Atlas Changes
         │ (via middleware)               │ (via Change Stream)
         │                                │
         ▼                                ▼
┌──────────────────┐           ┌──────────────────────┐
│  Sync Queue      │           │  Atlas Listener      │
│  (Local→Atlas)   │           │  (Atlas→Local)       │
└────────┬─────────┘           └──────────┬───────────┘
         │                                │
         ▼                                ▼
┌──────────────────┐           ┌──────────────────────┐
│  Sync Worker     │           │  Change Processor    │
└──────────────────┘           └──────────────────────┘
         │                                │
         └────────────┬───────────────────┘
                      ▼
         ┌──────────────────────┐
         │  Conflict Resolver   │
         │  (Last Write Wins)   │
         └──────────────────────┘
```

### Data Flow

#### Local → Atlas (Existing One-Way Sync)

1. User performs operation (create, update, delete) on Local MongoDB
2. Mongoose middleware intercepts the change
3. Change is queued with origin metadata (instanceId, timestamp)
4. Sync Worker processes the queue
5. Change is applied to MongoDB Atlas
6. Origin metadata prevents re-sync from Atlas

#### Atlas → Local (New Bidirectional Sync)

1. Another device performs operation on MongoDB Atlas
2. Atlas Change Stream emits change event
3. Atlas Listener receives and validates the change
4. Change Processor checks origin (skip if from same instance)
5. Change is applied to Local MongoDB with business logic execution
6. Origin metadata prevents re-sync to Atlas

---

## Components

### 1. Atlas Change Listener

**Location**: `server/services/sync/atlasChangeListener.js`

**Purpose**: Monitors MongoDB Atlas for changes using Change Streams and forwards them for processing.

**Key Features**:
- Real-time change detection
- Resume token management for reliability
- Automatic reconnection with exponential backoff
- Collection filtering (excluded collections)
- Instance-based change filtering

**Methods**:
```javascript
start()              // Start monitoring Atlas
stop()               // Stop monitoring
handleChange(change) // Process incoming change
reconnect()          // Reconnect after disconnection
```

### 2. Change Processor

**Location**: `server/services/sync/changeProcessor.js`

**Purpose**: Applies Atlas changes to Local MongoDB while maintaining data integrity.

**Key Features**:
- Change validation
- Origin checking (prevent loops)
- Business logic execution (Mongoose hooks)
- Conflict resolution integration
- Idempotent operations

**Methods**:
```javascript
processChange(change)  // Main processing entry point
applyInsert(change)    // Handle document creation
applyUpdate(change)    // Handle document updates
applyDelete(change)    // Handle document deletion
applyReplace(change)   // Handle document replacement
```

### 3. Origin Tracker

**Location**: `server/services/sync/originTracker.js`

**Purpose**: Tracks change origins to prevent infinite sync loops.

**Key Features**:
- Unique instance ID generation
- Change origin marking (local vs atlas)
- Recent change tracking
- Automatic cleanup of old data

**Methods**:
```javascript
markLocalChange(docId)     // Mark change as local
markAtlasChange(docId)     // Mark change as from Atlas
isLocalChange(docId)       // Check if change is local
shouldSkipSync(docId)      // Determine if sync should be skipped
```

### 4. Conflict Resolver

**Location**: `server/services/sync/conflictResolver.js`

**Purpose**: Resolves conflicts when the same document is modified on multiple devices.

**Strategy**: Last Write Wins (LWW)
- Compares timestamps of conflicting versions
- Preserves the version with the latest timestamp
- Logs all conflicts for monitoring

**Methods**:
```javascript
resolveConflict(localDoc, atlasChange) // Resolve conflict
compareTimestamps(local, atlas)        // Compare versions
logConflict(conflict)                  // Record conflict
getConflictStats()                     // Get conflict metrics
```

### 5. Bidirectional Sync Monitor

**Location**: `server/services/sync/bidirectionalSyncMonitor.js`

**Purpose**: Tracks metrics and health for both sync directions.

**Metrics Tracked**:
- Total operations processed (both directions)
- Success/failure rates
- Conflict count
- Average processing time
- Sync lag

**Methods**:
```javascript
recordAtlasToLocal(op, success, duration) // Record Atlas→Local metric
recordConflict(conflict)                  // Record conflict
getDirectionalMetrics()                   // Get metrics by direction
checkBidirectionalHealth()                // Health check
```

### 6. Resume Token Storage

**Location**: `server/services/sync/resumeTokenStorage.js`

**Purpose**: Persists Change Stream position to survive restarts.

**Features**:
- Token persistence in Local MongoDB
- Automatic token validation
- Expired token handling
- Instance-specific tokens

---

## Configuration

### Environment Variables

Add these to your `server/.env` file:

```env
# Enable/Disable Bidirectional Sync
BIDIRECTIONAL_SYNC_ENABLED=true

# Change Stream Configuration
ATLAS_CHANGE_STREAM_BATCH_SIZE=100

# Excluded Collections (comma-separated)
# These collections will only sync Local→Atlas, not Atlas→Local
BIDIRECTIONAL_EXCLUDED_COLLECTIONS=sessions,logs,notifications

# Conflict Resolution Strategy
CONFLICT_RESOLUTION_STRATEGY=last-write-wins

# Origin Tracking
ORIGIN_TRACKING_CLEANUP_INTERVAL=60000

# Reconnection Settings
CHANGE_STREAM_RECONNECT_INTERVAL=5000
CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS=10
```

### Configuration File

**Location**: `server/config/syncConfig.js`

```javascript
const syncConfig = {
  bidirectional: {
    enabled: process.env.BIDIRECTIONAL_SYNC_ENABLED === 'true',
    changeStream: {
      batchSize: parseInt(process.env.ATLAS_CHANGE_STREAM_BATCH_SIZE) || 100,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10
    },
    excludedCollections: [
      'sessions',
      'logs',
      'notifications',
      '_sync_metadata'
    ],
    conflictResolution: {
      strategy: 'last-write-wins'
    }
  }
};
```

### Excluded Collections

Some collections should only sync in one direction (Local→Atlas):

**Default Excluded Collections**:
- `sessions` - Session-specific data
- `logs` - Application logs
- `notifications` - Device-specific notifications
- `_sync_metadata` - Sync system metadata

**Why Exclude Collections?**
- Prevent unnecessary bidirectional sync for device-specific data
- Reduce sync overhead
- Maintain device-specific state

---

## Conflict Resolution

### Last Write Wins (LWW) Strategy

When the same document is modified on multiple devices simultaneously, the system uses timestamps to determine which version to keep.

**How It Works**:

1. **Conflict Detection**: System detects when a document exists locally and an update arrives from Atlas
2. **Timestamp Comparison**: Compare `updatedAt` timestamps
3. **Winner Selection**: Keep the version with the latest timestamp
4. **Conflict Logging**: Record the conflict for monitoring

**Example**:

```javascript
// Device A modifies document at 10:00:00
{
  _id: "123",
  name: "Product A",
  price: 100,
  updatedAt: "2025-11-30T10:00:00Z"
}

// Device B modifies same document at 10:00:05
{
  _id: "123",
  name: "Product A",
  price: 150,
  updatedAt: "2025-11-30T10:00:05Z"
}

// Result: Device B's version wins (latest timestamp)
// Both devices will have price: 150
```

### Conflict Metrics

Monitor conflicts via API:

```bash
GET /api/sync/bidirectional/conflicts
```

Response:
```json
{
  "totalConflicts": 5,
  "recentConflicts": [
    {
      "collection": "menuitems",
      "documentId": "123",
      "localTimestamp": "2025-11-30T10:00:00Z",
      "atlasTimestamp": "2025-11-30T10:00:05Z",
      "winner": "atlas",
      "resolvedAt": "2025-11-30T10:00:06Z"
    }
  ]
}
```

---

## Troubleshooting

### Common Issues

#### 1. Sync Loop Detected

**Symptoms**: Logs show repeated sync operations for the same document

**Causes**:
- Origin tracking not working
- Instance ID collision
- Metadata corruption

**Solutions**:
```bash
# Check origin tracking
node server/scripts/verifyOriginTracking.js

# Restart application to generate new instance ID
pm2 restart bomba

# Check logs for origin metadata
tail -f server/logs/app.log | grep "origin"
```

#### 2. Change Stream Connection Failed

**Symptoms**: Error "Change Stream connection failed" in logs

**Causes**:
- Atlas cluster not M10+ tier
- Network connectivity issues
- Invalid credentials
- Replica set not configured

**Solutions**:
```bash
# Verify Atlas connection
node server/scripts/testAtlasConnection.js

# Check Atlas tier (must be M10+)
# Verify in MongoDB Atlas dashboard

# Test Change Stream support
node server/scripts/testAtlasListenerIntegration.js
```

#### 3. Changes Not Syncing from Atlas

**Symptoms**: Changes made on other devices don't appear locally

**Causes**:
- Bidirectional sync disabled
- Collection in exclusion list
- Change Stream not running
- Resume token expired

**Solutions**:
```bash
# Check bidirectional sync status
curl http://localhost:5000/api/sync/bidirectional/health

# Verify configuration
cat server/.env | grep BIDIRECTIONAL

# Check Change Stream status
node server/scripts/testAtlasListenerIntegration.js

# Clear resume token (forces full resync)
# Delete from _sync_metadata collection
```

#### 4. High Conflict Rate

**Symptoms**: Many conflicts in metrics

**Causes**:
- Multiple users editing same documents
- Clock synchronization issues
- Network latency

**Solutions**:
```bash
# Check conflict metrics
curl http://localhost:5000/api/sync/bidirectional/conflicts

# Verify system clocks are synchronized (NTP)
# Consider implementing optimistic locking
# Review user workflows to reduce simultaneous edits
```

#### 5. Sync Lag Increasing

**Symptoms**: Changes take longer to appear on other devices

**Causes**:
- High change volume
- Network bandwidth issues
- Processing bottleneck
- Atlas throttling

**Solutions**:
```bash
# Check sync metrics
curl http://localhost:5000/api/sync/bidirectional/metrics

# Monitor processing time
# Increase batch size if needed
# Check network bandwidth
# Verify Atlas cluster performance
```

### Diagnostic Commands

```bash
# Test bidirectional sync integration
node server/scripts/testBidirectionalSyncIntegration.js

# Test Atlas listener
node server/scripts/testAtlasListenerIntegration.js

# Verify origin tracking
node server/scripts/verifyOriginTracking.js

# Test excluded collections
node server/scripts/testExcludedCollections.js

# Test data validation
node server/scripts/testDataValidation.js

# Check resume token storage
node server/scripts/testResumeTokenStorageSimple.js
```

### Log Analysis

**Important Log Patterns**:

```bash
# Successful Atlas→Local sync
grep "Atlas change applied successfully" server/logs/app.log

# Conflicts detected
grep "Conflict detected" server/logs/app.log

# Sync loops prevented
grep "Skipping sync - same instance" server/logs/app.log

# Change Stream reconnections
grep "Change Stream reconnecting" server/logs/app.log

# Errors
grep "ERROR" server/logs/error.log
```

---

## Examples and Use Cases

### Use Case 1: Multi-Location Restaurant Chain

**Scenario**: Restaurant chain with multiple locations, each with local POS system

**Setup**:
- Each location has Local MongoDB for fast operations
- All locations share MongoDB Atlas for centralized data
- Menu updates from HQ propagate to all locations
- Sales data from all locations aggregates in Atlas

**Configuration**:
```env
BIDIRECTIONAL_SYNC_ENABLED=true
BIDIRECTIONAL_EXCLUDED_COLLECTIONS=sessions,logs,notifications
```

**Benefits**:
- Fast local operations (no network latency)
- Centralized menu management
- Real-time inventory visibility across locations
- Automatic data backup in Atlas

### Use Case 2: Mobile and Desktop Applications

**Scenario**: Users work on both desktop (office) and mobile (on-site)

**Setup**:
- Desktop app uses Local MongoDB
- Mobile app connects directly to Atlas
- Changes sync automatically between devices
- Work continues seamlessly across devices

**Configuration**:
```env
BIDIRECTIONAL_SYNC_ENABLED=true
CONFLICT_RESOLUTION_STRATEGY=last-write-wins
```

**Benefits**:
- Work from anywhere
- No manual data transfer
- Automatic conflict resolution
- Real-time updates

### Use Case 3: Development and Testing

**Scenario**: Multiple developers working on same codebase

**Setup**:
- Each developer has local instance
- Shared Atlas database for integration testing
- Test data syncs across environments
- Conflicts resolved automatically

**Configuration**:
```env
BIDIRECTIONAL_SYNC_ENABLED=true
BIDIRECTIONAL_EXCLUDED_COLLECTIONS=logs,sessions
```

**Benefits**:
- Consistent test data
- Easy collaboration
- Reduced setup time
- Realistic testing scenarios

### Example: Creating a Menu Item

**Device A (Local)**:
```javascript
// Create menu item locally
const menuItem = await MenuItem.create({
  name: 'Cappuccino',
  price: 25,
  category: 'beverages'
});

// Automatically synced to Atlas within seconds
// Origin metadata added: { origin: 'local', instanceId: 'device-a-123' }
```

**Device B (Receives Update)**:
```javascript
// Atlas Change Stream detects new document
// Change Processor validates and applies to Local
// Mongoose hooks execute (validation, defaults, etc.)
// Document appears in local database

const items = await MenuItem.find({ category: 'beverages' });
// Cappuccino now appears in results
```

### Example: Handling Conflicts

**Scenario**: Two devices update same menu item simultaneously

**Device A** (10:00:00):
```javascript
await MenuItem.findByIdAndUpdate('123', { price: 25 });
```

**Device B** (10:00:05):
```javascript
await MenuItem.findByIdAndUpdate('123', { price: 30 });
```

**Resolution**:
```javascript
// Device B's change wins (latest timestamp)
// Both devices end up with price: 30
// Conflict logged in metrics

// Check conflict
const conflicts = await fetch('/api/sync/bidirectional/conflicts');
// Shows conflict was detected and resolved
```

---

## API Reference

### Health Check

**Endpoint**: `GET /api/sync/bidirectional/health`

**Description**: Check bidirectional sync health status

**Response**:
```json
{
  "enabled": true,
  "atlasListener": {
    "running": true,
    "connected": true,
    "lastChange": "2025-11-30T10:00:00Z"
  },
  "syncWorker": {
    "running": true,
    "queueSize": 5
  },
  "health": "healthy"
}
```

### Metrics

**Endpoint**: `GET /api/sync/bidirectional/metrics`

**Description**: Get sync metrics for both directions

**Response**:
```json
{
  "localToAtlas": {
    "totalProcessed": 1000,
    "successful": 995,
    "failed": 5,
    "avgProcessTime": 150
  },
  "atlasToLocal": {
    "totalProcessed": 800,
    "successful": 798,
    "failed": 2,
    "avgProcessTime": 200
  },
  "conflicts": {
    "total": 10,
    "resolved": 10
  }
}
```

### Conflicts

**Endpoint**: `GET /api/sync/bidirectional/conflicts`

**Description**: Get conflict history and statistics

**Response**:
```json
{
  "totalConflicts": 10,
  "recentConflicts": [
    {
      "collection": "menuitems",
      "documentId": "123",
      "localTimestamp": "2025-11-30T10:00:00Z",
      "atlasTimestamp": "2025-11-30T10:00:05Z",
      "winner": "atlas",
      "resolvedAt": "2025-11-30T10:00:06Z"
    }
  ]
}
```

### Toggle Sync

**Endpoint**: `POST /api/sync/bidirectional/toggle`

**Description**: Enable or disable bidirectional sync

**Request**:
```json
{
  "enabled": true
}
```

**Response**:
```json
{
  "success": true,
  "enabled": true,
  "message": "Bidirectional sync enabled"
}
```

---

## Performance Considerations

### Bandwidth Usage

- Change Streams only transmit actual changes (not full documents)
- Typical change size: 1-5 KB
- Batch processing reduces overhead
- Resume tokens are small (<1 KB)

### Latency

- Local operations: <10ms (no network)
- Atlas sync: 1-5 seconds (depends on network)
- Conflict resolution: <100ms additional

### Storage Overhead

- Origin metadata: ~100 bytes per document
- Resume tokens: ~1 KB total
- Conflict logs: ~500 bytes per conflict
- Total overhead: <1% of database size

### Scalability

- Supports 100+ concurrent devices
- Handles 1000+ changes per minute
- Batch processing prevents bottlenecks
- Connection pooling optimizes resources

---

## Security Considerations

### Authentication

- Change Streams require Atlas authentication
- Use dedicated sync user with minimal permissions
- Rotate credentials regularly
- Store credentials in environment variables

### Data Validation

- All incoming changes are validated
- Schema validation enforced
- Business rules applied via Mongoose hooks
- Invalid changes are rejected and logged

### Network Security

- Use TLS/SSL for Atlas connections
- Implement rate limiting on sync endpoints
- Monitor for unusual sync patterns
- Log all sync operations for audit

---

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Sync Lag**: Time between change and replication
2. **Conflict Rate**: Number of conflicts per hour
3. **Error Rate**: Failed sync operations
4. **Queue Size**: Pending operations
5. **Connection Status**: Change Stream health

### Recommended Alerts

```javascript
// Alert if sync lag > 30 seconds
if (syncLag > 30000) {
  alert('High sync lag detected');
}

// Alert if conflict rate > 10 per hour
if (conflictRate > 10) {
  alert('High conflict rate');
}

// Alert if Change Stream disconnected > 5 minutes
if (disconnectedTime > 300000) {
  alert('Change Stream disconnected');
}
```

### Health Check Script

```bash
#!/bin/bash
# Add to cron for periodic health checks

HEALTH=$(curl -s http://localhost:5000/api/sync/bidirectional/health)
STATUS=$(echo $HEALTH | jq -r '.health')

if [ "$STATUS" != "healthy" ]; then
  echo "Bidirectional sync unhealthy: $HEALTH"
  # Send alert (email, Slack, etc.)
fi
```

---

## Best Practices

### 1. Configuration

- Start with bidirectional sync disabled in production
- Test thoroughly in development first
- Use excluded collections for device-specific data
- Monitor metrics during initial rollout

### 2. Conflict Prevention

- Implement optimistic locking for critical documents
- Use field-level updates instead of full document replacement
- Synchronize system clocks (NTP)
- Design workflows to minimize simultaneous edits

### 3. Error Handling

- Implement retry logic with exponential backoff
- Log all errors for analysis
- Set up alerts for critical failures
- Have rollback plan ready

### 4. Testing

- Test with multiple devices before production
- Simulate network interruptions
- Test conflict scenarios
- Verify resume token functionality

### 5. Monitoring

- Monitor sync lag continuously
- Track conflict rates
- Watch for sync loops
- Monitor Change Stream connection status

---

## Limitations

1. **Atlas Tier**: Requires M10+ cluster for Change Streams
2. **Latency**: Changes take 1-5 seconds to propagate
3. **Conflict Resolution**: Only Last Write Wins supported
4. **Network Dependency**: Requires stable internet connection
5. **MongoDB Version**: Requires MongoDB 4.0+ with replica set

---

## Support and Resources

### Documentation
- [MongoDB Change Streams](https://docs.mongodb.com/manual/changeStreams/)
- [Mongoose Middleware](https://mongoosejs.com/docs/middleware.html)
- [Bomba Sync Configuration](./SYNC_CONFIGURATION.md)

### Scripts
- `server/scripts/testBidirectionalSyncIntegration.js` - Integration test
- `server/scripts/testAtlasListenerIntegration.js` - Atlas listener test
- `server/scripts/verifyOriginTracking.js` - Origin tracking verification

### Logs
- `server/logs/app.log` - Application logs
- `server/logs/error.log` - Error logs

### Contact
For issues or questions, check the troubleshooting guide or review the logs.
