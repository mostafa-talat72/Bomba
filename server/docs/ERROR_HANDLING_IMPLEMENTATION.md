# Error Handling Implementation - Bidirectional Sync

## Overview

This document describes the comprehensive error handling implementation for the bidirectional sync system. All components now include robust error handling with retry logic and exponential backoff.

**Requirements Addressed:** 7.1, 9.2, 9.3

## Components Enhanced

### 1. AtlasChangeListener

**Error Handling Features:**

- **Change Stream Connection Errors:**
  - Automatic reconnection with exponential backoff
  - Maximum retry attempts (configurable, default: 10)
  - Graceful degradation when max retries reached
  
- **Resume Token Errors:**
  - Detection of invalid/expired resume tokens (error code 286, ChangeStreamHistoryLost)
  - Automatic token clearing when invalid
  - Fallback to full sync when token cannot be resumed
  
- **Change Processing Errors:**
  - Retry logic with exponential backoff for failed changes
  - Maximum 5 retries per change (configurable)
  - Batch processing continues even if individual changes fail
  - Failed changes are logged but don't stop the sync process

**Error Codes Handled:**
- `286` - ChangeStreamHistoryLost (resume token expired)
- Connection errors (network issues)
- Processing errors (validation, database errors)

**Example:**
```javascript
// Resume token error handling
this.changeStream.on('error', async (error) => {
    if (error.code === 286 || error.codeName === 'ChangeStreamHistoryLost') {
        await this.resumeTokenStorage.handleInvalidToken('Resume token expired');
        this.resumeToken = null;
    }
    this.scheduleReconnect();
});
```

### 2. ChangeProcessor

**Error Handling Features:**

- **Change Processing Errors:**
  - Validation errors are caught and logged
  - Invalid changes are rejected with detailed error messages
  - Processing continues with other changes
  
- **Conflict Resolution Errors:**
  - Errors during conflict resolution default to Atlas as source of truth
  - Timestamp extraction errors use fallback values
  - Comparison errors are logged but don't stop processing
  
- **Data Validation Errors:**
  - Document structure validation
  - Field type validation
  - Required field validation
  - Enum value validation
  - Numeric constraint validation
  - All validation errors are logged with details

**Example:**
```javascript
// Validation error handling
const validation = this.validateDocumentData(document, collectionName, 'insert');
if (!validation.success) {
    Logger.error(`Document validation failed:`, validation.errors);
    return {
        success: false,
        reason: 'Document validation failed',
        validationErrors: validation.errors
    };
}
```

### 3. ConflictResolver

**Error Handling Features:**

- **Input Validation:**
  - Null/undefined document checks
  - Null/undefined change event checks
  - Graceful handling of missing data
  
- **Timestamp Extraction Errors:**
  - Multiple fallback timestamp sources
  - Invalid date detection and handling
  - MongoDB Timestamp type conversion errors
  - Defaults to current time on extraction failure
  
- **Comparison Errors:**
  - Type validation before comparison
  - Invalid timestamp detection
  - Defaults to Atlas preference on comparison failure
  
- **Logging Errors:**
  - Conflict log overflow protection
  - Graceful handling of logging failures
  - Logging failures don't stop conflict resolution

**Example:**
```javascript
// Timestamp extraction with error handling
try {
    localTimestamp = this.extractTimestamp(localDoc);
} catch (error) {
    console.error('Error extracting local timestamp:', error);
    localTimestamp = new Date(0); // Use epoch as fallback
}
```

### 4. OriginTracker

**Error Handling Features:**

- **Instance ID Generation Errors:**
  - Fallback to random ID if hostname/pid unavailable
  - Validation of ID components
  - Guaranteed unique ID generation
  
- **Change Tracking Errors:**
  - Null/undefined document ID checks
  - toString() conversion errors
  - Map operation errors
  - Tracking failures don't stop sync process
  
- **Cleanup Errors:**
  - Individual entry cleanup errors are caught
  - Problematic entries are removed
  - Cleanup failures don't stop the cleanup timer
  - Timer errors don't break initialization

