# Bidirectional Sync Documentation Index

## Quick Links

### 📚 Main Documentation
- **[Bidirectional Sync Documentation](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md)** - Complete guide to bidirectional sync architecture, components, configuration, and troubleshooting

### 🚀 Migration Guide
- **[Migration Guide](./BIDIRECTIONAL_SYNC_MIGRATION_GUIDE.md)** - Step-by-step guide for migrating from one-way to bidirectional sync

### 🔧 Implementation Docs
- **[Server Integration](./BIDIRECTIONAL_SYNC_SERVER_INTEGRATION.md)** - Server initialization and integration details
- **[API Documentation](./BIDIRECTIONAL_SYNC_API.md)** - API endpoints for bidirectional sync
- **[Origin Tracking](../middleware/sync/ORIGIN_TRACKING_IMPLEMENTATION.md)** - Origin tracking implementation details
- **[Resume Token Storage](../services/sync/RESUME_TOKEN_STORAGE_SUMMARY.md)** - Resume token persistence implementation
- **[Data Validation](./DATA_VALIDATION_IMPLEMENTATION.md)** - Data validation for incoming changes
- **[Error Handling](./ERROR_HANDLING_IMPLEMENTATION.md)** - Comprehensive error handling
- **[Excluded Collections](./EXCLUDED_COLLECTIONS_IMPLEMENTATION.md)** - Collection exclusion implementation

### 📋 Spec Documents
- **[Requirements](../../.kiro/specs/bidirectional-sync/requirements.md)** - Feature requirements and acceptance criteria
- **[Design](../../.kiro/specs/bidirectional-sync/design.md)** - Detailed design document with correctness properties
- **[Tasks](../../.kiro/specs/bidirectional-sync/tasks.md)** - Implementation task list

---

## Documentation Overview

### For Users

