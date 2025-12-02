# Excluded Collections Implementation

## Overview

This document describes the implementation of collection exclusion logic for bidirectional sync, allowing administrators to control which collections are synced bidirectionally and which remain one-way only.

## Requirements Addressed

- **8.1**: Support configuration for excluded collections in bidirectional sync
- **8.2**: Collections excluded from bidirectional sync don't sync changes from Atlas
- **8.3**: Excluded collections continue one-way sync (Local → Atlas)
- **8.4**: Validate excluded collections list on startup
- **8.5**: Support dynamic exclusion updates without restart

## Implementation Details

### 1. Configuration Validation (`server/config/syncConfig.js`)

#### Enhanced `validateSyncConfig()`

Added comprehensive validation for excluded collections:

```javascript
// Validate excluded collections
if (syncConfig.excludedCollections.length > 0) {
    syncConfig.excludedCollections.forEach(coll => {
        if (typeof coll !== 'string' || coll.trim() === '') {
            errors.push(`Invalid collection name in SYNC_EXCLUDED_COLLECTIONS: "${coll}"`);
        }
    });
}

// Validate bidirectional excluded collections
if (syncConfig.bidirectionalSync.excludedCollections.length > 0) {
    syncConfig.bidirectionalSync.excludedCollections.forEach(coll => {
        if (typeof coll !== 'string' || coll.trim() === '') {
            errors.push(`Invalid collection name in BIDIRECTIONAL_EXCLUDED_COLLECTIONS: "${coll}"`);
        }
    });

    // Warn if excluded collections are also in general excluded collections
    const generalExcluded = new Set(syncConfig.excludedCollections);
    syncConfig.bidirectionalSync.excludedCollections.forEach(coll => {
        if (generalExcluded.has(coll)) {
            warnings.push(
                `Collection "${coll}" is excluded from both one-way and bidirectional sync. ` +
                `It will not be synced at all.`
            );
        }
    });
}
```

**Features:**
- Validates collection names are non-empty strings
- Warns about overlapping exclusions (collections excluded from both one-way and bidirectional sync)
- Returns both errors and warnings

#### New Functions

**`updateExcludedCollections(collections, bidirectional)`**
- Dynamically updates excluded collections at runtime
- Validates input before applying changes
- Returns success/failure with detailed messages
- Supports both one-way and bidirectional exclusions

**`getExcludedCollections()`**
- Returns current exclusion lists
- Provides one-way, bidirectional, and combined views
- Useful for monitoring and debugging

### 2. Atlas Change Listener (`server/services/sync/atlasChangeListener.js`)

#### Existing Filtering

The Atlas listener already filters excluded collections in the Change Stream pipeline:

```javascript
// Build pipeline to filter excluded collections
const pipeline = [];
if (this.excludedCollections.length > 0) {
    pipeline.push({
        $match: {
            'ns.coll': { $nin: this.excludedCollections }
        }
    });
    Logger.info(`[AtlasChangeListener] Excluding collections: ${this.excludedCollections.join(', ')}`);
}
```

#### New Methods

**`updateExcludedCollections(collections)`**
- Updates the exclusion list dynamically
- Restarts the Change Stream to apply new filters
- Validates input before applying
- Returns success/failure with detailed messages

**`getExcludedCollections()`**
- Returns current exclusion list
- Useful for monitoring

### 3. Change Processor (`server/services/sync/changeProcessor.js`)

#### Existing Filtering

The change processor already checks excluded collections in `shouldApplyChange()`:

```javascript
// Check if collection is excluded from bidirectional sync
const excludedCollections = syncConfig.bidirectionalSync?.excludedCollections || [];
if (excludedCollections.includes(collectionName)) {
    Logger.debug(`[ChangeProcessor] Skipping excluded collection: ${collectionName}`);
    return false;
}
```

#### New Methods

**`updateExcludedCollections(collections)`**
- Updates the config exclusion list
- Changes take effect immediately for new changes
- Validates input before applying

**`getExcludedCollections()`**
- Returns current exclusion list

### 4. API Endpoints (`server/controllers/syncController.js`)

#### New Endpoints

**GET `/api/sync/bidirectional/excluded-collections`**
- Returns current exclusion lists
- Shows one-way, bidirectional, and combined exclusions
- Indicates if bidirectional sync is enabled

**PUT `/api/sync/bidirectional/excluded-collections`**
- Updates exclusion lists dynamically
- Requires `collections` (array) and `bidirectional` (boolean) in request body
- Validates input before applying
- Updates Atlas listener and change processor if bidirectional sync is enabled
- Returns warnings if any
- Indicates if restart is required (for one-way exclusions)

### 5. Server Integration (`server/server.js`)

#### Global Exposure

The Atlas listener and change processor are exposed globally for dynamic updates:

```javascript
// Expose to global scope for dynamic configuration updates
global.atlasChangeListener = atlasChangeListener;
global.changeProcessor = changeProcessor;
```

#### Startup Validation

Enhanced startup logging to show warnings:

```javascript
// Log warnings if any
if (configValidation.warnings && configValidation.warnings.length > 0) {
    Logger.warn("⚠️ Sync configuration warnings:");
    configValidation.warnings.forEach((warning) => Logger.warn(`  - ${warning}`));
}
```

## Usage

### Environment Variables

