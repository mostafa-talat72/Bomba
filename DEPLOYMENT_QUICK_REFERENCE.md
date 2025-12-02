# Dual MongoDB Sync - Quick Deployment Reference

Quick reference for deploying the dual MongoDB sync system. For detailed instructions, see `server/docs/MIGRATION_GUIDE.md`.

## Prerequisites

✓ Local MongoDB running (4.4+)
✓ MongoDB Atlas cluster created
✓ Full backup completed
✓ Node.js 18+ installed

## Quick Start (3 Phases)

### Phase 1: Setup (30-60 min) - Sync Disabled

```bash
# 1. Backup
mkdir -p backups/pre-sync-migration
mongodump --uri="mongodb://localhost:27017/bomba" --out=backups/pre-sync-migration/mongodb

# 2. Install dependencies
cd server
npm install uuid@^9.0.0
npm install --save-dev fast-check@^3.15.0

# 3. Configure .env (KEEP SYNC_ENABLED=false)
cat >> server/.env << EOF
SYNC_ENABLED=false
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba
MONGODB_ATLAS_URI=your_atlas_connection_string_here
SYNC_QUEUE_MAX_SIZE=10000
SYNC_WORKER_INTERVAL=100
SYNC_MAX_RETRIES=5
SYNC_PERSIST_QUEUE=true
SYNC_BATCH_SIZE=100
EOF

# 4. Deploy
npm run build:all
pm2 restart bomba

# 5. Verify (should see "Sync disabled by configuration")
pm2 logs bomba --lines 50
```

### Phase 2: Testing (2-4 hours) - Test Environment

```bash
# 1. Create test database
mongodump --uri="mongodb://localhost:27017/bomba" --archive | \
mongorestore --uri="mongodb://localhost:27017/bomba-test" --archive

# 2. Enable sync in test (create .env.test with SYNC_ENABLED=true)

# 3. Run tests
node server/scripts/testSyncBasicOperations.js
node server/scripts/testSyncPerformance.js
npm test -- --run server/__tests__/properties/

# 4. Verify all tests pass
```

### Phase 3: Production (1-2 days) - Gradual Rollout

```bash
# 1. Enable sync in production .env
# Change: SYNC_ENABLED=true

# 2. Optional: Start with excluded collections
# SYNC_EXCLUDED_COLLECTIONS=bills,orders,sessions

# 3. Restart
pm2 restart bomba

# 4. Monitor (first hour - check every 5 min)
curl -s http://localhost:5000/api/sync/metrics \
  -H "Authorization: Bearer TOKEN" | jq

# 5. Run full sync (after 2-4 hours)
curl -X POST http://localhost:5000/api/sync/full \
  -H "Authorization: Bearer TOKEN"

# 6. Verify consistency
node server/scripts/verifyDataConsistency.js

# 7. Monitor for 24-48 hours
```

## Key Commands

### Check Sync Status
```bash
curl http://localhost:5000/api/sync/health \
  -H "Authorization: Bearer TOKEN"
```

### View Metrics
```bash
curl http://localhost:5000/api/sync/metrics \
  -H "Authorization: Bearer TOKEN" | jq
```

### Trigger Full Sync
```bash
curl -X POST http://localhost:5000/api/sync/full \
  -H "Authorization: Bearer TOKEN"
```

### Verify Data Consistency
```bash
node server/scripts/verifyDataConsistency.js
```

### Test Performance
```bash
node server/scripts/testSyncPerformance.js
```

## Emergency Rollback

```bash
# Quick disable (no code changes)
# Edit server/.env: SYNC_ENABLED=false
pm2 restart bomba
# Application continues on local MongoDB only
```

## Health Indicators

✓ **Healthy Sync**
- Queue size < 100
- Success rate > 99%
- Avg sync time < 500ms
- No persistent errors

✗ **Issues**
- Queue size > 1000 (sync lag)
- Success rate < 95% (connection issues)
- Persistent errors in logs

## Environment Variables

```env
# Required
SYNC_ENABLED=true|false
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba
MONGODB_ATLAS_URI=mongodb+srv://user:pass@cluster.mongodb.net/bomba

# Optional (with defaults)
SYNC_QUEUE_MAX_SIZE=10000
SYNC_WORKER_INTERVAL=100
SYNC_MAX_RETRIES=5
SYNC_PERSIST_QUEUE=true
SYNC_BATCH_SIZE=100
SYNC_EXCLUDED_COLLECTIONS=
```

## Monitoring Checklist

- [ ] Queue size consistently low
- [ ] Success rate > 99%
- [ ] No errors in logs
- [ ] Application performance normal
- [ ] Data consistency verified

## Troubleshooting

**Atlas Connection Fails**
- Check connection string
- Verify IP whitelist in Atlas
- Test: `mongosh "YOUR_ATLAS_URI" --eval "db.version()"`

**Queue Growing**
- Check Atlas connection status
- Review error logs
- Consider increasing SYNC_WORKER_INTERVAL

**Performance Issues**
- Verify sync is asynchronous
- Check local MongoDB performance
- Review application logs

## Documentation

- **Full Migration Guide**: `server/docs/MIGRATION_GUIDE.md`
- **Deployment Checklist**: `server/docs/DEPLOYMENT_CHECKLIST.md`
- **Configuration Reference**: `server/config/SYNC_CONFIG_QUICK_REFERENCE.md`
- **Technical Docs**: `server/services/sync/README.md`

## Support

For issues or questions:
1. Check troubleshooting section in MIGRATION_GUIDE.md
2. Review logs: `pm2 logs bomba`
3. Check metrics: `curl http://localhost:5000/api/sync/metrics`
4. Contact development team

---

**Remember**: Local MongoDB is always primary. Sync can be disabled at any time without data loss.
