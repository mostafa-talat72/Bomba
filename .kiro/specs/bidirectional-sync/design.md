# Design Document - Bidirectional Sync

## Overview

يضيف هذا التصميم المزامنة الثنائية الاتجاه إلى نظام Dual MongoDB الحالي. بدلاً من المزامنة أحادية الاتجاه (Local→Atlas)، سيدعم النظام الآن المزامنة في كلا الاتجاهين، مما يسمح بالعمل من أجهزة متعددة مع الحفاظ على تزامن البيانات.

## Architecture

### High-Level Architecture

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
│  localhost:27017 │           │                      │
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
│  (processes      │           │  (applies Atlas      │
│   Local changes) │           │   changes to Local)  │
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

**Local → Atlas (Existing)**
1. User performs operation on Local
2. Mongoose middleware intercepts change
3. Change is queued with origin metadata
4. Sync Worker processes queue
5. Change is applied to Atlas

**Atlas → Local (New)**
1. Another device performs operation on Atlas
2. Atlas Change Stream emits change event
3. Atlas Listener receives change
4. Change Processor validates and applies to Local
5. Origin metadata prevents re-sync to Atlas

## Components and Interfaces

### 1. Atlas Change Stream Listener (`server/services/sync/atlasChangeListener.js`)

Monitors Atlas for changes and processes them.

```javascript
class AtlasChangeListener {
  constructor() {
    this.changeStream = null;
    this.isRunning = false;
    this.resumeToken = null;
    this.instanceId = generateInstanceId();
  }

  async start();
  async stop();
  async handleChange(change);
  async reconnect();
  async saveResumeToken(token);
  async loadResumeToken();
}
```

**Responsibilities:**
- Connect to Atlas Change Stream
- Monitor insert, update, delete, replace operations
- Handle reconnection with resume tokens
- Filter out changes from same instance
- Pass changes to Change Processor

### 2. Change Processor (`server/services/sync/changeProcessor.js`)

Applies Atlas changes to Local database.

```javascript
class ChangeProcessor {
  constructor() {
    this.processingQueue = [];
    this.isProcessing = false;
  }

  async processChange(change);
  async applyInsert(change);
  async applyUpdate(change);
  async applyDelete(change);
  async applyReplace(change);
  validateChange(change);
  shouldApplyChange(change);
}
```

**Responsibilities:**
- Validate incoming changes
- Check if change should be applied (origin tracking)
- Apply changes to Local database
- Handle conflicts using Last Write Wins
- Bypass sync middleware when applying changes

### 3. Origin Tracker (`server/services/sync/originTracker.js`)

Tracks change origins to prevent sync loops.

```javascript
class OriginTracker {
  constructor() {
    this.instanceId = generateInstanceId();
    this.recentChanges = new Map(); // _id -> timestamp
    this.cleanupInterval = 60000; // 1 minute
  }

  markLocalChange(documentId);
  markAtlasChange(documentId);
  isLocalChange(documentId);
  isAtlasChange(documentId);
  shouldSkipSync(documentId, origin);
  cleanup();
}
```

**Responsibilities:**
- Generate unique instance ID
- Track recent changes by origin
- Determine if change should be synced
- Clean up old tracking data

### 4. Conflict Resolver (`server/services/sync/conflictResolver.js`)

Resolves conflicts using Last Write Wins strategy.

```javascript
class ConflictResolver {
  constructor() {
    this.strategy = 'last-write-wins';
    this.conflictLog = [];
  }

  resolveConflict(localDoc, atlasChange);
  compareTimestamps(localDoc, atlasChange);
  logConflict(conflict);
  getConflictStats();
}
```

**Responsibilities:**
- Compare document timestamps
- Apply Last Write Wins strategy
- Log conflicts for monitoring
- Provide conflict statistics

### 5. Bidirectional Sync Monitor (`server/services/sync/bidirectionalSyncMonitor.js`)

Extends existing sync monitor for bidirectional metrics.

```javascript
class BidirectionalSyncMonitor extends SyncMonitor {
  constructor() {
    super();
    this.atlasToLocalMetrics = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      conflicts: 0,
      avgProcessTime: 0
    };
  }

  recordAtlasToLocal(operation, success, duration);
  recordConflict(conflict);
  getDirectionalMetrics();
  checkBidirectionalHealth();
}
```

