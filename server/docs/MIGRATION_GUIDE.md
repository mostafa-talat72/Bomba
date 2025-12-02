# Dual MongoDB Sync - Migration Guide

## Overview

This guide provides step-by-step instructions for migrating the Bomba system to use the dual MongoDB architecture. The migration is designed to be safe, reversible, and performed with minimal downtime.

## Migration Philosophy

The dual MongoDB sync system is designed with safety as the top priority:
- **Local MongoDB remains primary**: All operations continue on local database
- **Zero downtime**: Application continues running during migration
- **Reversible**: Can be disabled at any time without data loss
- **Gradual rollout**: Enable sync incrementally to minimize risk

## Prerequisites

Before starting the migration, ensure you have:

1. **Local MongoDB installed and running**
   - Version 4.4 or higher
   - Running on localhost:27017 (or configured port)
   - Sufficient disk space for current data + growth

2. **MongoDB Atlas account and cluster**
   - Cluster created and accessible
   - Connection string available
   - Network access configured (IP whitelist)
   - Database user created with read/write permissions

3. **Backup of current data**
   - Full MongoDB dump of local database
   - Stored in secure location
   - Verified backup can be restored

4. **System requirements**
   - Node.js 18+ installed
   - PM2 or process manager configured
   - Sufficient disk space for sync queue persistence

## Migration Phases

The migration is divided into three phases, each with specific goals and validation steps.

---

## Phase 1: Setup and Configuration

**Goal**: Install sync system without enabling it. Zero impact on production.

**Duration**: 30-60 minutes

### Step 1.1: Backup Current System

```bash
# Create backup directory
mkdir -p backups/pre-sync-migration

# Backup MongoDB data
mongodump --uri="mongodb://localhost:27017/bomba" --out=backups/pre-sync-migration/mongodb

# Backup application code
tar -czf backups/pre-sync-migration/app-backup-$(date +%Y%m%d).tar.gz \
  server/ src/ package.json

# Verify backup
ls -lh backups/pre-sync-migration/
```

### Step 1.2: Install Dependencies

```bash
# Navigate to server directory
cd server

# Install new dependencies
npm install uuid@^9.0.0

# Install dev dependencies for testing
npm install --save-dev fast-check@^3.15.0

# Verify installation
npm list uuid fast-check
```

### Step 1.3: Configure Environment Variables

Add the following to `server/.env`:

```env
# Dual MongoDB Sync Configuration
SYNC_ENABLED=false                    # Keep disabled during setup
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba
MONGODB_ATLAS_URI=                    # Add your Atlas URI here

# Sync Behavior
SYNC_QUEUE_MAX_SIZE=10000
SYNC_WORKER_INTERVAL=100
SYNC_MAX_RETRIES=5
SYNC_PERSIST_QUEUE=true
SYNC_BATCH_SIZE=100

# Optional: Exclude collections from sync
SYNC_EXCLUDED_COLLECTIONS=
```

**Important**: Keep `SYNC_ENABLED=false` for now.

### Step 1.4: Add Atlas Connection String

1. Log into MongoDB Atlas
2. Navigate to your cluster
3. Click "Connect" → "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your database user password
6. Add to `MONGODB_ATLAS_URI` in `.env`

Example:
```env
MONGODB_ATLAS_URI=mongodb+srv://bomba-user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/bomba?retryWrites=true&w=majority
```

### Step 1.5: Verify Configuration

```bash
# Check environment variables are loaded
node -e "require('dotenv').config({path: './server/.env'}); console.log('SYNC_ENABLED:', process.env.SYNC_ENABLED); console.log('MONGODB_ATLAS_URI:', process.env.MONGODB_ATLAS_URI ? 'Set' : 'Not Set');"
```

Expected output:
```
SYNC_ENABLED: false
MONGODB_ATLAS_URI: Set
```

### Step 1.6: Deploy Code (Sync Disabled)

```bash
# Build application
npm run build:all

# Restart application with PM2
pm2 restart bomba

# Check logs for any errors
pm2 logs bomba --lines 50
```

**Validation**: Application should start normally with no changes in behavior.

### Phase 1 Checklist

- [ ] Full backup created and verified
- [ ] Dependencies installed successfully
- [ ] Environment variables configured
- [ ] Atlas connection string added
- [ ] Application deployed and running normally
- [ ] No errors in application logs
- [ ] All existing functionality working

**If any validation fails**: Stop and resolve issues before proceeding.

---

## Phase 2: Testing and Validation

**Goal**: Enable sync in development/staging environment and validate functionality.

**Duration**: 2-4 hours

### Step 2.1: Create Test Environment

