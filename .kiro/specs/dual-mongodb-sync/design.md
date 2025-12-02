# Design Document

## Overview

This design implements a dual MongoDB architecture where the Bomba system operates on a local MongoDB instance for optimal performance while automatically synchronizing all data changes to MongoDB Atlas as a cloud backup. The system uses Mongoose middleware hooks to intercept database operations and queue them for asynchronous synchronization to Atlas, ensuring local operations remain fast while maintaining cloud redundancy.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Bomba Application                        │
│  (Controllers, Services, Routes)                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Mongoose Models                             │
│  (with sync middleware hooks)                               │
└────────┬────────────────────────────────┬───────────────────┘
         │                                │
         ▼                                ▼
┌──────────────────┐           ┌──────────────────────┐
│  Local MongoDB   │           │   Sync Queue         │
│  (Primary DB)    │           │   (Background)       │
│  localhost:27017 │           └──────────┬───────────┘
└──────────────────┘                      │
         │                                │
         │ (immediate)                    │ (async)
         │                                ▼
         │                    ┌──────────────────────┐
         │                    │  Sync Worker         │
         │                    │  (processes queue)   │
         │                    └──────────┬───────────┘
         │                               │
         │                               ▼
         │                    ┌──────────────────────┐
         │                    │  MongoDB Atlas       │
         │                    │  (Backup DB)         │
         │                    └──────────────────────┘
         │
         └─────────────────────────────────────────────────────┐
                                                                │
                                                                ▼
                                                    ┌──────────────────────┐
                                                    │  Sync Monitor        │
                                                    │  (metrics & health)  │
                                                    └──────────────────────┘
```

### Connection Management

The system maintains two separate Mongoose connections:
1. **Primary Connection**: Local MongoDB for all application operations
2. **Backup Connection**: MongoDB Atlas for synchronization only

Both connections are established at startup, but Atlas connection failures do not prevent application startup.

## Components and Interfaces

### 1. Database Connection Manager (`server/config/dualDatabase.js`)

Manages both local and Atlas connections.

```javascript
class DualDatabaseManager {
  constructor() {
    this.localConnection = null;
    this.atlasConnection = null;
    this.isAtlasConnected = false;
  }

  async connectLocal(uri);
  async connectAtlas(uri);
  getLocalConnection();
  getAtlasConnection();
  isAtlasAvailable();
  async closeConnections();
}
```

**Responsibilities:**
- Establish and maintain both database connections
- Handle connection errors and reconnection logic
- Provide connection status information
- Graceful shutdown of both connections

### 2. Sync Queue Manager (`server/services/syncQueueManager.js`)

Manages the queue of synchronization operations with deduplication.

```javascript
class SyncQueueManager {
  constructor(maxSize = 10000) {
    this.queue = [];
    this.maxSize = maxSize;
    this.processing = false;
    this.persistencePath = './data/sync-queue.json';
    this.pendingOperations = new Map(); // Track pending ops by collection:_id
  }

  enqueue(operation);
  dequeue();
  size();
  isEmpty();
  isFull();
  detectDuplicate(operation);
  mergeDuplicateOperation(existing, newOp);
  async persistToDisk();
  async loadFromDisk();
  clear();
}
```

**Operation Structure:**
```javascript
{
  id: 'uuid',
  type: 'insert' | 'update' | 'delete',
  collection: 'bills',
  data: { ... },
  filter: { _id: '...' },
  documentId: '...', // Extracted _id for deduplication
  timestamp: Date,
  retryCount: 0,
  maxRetries: 5
}
```

**Deduplication Strategy:**

The queue manager maintains a `pendingOperations` Map with keys in the format `collection:documentId` to track operations currently in the queue. When a new operation is enqueued:

1. **Check for existing operation**: Look up `collection:documentId` in the map
2. **If no duplicate**: Add to queue and map
3. **If duplicate exists**:
   - **Insert + Insert**: Replace old with new (latest data wins)
   - **Insert + Update**: Replace with new insert (latest data wins)
   - **Update + Update**: Merge update data (combine all changes)
   - **Any + Delete**: Remove old operation, add delete (delete supersedes all)
   - **Delete + Any**: Keep delete, ignore new operation (already deleted)

This ensures:
- No duplicate key errors from multiple inserts
- Minimal sync operations (efficiency)
- Latest data always wins (consistency)
- Correct operation order (delete supersedes all)

### 3. Sync Worker (`server/services/syncWorker.js`)

Processes queued synchronization operations.

```javascript
class SyncWorker {
  constructor(queueManager, atlasConnection) {
    this.queueManager = queueManager;
    this.atlasConnection = atlasConnection;
    this.isRunning = false;
    this.processingInterval = 100; // ms
    this.retryDelays = [1000, 5000, 15000, 30000, 60000]; // exponential backoff
  }

