# Atlas Listener and Change Processor Integration

## Overview

This document describes the integration between the Atlas Change Stream Listener and the Change Processor, implementing error handling, retry logic, and batching for efficient bidirectional sync.

## Implementation Summary

### Task 8.1: Connect Atlas Listener to Change Processor

**Requirements:** 1.4, 6.1, 6.2, 6.3, 9.2, 9.3

**Completed Features:**

1. **Error Handling for Processing Failures**
   - Comprehensive error handling in `handleChange()` method
   - Errors are logged with detailed context
   - Failed changes are tracked in statistics
   - Processing continues even if individual changes fail

2. **Retry Logic with Exponential Backoff**
   - New `processChangeWithRetry()` method implements retry logic
   - Uses configurable max retries (default: 5 from syncConfig)
   - Exponential backoff delays: [1s, 5s, 15s, 30s, 60s]
   - Retries both successful failures and exceptions
   - Logs each retry attempt with delay information
   - Stops retrying after max attempts reached

3. **Change Batching for Efficiency**
   - New batching mechanism accumulates changes before processing
   - Configurable batch size (default: 100 from syncConfig)
   - Batch timeout: 1 second of inactivity triggers processing
   - Automatic processing when batch size limit reached
   - Parallel processing of batched changes using `Promise.allSettled()`
   - Batch statistics tracking (batches processed count)
   - Graceful handling of batch processing during shutdown

4. **Enhanced Statistics**
   - Added `batchesProcessed` counter
   - Added `pendingBatchSize` to track current batch
   - Added `isBatchProcessing` flag to prevent concurrent processing
   - Statistics include batch processing metrics

## Key Methods

### `processChangeWithRetry(change, attempt = 0)`

Processes a change with automatic retry logic:

```javascript
// Attempts to process change
// If fails and retries available:
//   - Waits with exponential backoff
//   - Retries recursively
// If max retries reached:
//   - Logs error
//   - Returns failure result
```

**Parameters:**
- `change`: Atlas change event
- `attempt`: Current retry attempt (default: 0)

**Returns:** Processing result object with `success` flag

### `addChangeToBatch(change)`

Adds a change to the processing batch:

```javascript
// Adds change to batch array
// Clears existing batch timer
// If batch full:
//   - Processes immediately
// Else:
//   - Schedules batch processing after timeout
```

### `processBatch()`

Processes accumulated batch of changes:

```javascript
// Prevents concurrent processing
// Gets current batch and clears for new changes
// Processes changes in parallel
// Updates statistics
// Schedules next batch if changes accumulated
```

## Configuration

Uses existing `syncConfig` settings:

```javascript
{
  maxRetries: 5,  // Maximum retry attempts
  retryDelays: [1000, 5000, 15000, 30000, 60000],  // Exponential backoff delays
  bidirectionalSync: {
    changeStream: {
      batchSize: 100  // Maximum changes per batch
    }
  }
}
```

## Statistics Tracking

Enhanced statistics include:

```javascript
{
  totalChanges: 0,        // Total changes received
  processedChanges: 0,    // Successfully processed
  failedChanges: 0,       // Failed after retries
  skippedChanges: 0,      // Skipped (origin tracking)
  batchesProcessed: 0,    // Number of batches processed
  pendingBatchSize: 0,    // Current batch size
  isBatchProcessing: false // Batch processing flag
}
```

## Error Handling Flow

```
Change Received
    ↓
handleChange()
    ↓
addChangeToBatch()
    ↓
[Batch Full or Timeout]
    ↓
processBatch()
    ↓
processChangeWithRetry()
    ↓
[Attempt 1] → Fail
    ↓
[Wait 1s]
    ↓
[Attempt 2] → Fail
    ↓
[Wait 5s]
    ↓
[Attempt 3] → Success ✓
```

## Benefits

1. **Resilience**: Automatic retry handles transient failures
2. **Efficiency**: Batching reduces overhead and improves throughput
3. **Observability**: Comprehensive statistics for monitoring
4. **Reliability**: Graceful degradation on persistent failures
5. **Performance**: Parallel batch processing maximizes throughput

## Testing

Integration test script: `server/scripts/testAtlasListenerIntegration.js`

Tests verify:
- ✓ Retry logic with exponential backoff
- ✓ Batching accumulation and processing
- ✓ Statistics tracking accuracy
- ✓ Origin tracking integration
- ✓ Batch size limit enforcement

## Next Steps

Task 8.2 (Optional): Write integration tests for Atlas→Local flow
- End-to-end change replication tests
- Error handling validation
- Retry logic verification
- Batching performance tests
