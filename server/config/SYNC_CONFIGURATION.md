# Dual MongoDB Sync - Configuration Guide

## Overview

This document provides comprehensive configuration guidance for the Dual MongoDB Sync system in the Bomba application. The sync system enables the application to operate on a local MongoDB instance for optimal performance while automatically synchronizing all data changes to MongoDB Atlas as a cloud backup.

---

## Environment Variables

### Core Configuration

#### `SYNC_ENABLED`
- **Type:** Boolean (string)
- **Default:** `false`
- **Required:** No
- **Description:** Master switch to enable/disable the entire sync system
- **Values:**
  - `true` - Enable synchronization to Atlas
  - `false` - Disable synchronization (local MongoDB only)
- **Example:**
  ```env
  SYNC_ENABLED=true
  ```
- **Notes:**
  - When disabled, the application operates normally on local MongoDB only
  - Can be toggled without code changes
  - Useful for development/testing environments

---

### Database Connections

#### `MONGODB_LOCAL_URI`
- **Type:** String (MongoDB connection URI)
- **Default:** `mongodb://localhost:27017/bomba`
- **Required:** Yes (application won't start without local MongoDB)
- **Description:** Connection string for the local MongoDB instance (primary database)
- **Format:** `mongodb://[username:password@]host[:port]/database[?options]`
- **Example:**
  ```env
  MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba
  ```
- **Notes:**
  - This is the primary database for all operations
  - Must be accessible for application to start
  - Typically runs on localhost for best performance

#### `MONGODB_ATLAS_URI`
- **Type:** String (MongoDB connection URI)
- **Default:** Empty string
- **Required:** Yes (when `SYNC_ENABLED=true`)
- **Description:** Connection string for MongoDB Atlas (backup database)
- **Format:** `mongodb+srv://username:password@cluster.mongodb.net/database?options`
- **Example:**
  ```env
  MONGODB_ATLAS_URI=mongodb+srv://user:pass@cluster0.mongodb.net/bomba?retryWrites=true&w=majority
  ```
- **Notes:**
  - Only used when sync is enabled
  - Application continues if Atlas is unavailable
  - Must include authentication credentials
  - Recommended to use SRV connection string

#### `MONGODB_URI` (Legacy)
- **Type:** String (MongoDB connection URI)
- **Default:** Uses `MONGODB_LOCAL_URI` if not set
- **Required:** No
- **Description:** Legacy support for existing configurations
- **Notes:**
  - Maintained for backward compatibility
  - `MONGODB_LOCAL_URI` takes precedence if both are set

---

### Queue Configuration

#### `SYNC_QUEUE_MAX_SIZE`
- **Type:** Integer
- **Default:** `10000`
- **Required:** No
- **Valid Range:** 100 - 100000
- **Description:** Maximum number of operations that can be queued for synchronization
- **Example:**
  ```env
  SYNC_QUEUE_MAX_SIZE=10000
  ```
- **Tuning Guide:**
  - **Low traffic (< 100 ops/min):** 5000
  - **Medium traffic (100-500 ops/min):** 10000 (default)
  - **High traffic (> 500 ops/min):** 20000+
- **Notes:**
  - When queue reaches max size, oldest operations may be persisted to disk
  - Larger queues use more memory
  - Monitor queue size via `/api/sync/metrics`

#### `SYNC_WORKER_INTERVAL`
- **Type:** Integer (milliseconds)
- **Default:** `100`
- **Required:** No
- **Valid Range:** 10 - 5000
- **Description:** Time interval between processing sync operations
- **Example:**
  ```env
  SYNC_WORKER_INTERVAL=100
  ```
- **Tuning Guide:**
  - **Fast Atlas connection:** 50-100ms
  - **Normal connection:** 100-200ms (default)
  - **Slow/throttled connection:** 500-1000ms
  - **Rate-limited Atlas:** 1000-5000ms
- **Notes:**
  - Lower values = faster sync but more Atlas load
  - Higher values = slower sync but less Atlas load
  - Adjust based on Atlas performance and rate limits

---

### Retry Configuration

#### `SYNC_MAX_RETRIES`
- **Type:** Integer
- **Default:** `5`
- **Required:** No
- **Valid Range:** 1 - 10
- **Description:** Maximum number of retry attempts for failed sync operations
- **Example:**
  ```env
  SYNC_MAX_RETRIES=5
  ```
- **Retry Schedule:**
  - Attempt 1: 1 second delay
  - Attempt 2: 5 seconds delay
  - Attempt 3: 15 seconds delay
  - Attempt 4: 30 seconds delay
  - Attempt 5: 60 seconds delay
- **Notes:**
  - Uses exponential backoff strategy
  - After max retries, operation is logged as failed
  - Higher values increase resilience but delay failure detection

---

### Queue Persistence

#### `SYNC_PERSIST_QUEUE`
- **Type:** Boolean (string)
- **Default:** `false`
- **Required:** No
- **Description:** Enable automatic queue persistence to disk
- **Values:**
  - `true` - Save queue to disk when Atlas is unavailable
  - `false` - Keep queue in memory only
- **Example:**
  ```env
  SYNC_PERSIST_QUEUE=true
  ```
- **Notes:**
  - Recommended for production environments
  - Prevents data loss during application restarts
  - Automatically loads persisted queue on startup

#### `SYNC_QUEUE_PATH`
- **Type:** String (file path)
- **Default:** `./data/sync-queue.json`
- **Required:** No
- **Description:** File path for queue persistence
- **Example:**
  ```env
  SYNC_QUEUE_PATH=./data/sync-queue.json
  ```
- **Notes:**
  - Directory must exist and be writable
  - File is created automatically if it doesn't exist
  - JSON format for easy inspection

---

### Collection Filtering

#### `SYNC_EXCLUDED_COLLECTIONS`
- **Type:** String (comma-separated list)
- **Default:** Empty string (sync all collections)
- **Required:** No
- **Description:** Collections to exclude from synchronization
- **Example:**
  ```env
  SYNC_EXCLUDED_COLLECTIONS=logs,temp,cache,sessions
  ```
- **Common Exclusions:**
  - `logs` - Application logs
  - `sessions` - User sessions (if using connect-mongo)
  - `temp` - Temporary data
  - `cache` - Cached data
- **Notes:**
  - Collection names are case-sensitive
  - No spaces between collection names
  - Excluded collections only exist in local MongoDB

---

### Batch Processing

#### `SYNC_BATCH_SIZE`
- **Type:** Integer
- **Default:** `100`
- **Required:** No
- **Valid Range:** 1 - 1000
- **Description:** Number of documents to process in each batch during full sync
- **Example:**
  ```env
  SYNC_BATCH_SIZE=100
  ```
- **Tuning Guide:**
  - **Small documents (< 1KB):** 200-500
  - **Medium documents (1-10KB):** 100 (default)
  - **Large documents (> 10KB):** 20-50
- **Notes:**
  - Only affects manual full sync operations
  - Larger batches = faster sync but more memory usage
  - Adjust based on document size and available memory

---

### Monitoring Thresholds

#### `SYNC_QUEUE_WARNING_THRESHOLD`
- **Type:** Integer
- **Default:** `5000`
- **Required:** No
- **Description:** Queue size that triggers warning alerts
- **Example:**
  ```env
  SYNC_QUEUE_WARNING_THRESHOLD=5000
  ```
- **Notes:**
  - Should be less than `SYNC_QUEUE_MAX_SIZE`
  - Warnings appear in logs and health checks
  - Recommended: 50% of max queue size

#### `SYNC_LAG_WARNING_THRESHOLD`
- **Type:** Integer (milliseconds)
- **Default:** `60000` (1 minute)
- **Required:** No
- **Description:** Sync lag duration that triggers warning alerts
- **Example:**
  ```env
  SYNC_LAG_WARNING_THRESHOLD=60000
  ```
- **Notes:**
  - Sync lag = time since oldest queued operation
  - Lower values = more sensitive warnings
  - Adjust based on business requirements

---

## Configuration Examples

### Development Environment
```env
# Minimal sync for development
SYNC_ENABLED=false
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba-dev
```

### Testing Environment
```env
# Sync enabled with relaxed settings
SYNC_ENABLED=true
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba-test
MONGODB_ATLAS_URI=mongodb+srv://test:pass@test-cluster.mongodb.net/bomba-test
SYNC_QUEUE_MAX_SIZE=5000
SYNC_WORKER_INTERVAL=200
SYNC_MAX_RETRIES=3
SYNC_PERSIST_QUEUE=false
```

### Production Environment
```env
# Full sync with optimal settings
SYNC_ENABLED=true
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba
MONGODB_ATLAS_URI=mongodb+srv://prod:pass@prod-cluster.mongodb.net/bomba?retryWrites=true&w=majority
SYNC_QUEUE_MAX_SIZE=10000
SYNC_WORKER_INTERVAL=100
SYNC_MAX_RETRIES=5
SYNC_PERSIST_QUEUE=true
SYNC_QUEUE_PATH=./data/sync-queue.json
SYNC_EXCLUDED_COLLECTIONS=logs,sessions
SYNC_BATCH_SIZE=100
SYNC_QUEUE_WARNING_THRESHOLD=5000
SYNC_LAG_WARNING_THRESHOLD=60000
```

### High-Traffic Environment
```env
# Optimized for high volume
SYNC_ENABLED=true
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba
MONGODB_ATLAS_URI=mongodb+srv://prod:pass@prod-cluster.mongodb.net/bomba
SYNC_QUEUE_MAX_SIZE=20000
SYNC_WORKER_INTERVAL=50
SYNC_MAX_RETRIES=5
SYNC_PERSIST_QUEUE=true
SYNC_BATCH_SIZE=200
SYNC_QUEUE_WARNING_THRESHOLD=10000
```

---

## Troubleshooting Guide

### Issue: Application Won't Start

**Symptoms:**
```
❌ Local MongoDB connection failed!
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Diagnosis:**
1. Check if MongoDB is running:
   ```bash
   # Windows
   tasklist | findstr mongod
   
   # Linux/Mac
   ps aux | grep mongod
   ```

2. Check MongoDB port:
   ```bash
   netstat -an | findstr 27017
   ```

**Solutions:**
1. Start MongoDB:
   ```bash
   # Direct start
   mongod
   
   # Or with Docker
   docker start mongodb
   ```

2. Verify connection string:
   ```env
   MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba
   ```

3. Check firewall settings (port 27017 must be open)

4. Verify MongoDB installation:
   ```bash
   mongod --version
   ```

---

### Issue: Sync Not Working

**Symptoms:**
```
⚠️ Atlas unavailable, operations queued
```

**Diagnosis:**
1. Check sync status:
   ```bash
   curl http://localhost:5000/api/sync/health
   ```

2. Verify configuration:
   ```bash
   # Check if sync is enabled
   grep SYNC_ENABLED server/.env
   
   # Check Atlas URI
   grep MONGODB_ATLAS_URI server/.env
   ```

**Solutions:**

1. **Sync is disabled:**
   ```env
   SYNC_ENABLED=true
   ```

2. **Invalid Atlas URI:**
   - Verify username and password
   - Check cluster name
   - Ensure database name is correct
   - Test connection with MongoDB Compass

3. **Network/Firewall issues:**
   - Check internet connection
   - Verify Atlas Network Access (IP whitelist)
   - Test DNS resolution:
     ```bash
     nslookup cluster0.mongodb.net
     ```

4. **Authentication failure:**
   - Verify credentials in Atlas
   - Check user permissions (readWrite on database)
   - Ensure user is not expired

---

### Issue: Queue Growing Large

**Symptoms:**
```
⚠️ Sync queue size is large: 5000/10000
⚠️ Sync lag: 120000ms
```

**Diagnosis:**
1. Check queue status:
   ```bash
   curl -H "Authorization: Bearer TOKEN" \
        http://localhost:5000/api/sync/queue
   ```

2. Check worker status:
   ```bash
   curl -H "Authorization: Bearer TOKEN" \
        http://localhost:5000/api/sync/worker
   ```

3. Review logs for errors:
   ```bash
   tail -f server/logs/app.log | grep sync
   ```

**Solutions:**

1. **Atlas connection issues:**
   - Check Atlas status: https://status.mongodb.com/
   - Verify network connectivity
   - Check Atlas performance metrics

2. **Worker not running:**
   ```bash
   # Restart worker via API
   curl -X POST \
        -H "Authorization: Bearer TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"action":"start"}' \
        http://localhost:5000/api/sync/worker/control
   ```

3. **Slow Atlas performance:**
   - Increase worker interval:
     ```env
     SYNC_WORKER_INTERVAL=200
     ```
   - Check Atlas cluster tier (upgrade if needed)
   - Review Atlas performance metrics

4. **High operation volume:**
   - Increase queue size:
     ```env
     SYNC_QUEUE_MAX_SIZE=20000
     ```
   - Enable queue persistence:
     ```env
     SYNC_PERSIST_QUEUE=true
     ```

---

### Issue: High Failure Rate

**Symptoms:**
```
⚠️ High sync failure rate: 15%
❌ Sync operation failed after 5 retries
```

**Diagnosis:**
1. Check metrics:
   ```bash
   curl -H "Authorization: Bearer TOKEN" \
        http://localhost:5000/api/sync/metrics
   ```

2. Review detailed report:
   ```bash
   curl -H "Authorization: Bearer TOKEN" \
        http://localhost:5000/api/sync/report
   ```

3. Check logs for specific errors:
   ```bash
   grep "Sync operation failed" server/logs/error.log
   ```

**Solutions:**

1. **Schema validation errors:**
   - Review error messages in logs
   - Check for schema mismatches between local and Atlas
   - Verify data integrity

2. **Network timeouts:**
   - Increase retry attempts:
     ```env
     SYNC_MAX_RETRIES=7
     ```
   - Check network stability
   - Consider using a VPN if network is unreliable

3. **Atlas rate limiting:**
   - Increase worker interval:
     ```env
     SYNC_WORKER_INTERVAL=500
     ```
   - Upgrade Atlas cluster tier
   - Review Atlas rate limit documentation

4. **Data size issues:**
   - Check for documents exceeding 16MB limit
   - Review Atlas storage capacity
   - Consider excluding large collections

---

### Issue: Queue Persistence Failure

**Symptoms:**
```
❌ Failed to persist sync queue to disk
Error: ENOENT: no such file or directory
```

**Diagnosis:**
1. Check directory exists:
   ```bash
   # Windows
   dir data
   
   # Linux/Mac
   ls -la data
   ```

2. Check write permissions:
   ```bash
   # Linux/Mac
   ls -ld data
   ```

**Solutions:**

1. **Directory doesn't exist:**
   ```bash
   # Windows
   mkdir data
   
   # Linux/Mac
   mkdir -p data
   ```

2. **Permission issues:**
   ```bash
   # Linux/Mac
   chmod 755 data
   ```

3. **Disk space full:**
   ```bash
   # Check disk space
   df -h
   ```

4. **Change persistence path:**
   ```env
   SYNC_QUEUE_PATH=/tmp/sync-queue.json
   ```

---

### Issue: Memory Usage High

**Symptoms:**
- Application using excessive memory
- Slow performance
- Out of memory errors

**Diagnosis:**
1. Check queue size:
   ```bash
   curl http://localhost:5000/api/sync/health
   ```

2. Monitor memory usage:
   ```bash
   # Windows
   tasklist /FI "IMAGENAME eq node.exe"
   
   # Linux/Mac
   ps aux | grep node
   ```

**Solutions:**

1. **Large queue in memory:**
   - Enable queue persistence:
     ```env
     SYNC_PERSIST_QUEUE=true
     ```
   - Reduce queue size:
     ```env
     SYNC_QUEUE_MAX_SIZE=5000
     ```

2. **Large documents:**
   - Reduce batch size:
     ```env
     SYNC_BATCH_SIZE=50
     ```
   - Exclude large collections:
     ```env
     SYNC_EXCLUDED_COLLECTIONS=uploads,attachments
     ```

3. **Memory leak:**
   - Restart application
   - Update to latest version
   - Report issue with logs

---

### Issue: Sync Lag Increasing

**Symptoms:**
```
⚠️ Sync lag: 300000ms (5 minutes)
```

**Diagnosis:**
1. Check worker performance:
   ```bash
   curl -H "Authorization: Bearer TOKEN" \
        http://localhost:5000/api/sync/worker
   ```

2. Check Atlas performance:
   - Review Atlas metrics dashboard
   - Check cluster CPU/memory usage
   - Review slow query logs

**Solutions:**

1. **Worker too slow:**
   - Decrease worker interval:
     ```env
     SYNC_WORKER_INTERVAL=50
     ```

2. **Atlas performance issues:**
   - Upgrade Atlas cluster tier
   - Add indexes to frequently queried fields
   - Review and optimize slow queries

3. **High operation volume:**
   - Increase queue size temporarily
   - Consider scaling Atlas cluster
   - Review application for unnecessary writes

---

## Configuration Validation

The sync system automatically validates configuration on startup. Invalid configurations will:
1. Log detailed error messages
2. Disable sync automatically
3. Allow application to continue on local MongoDB only

### Validation Rules

- `SYNC_ENABLED=true` requires valid `MONGODB_ATLAS_URI`
- `SYNC_QUEUE_MAX_SIZE` must be ≥ 100
- `SYNC_WORKER_INTERVAL` must be ≥ 10ms
- `SYNC_MAX_RETRIES` must be between 1 and 10
- `SYNC_BATCH_SIZE` must be between 1 and 1000

### Testing Configuration

```javascript
// In Node.js REPL or script
import { validateSyncConfig } from './server/config/syncConfig.js';

const validation = validateSyncConfig();
console.log(validation);
// { isValid: true, errors: [] }
```

---

## Best Practices

### Security
1. **Never commit `.env` files** to version control
2. **Use strong passwords** for Atlas credentials
3. **Enable IP whitelisting** in Atlas Network Access
4. **Rotate credentials** regularly
5. **Use environment-specific** Atlas clusters

### Performance
1. **Monitor queue size** regularly via `/api/sync/metrics`
2. **Adjust worker interval** based on Atlas performance
3. **Exclude unnecessary collections** from sync
4. **Use appropriate batch sizes** for full sync
5. **Enable queue persistence** in production

### Reliability
1. **Enable queue persistence** to prevent data loss
2. **Set appropriate retry limits** for your network
3. **Monitor sync lag** and adjust thresholds
4. **Test failover scenarios** regularly
5. **Keep local and Atlas schemas** in sync

### Monitoring
1. **Set up health check alerts** for `/api/sync/health`
2. **Monitor queue size trends** over time
3. **Track failure rates** and investigate spikes
4. **Review sync lag** during peak hours
5. **Set up log aggregation** for error tracking

---

## Additional Resources

- **Full Documentation:** `DUAL_MONGODB_SYNC_COMPLETE.md`
- **Quick Start Guide:** `QUICK_START_SYNC.md`
- **Developer Guide:** `server/services/sync/README.md`
- **API Documentation:** `server/routes/syncRoutes.js`
- **Specifications:** `.kiro/specs/dual-mongodb-sync/`

---

## Support

For issues not covered in this guide:
1. Check application logs in `server/logs/`
2. Review sync system logs with `syncMonitor.logStatus()`
3. Test configuration with `validateSyncConfig()`
4. Consult MongoDB Atlas documentation
5. Review Mongoose documentation for model-specific issues