```bash
# Copy production data to test database
mongodump --uri="mongodb://localhost:27017/bomba" --archive | \
mongorestore --uri="mongodb://localhost:27017/bomba-test" --archive

# Update test environment .env
cp server/.env server/.env.test
# Edit .env.test to use bomba-test database
```

### Step 2.2: Enable Sync in Test Environment

Edit `server/.env.test`:
```env
SYNC_ENABLED=true
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba-test
```

### Step 2.3: Start Test Application

```bash
# Start with test environment
NODE_ENV=test node server/server.js

# Watch logs in another terminal
tail -f server/logs/app.log
```

### Step 2.4: Verify Connections

Check logs for:
```
✓ Connected to local MongoDB: bomba-test
✓ Connected to MongoDB Atlas: bomba
✓ Sync system initialized
✓ Sync worker started
```

### Step 2.5: Test Basic Operations

```bash
# Run test script
node server/scripts/testSyncBasicOperations.js
```

Create this test script:

```javascript
// server/scripts/testSyncBasicOperations.js
import mongoose from 'mongoose';
import { dualDbManager } from '../config/dualDatabaseManager.js';
import { syncMonitor } from '../services/sync/syncMonitor.js';

async function testBasicOperations() {
  console.log('Testing basic sync operations...\n');
  
  // Connect
  await dualDbManager.connectLocal(process.env.MONGODB_LOCAL_URI);
  await dualDbManager.connectAtlas(process.env.MONGODB_ATLAS_URI);
  
  // Test 1: Create document
  console.log('Test 1: Creating test document...');
  const TestModel = mongoose.model('SyncTest', new mongoose.Schema({
    name: String,
    timestamp: Date
  }));
  
  const doc = await TestModel.create({
    name: 'Test Document',
    timestamp: new Date()
  });
  console.log('✓ Document created:', doc._id);
  
  // Wait for sync
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Verify in Atlas
  const atlasDoc = await dualDbManager.getAtlasConnection()
    .model('SyncTest')
    .findById(doc._id);
  
  if (atlasDoc) {
    console.log('✓ Document synced to Atlas');
  } else {
    console.log('✗ Document NOT found in Atlas');
  }
  
  // Test 2: Update document
  console.log('\nTest 2: Updating document...');
  doc.name = 'Updated Test Document';
  await doc.save();
  console.log('✓ Document updated');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 3: Check metrics
  console.log('\nTest 3: Checking sync metrics...');
  const metrics = syncMonitor.getMetrics();
  console.log('Metrics:', JSON.stringify(metrics, null, 2));
  
  // Cleanup
  await TestModel.deleteOne({ _id: doc._id });
  
  console.log('\n✓ All tests passed!');
  process.exit(0);
}

testBasicOperations().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
```

### Step 2.6: Run Property-Based Tests

```bash
# Run all property tests
cd server
npm test -- --run server/__tests__/properties/

# Check results
echo "All property tests should pass"
```

### Step 2.7: Test Failure Scenarios

```bash
# Test Atlas disconnection
node server/scripts/testResilience.js
```

Verify:
- Operations continue on local DB when Atlas is down
- Queue grows during disconnection
- Operations sync when Atlas reconnects

### Step 2.8: Test Full Sync

```bash
# Create some differences
node server/scripts/createTestDifferences.js

# Run full sync
curl -X POST http://localhost:5000/api/sync/full \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Verify sync completed
curl http://localhost:5000/api/sync/metrics \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Step 2.9: Performance Testing

```bash
# Run performance test
node server/scripts/testSyncPerformance.js
```

Create performance test:

```javascript
// server/scripts/testSyncPerformance.js
import mongoose from 'mongoose';
import { performance } from 'perf_hooks';

async function testPerformance() {
  const TestModel = mongoose.model('PerfTest', new mongoose.Schema({
    data: String,
    index: Number
  }));
  
  console.log('Testing operation performance with sync enabled...\n');
  
  // Test write performance
  const iterations = 1000;
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    await TestModel.create({
      data: `Test data ${i}`,
      index: i
    });
  }
  
  const end = performance.now();
  const duration = end - start;
  const avgTime = duration / iterations;
  
  console.log(`Created ${iterations} documents`);
  console.log(`Total time: ${duration.toFixed(2)}ms`);
  console.log(`Average time per operation: ${avgTime.toFixed(2)}ms`);
  
  if (avgTime < 10) {
    console.log('✓ Performance acceptable (< 10ms per operation)');
  } else {
    console.log('⚠ Performance slower than expected');
  }
  
  // Cleanup
  await TestModel.deleteMany({});
  
  process.exit(0);
}

