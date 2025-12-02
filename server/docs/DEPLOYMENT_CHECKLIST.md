# Dual MongoDB Sync - Deployment Checklist

This checklist ensures all prerequisites are met and all steps are completed for a successful deployment of the dual MongoDB sync system.

---

## Pre-Deployment Checklist

### System Requirements

- [ ] **Node.js Version**
  - [ ] Node.js 18 or higher installed
  - [ ] Verify: `node --version`
  - [ ] Expected: v18.x.x or higher

- [ ] **Local MongoDB**
  - [ ] MongoDB 4.4+ installed
  - [ ] MongoDB service running
  - [ ] Verify: `mongosh --eval "db.version()"`
  - [ ] Accessible at configured URI (default: localhost:27017)
  - [ ] Sufficient disk space (at least 2x current data size)

- [ ] **MongoDB Atlas**
  - [ ] Atlas account created
  - [ ] Cluster provisioned and running
  - [ ] Cluster tier appropriate for data size
  - [ ] Network access configured (IP whitelist)
  - [ ] Database user created with readWrite permissions

- [ ] **Application**
  - [ ] PM2 or process manager installed
  - [ ] Application currently running and stable
  - [ ] No critical bugs or issues
  - [ ] Recent backup available

### Backup Requirements

- [ ] **Full System Backup**
  - [ ] MongoDB data backed up
  - [ ] Backup location: `backups/pre-sync-migration/`
  - [ ] Backup verified and restorable
  - [ ] Application code backed up
  - [ ] Environment files backed up
  - [ ] Backup timestamp recorded: _______________

- [ ] **Backup Verification**
  - [ ] Test restore performed successfully
  - [ ] Backup size matches expected data size
  - [ ] All collections included in backup

### Team Preparation

- [ ] **Communication**
  - [ ] Team notified of deployment schedule
  - [ ] Maintenance window scheduled (if needed)
  - [ ] Rollback plan reviewed with team
  - [ ] On-call engineer identified

- [ ] **Documentation**
  - [ ] Migration guide reviewed
  - [ ] Deployment checklist printed/accessible
  - [ ] Troubleshooting guide available
  - [ ] Contact information updated

---

## Phase 1: Setup (Sync Disabled)

### 1.1 Install Dependencies

- [ ] Navigate to server directory: `cd server`
- [ ] Install uuid: `npm install uuid@^9.0.0`
- [ ] Install fast-check (dev): `npm install --save-dev fast-check@^3.15.0`
- [ ] Verify installation: `npm list uuid fast-check`
- [ ] No dependency conflicts or warnings

### 1.2 Environment Variable Setup

- [ ] **Create/Update server/.env file**
  
  ```env
  # Dual MongoDB Sync Configuration
  SYNC_ENABLED=false
  MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba
  MONGODB_ATLAS_URI=
  
  # Sync Behavior
  SYNC_QUEUE_MAX_SIZE=10000
  SYNC_WORKER_INTERVAL=100
  SYNC_MAX_RETRIES=5
  SYNC_PERSIST_QUEUE=true
  SYNC_BATCH_SIZE=100
  
  # Optional: Exclude collections
  SYNC_EXCLUDED_COLLECTIONS=
  ```

- [ ] **Verify SYNC_ENABLED=false** (critical!)
- [ ] Local MongoDB URI is correct
- [ ] Atlas URI placeholder added (empty for now)

### 1.3 MongoDB Atlas Configuration

- [ ] **Get Atlas Connection String**
  - [ ] Log into MongoDB Atlas
  - [ ] Navigate to cluster
  - [ ] Click "Connect" → "Connect your application"
  - [ ] Copy connection string
  - [ ] Replace `<password>` with actual password
  - [ ] Add to MONGODB_ATLAS_URI in .env

- [ ] **Test Atlas Connection**
  ```bash
  mongosh "YOUR_ATLAS_CONNECTION_STRING" --eval "db.version()"
  ```
  - [ ] Connection successful
  - [ ] Correct database accessible

- [ ] **Verify Network Access**
  - [ ] Server IP added to Atlas IP whitelist
  - [ ] Or 0.0.0.0/0 configured (if appropriate)
  - [ ] Test connection from server: `ping cluster.mongodb.net`

### 1.4 Configuration Verification

- [ ] **Verify Environment Variables Loaded**
  ```bash
  node -e "require('dotenv').config({path: './server/.env'}); console.log('SYNC_ENABLED:', process.env.SYNC_ENABLED); console.log('ATLAS_URI:', process.env.MONGODB_ATLAS_URI ? 'Set' : 'Not Set');"
  ```
  - [ ] SYNC_ENABLED shows: false
  - [ ] ATLAS_URI shows: Set

