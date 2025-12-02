# Bidirectional Sync Configuration Guide

This document describes the configuration options for the bidirectional sync feature in the Bomba system.

## Overview

Bidirectional sync enables two-way synchronization between Local MongoDB and MongoDB Atlas. When enabled, changes made on Atlas (from other devices) are automatically replicated to the local database, in addition to the existing Local→Atlas sync.

## Configuration Options

### Core Bidirectional Sync Settings

#### `BIDIRECTIONAL_SYNC_ENABLED`
- **Type**: Boolean
- **Default**: `false`
- **Description**: Master switch to enable/disable bidirectional synchronization
- **Values**: 
  - `true`: Enable bidirectional sync (Atlas → Local + Local → Atlas)
  - `false`: One-way sync only (Local → Atlas)

**Example:**
```env
BIDIRECTIONAL_SYNC_ENABLED=true
```

### Change Stream Configuration

#### `ATLAS_CHANGE_STREAM_BATCH_SIZE`
- **Type**: Integer
- **Default**: `100`
- **Range**: 1-1000
- **Description**: Number of change events to process in a single batch from Atlas Change Stream
- **Recommendation**: Higher values improve throughput but increase memory usage

**Example:**
```env
ATLAS_CHANGE_STREAM_BATCH_SIZE=100
```

#### `CHANGE_STREAM_RECONNECT_INTERVAL`
- **Type**: Integer (milliseconds)
- **Default**: `5000` (5 seconds)
- **Minimum**: `1000` (1 second)
- **Description**: Time to wait before attempting to reconnect to Atlas Change Stream after disconnection
- **Recommendation**: Use exponential backoff for production environments

**Example:**
```env
CHANGE_STREAM_RECONNECT_INTERVAL=5000
```

#### `CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS`
- **Type**: Integer
- **Default**: `10`
- **Range**: 1-100
- **Description**: Maximum number of reconnection attempts before giving up
- **Recommendation**: Set higher for production to handle temporary network issues

**Example:**
```env
CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS=10
```

### Collection Exclusion

#### `BIDIRECTIONAL_EXCLUDED_COLLECTIONS`
- **Type**: Comma-separated string
- **Default**: `sessions,logs`
- **Description**: Collections to exclude from bidirectional sync. These collections will maintain one-way sync (Local → Atlas only)
- **Use Cases**:
  - Temporary data that doesn't need to sync back
  - Log collections
  - Session data
  - Device-specific data

**Example:**
```env
BIDIRECTIONAL_EXCLUDED_COLLECTIONS=sessions,logs,temp,cache
```

### Conflict Resolution

#### `CONFLICT_RESOLUTION_STRATEGY`
- **Type**: String
- **Default**: `last-write-wins`
- **Allowed Values**: `last-write-wins`
- **Description**: Strategy to use when the same document is modified on both databases simultaneously
- **Current Implementation**: Only Last Write Wins (LWW) is supported

**Example:**
```env
CONFLICT_RESOLUTION_STRATEGY=last-write-wins
```

### Origin Tracking

#### `ORIGIN_TRACKING_CLEANUP_INTERVAL`
- **Type**: Integer (milliseconds)
- **Default**: `60000` (1 minute)
- **Minimum**: `10000` (10 seconds)
- **Description**: Interval for cleaning up old origin tracking metadata to prevent memory bloat
- **Recommendation**: Balance between memory usage and tracking accuracy

**Example:**
```env
ORIGIN_TRACKING_CLEANUP_INTERVAL=60000
```

## Configuration Validation

The system validates all configuration values on startup. If validation fails:

1. Errors are logged to the console
2. Sync system is disabled automatically
3. Application continues running in non-sync mode

### Validation Rules

**Base Sync Configuration:**
- `MONGODB_ATLAS_URI` is required when sync is enabled
- `SYNC_QUEUE_MAX_SIZE` must be at least 100
- `SYNC_WORKER_INTERVAL` must be at least 10ms
- `SYNC_MAX_RETRIES` must be between 1 and 10
- `SYNC_BATCH_SIZE` must be between 1 and 1000

**Bidirectional Sync Configuration:**
- `MONGODB_ATLAS_URI` is required when bidirectional sync is enabled
- `ATLAS_CHANGE_STREAM_BATCH_SIZE` must be between 1 and 1000
- `CHANGE_STREAM_RECONNECT_INTERVAL` must be at least 1000ms
- `CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS` must be between 1 and 100
- `CONFLICT_RESOLUTION_STRATEGY` must be a valid strategy
- `ORIGIN_TRACKING_CLEANUP_INTERVAL` must be at least 10000ms

## Example Configurations

### Development Environment

```env
# Enable bidirectional sync for testing
BIDIRECTIONAL_SYNC_ENABLED=true

# Use smaller batch sizes for easier debugging
ATLAS_CHANGE_STREAM_BATCH_SIZE=50

# Faster reconnection for development
CHANGE_STREAM_RECONNECT_INTERVAL=2000
CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS=5

# Exclude test collections
BIDIRECTIONAL_EXCLUDED_COLLECTIONS=sessions,logs,test_data

# Standard conflict resolution
CONFLICT_RESOLUTION_STRATEGY=last-write-wins

# More frequent cleanup for testing
ORIGIN_TRACKING_CLEANUP_INTERVAL=30000
```

