# Bidirectional Sync Migration Guide

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Migration Steps](#migration-steps)
4. [Testing Procedures](#testing-procedures)
5. [Rollback Procedures](#rollback-procedures)
6. [Monitoring Recommendations](#monitoring-recommendations)
7. [Post-Migration Checklist](#post-migration-checklist)

---

## Overview

This guide walks you through migrating from one-way sync (Local→Atlas) to bidirectional sync (Local↔Atlas). The migration is designed to be safe, reversible, and minimally disruptive to operations.

### Migration Timeline

**Estimated Duration**: 2-4 hours (depending on data volume and testing thoroughness)

**Phases**:
1. **Preparation** (30 minutes): Backup, verification, configuration
2. **Development Testing** (1-2 hours): Test in development environment
3. **Production Deployment** (30 minutes): Deploy with monitoring
4. **Validation** (30 minutes): Verify bidirectional sync working
5. **Monitoring** (ongoing): Watch for issues

### Migration Strategy

We use a **phased rollout** approach:
- Deploy code with bidirectional sync **disabled**
- Enable for non-critical collections first
- Gradually enable for all collections
- Monitor at each phase
- Rollback capability at every step

---

## Prerequisites

### System Requirements

✅ **MongoDB Atlas**:
- Cluster tier: M10 or higher (required for Change Streams)
- MongoDB version: 4.0 or higher
- Replica set configured
- Network access configured for all devices

✅ **Local MongoDB**:
- MongoDB version: 4.0 or higher
- Replica set configured (if using transactions)
- Sufficient disk space for metadata

✅ **Application**:
- Node.js 18+
- All dependencies up to date
- Existing one-way sync working correctly

✅ **Network**:
- Stable internet connection
- Firewall rules allow Atlas connections
- Low latency to Atlas (<100ms recommended)

### Pre-Migration Checklist

```bash
# 1. Verify Atlas cluster tier
# Check in MongoDB Atlas dashboard - must be M10+

# 2. Test Atlas connection
node server/scripts/testAtlasConnection.js

# 3. Verify current sync is working
node server/scripts/testSyncBasicOperations.js

# 4. Check disk space (need ~10% extra for metadata)
df -h

# 5. Verify all dependencies installed
npm install
cd server && npm install

# 6. Create backup
node server/scripts/backupBeforeMigration.js
```

---

## Migration Steps

### Phase 1: Preparation (Development Environment)

#### Step 1.1: Create Backup

**Critical**: Always backup before migration!

```bash
# Backup Local MongoDB
mongodump --uri="mongodb://localhost:27017/bomba" --out=./backups/pre-bidirectional-$(date +%Y%m%d)

# Backup Atlas (optional but recommended)
# Use MongoDB Atlas backup feature or:
mongodump --uri="YOUR_ATLAS_URI" --out=./backups/atlas-pre-bidirectional-$(date +%Y%m%d)

# Verify backups
ls -lh ./backups/
```

#### Step 1.2: Update Environment Configuration

Add new environment variables to `server/.env`:

```env
# Bidirectional Sync Configuration
BIDIRECTIONAL_SYNC_ENABLED=false  # Start disabled!

# Change Stream Settings
ATLAS_CHANGE_STREAM_BATCH_SIZE=100

# Excluded Collections (device-specific data)
BIDIRECTIONAL_EXCLUDED_COLLECTIONS=sessions,logs,notifications,_sync_metadata

# Conflict Resolution
CONFLICT_RESOLUTION_STRATEGY=last-write-wins

# Origin Tracking
ORIGIN_TRACKING_CLEANUP_INTERVAL=60000

# Reconnection Settings
CHANGE_STREAM_RECONNECT_INTERVAL=5000
CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS=10
```

#### Step 1.3: Verify Configuration

```bash
# Verify configuration loads correctly
node server/scripts/verifyBidirectionalConfig.js

# Expected output:
# ✓ Configuration loaded successfully
# ✓ Bidirectional sync: disabled (as expected)
# ✓ Excluded collections: sessions, logs, notifications, _sync_metadata
# ✓ Conflict resolution: last-write-wins
```

#### Step 1.4: Deploy Code (Sync Disabled)

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm run install:all

# Build application
npm run build:all

# Restart application (bidirectional sync still disabled)
pm2 restart bomba

# Verify application started successfully
pm2 logs bomba --lines 50
```

**Verification**:
```bash
# Check health endpoint
curl http://localhost:5000/api/sync/bidirectional/health

# Expected response (sync disabled):
{
  "enabled": false,
  "message": "Bidirectional sync is disabled"
}
```

### Phase 2: Development Testing

#### Step 2.1: Enable Bidirectional Sync in Development

```bash
# Update .env
BIDIRECTIONAL_SYNC_ENABLED=true

# Restart application
pm2 restart bomba

# Verify Change Stream started
pm2 logs bomba | grep "Change Stream"
# Should see: "Atlas Change Stream started successfully"
```

#### Step 2.2: Test Basic Replication

**Test Atlas → Local**:

```bash
# Run integration test
node server/scripts/testBidirectionalSyncIntegration.js

# Expected output:
# ✓ Atlas → Local: Document created
# ✓ Atlas → Local: Document updated
# ✓ Atlas → Local: Document deleted
# ✓ All tests passed
```

**Test Local → Atlas** (existing functionality):

```bash
# Run existing sync test
node server/scripts/testSyncBasicOperations.js

# Expected output:
# ✓ Local → Atlas: Document created
# ✓ Local → Atlas: Document updated
# ✓ Local → Atlas: Document deleted
# ✓ All tests passed
```

#### Step 2.3: Test Loop Prevention

```bash
# Verify origin tracking prevents loops
node server/scripts/verifyOriginTracking.js

# Expected output:
# ✓ Local change marked correctly
# ✓ Atlas change marked correctly
# ✓ Loop prevention working
# ✓ No sync loops detected
```

#### Step 2.4: Test Conflict Resolution

```bash
# Simulate conflict scenario
node server/scripts/testConflictResolution.js

# Expected output:
# ✓ Conflict detected
# ✓ Last Write Wins applied
# ✓ Both databases consistent
# ✓ Conflict logged in metrics
```

#### Step 2.5: Test Excluded Collections

```bash
# Verify excluded collections don't sync from Atlas
node server/scripts/testExcludedCollections.js

# Expected output:
# ✓ Sessions collection excluded from Atlas→Local
# ✓ Logs collection excluded from Atlas→Local
# ✓ Local→Atlas sync still works for excluded collections
```

#### Step 2.6: Test Resume Token Functionality

```bash
# Test Change Stream resume capability
node server/scripts/testResumeTokenStorageSimple.js

# Expected output:
# ✓ Resume token saved
# ✓ Resume token loaded
# ✓ Change Stream resumed from correct position
```

#### Step 2.7: Test Error Handling

```bash
# Test error scenarios
node server/scripts/testErrorHandling.js

# Expected output:
# ✓ Connection loss handled
# ✓ Reconnection successful
# ✓ Invalid change rejected
# ✓ Retry logic working
```

#### Step 2.8: Multi-Device Simulation

**Setup**: Run two instances of the application

**Terminal 1** (Device A):
```bash
# Start first instance
PORT=5000 MONGODB_URI=mongodb://localhost:27017/bomba npm run server:dev
```

**Terminal 2** (Device B):
```bash
# Start second instance (different port, same databases)
PORT=5001 MONGODB_URI=mongodb://localhost:27017/bomba npm run server:dev
```

**Terminal 3** (Testing):
```bash
# Create document on Device A
curl -X POST http://localhost:5000/api/menu \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Item","price":25}'

# Wait 2-3 seconds

# Verify on Device B
curl http://localhost:5001/api/menu | grep "Test Item"
# Should find the item

# Update on Device B
curl -X PUT http://localhost:5001/api/menu/ITEM_ID \
  -H "Content-Type: application/json" \
  -d '{"price":30}'

# Wait 2-3 seconds

# Verify on Device A
curl http://localhost:5000/api/menu/ITEM_ID
# Should show price: 30
```

### Phase 3: Production Deployment

#### Step 3.1: Pre-Deployment Verification

```bash
# 1. Verify all tests pass
npm test

# 2. Verify development testing complete
# Review test results from Phase 2

# 3. Create production backup
mongodump --uri="YOUR_PRODUCTION_MONGODB_URI" --out=./backups/prod-pre-bidirectional-$(date +%Y%m%d)

# 4. Verify backup
ls -lh ./backups/prod-pre-bidirectional-*
```

#### Step 3.2: Deploy with Sync Disabled

```bash
# 1. Deploy code to production
git push production main

# 2. Update production .env
# Set BIDIRECTIONAL_SYNC_ENABLED=false

# 3. Restart application
pm2 restart bomba

# 4. Verify application health
curl https://your-domain.com/api/health

# 5. Verify one-way sync still working
# Monitor logs for successful sync operations
pm2 logs bomba | grep "Sync operation"
```

#### Step 3.3: Enable Bidirectional Sync (Gradual)

**Option A: Enable for Non-Critical Collections First**

```env
# Update .env
BIDIRECTIONAL_SYNC_ENABLED=true
BIDIRECTIONAL_EXCLUDED_COLLECTIONS=sessions,logs,notifications,bills,orders,menuitems

# This enables bidirectional sync only for:
# - users, settings, tables, etc. (low-risk collections)
```

```bash
# Restart
pm2 restart bomba

# Monitor for 30 minutes
pm2 logs bomba --lines 100

# Check metrics
curl https://your-domain.com/api/sync/bidirectional/metrics
```

**Option B: Enable for All Collections**

After monitoring non-critical collections:

```env
# Update .env
BIDIRECTIONAL_EXCLUDED_COLLECTIONS=sessions,logs,notifications,_sync_metadata
```

```bash
# Restart
pm2 restart bomba

# Monitor closely
pm2 logs bomba --lines 100
```

#### Step 3.4: Monitor Initial Sync

```bash
# Watch logs in real-time
pm2 logs bomba

# Check for:
# ✓ "Atlas Change Stream started successfully"
# ✓ "Change applied successfully" messages
# ✗ No error messages
# ✗ No "Sync loop detected" warnings

# Monitor metrics
watch -n 5 'curl -s https://your-domain.com/api/sync/bidirectional/metrics | jq'
```

---

## Testing Procedures

### Functional Testing

#### Test 1: Create Operation

```bash
# Create document locally
curl -X POST https://your-domain.com/api/menu \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Item","price":25,"category":"beverages"}'

# Wait 5 seconds

# Verify in Atlas (using MongoDB Compass or Atlas UI)
# Document should appear with origin metadata

# Verify on another device
# Document should appear automatically
```

#### Test 2: Update Operation

```bash
# Update document locally
curl -X PUT https://your-domain.com/api/menu/ITEM_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price":30}'

# Wait 5 seconds

# Verify in Atlas
# Price should be updated

# Verify on another device
# Price should be updated automatically
```

#### Test 3: Delete Operation

```bash
# Delete document locally
curl -X DELETE https://your-domain.com/api/menu/ITEM_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# Wait 5 seconds

# Verify in Atlas
# Document should be deleted

# Verify on another device
# Document should be deleted automatically
```

#### Test 4: Conflict Scenario

```bash
# Disconnect Device A from network
# Update document on Device A (queued)
# Update same document on Device B (syncs to Atlas)
# Reconnect Device A

# Wait 10 seconds

# Verify both devices have same data (Last Write Wins)
# Check conflict metrics
curl https://your-domain.com/api/sync/bidirectional/conflicts
```

### Performance Testing

```bash
# Test sync performance
node server/scripts/testSyncPerformance.js

# Metrics to check:
# - Sync latency: <5 seconds
# - Processing time: <200ms per change
# - Queue size: <100 pending operations
# - Error rate: <1%
```

### Load Testing

```bash
# Simulate high volume
node server/scripts/testHighVolumeSyncLoad.js

# Monitor:
# - CPU usage
# - Memory usage
# - Sync lag
# - Error rate
```

---

## Rollback Procedures

### Emergency Rollback (Immediate)

If critical issues occur, disable bidirectional sync immediately:

```bash
# 1. Disable bidirectional sync
# Update .env:
BIDIRECTIONAL_SYNC_ENABLED=false

# 2. Restart application
pm2 restart bomba

# 3. Verify sync disabled
curl https://your-domain.com/api/sync/bidirectional/health
# Should show: "enabled": false

# 4. Verify one-way sync still working
# Monitor logs for Local→Atlas sync operations
pm2 logs bomba | grep "Sync operation"
```

**Result**: System reverts to one-way sync (Local→Atlas). No data loss.

### Partial Rollback (Exclude Collections)

If issues with specific collections:

```bash
# Add problematic collections to exclusion list
# Update .env:
BIDIRECTIONAL_EXCLUDED_COLLECTIONS=sessions,logs,notifications,problematic_collection

# Restart
pm2 restart bomba

# Verify
curl https://your-domain.com/api/sync/bidirectional/health
```

### Full Rollback (Restore from Backup)

If data corruption occurs:

```bash
# 1. Stop application
pm2 stop bomba

# 2. Restore Local MongoDB from backup
mongorestore --uri="mongodb://localhost:27017" --drop ./backups/pre-bidirectional-YYYYMMDD/

# 3. Restore Atlas (if needed)
mongorestore --uri="YOUR_ATLAS_URI" --drop ./backups/atlas-pre-bidirectional-YYYYMMDD/

# 4. Disable bidirectional sync
# Update .env:
BIDIRECTIONAL_SYNC_ENABLED=false

# 5. Restart application
pm2 restart bomba

# 6. Verify data integrity
node server/scripts/verifyDataConsistency.js
```

### Rollback Decision Matrix

| Issue | Severity | Action | Rollback Type |
|-------|----------|--------|---------------|
| Sync loops detected | High | Immediate | Emergency |
| High conflict rate | Medium | Investigate | Partial (if needed) |
| Data corruption | Critical | Immediate | Full restore |
| Performance degradation | Medium | Monitor | Partial (exclude collections) |
| Change Stream errors | High | Investigate | Emergency (if persistent) |
| Network issues | Low | Wait | None (auto-recovery) |

---

## Monitoring Recommendations

### Key Metrics to Monitor

#### 1. Sync Health

```bash
# Check every 5 minutes
*/5 * * * * curl -s https://your-domain.com/api/sync/bidirectional/health | jq '.health' | grep -q 'healthy' || echo "ALERT: Sync unhealthy"
```

**Thresholds**:
- Health status: Must be "healthy"
- Change Stream: Must be "connected"
- Queue size: <100 operations

#### 2. Sync Lag

```bash
# Monitor sync lag
curl https://your-domain.com/api/sync/bidirectional/metrics | jq '.atlasToLocal.avgProcessTime'
```

**Thresholds**:
- Normal: <200ms
- Warning: 200-500ms
- Critical: >500ms

#### 3. Conflict Rate

```bash
# Check conflicts per hour
curl https://your-domain.com/api/sync/bidirectional/conflicts | jq '.totalConflicts'
```

**Thresholds**:
- Normal: <5 per hour
- Warning: 5-20 per hour
- Critical: >20 per hour

#### 4. Error Rate

```bash
# Check error rate
curl https://your-domain.com/api/sync/bidirectional/metrics | jq '.atlasToLocal.failed'
```

**Thresholds**:
- Normal: <1% of total operations
- Warning: 1-5%
- Critical: >5%

### Monitoring Dashboard

Create a simple monitoring dashboard:

```javascript
// server/routes/monitoring.js
router.get('/monitoring/dashboard', async (req, res) => {
  const health = await syncController.getBidirectionalHealth();
  const metrics = await syncController.getBidirectionalMetrics();
  const conflicts = await syncController.getConflicts();
  
  res.json({
    timestamp: new Date(),
    health: health.health,
    syncLag: metrics.atlasToLocal.avgProcessTime,
    conflictRate: conflicts.totalConflicts,
    errorRate: (metrics.atlasToLocal.failed / metrics.atlasToLocal.totalProcessed) * 100,
    queueSize: health.syncWorker.queueSize
  });
});
```

### Alert Configuration

**Recommended Alerts**:

```bash
# 1. Sync unhealthy for >5 minutes
# 2. Sync lag >500ms for >10 minutes
# 3. Conflict rate >20 per hour
# 4. Error rate >5%
# 5. Change Stream disconnected >5 minutes
# 6. Queue size >100 for >10 minutes
```

**Alert Script** (`server/scripts/checkSyncHealth.sh`):

```bash
#!/bin/bash

HEALTH=$(curl -s http://localhost:5000/api/sync/bidirectional/health)
STATUS=$(echo $HEALTH | jq -r '.health')

if [ "$STATUS" != "healthy" ]; then
  echo "ALERT: Bidirectional sync unhealthy"
  echo $HEALTH | jq
  # Send notification (email, Slack, etc.)
  # curl -X POST YOUR_WEBHOOK_URL -d "Sync unhealthy: $HEALTH"
fi
```

Add to crontab:
```bash
*/5 * * * * /path/to/checkSyncHealth.sh
```

### Log Monitoring

**Important Log Patterns**:

```bash
# Success patterns (should see regularly)
grep "Atlas change applied successfully" server/logs/app.log

# Warning patterns (investigate if frequent)
grep "Conflict detected" server/logs/app.log
grep "Retry attempt" server/logs/app.log

# Error patterns (alert immediately)
grep "ERROR" server/logs/error.log
grep "Sync loop detected" server/logs/app.log
grep "Change Stream connection failed" server/logs/error.log
```

### Performance Monitoring

```bash
# Monitor system resources
pm2 monit

# Check MongoDB performance
mongostat --uri="mongodb://localhost:27017" 1

# Check Atlas performance
# Use MongoDB Atlas Performance Advisor
```

---

## Post-Migration Checklist

### Immediate (First Hour)

- [ ] Bidirectional sync enabled successfully
- [ ] Change Stream connected to Atlas
- [ ] No error messages in logs
- [ ] Health endpoint returns "healthy"
- [ ] Test document syncs Atlas→Local
- [ ] Test document syncs Local→Atlas
- [ ] No sync loops detected
- [ ] Metrics tracking both directions

### Short-term (First Day)

- [ ] Monitor sync lag (<200ms average)
- [ ] Check conflict rate (<5 per hour)
- [ ] Verify error rate (<1%)
- [ ] Test from multiple devices
- [ ] Verify excluded collections working
- [ ] Check resume token persistence
- [ ] Monitor system resources (CPU, memory)
- [ ] Review all logs for warnings

### Medium-term (First Week)

- [ ] Analyze conflict patterns
- [ ] Review performance metrics
- [ ] Optimize excluded collections list
- [ ] Test network interruption recovery
- [ ] Verify backup procedures
- [ ] Document any issues encountered
- [ ] Train team on new features
- [ ] Update runbooks if needed

### Long-term (First Month)

- [ ] Review overall sync performance
- [ ] Analyze conflict resolution effectiveness
- [ ] Optimize configuration if needed
- [ ] Plan for scaling (if needed)
- [ ] Document lessons learned
- [ ] Update monitoring thresholds
- [ ] Consider additional features

---

## Common Migration Issues

### Issue 1: Change Stream Won't Start

**Symptoms**: Error "Change Stream connection failed"

**Causes**:
- Atlas cluster not M10+ tier
- Network connectivity issues
- Invalid credentials

**Solution**:
```bash
# Verify Atlas tier in dashboard
# Test connection
node server/scripts/testAtlasConnection.js

# Check credentials in .env
# Verify network access in Atlas dashboard
```

### Issue 2: High Initial Sync Load

**Symptoms**: High CPU/memory usage after enabling

**Causes**:
- Large backlog of changes
- Many documents to process

**Solution**:
```bash
# Temporarily increase batch size
ATLAS_CHANGE_STREAM_BATCH_SIZE=50

# Monitor and adjust
# Consider enabling during off-peak hours
```

### Issue 3: Conflicts on Every Change

**Symptoms**: Every change creates a conflict

**Causes**:
- Clock synchronization issues
- Origin tracking not working

**Solution**:
```bash
# Synchronize system clocks (NTP)
# Verify origin tracking
node server/scripts/verifyOriginTracking.js

# Check instance IDs are unique
pm2 logs bomba | grep "Instance ID"
```

### Issue 4: Resume Token Errors

**Symptoms**: "Resume token expired" errors

**Causes**:
- Application down too long
- Token storage issues

**Solution**:
```bash
# Clear resume token (forces full resync)
mongo bomba --eval 'db._sync_metadata.deleteOne({_id: "atlas-resume-token"})'

# Restart application
pm2 restart bomba

# Monitor initial sync
pm2 logs bomba
```

---

## Success Criteria

Migration is successful when:

✅ **Functionality**:
- Changes sync in both directions
- Conflicts resolve automatically
- No sync loops occur
- Excluded collections work correctly

✅ **Performance**:
- Sync lag <5 seconds
- Processing time <200ms
- Error rate <1%
- No performance degradation

✅ **Reliability**:
- Change Stream stays connected
- Resume tokens work correctly
- Reconnection works after interruptions
- No data loss or corruption

✅ **Monitoring**:
- All metrics tracking correctly
- Alerts configured and working
- Logs show expected patterns
- Dashboard shows healthy status

---

## Support and Troubleshooting

### Getting Help

1. **Check Documentation**:
   - [Bidirectional Sync Documentation](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md)
   - [Troubleshooting Guide](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#troubleshooting)

2. **Run Diagnostic Scripts**:
   ```bash
   node server/scripts/testBidirectionalSyncIntegration.js
   node server/scripts/verifyOriginTracking.js
   ```

3. **Review Logs**:
   ```bash
   pm2 logs bomba --lines 200
   tail -f server/logs/error.log
   ```

4. **Check Metrics**:
   ```bash
   curl http://localhost:5000/api/sync/bidirectional/health
   curl http://localhost:5000/api/sync/bidirectional/metrics
   ```

### Emergency Contacts

- **System Administrator**: [Contact Info]
- **Database Administrator**: [Contact Info]
- **Development Team**: [Contact Info]

### Escalation Path

1. Check troubleshooting guide
2. Run diagnostic scripts
3. Review logs and metrics
4. Contact system administrator
5. If critical: Execute emergency rollback
6. Contact development team

---

## Appendix

### A. Environment Variables Reference

```env
# Required
BIDIRECTIONAL_SYNC_ENABLED=true|false
MONGODB_URI=mongodb://localhost:27017/bomba
MONGODB_ATLAS_URI=mongodb+srv://...

# Optional (with defaults)
ATLAS_CHANGE_STREAM_BATCH_SIZE=100
BIDIRECTIONAL_EXCLUDED_COLLECTIONS=sessions,logs,notifications,_sync_metadata
CONFLICT_RESOLUTION_STRATEGY=last-write-wins
ORIGIN_TRACKING_CLEANUP_INTERVAL=60000
CHANGE_STREAM_RECONNECT_INTERVAL=5000
CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS=10
```

### B. Useful Commands

```bash
# Health check
curl http://localhost:5000/api/sync/bidirectional/health

# Metrics
curl http://localhost:5000/api/sync/bidirectional/metrics

# Conflicts
curl http://localhost:5000/api/sync/bidirectional/conflicts

# Enable/disable sync
curl -X POST http://localhost:5000/api/sync/bidirectional/toggle \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}'

# View logs
pm2 logs bomba
tail -f server/logs/app.log

# Restart
pm2 restart bomba

# Monitor
pm2 monit
```

### C. Testing Scripts

```bash
# Integration test
node server/scripts/testBidirectionalSyncIntegration.js

# Atlas listener test
node server/scripts/testAtlasListenerIntegration.js

# Origin tracking verification
node server/scripts/verifyOriginTracking.js

# Excluded collections test
node server/scripts/testExcludedCollections.js

# Resume token test
node server/scripts/testResumeTokenStorageSimple.js

# Error handling test
node server/scripts/testErrorHandling.js

# Performance test
node server/scripts/testSyncPerformance.js
```

### D. Migration Timeline Template

| Phase | Duration | Tasks | Success Criteria |
|-------|----------|-------|------------------|
| Preparation | 30 min | Backup, config, deploy | Code deployed, sync disabled |
| Dev Testing | 1-2 hrs | All tests pass | All tests green |
| Prod Deploy | 30 min | Enable sync, monitor | Sync enabled, no errors |
| Validation | 30 min | Functional tests | All tests pass |
| Monitoring | Ongoing | Watch metrics | Metrics healthy |

### E. Rollback Decision Tree

```
Issue Detected
    │
    ├─ Data Corruption? ──YES──> Full Rollback (restore backup)
    │
    ├─ Sync Loops? ──YES──> Emergency Rollback (disable sync)
    │
    ├─ High Conflicts? ──YES──> Investigate
    │                              │
    │                              ├─ Clock sync issue? ──> Fix clocks
    │                              └─ Workflow issue? ──> Adjust workflows
    │
    ├─ Performance Issues? ──YES──> Partial Rollback (exclude collections)
    │
    └─ Network Issues? ──YES──> Wait (auto-recovery)
```

---

## Conclusion

This migration guide provides a comprehensive, step-by-step process for safely migrating to bidirectional sync. Follow the phases carefully, test thoroughly, and monitor closely. The phased approach ensures you can rollback at any point if issues arise.

**Remember**:
- Always backup before migration
- Test in development first
- Enable gradually in production
- Monitor continuously
- Have rollback plan ready

Good luck with your migration! 🚀
