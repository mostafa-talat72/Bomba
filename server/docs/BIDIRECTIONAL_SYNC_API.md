# Bidirectional Sync API Endpoints

This document describes the API endpoints for monitoring and controlling bidirectional sync between Local MongoDB and MongoDB Atlas.

## Overview

The bidirectional sync API provides endpoints to:
- Monitor sync metrics in both directions (Local→Atlas and Atlas→Local)
- Check the health status of bidirectional sync
- View conflict resolution statistics
- Toggle bidirectional sync on/off (requires restart)

All endpoints require authentication and admin role.

## Endpoints

### 1. Get Bidirectional Metrics

Get detailed metrics for both sync directions.

**Endpoint:** `GET /api/sync/bidirectional/metrics`

**Authentication:** Required (Admin only)

**Response:**

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "localToAtlas": {
      "totalOperations": 1250,
      "successfulSyncs": 1245,
      "failedSyncs": 5,
      "avgSyncTime": 45.2,
      "lastSyncTimestamp": "2025-11-30T10:30:00.000Z",
      "successRate": "99.60%"
    },
    "atlasToLocal": {
      "totalOperations": 890,
      "successfulSyncs": 885,
      "failedSyncs": 5,
      "avgProcessTime": 38.7,
      "lastSyncTimestamp": "2025-11-30T10:29:55.000Z",
      "changeStreamStatus": "connected",
      "reconnectAttempts": 0,
      "successRate": "99.44%"
    },
    "conflicts": {
      "totalConflicts": 12,
      "resolvedConflicts": 12,
      "conflictsByCollection": {
        "bills": 8,
        "orders": 4
      },
      "lastConflictTime": "2025-11-30T10:25:00.000Z",
      "conflictRate": "1.35%"
    }
  }
}
```

**When Bidirectional Sync is Disabled:**

```json
{
  "success": true,
  "data": {
    "enabled": false,
    "message": "Bidirectional sync is not enabled"
  }
}
```

---

### 2. Get Bidirectional Health

Check the health status of bidirectional sync.

**Endpoint:** `GET /api/sync/bidirectional/health`

**Authentication:** Required (Admin only)

**Response:**

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "status": "healthy",
    "timestamp": "2025-11-30T10:30:00.000Z",
    "warnings": [],
    "errors": [],
    "checks": {
      "syncEnabled": {
        "status": "pass",
        "message": "Sync is enabled"
      },
      "localConnection": {
        "status": "pass",
        "message": "Local MongoDB: connected"
      },
      "atlasConnection": {
        "status": "pass",
        "message": "Atlas MongoDB: connected"
      },
      "bidirectionalSyncEnabled": {
        "status": "pass",
        "message": "Bidirectional sync is enabled"
      },
      "changeStream": {
        "status": "pass",
        "message": "Change Stream: connected",
        "reconnectAttempts": 0
      },
      "atlasToLocalFailureRate": {
        "status": "pass",
        "message": "Atlas→Local failure rate: 0.56%",
        "value": 0.56
      },
      "conflictRate": {
        "status": "pass",
        "message": "Conflict rate: 1.35%",
        "value": 1.35
      }
    },
    "directionalMetrics": {
      "localToAtlas": { /* ... */ },
      "atlasToLocal": { /* ... */ },
      "conflicts": { /* ... */ }
    }
  }
}
```

**Status Codes:**
- `200 OK` - Healthy or degraded
- `503 Service Unavailable` - Unhealthy

**Health Status Values:**
- `healthy` - All systems operational
- `degraded` - Some warnings present but operational
- `unhealthy` - Critical issues present

**When Bidirectional Sync is Disabled:**

```json
{
  "success": true,
  "data": {
    "enabled": false,
    "status": "disabled",
    "message": "Bidirectional sync is not enabled"
  }
}
```

---

### 3. Get Bidirectional Conflicts

Get detailed information about sync conflicts.

**Endpoint:** `GET /api/sync/bidirectional/conflicts`

**Authentication:** Required (Admin only)

**Response:**

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "totalConflicts": 12,
    "resolvedConflicts": 12,
    "conflictRate": 1.35,
    "lastConflict": "2025-11-30T10:25:00.000Z",
    "conflictsByCollection": {
      "bills": 8,
      "orders": 4
    }
  }
}
```

**When Bidirectional Sync is Disabled:**

```json
{
  "success": true,
  "data": {
    "enabled": false,
    "conflicts": [],
    "message": "Bidirectional sync is not enabled"
  }
}
```

---

### 4. Toggle Bidirectional Sync

Request to enable or disable bidirectional sync.

**Endpoint:** `POST /api/sync/bidirectional/toggle`

**Authentication:** Required (Admin only)

**Request Body:**

```json
{
  "enabled": true
}
```

**Response:**

```json
{
  "success": true,
  "message": "Bidirectional sync toggle requested. Please restart the server with BIDIRECTIONAL_SYNC_ENABLED=true for changes to take effect.",
  "data": {
    "currentState": false,
    "requestedState": true,
    "requiresRestart": true
  }
}
```

**Important Notes:**
- This endpoint only logs the toggle request
- For changes to take effect, you must:
  1. Update `BIDIRECTIONAL_SYNC_ENABLED` in `.env` file
  2. Restart the server
- This design ensures safe configuration changes

**Error Response (Invalid Request):**

```json
{
  "success": false,
  "message": "enabled field is required and must be a boolean"
}
```

---

## Error Responses

All endpoints may return the following error responses:

**500 Internal Server Error:**

```json
{
  "success": false,
  "message": "Failed to get bidirectional sync metrics",
  "error": "Error message details"
}
```

**401 Unauthorized:**

```json
{
  "success": false,
  "message": "Not authorized, token failed"
}
```

**403 Forbidden:**

```json
{
  "success": false,
  "message": "Not authorized as admin"
}
```

---

## Usage Examples

### Using cURL

**Get Metrics:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/sync/bidirectional/metrics
```

