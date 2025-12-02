# Dual MongoDB Sync - Documentation Index

Complete index of all deployment and migration documentation for the dual MongoDB sync system.

---

## 📚 Documentation Files

### Quick Start & Overview

| Document | Location | Purpose | Audience |
|----------|----------|---------|----------|
| **Quick Start Guide** | `QUICK_START_SYNC.md` | Get running in 5 minutes | Developers |
| **Complete Overview** | `DUAL_MONGODB_SYNC_COMPLETE.md` | System overview and features | All |
| **Setup Guide** | `DUAL_MONGODB_SYNC_SETUP.md` | Initial setup instructions | Developers |
| **Project Summary** | `SYNC_PROJECT_SUMMARY.md` | Project completion summary | All |

### Deployment & Migration

| Document | Location | Purpose | Audience |
|----------|----------|---------|----------|
| **Migration Guide** | `server/docs/MIGRATION_GUIDE.md` | Complete 3-phase migration | DevOps, SysAdmin |
| **Deployment Checklist** | `server/docs/DEPLOYMENT_CHECKLIST.md` | Step-by-step checklist | DevOps, PM |
| **Quick Reference** | `DEPLOYMENT_QUICK_REFERENCE.md` | Quick commands & tips | Experienced Admins |
| **Deployment Summary** | `server/docs/DEPLOYMENT_SUMMARY.md` | Documentation overview | All |

### Configuration & Technical

| Document | Location | Purpose | Audience |
|----------|----------|---------|----------|
| **Config Reference** | `server/config/SYNC_CONFIG_QUICK_REFERENCE.md` | Environment variables | Developers, SysAdmin |
| **Config Guide** | `server/config/SYNC_CONFIGURATION.md` | Detailed configuration | Developers, SysAdmin |
| **Technical Docs** | `server/services/sync/README.md` | Architecture & API | Developers |
| **Resilience Docs** | `server/docs/RESILIENCE_AND_RECOVERY_IMPLEMENTATION.md` | Failure handling | Developers |

---

## 🛠️ Helper Scripts

### Testing Scripts

| Script | Location | Purpose |
|--------|----------|---------|
| **Basic Operations Test** | `server/scripts/testSyncBasicOperations.js` | Test CRUD sync operations |
| **Performance Test** | `server/scripts/testSyncPerformance.js` | Measure operation speed |
| **Resilience Test** | `server/scripts/testResilience.js` | Test failure scenarios |

### Verification Scripts

| Script | Location | Purpose |
|--------|----------|---------|
| **Data Consistency** | `server/scripts/verifyDataConsistency.js` | Compare local vs Atlas |

### Usage Examples

```bash
# Test basic sync operations
node server/scripts/testSyncBasicOperations.js

# Test performance
node server/scripts/testSyncPerformance.js

# Test resilience
node server/scripts/testResilience.js

# Verify data consistency
node server/scripts/verifyDataConsistency.js
```

---

## 🎯 Use Case Guide

### "I want to set up sync for the first time (Development)"

1. Read: `QUICK_START_SYNC.md`
2. Follow: Setup steps
3. Run: `npm run dev`
4. Verify: Check logs for success messages

**Time**: 5-10 minutes
**Risk**: None

---

### "I want to migrate to production"

1. Read: `server/docs/MIGRATION_GUIDE.md` (complete)
2. Print: `server/docs/DEPLOYMENT_CHECKLIST.md`
3. Execute: Phase 1 (Setup - sync disabled)
4. Execute: Phase 2 (Testing in staging)
5. Execute: Phase 3 (Production rollout)
6. Reference: `DEPLOYMENT_QUICK_REFERENCE.md` (ongoing)

**Time**: 2-3 days (with monitoring)
**Risk**: Low (gradual, reversible)

---

### "I need quick command reference"

Use: `DEPLOYMENT_QUICK_REFERENCE.md`

**Contains**:
- Quick start commands
- Health check commands
- Metrics commands
- Emergency rollback
- Troubleshooting tips

**Time**: Instant reference
**Risk**: None

---

### "I need to configure the system"

1. Read: `server/config/SYNC_CONFIG_QUICK_REFERENCE.md`
2. Edit: `server/.env`
3. Reference: `server/config/SYNC_CONFIGURATION.md` for details

**Time**: 10-15 minutes
**Risk**: Low (can revert)

---

### "I need to troubleshoot an issue"

1. Check: `DEPLOYMENT_QUICK_REFERENCE.md` (Quick troubleshooting)
2. Review: `server/docs/MIGRATION_GUIDE.md` (Troubleshooting section)
3. Check: Application logs (`pm2 logs bomba`)
4. Verify: Metrics (`curl /api/sync/metrics`)

