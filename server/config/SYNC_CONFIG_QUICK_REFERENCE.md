# Sync Configuration - Quick Reference Card

## Essential Variables

```env
# Enable/Disable Sync
SYNC_ENABLED=true

# Database Connections
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba
MONGODB_ATLAS_URI=mongodb+srv://user:pass@cluster.mongodb.net/bomba

# Queue Settings
SYNC_QUEUE_MAX_SIZE=10000
SYNC_WORKER_INTERVAL=100

# Retry Settings
SYNC_MAX_RETRIES=5

# Persistence
SYNC_PERSIST_QUEUE=true
SYNC_QUEUE_PATH=./data/sync-queue.json
```

## Quick Commands

```bash
# Test configuration
node -e "import('./server/config/syncConfig.js').then(m => console.log(m.validateSyncConfig()))"

# Check sync health
curl http://localhost:5000/api/sync/health

# View metrics (requires auth)
curl -H "Authorization: Bearer TOKEN" http://localhost:5000/api/sync/metrics
```

## Common Issues

| Issue | Quick Fix |
|-------|-----------|
| App won't start | Start MongoDB: `mongod` |
| Sync not working | Set `SYNC_ENABLED=true` |
| Queue growing | Check Atlas connection |
| High failures | Review logs, increase retries |

## Tuning Guide

| Scenario | QUEUE_MAX_SIZE | WORKER_INTERVAL | MAX_RETRIES |
|----------|----------------|-----------------|-------------|
| Low traffic | 5000 | 100-200ms | 3-5 |
| Normal | 10000 | 100ms | 5 |
| High traffic | 20000 | 50-100ms | 5-7 |
| Slow Atlas | 10000 | 500-1000ms | 7-10 |

## Documentation

- **Full Guide:** `server/config/SYNC_CONFIGURATION.md`
- **System Docs:** `DUAL_MONGODB_SYNC_COMPLETE.md`
- **Quick Start:** `QUICK_START_SYNC.md`