- [ ] **Check Configuration File**
  - [ ] Review `server/config/syncConfig.js`
  - [ ] Verify default values are appropriate
  - [ ] No syntax errors

### 1.5 Code Deployment

- [ ] **Build Application**
  ```bash
  npm run build:all
  ```
  - [ ] Build completes without errors
  - [ ] No TypeScript errors
  - [ ] No linting errors

- [ ] **Deploy to Server**
  - [ ] Code pushed to repository (if using Git)
  - [ ] Code pulled on server
  - [ ] Dependencies installed

- [ ] **Restart Application**
  ```bash
  pm2 restart bomba
  ```
  - [ ] Application starts successfully
  - [ ] No errors in startup logs

### 1.6 Post-Deployment Verification

- [ ] **Check Application Logs**
  ```bash
  pm2 logs bomba --lines 50
  ```
  - [ ] No errors related to sync system
  - [ ] Application functioning normally
  - [ ] Should see: "Sync disabled by configuration"

- [ ] **Test Core Functionality**
  - [ ] Login works
  - [ ] Create test order
  - [ ] Create test session
  - [ ] View reports
  - [ ] All features working as before

- [ ] **Monitor for 30 Minutes**
  - [ ] No new errors
  - [ ] Performance normal
  - [ ] Users not reporting issues

### Phase 1 Sign-Off

- [ ] All Phase 1 items completed
- [ ] Application stable with sync code deployed but disabled
- [ ] Team confirms no issues
- [ ] Ready to proceed to Phase 2

**Signed off by**: _______________ **Date**: _______________

---

## Phase 2: Testing (Development/Staging)

### 2.1 Test Environment Setup

- [ ] **Create Test Database**
  ```bash
  mongodump --uri="mongodb://localhost:27017/bomba" --archive | \
  mongorestore --uri="mongodb://localhost:27017/bomba-test" --archive
  ```
  - [ ] Test database created
  - [ ] Data copied successfully

- [ ] **Configure Test Environment**
  - [ ] Copy .env to .env.test
  - [ ] Update MONGODB_LOCAL_URI to use bomba-test
  - [ ] Set SYNC_ENABLED=true in .env.test

### 2.2 Enable Sync in Test

- [ ] **Start Test Application**
  ```bash
  NODE_ENV=test node server/server.js
  ```
  - [ ] Application starts
  - [ ] Both connections established

- [ ] **Verify Connections**
  - [ ] Check logs for: "Connected to local MongoDB"
  - [ ] Check logs for: "Connected to MongoDB Atlas"
  - [ ] Check logs for: "Sync system initialized"
  - [ ] Check logs for: "Sync worker started"

### 2.3 Basic Operations Test

- [ ] **Run Basic Operations Test**
  ```bash
  node server/scripts/testSyncBasicOperations.js
  ```
  - [ ] Test creates document successfully
  - [ ] Document syncs to Atlas
  - [ ] Update syncs to Atlas
  - [ ] Delete syncs to Atlas
  - [ ] All tests pass

### 2.4 Property-Based Tests

- [ ] **Run Property Tests**
  ```bash
  cd server
  npm test -- --run server/__tests__/properties/
  ```
  - [ ] All property tests pass
  - [ ] No failures or errors
  - [ ] Test coverage adequate

### 2.5 Resilience Testing

- [ ] **Test Atlas Disconnection**
  ```bash
  node server/scripts/testResilience.js
  ```
  - [ ] Operations continue when Atlas down
  - [ ] Queue grows during disconnection
  - [ ] Operations sync when reconnected
  - [ ] No data loss

### 2.6 Performance Testing

- [ ] **Run Performance Test**
  ```bash
  node server/scripts/testSyncPerformance.js
  ```
  - [ ] Average operation time < 10ms
  - [ ] No significant performance degradation
  - [ ] Results documented: _______________

### 2.7 Full Sync Test

- [ ] **Trigger Full Sync**
  ```bash
  curl -X POST http://localhost:5000/api/sync/full \
    -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
  ```
  - [ ] Full sync completes successfully
  - [ ] All collections synchronized
  - [ ] No errors in logs

- [ ] **Verify Sync Metrics**
  ```bash
  curl http://localhost:5000/api/sync/metrics \
    -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
  ```
  - [ ] Metrics returned successfully
  - [ ] Success rate > 99%
  - [ ] Queue size low

### Phase 2 Sign-Off

- [ ] All Phase 2 tests passed
- [ ] Sync working correctly in test environment
- [ ] Performance acceptable
- [ ] No critical issues found
- [ ] Ready for production rollout