**Get Health:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/sync/bidirectional/health
```

**Get Conflicts:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/sync/bidirectional/conflicts
```

**Toggle Sync:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}' \
  http://localhost:5000/api/sync/bidirectional/toggle
```

### Using JavaScript (Axios)

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Get metrics
const metrics = await api.get('/sync/bidirectional/metrics');
console.log(metrics.data);

// Get health
const health = await api.get('/sync/bidirectional/health');
console.log(health.data);

// Get conflicts
const conflicts = await api.get('/sync/bidirectional/conflicts');
console.log(conflicts.data);

// Toggle sync
const toggle = await api.post('/sync/bidirectional/toggle', {
  enabled: true
});
console.log(toggle.data);
```

---

## Monitoring Recommendations

### Metrics to Monitor

1. **Success Rate**: Should be > 99%
   - If below 95%, investigate error logs

2. **Conflict Rate**: Should be < 5%
   - High conflict rate indicates concurrent modifications
   - Consider optimizing update patterns

3. **Change Stream Status**: Should be "connected"
   - If "reconnecting" or "disconnected", check network and Atlas

4. **Reconnect Attempts**: Should be 0 or low
   - High reconnect attempts indicate network instability

5. **Average Process Time**: Should be < 100ms
   - High process time may indicate performance issues

### Health Check Frequency

- **Production**: Check every 5 minutes
- **Development**: Check every 30 seconds
- **Critical Systems**: Check every 1 minute

### Alert Thresholds

Set up alerts for:
- Health status changes to "degraded" or "unhealthy"
- Success rate drops below 95%
- Conflict rate exceeds 5%
- Change Stream disconnects
- Reconnect attempts exceed 5

---

## Configuration

Bidirectional sync is configured via environment variables:

```env
# Enable/disable bidirectional sync
BIDIRECTIONAL_SYNC_ENABLED=true

# Change Stream batch size
ATLAS_CHANGE_STREAM_BATCH_SIZE=100

# Excluded collections (comma-separated)
BIDIRECTIONAL_EXCLUDED_COLLECTIONS=sessions,logs

# Conflict resolution strategy
CONFLICT_RESOLUTION_STRATEGY=last-write-wins

# Reconnection settings
CHANGE_STREAM_RECONNECT_INTERVAL=5000
CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS=10
```

See `server/config/BIDIRECTIONAL_SYNC_CONFIG.md` for detailed configuration documentation.

---

## Troubleshooting

### Change Stream Disconnected

**Symptoms:**
- Health status shows "unhealthy"
- `changeStreamStatus` is "disconnected"

**Solutions:**
1. Check Atlas connection
2. Verify Atlas cluster is M10+ (required for Change Streams)
3. Check network connectivity
4. Review error logs for details

### High Conflict Rate

**Symptoms:**
- Conflict rate > 5%
- Many conflicts in specific collections

**Solutions:**
1. Review concurrent modification patterns
2. Consider reducing update frequency
3. Implement optimistic locking if needed
4. Check if multiple devices are modifying same documents

### High Failure Rate

**Symptoms:**
- Success rate < 95%
- Many failed syncs in metrics

**Solutions:**
1. Review error logs for specific failures
2. Check data validation rules
3. Verify network stability
4. Check database permissions

### Frequent Reconnections

**Symptoms:**
- High reconnect attempts
- Change Stream status frequently "reconnecting"

**Solutions:**
1. Check network stability
2. Verify Atlas cluster health
3. Review firewall/proxy settings
4. Consider increasing reconnect interval

---

## Related Documentation

- [Bidirectional Sync Configuration](./BIDIRECTIONAL_SYNC_CONFIG.md)
- [Bidirectional Sync Server Integration](./BIDIRECTIONAL_SYNC_SERVER_INTEGRATION.md)
- [Sync System Overview](../services/sync/README.md)
- [Atlas Change Listener](../services/sync/ATLAS_LISTENER_INTEGRATION.md)

---

## Support

For issues or questions:
1. Check error logs in `server/logs/error.log`
2. Review health check endpoint for specific issues
3. Consult troubleshooting section above
4. Contact system administrator