  start();
  stop();
  async processQueue();
  async executeOperation(operation);
  async retryOperation(operation);
  calculateBackoff(retryCount);
}
```

**Responsibilities:**
- Continuously process sync queue in background
- Execute operations against Atlas connection
- Implement retry logic with exponential backoff
- Handle operation failures gracefully

### 4. Sync Middleware (`server/middleware/syncMiddleware.js`)

Mongoose middleware that intercepts database operations.

```javascript
function createSyncMiddleware(queueManager, config) {
  return {
    postSave: function(doc, next),
    postUpdate: function(result, next),
    postRemove: function(doc, next),
    postFindOneAndUpdate: function(doc, next),
    postFindOneAndDelete: function(doc, next)
  };
}
```

**Responsibilities:**
- Intercept Mongoose post-save, post-update, post-remove hooks
- Extract operation details and enqueue for sync
- Ensure middleware doesn't block primary operations
- Handle errors without affecting local operations

### 5. Sync Monitor (`server/services/syncMonitor.js`)

Monitors synchronization health and metrics.

```javascript
class SyncMonitor {
  constructor() {
    this.metrics = {
      totalOperations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      queueSize: 0,
      avgSyncTime: 0,
      lastSyncTimestamp: null
    };
  }

  recordSuccess(operation, duration);
  recordFailure(operation, error);
  updateQueueSize(size);
  getMetrics();
  checkHealth();
  async generateReport();
}
```

### 6. Full Sync Service (`server/services/fullSyncService.js`)

Handles manual full synchronization between databases.

```javascript
class FullSyncService {
  constructor(localConnection, atlasConnection) {
    this.localConnection = localConnection;
    this.atlasConnection = atlasConnection;
    this.isRunning = false;
  }