**Signed off by**: _______________ **Date**: _______________

---

## Phase 3: Production Rollout

### 3.1 Pre-Production Final Checks

- [ ] **System Status**
  - [ ] All Phase 2 tests passed
  - [ ] Application stable
  - [ ] No pending critical bugs
  - [ ] Backup recent (< 24 hours old)

- [ ] **Team Readiness**
  - [ ] Deployment window scheduled
  - [ ] Team members available
  - [ ] Rollback plan reviewed
  - [ ] Monitoring tools ready

- [ ] **Communication**
  - [ ] Users notified (if needed)
  - [ ] Support team briefed
  - [ ] Escalation path defined

### 3.2 Enable Sync in Production

- [ ] **Choose Rollout Strategy**
  
  **Option A: Gradual (Recommended)**
  - [ ] Set SYNC_EXCLUDED_COLLECTIONS=bills,orders,sessions
  - [ ] Enable sync for non-critical collections first
  
  **Option B: Full**
  - [ ] Set SYNC_EXCLUDED_COLLECTIONS= (empty)
  - [ ] Enable sync for all collections

- [ ] **Update Production .env**
  ```env
  SYNC_ENABLED=true
  ```
  - [ ] SYNC_ENABLED changed to true
  - [ ] All other settings verified
  - [ ] File saved

### 3.3 Deploy to Production

- [ ] **Restart Application**
  ```bash
  pm2 restart bomba
  ```
  - [ ] Application restarts successfully
  - [ ] No startup errors

- [ ] **Verify Connections**
  ```bash
  pm2 logs bomba --lines 100
  ```
  - [ ] "Connected to local MongoDB" appears
  - [ ] "Connected to MongoDB Atlas" appears
  - [ ] "Sync system initialized" appears
  - [ ] "Sync worker started" appears
  - [ ] No error messages

### 3.4 Initial Monitoring (First Hour)

- [ ] **Monitor Logs Continuously**
  ```bash
  pm2 logs bomba
  ```
  - [ ] No sync errors
  - [ ] No connection issues
  - [ ] Operations completing normally

- [ ] **Check Metrics Every 5 Minutes**
  ```bash
  curl -s http://localhost:5000/api/sync/metrics \
    -H "Authorization: Bearer TOKEN" | jq
  ```
  
  **Record Metrics:**
  - [ ] T+5min: Queue size: ___ Success rate: ___%
  - [ ] T+10min: Queue size: ___ Success rate: ___%
  - [ ] T+15min: Queue size: ___ Success rate: ___%
  - [ ] T+30min: Queue size: ___ Success rate: ___%
  - [ ] T+60min: Queue size: ___ Success rate: ___%

- [ ] **Verify Metrics Healthy**
  - [ ] Queue size < 100
  - [ ] Success rate > 99%
  - [ ] Average sync time < 500ms
  - [ ] No failed operations

### 3.5 Run Full Sync

- [ ] **Trigger Full Sync** (after 2-4 hours of monitoring)
  ```bash
  curl -X POST http://localhost:5000/api/sync/full \
    -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
  ```
  - [ ] Full sync initiated
  - [ ] Monitor progress in logs

- [ ] **Verify Full Sync Completion**
  - [ ] Full sync completes without errors
  - [ ] All collections synchronized
  - [ ] Document counts match

### 3.6 Enable Remaining Collections (If Gradual)

- [ ] **Update Configuration**
  - [ ] Remove SYNC_EXCLUDED_COLLECTIONS
  - [ ] Or set to empty: SYNC_EXCLUDED_COLLECTIONS=

- [ ] **Restart Application**
  ```bash
  pm2 restart bomba
  ```

- [ ] **Run Full Sync for New Collections**
  ```bash
  curl -X POST http://localhost:5000/api/sync/full \
    -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
  ```

### 3.7 Extended Monitoring (24-48 Hours)

- [ ] **Monitor Application Performance**
  - [ ] Response times normal
  - [ ] Error rates normal
  - [ ] CPU usage normal
  - [ ] Memory usage normal

- [ ] **Monitor Sync Health**
  - [ ] Queue size consistently low
  - [ ] Success rate > 99%
  - [ ] No persistent errors
  - [ ] Atlas storage growing appropriately

- [ ] **Check User Experience**
  - [ ] No user-reported issues
  - [ ] Application responsive
  - [ ] All features working

- [ ] **Daily Metrics Check**
  - [ ] Day 1: Queue: ___ Success: ___% Issues: ___
  - [ ] Day 2: Queue: ___ Success: ___% Issues: ___

