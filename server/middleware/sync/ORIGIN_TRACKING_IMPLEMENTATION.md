# Origin Tracking Implementation in Sync Middleware

## Overview

The sync middleware has been enhanced to support bidirectional sync by adding origin tracking metadata to all queued operations. This prevents sync loops where changes bounce back and forth between Local and Atlas databases.

## Changes Made

### 1. OriginTracker Integration

- Imported `OriginTracker` class from `server/services/sync/originTracker.js`
- Created a singleton instance accessible via `getOriginTracker()` function
- Exported `getOriginTracker()` for use by other modules (e.g., Change Processor)

### 2. Enhanced Operation Metadata

All queued operations now include three additional fields:

```javascript
{
  type: "insert" | "update" | "delete",
  collection: "collectionName",
  data: { ... },
  timestamp: Date,
  // NEW FIELDS:
  origin: 'local',           // Indicates this change originated from Local
  instanceId: 'uuid',        // Unique identifier for this application instance
}
```

### 3. Change Marking

Before queueing any operation, the middleware now:
1. Gets the OriginTracker instance
2. Marks the document ID as a local change using `tracker.markLocalChange(doc._id)`
3. Adds origin metadata to the operation

This marking allows the system to:
- Prevent re-syncing changes that came from Atlas back to Atlas
- Track which instance made which changes
- Detect and break sync loops

## Updated Hooks

All Mongoose post-hooks have been updated:

1. **postSaveHook** - Insert operations
2. **postUpdateHook** - Update operations (updateOne, updateMany)
3. **postFindOneAndUpdateHook** - FindOneAndUpdate operations
4. **postRemoveHook** - Remove operations
5. **postFindOneAndDeleteHook** - FindOneAndDelete/FindOneAndRemove operations
6. **postDeleteOneHook** - DeleteOne operations
7. **postDeleteManyHook** - DeleteMany operations

## How It Works

### Local → Atlas Flow (Enhanced)

```
1. User performs operation on Local
2. Mongoose middleware intercepts change
3. OriginTracker marks document as 'local' change
4. Operation queued with origin='local' and instanceId
5. Sync Worker processes queue
6. Change applied to Atlas
```

### Atlas → Local Flow (Future)

```
1. Another device performs operation on Atlas
2. Atlas Change Stream emits change event
3. Atlas Listener receives change
4. Change Processor checks origin metadata
5. If origin='local' and instanceId matches → SKIP (prevent loop)
6. If origin='atlas' or different instanceId → APPLY to Local
7. OriginTracker marks document as 'atlas' change
8. Middleware sees 'atlas' mark → SKIP queueing (prevent loop)
```

## Requirements Validated

This implementation satisfies the following requirements:

- **Requirement 2.1**: Changes originating from Local are marked to prevent re-syncing from Atlas
- **Requirement 2.4**: Change origin is tracked using metadata fields
- **Requirement 10.1**: Changes from Local include metadata indicating Local origin
- **Requirement 10.3**: Device/instance identifier is included in change metadata

## Testing

The implementation can be tested by:

1. **Unit Tests**: Verify that all hooks add correct metadata
2. **Property Tests**: Verify sync loop prevention (Property 2)
3. **Integration Tests**: Verify end-to-end bidirectional sync flow

## Next Steps

1. Implement Change Processor to use origin metadata when applying Atlas changes
2. Update Sync Worker to include origin metadata when syncing to Atlas
3. Write property-based tests for sync loop prevention
4. Test with multiple application instances

## Configuration

No new configuration is required. The OriginTracker uses settings from `syncConfig.bidirectionalSync.originTracking`:

```javascript
{
  cleanupInterval: 60000 // 1 minute (from env: ORIGIN_TRACKING_CLEANUP_INTERVAL)
}
```

## Performance Impact

- **Memory**: Minimal - OriginTracker stores document IDs in a Map with automatic cleanup
- **CPU**: Negligible - Simple Map operations and string concatenation
- **Network**: None - Metadata is small (origin string + instanceId)

## Backward Compatibility

This change is fully backward compatible:
- Existing sync operations continue to work
- New fields are optional and don't break existing code
- OriginTracker is only active when sync is enabled