testPerformance().catch(console.error);
```

### Phase 2 Checklist

- [ ] Test environment created
- [ ] Sync enabled in test environment
- [ ] Both connections established successfully
- [ ] Basic CRUD operations sync correctly
- [ ] Property-based tests pass
- [ ] Failure scenarios handled gracefully
- [ ] Full sync works correctly
- [ ] Performance is acceptable (< 10ms per operation)
- [ ] No errors or warnings in logs
- [ ] Metrics endpoint returns accurate data

**If any validation fails**: Investigate and fix before proceeding to production.

---

## Phase 3: Production Rollout

**Goal**: Enable sync in production with gradual rollout and monitoring.

**Duration**: 1-2 days (with monitoring periods)

### Step 3.1: Pre-Production Checklist

Before enabling sync in production:

- [ ] Phase 2 completed successfully
- [ ] All tests passing
- [ ] Performance validated
- [ ] Monitoring tools ready
- [ ] Team notified of deployment
- [ ] Rollback plan reviewed
- [ ] Off-hours deployment window scheduled

### Step 3.2: Enable Sync (Gradual)

**Option A: Start with excluded collections**

Edit `server/.env`:
```env
SYNC_ENABLED=true
# Exclude critical collections initially
SYNC_EXCLUDED_COLLECTIONS=bills,orders,sessions
```

This syncs only non-critical data first (users, settings, menu items).

**Option B: Enable all collections**

If testing was thorough:
```env
SYNC_ENABLED=true
SYNC_EXCLUDED_COLLECTIONS=
```

### Step 3.3: Deploy to Production

```bash
# Build application
npm run build:all

# Restart with PM2
pm2 restart bomba

# Watch logs closely
pm2 logs bomba --lines 100
```

### Step 3.4: Monitor Initial Sync

Watch for:
```
✓ Connected to local MongoDB
✓ Connected to MongoDB Atlas
✓ Sync system initialized
✓ Sync worker started
✓ Loaded X operations from persisted queue
```

### Step 3.5: Monitor Metrics (First Hour)

```bash
# Check metrics every 5 minutes
watch -n 300 'curl -s http://localhost:5000/api/sync/metrics -H "Authorization: Bearer TOKEN" | jq'
```

Monitor:
- Queue size (should stay low, < 100)
- Success rate (should be > 99%)
- Average sync time (should be < 500ms)
- Failed operations (should be 0 or very low)

### Step 3.6: Run Full Sync

After initial monitoring period (2-4 hours):

```bash
# Trigger full sync to ensure consistency
curl -X POST http://localhost:5000/api/sync/full \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Monitor progress
curl http://localhost:5000/api/sync/health \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Step 3.7: Enable Remaining Collections

If you started with excluded collections:

Edit `server/.env`:
```env
# Remove exclusions
SYNC_EXCLUDED_COLLECTIONS=
```

```bash
# Restart
pm2 restart bomba

# Run full sync for newly included collections
curl -X POST http://localhost:5000/api/sync/full \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Step 3.8: Extended Monitoring (24-48 hours)

Monitor for:
- Application performance (should be unchanged)
- Error rates (should be normal)
- Sync queue size (should stay low)
- Atlas storage usage (should match local DB)
- User-reported issues (should be none)

### Step 3.9: Verify Data Consistency

```bash
# Run consistency check
node server/scripts/verifyDataConsistency.js
```

Create verification script:

```javascript
// server/scripts/verifyDataConsistency.js
import { dualDbManager } from '../config/dualDatabaseManager.js';

async function verifyConsistency() {
  await dualDbManager.connectLocal(process.env.MONGODB_LOCAL_URI);
  await dualDbManager.connectAtlas(process.env.MONGODB_ATLAS_URI);
  
  const collections = ['bills', 'orders', 'sessions', 'users', 'menuitems'];
  
  console.log('Verifying data consistency...\n');
  
  for (const collectionName of collections) {
    const localCount = await dualDbManager.getLocalConnection()
      .collection(collectionName)
      .countDocuments();
    
    const atlasCount = await dualDbManager.getAtlasConnection()
      .collection(collectionName)
      .countDocuments();
    
    const match = localCount === atlasCount ? '✓' : '✗';
    console.log(`${match} ${collectionName}: Local=${localCount}, Atlas=${atlasCount}`);
    
    if (localCount !== atlasCount) {
      console.log(`  ⚠ Mismatch detected! Difference: ${Math.abs(localCount - atlasCount)}`);
    }
  }
  
  console.log('\nConsistency check complete.');
  process.exit(0);
}