### 3.8 Data Consistency Verification

- [ ] **Run Consistency Check**
  ```bash
  node server/scripts/verifyDataConsistency.js
  ```
  - [ ] All collections match
  - [ ] No mismatches found
  - [ ] Local and Atlas in sync

- [ ] **Manual Spot Checks**
  - [ ] Check recent bills in both databases
  - [ ] Verify recent orders synced
  - [ ] Confirm recent sessions synced

### Phase 3 Sign-Off

- [ ] Sync enabled in production
- [ ] Initial monitoring completed (1 hour)
- [ ] Extended monitoring completed (24-48 hours)
- [ ] Full sync completed successfully
- [ ] Data consistency verified
- [ ] No performance issues
- [ ] No user-reported problems
- [ ] Production deployment successful

**Signed off by**: _______________ **Date**: _______________

---

## Post-Deployment Tasks

### Monitoring Setup

- [ ] **Configure Monitoring Alerts**
  - [ ] Alert for queue size > 1000
  - [ ] Alert for success rate < 95%
  - [ ] Alert for Atlas connection down > 5 minutes
  - [ ] Alert for sync errors > 10 per hour

- [ ] **Set Up Dashboards**
  - [ ] Sync metrics dashboard
  - [ ] Queue size graph
  - [ ] Success rate graph
  - [ ] Error rate graph

### Scheduled Tasks

- [ ] **Schedule Daily Full Sync**
  - [ ] Add cron job for 3 AM daily
  - [ ] Test scheduled sync runs
  - [ ] Verify notifications on failure

- [ ] **Schedule Weekly Consistency Check**
  - [ ] Add cron job for weekly verification
  - [ ] Configure email notifications
  - [ ] Document results location

### Documentation

- [ ] **Update Internal Documentation**
  - [ ] How to check sync status
  - [ ] How to interpret metrics
  - [ ] When to trigger manual full sync
  - [ ] Troubleshooting common issues

- [ ] **Team Training**
  - [ ] Train support team on sync system
  - [ ] Share monitoring dashboard access
  - [ ] Review escalation procedures
  - [ ] Conduct Q&A session

### Backup Procedures

- [ ] **Update Backup Scripts**
  - [ ] Include sync queue persistence file
  - [ ] Backup both local and Atlas
  - [ ] Test restore procedures
  - [ ] Document new backup process

---

## Rollback Procedures

### Quick Disable (No Code Changes)

If issues arise, sync can be disabled immediately:

- [ ] Edit server/.env
- [ ] Set SYNC_ENABLED=false
- [ ] Run: `pm2 restart bomba`
- [ ] Verify in logs: "Sync disabled by configuration"
- [ ] Application continues on local MongoDB only

**Impact**: None. Application continues normally.

### Full Rollback (Revert Code)

If sync system causes application issues:

- [ ] Stop application: `pm2 stop bomba`
- [ ] Restore from backup
- [ ] Reinstall dependencies: `npm install`
- [ ] Start application: `pm2 start bomba`
- [ ] Verify application working

### Emergency Data Restore

Only if data corruption occurs (extremely unlikely):

- [ ] Stop application: `pm2 stop bomba`
- [ ] Restore MongoDB from backup
- [ ] Start application: `pm2 start bomba`
- [ ] Verify data integrity

**Note**: This loses data created after backup.

---

## Success Criteria

Deployment is successful when ALL criteria are met:

- [x] Application running normally with sync enabled
- [x] Both local and Atlas connections stable
- [x] Sync queue size consistently low (< 100)
- [x] Sync success rate > 99%
- [x] No performance degradation
- [x] Data consistency verified between databases
- [x] No user-reported issues
- [x] Team trained on monitoring and troubleshooting
- [x] Monitoring alerts configured
- [x] Documentation updated

---

## Contact Information

**Primary Contact**: _______________
**Phone**: _______________
**Email**: _______________

**Backup Contact**: _______________
**Phone**: _______________
**Email**: _______________

**MongoDB Atlas Support**: https://support.mongodb.com/

---

## Notes and Issues

Use this section to document any issues encountered during deployment:

**Date**: _______________ **Issue**: _______________
**Resolution**: _______________

**Date**: _______________ **Issue**: _______________
**Resolution**: _______________

**Date**: _______________ **Issue**: _______________
**Resolution**: _______________

---

## Final Sign-Off

**Deployment completed successfully**: [ ]

**Signed by**: _______________
**Role**: _______________
**Date**: _______________
**Time**: _______________

**Verified by**: _______________
**Role**: _______________
**Date**: _______________
**Time**: _______________