### 6. Enhanced Sync Middleware

Update existing middleware to add origin tracking.

```javascript
function createSyncMiddleware(queueManager, config) {
  return {
    postSave: function(doc, next) {
      // Add origin metadata
      const operation = {
        ...existingFields,
        origin: 'local',
        instanceId: originTracker.instanceId,
        timestamp: new Date()
      };
      
      // Mark as local change
      originTracker.markLocalChange(doc._id);
      
      queueManager.enqueue(operation);
      next();
    }
    // ... other hooks
  };
}
```

## Data Models

### Sync Metadata Schema

Add metadata to track sync information:

```javascript
{
  _syncMeta: {
    origin: 'local' | 'atlas',
    instanceId: 'uuid',
    lastModified: Date,
    version: Number,
    conflictCount: Number
  }
}
```

### Resume Token Storage

```json
{
  "_id": "atlas-change-stream-token",
  "token": { ... },
  "timestamp": "2025-11-30T10:00:00Z",
  "instanceId": "uuid"
}
```

### Change Event Structure

Atlas Change Stream event:

```javascript
{
  _id: { _data: 'resume_token' },
  operationType: 'insert' | 'update' | 'delete' | 'replace',
  fullDocument: { ... },
  ns: {
    db: 'bomba',
    coll: 'bills'
  },
  documentKey: { _id: ObjectId },
  updateDescription: {
    updatedFields: { ... },
    removedFields: []
  },
  clusterTime: Timestamp
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Acceptence Criteria Testing Prework

1.1 WHEN a document is created on Atlas THEN the Bomba System SHALL replicate it to Local MongoDB and execute model business logic
Thoughts: This is about ensuring that any document created on Atlas appears on Local with proper business logic execution (pre-save hooks, validation, calculated fields). We can test this by creating random documents on Atlas and verifying they appear on Local with correct computed values.
Testable: yes - property

1.2 WHEN a document is updated on Atlas THEN the Bomba System SHALL replicate the update to Local MongoDB and execute model business logic
Thoughts: This is about ensuring updates propagate from Atlas to Local with business logic execution. We can test by updating random documents on Atlas and verifying the updates appear on Local with recalculated fields.
Testable: yes - property

1.3 WHEN a document is deleted on Atlas THEN the Bomba System SHALL replicate the deletion to Local MongoDB
Thoughts: This is about ensuring deletions propagate from Atlas to Local. We can test by deleting random documents on Atlas and verifying they're deleted on Local.
Testable: yes - property

1.6 WHEN applying Atlas changes THEN the Bomba System SHALL execute Mongoose pre-save hooks and model validation to maintain data consistency
Thoughts: This ensures that replicated data maintains the same business logic and constraints as locally created data. We can test by verifying that calculated fields (like Bill status) are computed correctly after replication.
Testable: yes - property

2.1 WHEN a change originates from Local THEN the Bomba System SHALL mark it to prevent re-syncing from Atlas
Thoughts: This is about preventing sync loops. We can test by creating a document locally and verifying it doesn't trigger a sync back from Atlas.
Testable: yes - property

2.3 WHEN applying a synced change THEN the Bomba System SHALL bypass the sync middleware
Thoughts: This is about ensuring changes from Atlas don't trigger another sync. We can test by applying an Atlas change and verifying no sync operation is queued.
Testable: yes - property

3.1 WHEN the same document is modified on both databases simultaneously THEN the Bomba System SHALL apply Last Write Wins strategy
Thoughts: This is about conflict resolution. We can test by modifying the same document on both databases with different timestamps and verifying the latest wins.
Testable: yes - property

4.1 WHEN sync operations occur THEN the Bomba System SHALL track metrics for both directions
Thoughts: This is about metrics tracking. We can test by performing operations and verifying metrics are recorded for both Local→Atlas and Atlas→Local.
Testable: yes - property

7.2 WHEN reconnecting to Atlas Change Stream THEN the Bomba System SHALL resume from last processed change
Thoughts: This is about resume token functionality. We can test by disconnecting, making changes, reconnecting, and verifying all changes are processed.
Testable: yes - property

### Property Reflection

After reviewing all testable properties:
- Properties 1.1, 1.2, 1.3 all test Atlas→Local replication and can be combined into one comprehensive property
- Properties 2.1 and 2.3 both test loop prevention and can be combined
- Property 3.1 stands alone for conflict resolution
- Property 4.1 stands alone for metrics
- Property 7.2 stands alone for resume functionality

### Correctness Properties

Property 1: Atlas to Local replication with business logic
*For any* operation (insert, update, delete) performed on Atlas, the same operation should be replicated to Local MongoDB with proper execution of Mongoose pre-save hooks, validation, and calculated fields
**Validates: Requirements 1.1, 1.2, 1.3, 1.6**

Property 2: Sync loop prevention
*For any* change originating from Local, when it syncs to Atlas, it should not trigger a sync back to Local
**Validates: Requirements 2.1, 2.3**

Property 3: Last Write Wins conflict resolution
*For any* document modified simultaneously on both databases, the version with the latest timestamp should be preserved on both databases after sync completes
**Validates: Requirements 3.1, 3.3**

Property 4: Bidirectional metrics tracking
*For any* sync operation in either direction, the system should accurately record it in the appropriate directional metrics (Local→Atlas or Atlas→Local)
**Validates: Requirements 4.1**

Property 5: Change Stream resume capability
*For any* Change Stream disconnection, when reconnecting, all changes that occurred during disconnection should be processed using the resume token
**Validates: Requirements 7.2**

Property 6: Origin tracking accuracy
*For any* change, the system should correctly identify its origin (Local or Atlas) and include the instance ID in metadata
**Validates: Requirements 10.1, 10.2, 10.3**

Property 7: Excluded collections bypass
*For any* collection in the exclusion list, changes from Atlas should not be synced to Local, but Local→Atlas sync should continue
**Validates: Requirements 8.2, 8.3**

Property 8: Idempotent Atlas change application
*For any* Atlas change applied multiple times (due to retries or duplicate events), the final state should be identical to applying it once
**Validates: Requirements 9.2**

## Error Handling

### Change Stream Errors

**Connection Lost:**
- Log disconnection with details
- Attempt reconnection with exponential backoff
- Use resume token to continue from last position
- If resume token invalid, trigger full sync

**Invalid Change Event:**
- Log error with event details
- Skip invalid event
- Continue processing other events
- Record in error metrics

### Conflict Resolution Errors

**Timestamp Missing:**
- Use current time as fallback
- Log warning about missing timestamp
- Apply change with caution flag

**Conflict Resolution Failure:**
- Log detailed conflict information
- Apply Atlas version (Atlas as source of truth)
- Record conflict in metrics

### Origin Tracking Errors

**Instance ID Collision:**
- Generate new instance ID
- Log warning
- Continue with new ID

**Metadata Corruption:**
- Treat as new change
- Apply with current metadata
- Log warning

## Testing Strategy

### Unit Testing

Using Jest framework:

1. **Atlas Change Listener Tests**
   - Test Change Stream connection
   - Test change event handling
   - Test reconnection logic
   - Test resume token persistence

2. **Change Processor Tests**
   - Test insert application
   - Test update application
   - Test delete application
   - Test validation logic

3. **Origin Tracker Tests**
   - Test change marking
   - Test origin detection
   - Test cleanup logic

4. **Conflict Resolver Tests**
   - Test Last Write Wins logic
   - Test timestamp comparison
   - Test conflict logging

### Property-Based Testing

Using fast-check library with Jest:

Each property test will run minimum 100 iterations and be tagged with:
`**Feature: bidirectional-sync, Property {number}: {property_text}**`

1. **Property 1 Test**: Create random documents on Atlas, verify they appear on Local
2. **Property 2 Test**: Create documents locally, verify they don't sync back from Atlas
3. **Property 3 Test**: Modify same document on both databases, verify latest wins
4. **Property 4 Test**: Perform operations, verify metrics track both directions
5. **Property 5 Test**: Disconnect/reconnect Change Stream, verify resume works
6. **Property 6 Test**: Create changes, verify origin metadata is correct
7. **Property 7 Test**: Exclude collections, verify they don't sync from Atlas
8. **Property 8 Test**: Apply same Atlas change multiple times, verify idempotency

### Integration Testing

1. **End-to-End Bidirectional Flow**
   - Create document on Device A (Local)
   - Verify it appears on Atlas
   - Verify it appears on Device B (Local)
   - Update on Device B
   - Verify update on Device A

2. **Conflict Scenario**
   - Disconnect both devices
   - Modify same document on both
   - Reconnect both
   - Verify Last Write Wins applied

3. **Resume Token Recovery**
   - Start Change Stream
   - Process some changes
   - Stop application
   - Make changes on Atlas
   - Restart application
   - Verify all changes processed

## Implementation Notes

### Change Stream Configuration

```javascript
const changeStreamOptions = {
  fullDocument: 'updateLookup',
  resumeAfter: resumeToken,
  batchSize: 100
};