  async startFullSync(collections);
  async syncCollection(collectionName);
  async compareDocuments(localDocs, atlasDocs);
  async syncMissingDocuments(collectionName, docs);
  getProgress();
  cancel();
}
```

### 7. Sync Configuration (`server/config/syncConfig.js`)

Centralized configuration for sync behavior.

```javascript
const syncConfig = {
  enabled: process.env.SYNC_ENABLED === 'true',
  atlasUri: process.env.MONGODB_ATLAS_URI,
  localUri: process.env.MONGODB_LOCAL_URI || 'mongodb://localhost:27017/bomba',
  queueMaxSize: parseInt(process.env.SYNC_QUEUE_MAX_SIZE) || 10000,
  workerInterval: parseInt(process.env.SYNC_WORKER_INTERVAL) || 100,
  maxRetries: parseInt(process.env.SYNC_MAX_RETRIES) || 5,
  persistQueue: process.env.SYNC_PERSIST_QUEUE === 'true',
  excludedCollections: (process.env.SYNC_EXCLUDED_COLLECTIONS || '').split(','),
  batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 100
};
```

## Data Models

No new data models are required. The system works with existing Mongoose models by adding middleware hooks.

### Sync Queue Persistence Schema

When queue is persisted to disk:

```json
{
  "version": "1.0",
  "timestamp": "2025-11-30T10:00:00Z",
  "operations": [
    {
      "id": "uuid-1",
      "type": "insert",
      "collection": "bills",
      "data": { ... },
      "timestamp": "2025-11-30T09:59:58Z",
      "retryCount": 0
    }
  ]
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After reviewing all testable properties from the prework, several redundancies were identified:

- Properties 1.2, 1.3, and 1.5 all test that operations execute against local MongoDB - these can be combined into one comprehensive property
- Properties 2.1, 2.2, and 2.3 all test that operations are queued for sync - these can be combined into one property about operation replication
- Properties 3.4 and 3.5 both test resilience when Atlas is unavailable - these can be combined
- Properties 4.1 and 4.2 both test logging behavior - these can be combined into one property about sync logging
- Properties 6.1 and 6.5 both test backward compatibility - these can be combined

The consolidated properties below eliminate this redundancy while maintaining complete validation coverage.

### Correctness Properties

Property 1: Local database primary execution
*For any* database operation (read, write, update, delete), the operation should execute against the local MongoDB connection and complete successfully regardless of Atlas connection status
**Validates: Requirements 1.2, 1.3, 1.5, 3.4, 3.5**

Property 2: Operation replication to sync queue
*For any* write operation (insert, update, delete) on the local database, the operation details should be added to the sync queue for Atlas replication
**Validates: Requirements 2.1, 2.2, 2.3**

Property 3: Sync queue ordering preservation
*For any* sequence of write operations, the sync queue should maintain the same order as the operations were executed locally
**Validates: Requirements 2.4**

Property 4: Exponential backoff retry strategy
*For any* failed synchronization operation, retry attempts should occur with exponentially increasing delays (1s, 5s, 15s, 30s, 60s) up to the maximum retry limit
**Validates: Requirements 2.5, 8.5**

Property 5: Asynchronous sync execution
*For any* write operation on local MongoDB, the operation should return success immediately without waiting for Atlas synchronization to complete
**Validates: Requirements 3.1, 3.2**

Property 6: Sync operation logging
*For any* synchronization operation (successful or failed), the system should log the operation with timestamp and relevant details
**Validates: Requirements 4.1, 4.2**

Property 7: Metrics tracking accuracy
*For any* synchronization operation, the system metrics should accurately reflect queue size, success count, failure count, and average sync time
**Validates: Requirements 4.4**

Property 8: Full sync difference detection
*For any* collection during full sync, if documents exist in local but not in Atlas (or vice versa), those documents should be identified and synchronized
**Validates: Requirements 5.2**

Property 9: Concurrent full sync prevention
*For any* full sync operation in progress, attempting to start another full sync should be rejected until the first completes
**Validates: Requirements 5.5**

Property 10: Transparent sync middleware
*For any* existing database operation in controllers, the operation should trigger synchronization automatically without requiring code modifications
**Validates: Requirements 6.1, 6.5**

Property 11: Configuration-based sync control
*For any* configuration setting (excluded collections, queue size, retry limits), the sync behavior should respect the configured values
**Validates: Requirements 7.2, 7.4**

Property 12: Queue persistence and recovery
*For any* operations in the sync queue when Atlas is disconnected, the operations should remain queued and process successfully when Atlas reconnects
**Validates: Requirements 8.1, 8.2**

Property 13: Idempotent insert operations
*For any* document insert operation that is retried or executed multiple times, the system should use upsert semantics to update existing documents without throwing duplicate key errors
**Validates: Requirements 9.1, 9.2**

Property 14: Idempotent update operations
*For any* document update operation that is retried, the final state should be identical to a single execution of that operation
**Validates: Requirements 9.3**

Property 15: Idempotent delete operations
*For any* document delete operation that is retried, the operation should succeed even if the document was already deleted in a previous attempt
**Validates: Requirements 9.4**

Property 16: Duplicate operation detection
*For any* new operation queued for a document, if a pending operation already exists for the same document _id in the queue, the system should detect the duplicate
**Validates: Requirements 10.1**

Property 17: Duplicate operation merging
*For any* duplicate operations detected in the queue for the same document, the system should merge or replace them to ensure only one operation is executed with the latest data
**Validates: Requirements 10.2, 10.3, 10.4**

## Error Handling

### Connection Errors

**Local MongoDB Connection Failure:**
- **Impact**: Critical - application cannot start
- **Handling**: 
  - Log detailed error with troubleshooting steps
  - Exit application with error code
  - Provide clear instructions for starting local MongoDB

**Atlas Connection Failure:**
- **Impact**: Low - application continues normally
- **Handling**:
  - Log warning about Atlas unavailability
  - Continue application startup
  - Queue sync operations for later processing
  - Attempt reconnection with exponential backoff

### Sync Operation Errors

**Individual Operation Failure:**
- **Handling**:
  - Log error with operation details
  - Increment retry counter
  - Re-queue with exponential backoff
  - After max retries, move to dead letter queue
  - Alert monitoring system

**Queue Overflow:**
- **Handling**:
  - Log critical warning
  - Persist queue to disk
  - Alert monitoring system
  - Continue accepting new operations (oldest may be dropped if disk full)

**Disk Persistence Failure:**
- **Handling**:
  - Log critical error
  - Continue in-memory queue operation
  - Alert monitoring system
  - Attempt alternative persistence location

### Data Consistency Errors

**Document Conflict During Sync:**
- **Handling**:
  - Log conflict details
  - Use "local wins" strategy (local version overwrites Atlas)
  - Record conflict in metrics
  - Optionally notify administrator

**Schema Mismatch:**
- **Handling**:
  - Log schema difference
  - Attempt sync with available fields
  - Record mismatch in error log
  - Continue with other operations

## Testing Strategy

### Unit Testing

The system will use **Jest** as the testing framework for both unit and property-based tests.

**Unit Test Coverage:**

1. **Connection Management Tests**
   - Test successful local connection
   - Test successful Atlas connection
   - Test Atlas connection failure handling
   - Test graceful shutdown

2. **Queue Manager Tests**
   - Test enqueue/dequeue operations
   - Test queue size limits
   - Test persistence to disk
   - Test loading from disk

3. **Sync Worker Tests**
   - Test operation execution
   - Test retry logic
   - Test exponential backoff calculation
   - Test error handling

4. **Middleware Tests**
   - Test post-save hook
   - Test post-update hook
   - Test post-remove hook
   - Test error handling in hooks

5. **Monitor Tests**
   - Test metrics recording
   - Test health check
   - Test report generation

6. **Full Sync Tests**
   - Test collection comparison
   - Test document synchronization
   - Test progress tracking

### Property-Based Testing

The system will use **fast-check** library for property-based testing with Jest integration.

**Property Test Configuration:**
- Minimum 100 iterations per property test
- Custom generators for MongoDB operations
- Seed-based reproducibility for failed tests

**Property Test Coverage:**

Each property-based test will be tagged with the format: `**Feature: dual-mongodb-sync, Property {number}: {property_text}**`

1. **Property 1 Test**: Generate random database operations and verify they execute against local connection
2. **Property 2 Test**: Generate random write operations and verify they appear in sync queue
3. **Property 3 Test**: Generate sequence of operations and verify queue order matches execution order
4. **Property 4 Test**: Simulate failures and verify retry delays follow exponential backoff pattern
5. **Property 5 Test**: Measure operation completion time and verify it doesn't include sync time
6. **Property 6 Test**: Generate sync operations and verify all are logged with timestamps
7. **Property 7 Test**: Perform operations and verify metrics accurately reflect counts and timing
8. **Property 8 Test**: Create database differences and verify full sync detects and fixes them
9. **Property 9 Test**: Attempt concurrent full syncs and verify only one executes
10. **Property 10 Test**: Use existing model operations and verify sync happens automatically
11. **Property 11 Test**: Generate random configurations and verify sync behavior respects them
12. **Property 12 Test**: Disconnect/reconnect Atlas and verify queued operations process successfully

### Integration Testing

1. **End-to-End Sync Flow**
   - Create document in local DB
   - Verify it appears in sync queue
   - Verify it syncs to Atlas
   - Verify metrics are updated

2. **Failure Recovery**
   - Disconnect Atlas
   - Perform operations
   - Reconnect Atlas
   - Verify all operations sync

3. **Full Sync Validation**
   - Create differences between databases
   - Run full sync
   - Verify databases are identical

4. **Performance Testing**
   - Measure local operation latency
   - Verify sync doesn't impact local performance
   - Test with high operation volume

## Implementation Notes

### Mongoose Middleware Approach

The system uses Mongoose post-hooks rather than pre-hooks to ensure:
- Local operations complete successfully before sync is attempted
- Sync failures don't affect local operations
- Actual saved/updated/deleted data is synchronized (not pre-save data)

### Queue Processing Strategy

The sync worker uses a continuous processing loop with configurable interval:
- Processes one operation at a time to maintain order
- Sleeps between operations to avoid overwhelming Atlas
- Implements circuit breaker pattern for repeated failures

### Connection Pooling

Both connections use separate connection pools:
- Local: Larger pool (10 connections) for high throughput
- Atlas: Smaller pool (5 connections) for sync operations only

### Monitoring and Observability

The system exposes metrics via:
- REST API endpoint: `GET /api/sync/metrics`
- Health check endpoint: `GET /api/sync/health`
- Detailed logs with structured format for log aggregation

### Configuration Best Practices

Recommended production settings:
```env
SYNC_ENABLED=true
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba
MONGODB_ATLAS_URI=mongodb+srv://user:pass@cluster.mongodb.net/bomba
SYNC_QUEUE_MAX_SIZE=10000
SYNC_WORKER_INTERVAL=100
SYNC_MAX_RETRIES=5
SYNC_PERSIST_QUEUE=true
SYNC_BATCH_SIZE=100
```

### Security Considerations

- Atlas credentials stored in environment variables only
- No credentials in logs or error messages
- Separate authentication for local and Atlas connections
- TLS/SSL enforced for Atlas connections

### Scalability Considerations

- Queue can handle 10,000 operations in memory
- Disk persistence allows unlimited queue size
- Worker interval adjustable based on Atlas throughput
- Batch operations possible for bulk syncs

## Dependencies

### New Dependencies

```json
{
  "uuid": "^9.0.0",           // For operation IDs
  "fast-check": "^3.15.0"     // For property-based testing
}
```

### Existing Dependencies

- mongoose: For database connections and models
- dotenv: For configuration
- winston/custom logger: For logging

## Migration Strategy

### Phase 1: Setup (No Impact)
1. Install new dependencies
2. Create sync service files
3. Add environment variables
4. Keep sync disabled

### Phase 2: Testing (Isolated)
1. Enable sync in development environment
2. Run comprehensive tests
3. Monitor sync behavior
4. Verify data consistency

### Phase 3: Production Rollout (Gradual)
1. Deploy with sync disabled
2. Enable sync for non-critical collections first
3. Monitor performance and errors
4. Gradually enable for all collections
5. Run full sync to ensure consistency

### Rollback Plan

If issues occur:
1. Set `SYNC_ENABLED=false` in environment
2. Restart application
3. System continues on local MongoDB only
4. No data loss (local DB remains primary)