### Production Environment

```env
# Enable bidirectional sync
BIDIRECTIONAL_SYNC_ENABLED=true

# Optimize for throughput
ATLAS_CHANGE_STREAM_BATCH_SIZE=100

# More resilient reconnection
CHANGE_STREAM_RECONNECT_INTERVAL=5000
CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS=20

# Exclude temporary collections
BIDIRECTIONAL_EXCLUDED_COLLECTIONS=sessions,logs

# Standard conflict resolution
CONFLICT_RESOLUTION_STRATEGY=last-write-wins

# Standard cleanup interval
ORIGIN_TRACKING_CLEANUP_INTERVAL=60000
```

### Disabled Bidirectional Sync (One-Way Only)

```env
# Disable bidirectional sync - only Local → Atlas
BIDIRECTIONAL_SYNC_ENABLED=false

# Other settings are ignored when disabled
```

## Monitoring

When bidirectional sync is enabled, the system logs:

- Configuration validation results on startup
- Bidirectional sync status (enabled/disabled)
- Conflict resolution strategy
- Change Stream batch size
- Excluded collections list

**Example startup logs:**
```
✅ Sync configuration validated successfully
🔄 Bidirectional sync is ENABLED
  - Conflict resolution: last-write-wins
  - Change Stream batch size: 100
  - Excluded collections: sessions, logs
```

## Troubleshooting

### Configuration Validation Fails

**Problem**: Server logs show configuration validation errors

**Solution**: 
1. Check the error messages in the logs
2. Verify all required environment variables are set
3. Ensure values are within valid ranges
4. Check for typos in environment variable names

### Bidirectional Sync Not Working

**Problem**: Changes from Atlas are not appearing locally

**Solution**:
1. Verify `BIDIRECTIONAL_SYNC_ENABLED=true`
2. Check that `MONGODB_ATLAS_URI` is correctly set
3. Ensure Atlas cluster is M10+ (required for Change Streams)
4. Check that collections are not in the exclusion list
5. Review server logs for Change Stream connection errors

### High Memory Usage

**Problem**: Application memory usage increases over time

**Solution**:
1. Reduce `ATLAS_CHANGE_STREAM_BATCH_SIZE`
2. Decrease `ORIGIN_TRACKING_CLEANUP_INTERVAL` for more frequent cleanup
3. Add more collections to `BIDIRECTIONAL_EXCLUDED_COLLECTIONS`

### Frequent Reconnections

**Problem**: Change Stream disconnects and reconnects frequently

**Solution**:
1. Increase `CHANGE_STREAM_RECONNECT_INTERVAL`
2. Increase `CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS`
3. Check network stability
4. Verify Atlas cluster health

## Requirements

- MongoDB Atlas M10+ cluster (for Change Streams)
- MongoDB 4.0+ (for Change Stream support)
- Replica set configuration (required for Change Streams)
- Stable internet connection

## Security Considerations

- Ensure `MONGODB_ATLAS_URI` contains valid credentials
- Use environment variables, never hardcode credentials
- Restrict network access to Atlas cluster
- Monitor sync metrics for unusual activity
- Validate all incoming changes before applying

## Performance Considerations

- Change Streams use minimal bandwidth (only changes transmitted)
- Batch processing improves efficiency
- Async processing doesn't block local operations
- Connection pooling reduces overhead
- Resume tokens prevent re-processing of changes

## Migration from One-Way to Bidirectional

1. **Backup**: Create full backup of both databases
2. **Test**: Enable in development environment first
3. **Validate**: Verify sync works correctly with test data
4. **Monitor**: Watch metrics and logs closely
5. **Rollback Plan**: Keep `BIDIRECTIONAL_SYNC_ENABLED=false` ready

To rollback:
```env
BIDIRECTIONAL_SYNC_ENABLED=false
```
Restart the application. System reverts to one-way sync with no data loss.

## API Endpoints

When bidirectional sync is enabled, additional API endpoints are available:

- `GET /api/sync/bidirectional/metrics` - Get sync metrics for both directions
- `GET /api/sync/bidirectional/health` - Check bidirectional sync health
- `GET /api/sync/bidirectional/conflicts` - View conflict resolution history
- `POST /api/sync/bidirectional/toggle` - Enable/disable bidirectional sync

## Further Reading

- [MongoDB Change Streams Documentation](https://docs.mongodb.com/manual/changeStreams/)
- [Conflict Resolution Strategies](./CONFLICT_RESOLUTION.md)
- [Origin Tracking Implementation](../middleware/sync/ORIGIN_TRACKING_IMPLEMENTATION.md)
- [Atlas Listener Integration](../services/sync/ATLAS_LISTENER_INTEGRATION.md)