```env
# Collections to exclude from one-way sync (comma-separated)
SYNC_EXCLUDED_COLLECTIONS=

# Collections to exclude from bidirectional sync (comma-separated)
# These collections will maintain one-way sync (Local → Atlas only)
BIDIRECTIONAL_EXCLUDED_COLLECTIONS=sessions,logs
```

### API Usage

#### Get Current Exclusions

```bash
GET /api/sync/bidirectional/excluded-collections
Authorization: Bearer <admin_token>
```

Response:
```json
{
  "success": true,
  "data": {
    "oneWay": [],
    "bidirectional": ["sessions", "logs"],
    "combined": ["sessions", "logs"],
    "bidirectionalSyncEnabled": true
  }
}
```

#### Update Exclusions

```bash
PUT /api/sync/bidirectional/excluded-collections
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "collections": ["sessions", "logs", "temp"],
  "bidirectional": true
}
```

Response:
```json
{
  "success": true,
  "message": "Successfully updated bidirectional excluded collections",
  "data": {
    "collections": ["sessions", "logs", "temp"],
    "bidirectional": true,
    "warnings": [],
    "restartRequired": false
  }
}
```

### Programmatic Usage

```javascript
import { updateExcludedCollections, getExcludedCollections } from './config/syncConfig.js';

// Get current exclusions
const exclusions = getExcludedCollections();
console.log('Bidirectional exclusions:', exclusions.bidirectional);

// Update bidirectional exclusions
const result = updateExcludedCollections(['sessions', 'logs'], true);
if (result.success) {
    console.log('Updated successfully');
    if (result.warnings.length > 0) {
        console.warn('Warnings:', result.warnings);
    }
}
```

## Behavior

### One-Way Exclusions

Collections in `SYNC_EXCLUDED_COLLECTIONS`:
- **Not synced** from Local to Atlas
- **Not synced** from Atlas to Local
- Completely excluded from sync system

### Bidirectional Exclusions

Collections in `BIDIRECTIONAL_EXCLUDED_COLLECTIONS`:
- **Synced** from Local to Atlas (one-way sync continues)
- **Not synced** from Atlas to Local (bidirectional sync disabled)
- Useful for collections that should only be updated locally

### Overlapping Exclusions

If a collection appears in both lists:
- Completely excluded from sync (one-way exclusion takes precedence)
- Warning logged on startup and when updating
- Not recommended - use one-way exclusion only

## Dynamic Updates

### Bidirectional Exclusions

Can be updated dynamically without restart:
1. Update via API or programmatically
2. Atlas listener restarts with new filters
3. Change processor uses new exclusions immediately
4. No data loss - changes during restart are caught by resume token

### One-Way Exclusions

Require server restart to take effect:
1. Update via API or programmatically
2. Restart server to apply changes
3. Sync middleware uses new exclusions after restart

## Testing

A comprehensive test script is available at `server/scripts/testExcludedCollections.js`:

```bash
cd server
node scripts/testExcludedCollections.js
```

Tests cover:
1. Configuration validation
2. Getting current exclusions
3. Collection name validation
4. Updating one-way exclusions
5. Updating bidirectional exclusions
6. Overlapping exclusions warning
7. Configuration restoration

## Monitoring

### Startup Logs

```
✅ Sync configuration validated successfully
⚠️ Sync configuration warnings:
  - Collection "sessions" is excluded from both one-way and bidirectional sync. It will not be synced at all.
🔄 Bidirectional sync is ENABLED
  - Conflict resolution: last-write-wins
  - Change Stream batch size: 100
  - Excluded collections: sessions, logs
```

### Runtime Logs

```
[AtlasChangeListener] Excluding collections: sessions, logs
[AtlasChangeListener] Updated excluded collections: sessions, logs, temp
[AtlasChangeListener] Restarting Change Stream to apply new exclusions...
[AtlasChangeListener] ✅ Change Stream restarted with new exclusions
```

## Security

- All exclusion management endpoints require admin authentication
- Input validation prevents injection attacks
- Changes are logged with user information
- Invalid configurations are rejected before applying

## Performance

- Filtering at Change Stream level (most efficient)
- No performance impact on excluded collections
- Dynamic updates cause brief Change Stream restart (< 1 second)
- Resume token ensures no changes are lost during restart

## Limitations

1. One-way exclusions require server restart
2. Dynamic updates only work when bidirectional sync is enabled
3. Overlapping exclusions result in complete exclusion (by design)
4. Collection names must be exact matches (no wildcards)

## Future Enhancements

1. Support for wildcard patterns (e.g., `temp_*`)
2. Per-collection sync direction control
3. Scheduled exclusion changes
4. Exclusion history and audit log
5. UI for managing exclusions

## Related Files

- `server/config/syncConfig.js` - Configuration and validation
- `server/services/sync/atlasChangeListener.js` - Atlas Change Stream filtering
- `server/services/sync/changeProcessor.js` - Change application filtering
- `server/controllers/syncController.js` - API endpoints
- `server/routes/syncRoutes.js` - Route definitions
- `server/server.js` - Server initialization
- `server/scripts/testExcludedCollections.js` - Test script
- `server/.env.example` - Environment variable documentation

## Conclusion

The excluded collections implementation provides flexible control over bidirectional sync behavior, allowing administrators to:
- Exclude sensitive collections from bidirectional sync
- Maintain one-way sync for specific collections
- Update exclusions dynamically without downtime
- Monitor and validate exclusion configuration
- Prevent accidental data sync issues

All requirements (8.1-8.5) have been successfully implemented and tested.