verifyConsistency().catch(console.error);
```

### Phase 3 Checklist

- [ ] Sync enabled in production
- [ ] Both connections established
- [ ] Initial monitoring completed (1 hour)
- [ ] Metrics look healthy
- [ ] Full sync completed successfully
- [ ] All collections syncing (if applicable)
- [ ] Extended monitoring completed (24-48 hours)
- [ ] Data consistency verified
- [ ] No performance degradation
- [ ] No user-reported issues

---

## Rollback Procedures

If issues occur at any phase, follow these rollback steps.

### Immediate Rollback (Disable Sync)

```bash
# Edit .env
# Set SYNC_ENABLED=false

# Restart application
pm2 restart bomba

# Verify sync is disabled
pm2 logs bomba | grep "Sync"
# Should see: "Sync disabled by configuration"
```

**Impact**: None. Application continues on local MongoDB.

### Rollback with Code Revert

If sync system causes application issues:

```bash
# Stop application
pm2 stop bomba

# Restore from backup
tar -xzf backups/pre-sync-migration/app-backup-YYYYMMDD.tar.gz

# Reinstall dependencies
npm install

# Restart
pm2 start bomba

# Verify
pm2 logs bomba
```

### Data Rollback (Emergency Only)

If data corruption occurs (extremely unlikely):

```bash
# Stop application
pm2 stop bomba

# Restore MongoDB from backup
mongorestore --uri="mongodb://localhost:27017/bomba" \
  --drop \
  backups/pre-sync-migration/mongodb

# Restart application
pm2 start bomba
```

**Note**: This loses any data created after backup.

---

## Post-Migration Tasks

### 1. Schedule Regular Full Syncs

Add to cron or scheduler:

```javascript
// In server/utils/scheduler.js
import cron from 'node-cron';
import { fullSyncService } from '../services/sync/fullSyncService.js';

// Run full sync daily at 3 AM
cron.schedule('0 3 * * *', async () => {
  console.log('Starting scheduled full sync...');
  try {
    await fullSyncService.startFullSync();
    console.log('Scheduled full sync completed');
  } catch (error) {
    console.error('Scheduled full sync failed:', error);
  }
});
```

### 2. Set Up Monitoring Alerts

Configure alerts for:
- Sync queue size > 1000
- Sync failure rate > 5%
- Atlas connection down > 5 minutes

### 3. Document for Team

Create internal documentation:
- How to check sync status
- How to interpret metrics
- When to trigger manual full sync
- Who to contact for issues

### 4. Update Backup Procedures

Update backup scripts to include:
- Sync queue persistence file
- Both local and Atlas databases

---

## Troubleshooting

### Issue: Atlas Connection Fails

**Symptoms**: "Failed to connect to MongoDB Atlas" in logs

**Solutions**:
1. Verify connection string is correct
2. Check IP whitelist in Atlas (add current server IP)
3. Verify database user credentials
4. Check network connectivity: `ping cluster0.xxxxx.mongodb.net`

### Issue: Sync Queue Growing

**Symptoms**: Queue size increasing, not decreasing

**Solutions**:
1. Check Atlas connection status
2. Verify Atlas has sufficient storage
3. Check for rate limiting or throttling
4. Review error logs for specific failures
5. Consider increasing `SYNC_WORKER_INTERVAL`

### Issue: Performance Degradation

**Symptoms**: Application slower after enabling sync

**Solutions**:
1. Verify sync is truly asynchronous (check middleware)
2. Increase `SYNC_WORKER_INTERVAL` to reduce Atlas calls
3. Check local MongoDB performance
4. Review application logs for blocking operations

### Issue: Data Inconsistency

**Symptoms**: Document counts don't match between local and Atlas

**Solutions**:
1. Run full sync: `POST /api/sync/full`
2. Check for failed operations in logs
3. Verify all collections are included (not excluded)
4. Review sync queue for stuck operations

---

## Success Criteria

Migration is considered successful when:

✓ Application running normally with sync enabled
✓ Both local and Atlas connections stable
✓ Sync queue size consistently low (< 100)
✓ Sync success rate > 99%
✓ No performance degradation
✓ Data consistency verified
✓ No user-reported issues
✓ Team trained on monitoring and troubleshooting

---

## Support and Resources

- **Configuration Reference**: `server/config/SYNC_CONFIG_QUICK_REFERENCE.md`
- **Technical Documentation**: `server/services/sync/README.md`
- **API Documentation**: `server/docs/SYNC_API.md`
- **Quick Start Guide**: `QUICK_START_SYNC.md`

For issues or questions, refer to the troubleshooting section or contact the development team.