**Example:**
```javascript
// Instance ID generation with fallback
try {
    return `${os.hostname()}-${process.pid}-${Date.now()}`;
} catch (error) {
    console.error('Error generating instance ID:', error);
    return `fallback-${Math.random().toString(36).substring(7)}-${Date.now()}`;
}
```

### 5. ResumeTokenStorage

**Error Handling Features:**

- **Save Operation Errors:**
  - Retry logic with exponential backoff (3 retries)
  - Connection availability checks
  - Token validation before saving
  - Graceful handling of database errors
  
- **Load Operation Errors:**
  - Retry logic with exponential backoff (3 retries)
  - Invalid token detection and clearing
  - Token age checking (warns if > 7 days old)
  - Connection errors handled gracefully
  
- **Clear Operation Errors:**
  - Retry logic with exponential backoff (3 retries)
  - Handles non-existent tokens gracefully
  - Database operation errors are retried
  
- **Validation Errors:**
  - Comprehensive token structure validation
  - _data field presence and type checking
  - Base64 format validation
  - Empty string detection

**Example:**
```javascript
// Save with retry logic
for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
        await metadataCollection.updateOne(...);
        return true;
    } catch (error) {
        if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
            continue;
        }
        return false;
    }
}
```

## Retry Strategy

### Exponential Backoff

All components use exponential backoff for retries:

**Resume Token Storage:**
- Retry delays: [1000ms, 2000ms, 5000ms]
- Max retries: 3
- Total max wait: ~8 seconds

**Atlas Change Listener:**
- Retry delays: [1000ms, 5000ms, 15000ms, 30000ms, 60000ms]
- Max retries: 5 (for change processing)
- Max reconnection attempts: 10 (configurable)
- Reconnection delay: base interval * 2^(attempt-1)

**Change Processor:**
- Uses same retry configuration as Atlas Listener
- Configurable via syncConfig.maxRetries and syncConfig.retryDelays

### Retry Decision Logic

**When to Retry:**
- Network/connection errors
- Temporary database errors
- Timeout errors
- Resume token save/load failures

**When NOT to Retry:**
- Validation errors (invalid data)
- Authentication errors
- Permission errors
- Invalid resume tokens (clear and start fresh instead)

## Error Logging

### Log Levels

**ERROR:** Critical errors that need attention
- Change Stream connection failures
- Resume token errors
- Database operation failures
- Validation failures

**WARN:** Issues that are handled but noteworthy
- Retry attempts
- Invalid data detected
- Missing optional data
- Token age warnings

**DEBUG:** Detailed information for troubleshooting
- Successful operations
- Skipped changes
- Token operations
- Validation details

### Log Format

All error logs include:
- Component name (e.g., `[AtlasChangeListener]`)
- Operation being performed
- Error message
- Relevant context (document ID, collection name, etc.)
- Retry attempt number (if applicable)

Example:
```
[AtlasChangeListener] Error saving resume token (attempt 2/3): Connection timeout
[ResumeTokenStorage] Retrying save in 2000ms
```

## Graceful Degradation

### Fallback Behaviors

**Resume Token Failures:**
- Clear invalid token
- Start Change Stream without resume token
- Perform full sync if needed

**Conflict Resolution Failures:**
- Default to Atlas as source of truth
- Use current time for missing timestamps
- Continue processing other changes

**Origin Tracking Failures:**
- Allow sync to proceed
- Log tracking failures
- Don't block change processing

**Validation Failures:**
- Reject invalid changes
- Log detailed validation errors
- Continue processing other changes

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Error Rates:**
   - Change processing failures
   - Resume token errors
   - Validation failures
   - Conflict resolution errors

2. **Retry Counts:**
   - Number of retries per operation
   - Max retries reached count
   - Reconnection attempts

3. **Recovery Times:**
   - Time to recover from disconnection
   - Time to process retry queue
   - Resume token recovery time

### Health Checks