**Getting Started**:
1. Read [Overview](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#overview) to understand what bidirectional sync is
2. Review [Configuration](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#configuration) to set up your environment
3. Check [Examples and Use Cases](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#examples-and-use-cases) for practical scenarios

**Troubleshooting**:
1. Check [Troubleshooting Guide](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#troubleshooting) for common issues
2. Review [API Reference](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#api-reference) for monitoring endpoints
3. Run diagnostic scripts from the troubleshooting section

### For Administrators

**Migration**:
1. Review [Prerequisites](./BIDIRECTIONAL_SYNC_MIGRATION_GUIDE.md#prerequisites) before starting
2. Follow [Migration Steps](./BIDIRECTIONAL_SYNC_MIGRATION_GUIDE.md#migration-steps) carefully
3. Set up [Monitoring](./BIDIRECTIONAL_SYNC_MIGRATION_GUIDE.md#monitoring-recommendations)
4. Keep [Rollback Procedures](./BIDIRECTIONAL_SYNC_MIGRATION_GUIDE.md#rollback-procedures) handy

**Monitoring**:
1. Configure [Key Metrics](./BIDIRECTIONAL_SYNC_MIGRATION_GUIDE.md#key-metrics-to-monitor)
2. Set up [Alerts](./BIDIRECTIONAL_SYNC_MIGRATION_GUIDE.md#alert-configuration)
3. Review [Log Monitoring](./BIDIRECTIONAL_SYNC_MIGRATION_GUIDE.md#log-monitoring) patterns

### For Developers

**Architecture**:
1. Study [Architecture](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#architecture) diagram
2. Review [Components](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#components) and their responsibilities
3. Understand [Data Flow](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#data-flow)

**Implementation**:
1. Review [Design Document](../../.kiro/specs/bidirectional-sync/design.md) for detailed design
2. Check [Implementation Docs](#-implementation-docs) for specific components
3. Review [Correctness Properties](../../.kiro/specs/bidirectional-sync/design.md#correctness-properties)

**Testing**:
1. Run integration tests: `node server/scripts/testBidirectionalSyncIntegration.js`
2. Run property tests: `npm test -- atlasToLocalReplication.property.test.js`
3. Review [Testing Procedures](./BIDIRECTIONAL_SYNC_MIGRATION_GUIDE.md#testing-procedures)

---

## Quick Reference

### Key Concepts

| Concept | Description | Documentation |
|---------|-------------|---------------|
| **Bidirectional Sync** | Two-way data synchronization between Local and Atlas | [Overview](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#overview) |
| **Change Streams** | MongoDB feature for real-time change detection | [Architecture](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#architecture) |
| **Origin Tracking** | Prevents infinite sync loops | [Origin Tracker](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#3-origin-tracker) |
| **Conflict Resolution** | Last Write Wins strategy for conflicts | [Conflict Resolution](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#conflict-resolution) |
| **Resume Tokens** | Enables recovery after disconnection | [Resume Token Storage](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#6-resume-token-storage) |
| **Excluded Collections** | Collections that only sync one-way | [Configuration](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#excluded-collections) |

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Atlas Change Listener** | `server/services/sync/atlasChangeListener.js` | Monitors Atlas for changes |
| **Change Processor** | `server/services/sync/changeProcessor.js` | Applies Atlas changes to Local |
| **Origin Tracker** | `server/services/sync/originTracker.js` | Tracks change origins |
| **Conflict Resolver** | `server/services/sync/conflictResolver.js` | Resolves conflicts |
| **Sync Monitor** | `server/services/sync/bidirectionalSyncMonitor.js` | Tracks metrics |
| **Resume Token Storage** | `server/services/sync/resumeTokenStorage.js` | Persists resume tokens |

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BIDIRECTIONAL_SYNC_ENABLED` | `false` | Enable/disable bidirectional sync |
| `ATLAS_CHANGE_STREAM_BATCH_SIZE` | `100` | Change Stream batch size |
| `BIDIRECTIONAL_EXCLUDED_COLLECTIONS` | `sessions,logs,...` | Excluded collections |
| `CONFLICT_RESOLUTION_STRATEGY` | `last-write-wins` | Conflict resolution strategy |
| `CHANGE_STREAM_RECONNECT_INTERVAL` | `5000` | Reconnection interval (ms) |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync/bidirectional/health` | GET | Health check |
| `/api/sync/bidirectional/metrics` | GET | Sync metrics |
| `/api/sync/bidirectional/conflicts` | GET | Conflict history |
| `/api/sync/bidirectional/toggle` | POST | Enable/disable sync |

### Diagnostic Scripts

| Script | Purpose |
|--------|---------|
| `testBidirectionalSyncIntegration.js` | Test end-to-end sync |
| `testAtlasListenerIntegration.js` | Test Atlas listener |
| `verifyOriginTracking.js` | Verify origin tracking |
| `testExcludedCollections.js` | Test collection exclusion |
| `testResumeTokenStorageSimple.js` | Test resume tokens |
| `testDataValidation.js` | Test data validation |
| `testErrorHandling.js` | Test error scenarios |

---

## Common Tasks

### Enable Bidirectional Sync

```bash
# 1. Update .env
BIDIRECTIONAL_SYNC_ENABLED=true

# 2. Restart application
pm2 restart bomba

# 3. Verify
curl http://localhost:5000/api/sync/bidirectional/health
```

### Disable Bidirectional Sync

```bash
# 1. Update .env
BIDIRECTIONAL_SYNC_ENABLED=false

# 2. Restart application
pm2 restart bomba

# 3. Verify
curl http://localhost:5000/api/sync/bidirectional/health
```

### Check Sync Status

```bash
# Health check
curl http://localhost:5000/api/sync/bidirectional/health | jq

# Metrics
curl http://localhost:5000/api/sync/bidirectional/metrics | jq

# Conflicts
curl http://localhost:5000/api/sync/bidirectional/conflicts | jq
```

### Troubleshoot Issues

```bash
# 1. Check logs
pm2 logs bomba --lines 100

# 2. Run diagnostics
node server/scripts/testBidirectionalSyncIntegration.js

# 3. Verify origin tracking
node server/scripts/verifyOriginTracking.js

# 4. Check Atlas connection
node server/scripts/testAtlasConnection.js
```

### Monitor Performance

```bash
# Watch metrics in real-time
watch -n 5 'curl -s http://localhost:5000/api/sync/bidirectional/metrics | jq'

# Monitor logs
pm2 logs bomba

# System resources
pm2 monit
```

---

## Support

### Documentation
- [Main Documentation](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md)
- [Migration Guide](./BIDIRECTIONAL_SYNC_MIGRATION_GUIDE.md)
- [Troubleshooting](./BIDIRECTIONAL_SYNC_DOCUMENTATION.md#troubleshooting)

### Scripts
- All diagnostic scripts in `server/scripts/`
- Test scripts in `server/__tests__/`

### Logs
- Application logs: `server/logs/app.log`
- Error logs: `server/logs/error.log`
- PM2 logs: `pm2 logs bomba`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-30 | Initial bidirectional sync implementation |

---

## Related Documentation

- [Sync Configuration](./SYNC_CONFIGURATION.md)
- [Dual Database Manager](../config/BIDIRECTIONAL_SYNC_CONFIG.md)
- [MongoDB Change Streams](https://docs.mongodb.com/manual/changeStreams/)
- [Mongoose Middleware](https://mongoosejs.com/docs/middleware.html)