const changeStream = collection.watch([], changeStreamOptions);
```

### Bypassing Sync Middleware

When applying Atlas changes, bypass middleware:

```javascript
// Disable sync middleware temporarily
const originalSyncEnabled = syncConfig.enabled;
syncConfig.enabled = false;

try {
  await Model.updateOne(filter, update);
} finally {
  syncConfig.enabled = originalSyncEnabled;
}
```

### Instance ID Generation

```javascript
const instanceId = `${os.hostname()}-${process.pid}-${Date.now()}`;
```

### Resume Token Persistence

Store in Local MongoDB:

```javascript
await db.collection('_sync_metadata').updateOne(
  { _id: 'atlas-resume-token' },
  { $set: { token: resumeToken, timestamp: new Date() } },
  { upsert: true }
);
```

## Configuration

### New Environment Variables

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

## Security Considerations

- Change Stream requires Atlas M10+ cluster
- Ensure proper authentication for Change Stream
- Validate all incoming changes before applying
- Sanitize change data to prevent injection
- Rate limit Change Stream processing

## Performance Considerations

- Change Stream uses minimal bandwidth (only changes)
- Batch processing for multiple changes
- Async processing doesn't block Local operations
- Connection pooling for Change Stream
- Resume tokens prevent re-processing

## Migration Strategy

### Phase 1: Setup (No Impact)
1. Add new components (Atlas Listener, Change Processor, etc.)
2. Add configuration variables
3. Keep bidirectional sync disabled
4. Test in development

### Phase 2: Testing (Isolated)
1. Enable bidirectional sync in development
2. Test with multiple instances
3. Verify conflict resolution
4. Monitor performance

### Phase 3: Production Rollout (Gradual)
1. Deploy with bidirectional sync disabled
2. Enable for non-critical collections first
3. Monitor for sync loops and conflicts
4. Gradually enable for all collections
5. Monitor metrics and performance

### Rollback Plan

If issues occur:
1. Set `BIDIRECTIONAL_SYNC_ENABLED=false`
2. Restart application
3. System reverts to one-way sync (Local→Atlas)
4. No data loss (Atlas remains source of truth)

## Dependencies

### New Dependencies

```json
{
  "uuid": "^9.0.0"  // For instance ID generation (already installed)
}
```

### MongoDB Requirements

- MongoDB Atlas M10+ cluster (for Change Streams)
- MongoDB 4.0+ (for Change Stream support)
- Replica set configuration (required for Change Streams)

## Limitations

1. **Change Stream Availability**: Requires Atlas M10+ or replica set
2. **Latency**: Changes may take 1-5 seconds to propagate
3. **Conflict Resolution**: Only Last Write Wins supported initially
4. **Network Dependency**: Requires stable internet connection
5. **Storage**: Resume tokens and metadata add minimal storage overhead

## Future Enhancements

1. **Custom Conflict Resolution**: Allow user-defined strategies
2. **Selective Field Sync**: Sync only specific fields
3. **Change Batching**: Batch multiple changes for efficiency
4. **Compression**: Compress change data for bandwidth savings
5. **Multi-Region Support**: Handle geo-distributed deployments