**Time**: Varies
**Risk**: None (diagnostic only)

---

### "I need to understand the architecture"

1. Read: `server/services/sync/README.md`
2. Review: `server/docs/RESILIENCE_AND_RECOVERY_IMPLEMENTATION.md`
3. Check: Source code in `server/services/sync/`

**Time**: 30-60 minutes
**Risk**: None (read-only)

---

### "I need to disable sync (Emergency)"

Use: `DEPLOYMENT_QUICK_REFERENCE.md` (Rollback section)

**Steps**:
1. Edit `server/.env`: Set `SYNC_ENABLED=false`
2. Run: `pm2 restart bomba`
3. Verify: Check logs

**Time**: 2 minutes
**Risk**: None (local DB unaffected)

---

## 📊 API Endpoints Reference

### Public Endpoints (No Auth)

```bash
# Health check
GET /api/sync/health
```

### Admin Endpoints (Requires Auth)

```bash
# Get metrics
GET /api/sync/metrics

# Get detailed report
GET /api/sync/report

# Get queue status
GET /api/sync/queue

# Trigger full sync
POST /api/sync/full

# Pause sync worker
POST /api/sync/pause

# Resume sync worker
POST /api/sync/resume

# Clear queue
DELETE /api/sync/queue

# Get connection status
GET /api/sync/connections

# Retry failed operations
POST /api/sync/retry-failed
```

---

## 🔍 Quick Command Reference

### Check System Health

```bash
# Health check (no auth)
curl http://localhost:5000/api/sync/health

# Detailed metrics (requires admin token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:5000/api/sync/metrics | jq
```

### Trigger Full Sync

```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:5000/api/sync/full
```

### Verify Data Consistency

```bash
node server/scripts/verifyDataConsistency.js
```

### Test Performance

```bash
node server/scripts/testSyncPerformance.js
```

### Check Application Logs

```bash
# Real-time logs
pm2 logs bomba

# Last 100 lines
pm2 logs bomba --lines 100

# Error logs only
pm2 logs bomba --err
```

---

## 📋 Deployment Phases Summary

### Phase 1: Setup (Sync Disabled)
- **Duration**: 30-60 minutes
- **Risk**: None
- **Checklist**: `server/docs/DEPLOYMENT_CHECKLIST.md` (Phase 1)
- **Goal**: Deploy code with sync disabled

### Phase 2: Testing (Staging)
- **Duration**: 2-4 hours
- **Risk**: Low (isolated environment)
- **Checklist**: `server/docs/DEPLOYMENT_CHECKLIST.md` (Phase 2)
- **Goal**: Validate sync functionality

### Phase 3: Production Rollout
- **Duration**: 1-2 days (with monitoring)
- **Risk**: Low (gradual, reversible)
- **Checklist**: `server/docs/DEPLOYMENT_CHECKLIST.md` (Phase 3)
- **Goal**: Enable sync in production

---

## ✅ Success Criteria

Deployment is successful when:

- [x] Application running normally with sync enabled
- [x] Both connections stable (local + Atlas)
- [x] Sync queue size < 100
- [x] Success rate > 99%
- [x] No performance degradation
- [x] Data consistency verified
- [x] No user-reported issues
- [x] Team trained on monitoring

---

## 🆘 Emergency Contacts

**Primary Contact**: _______________
**Backup Contact**: _______________
**MongoDB Atlas Support**: https://support.mongodb.com/

---

## 📝 Document Versions

| Document | Version | Last Updated |
|----------|---------|--------------|
| Migration Guide | 1.0 | 2024-11-30 |
| Deployment Checklist | 1.0 | 2024-11-30 |
| Quick Reference | 1.0 | 2024-11-30 |
| Deployment Summary | 1.0 | 2024-11-30 |

---

## 🔗 Related Documentation

- **Requirements**: `.kiro/specs/dual-mongodb-sync/requirements.md`
- **Design**: `.kiro/specs/dual-mongodb-sync/design.md`
- **Tasks**: `.kiro/specs/dual-mongodb-sync/tasks.md`

---

## 💡 Tips

1. **Always backup before deployment**
2. **Test in staging first**
3. **Monitor closely after deployment**
4. **Keep rollback plan ready**
5. **Document any issues**
6. **Train team before production**
7. **Schedule regular full syncs**
8. **Set up monitoring alerts**

---

**For questions or issues, refer to the appropriate documentation above or contact the development team.**