The system provides health check endpoints that include:
- Change Stream connection status
- Reconnection attempt count
- Last successful change time
- Error counts and rates
- Resume token status

## Testing Error Scenarios

### Test Cases Implemented

1. **Network Disconnection:**
   - Change Stream disconnects
   - Automatic reconnection
   - Resume from last token

2. **Invalid Resume Token:**
   - Token expired
   - Token cleared
   - Fresh start

3. **Database Errors:**
   - Connection failures
   - Operation timeouts
   - Retry logic

4. **Validation Errors:**
   - Invalid document structure
   - Type mismatches
   - Missing required fields

5. **Conflict Scenarios:**
   - Simultaneous updates
   - Missing timestamps
   - Comparison errors

## Configuration

### Environment Variables

```env
# Change Stream reconnection settings
CHANGE_STREAM_RECONNECT_INTERVAL=5000
CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS=10

# Retry configuration
SYNC_MAX_RETRIES=5
SYNC_RETRY_DELAYS=1000,5000,15000,30000,60000

# Origin tracking cleanup
ORIGIN_TRACKING_CLEANUP_INTERVAL=60000
```

### Sync Config

```javascript
syncConfig = {
    maxRetries: 5,
    retryDelays: [1000, 5000, 15000, 30000, 60000],
    bidirectionalSync: {
        changeStream: {
            maxReconnectAttempts: 10,
            reconnectInterval: 5000,
            batchSize: 100
        }
    }
}
```

## Best Practices

1. **Always Validate Input:**
   - Check for null/undefined
   - Validate data types
   - Verify required fields

2. **Use Retry Logic:**
   - Implement exponential backoff
   - Set reasonable max retries
   - Log retry attempts

3. **Fail Gracefully:**
   - Don't throw errors that stop the entire process
   - Log errors with context
   - Continue processing when possible

4. **Provide Fallbacks:**
   - Default values for missing data
   - Alternative approaches when primary fails
   - Clear invalid state and start fresh

5. **Monitor and Alert:**
   - Track error rates
   - Monitor retry counts
   - Alert on repeated failures

## Troubleshooting Guide

### Common Issues

**Issue:** Change Stream keeps disconnecting
- **Check:** Network stability
- **Check:** Atlas cluster status
- **Check:** Reconnection attempt count
- **Action:** Review logs for error patterns

**Issue:** Resume token errors
- **Check:** Token age (> 7 days?)
- **Check:** Change Stream history availability
- **Action:** Clear token and perform full sync

**Issue:** High validation failure rate
- **Check:** Data quality at source
- **Check:** Schema mismatches
- **Action:** Review validation error logs

**Issue:** Conflict resolution always choosing Atlas
- **Check:** Local timestamp availability
- **Check:** Clock synchronization
- **Action:** Verify timestamp fields in documents

## Future Enhancements

1. **Circuit Breaker Pattern:**
   - Stop retrying after sustained failures
   - Automatic recovery when service restored

2. **Dead Letter Queue:**
   - Store permanently failed changes
   - Manual review and reprocessing

3. **Adaptive Retry Delays:**
   - Adjust delays based on error type
   - Faster retries for transient errors

4. **Error Rate Limiting:**
   - Slow down processing if error rate high
   - Prevent cascading failures

5. **Detailed Error Analytics:**
   - Error categorization
   - Trend analysis
   - Predictive alerting

## Summary

The bidirectional sync system now includes comprehensive error handling across all components:

✅ Change Stream connection errors with automatic reconnection
✅ Resume token errors with automatic clearing and recovery
✅ Change processing errors with retry logic and exponential backoff
✅ Conflict resolution errors with graceful fallbacks
✅ Data validation errors with detailed logging
✅ Origin tracking errors with safe defaults
✅ All operations include retry logic where appropriate
✅ Graceful degradation ensures system continues operating
✅ Comprehensive logging for troubleshooting
✅ Health checks for monitoring

The system is now resilient to various failure scenarios and can recover automatically from most error conditions.
