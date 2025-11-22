# Performance Testing Quick Start Guide

This guide will help you run comprehensive performance tests for the Orders and Billing optimization project.

## Prerequisites

Before running the tests, ensure:

1. ✅ MongoDB is running
2. ✅ Backend server is running (`npm run server:dev` from root)
3. ✅ You have admin credentials (default: username: `admin`, password: `admin123`)
4. ✅ Database has sufficient test data (at least 100 orders and bills)

## Running Performance Tests

### 1. Comprehensive Backend Performance Test

This test will verify:
- Database indexes are created and being used
- API response times meet targets
- Compression is working effectively

```bash
cd server
npm run test:performance
```

**What it tests:**
- ✓ Database index verification
- ✓ Index usage with explain()
- ✓ API response times (Orders and Bills endpoints)
- ✓ Compression effectiveness
- ✓ Response sizes
- ✓ Performance targets (< 500ms for 100 records)

**Expected output:**
```
=============================================================
Database Index Verification
=============================================================

Testing Order collection indexes...
Found 4 indexes on Order collection:
  - _id_: ...
  - organization_1_status_1_createdAt_-1: ...
  - organization_1_tableNumber_1_createdAt_-1: ...
  - organization_1_createdAt_-1: ...

Order query used index: organization_1_status_1_createdAt_-1
Documents examined: 100, returned: 100

=============================================================
API Response Time Testing
=============================================================

Testing: Orders (100 records)...
  ✓ Response time: 245ms (100 records, 45.2KB)
  Compression: Enabled ✓

Testing: Bills (100 records)...
  ✓ Response time: 312ms (100 records, 52.8KB)
  Compression: Enabled ✓

=============================================================
Performance Test Summary
=============================================================

Overall Assessment:
  ✓ All optimizations working correctly!
```

### 2. Frontend Performance Analysis

This test analyzes frontend optimization effectiveness:

```bash
cd server
npm run test:frontend-perf
```

**What it tests:**
- ✓ Memoization effectiveness
- ✓ Polling interval improvements
- ✓ Request reduction calculations

**Expected output:**
```
=== Memoization Effectiveness Test ===

Without memoization: 125.45ms
With memoization: 2.31ms
Improvement: 98.16%
Status: ✓ Excellent

=== Polling Effectiveness Test ===

Old (5s interval):
  Requests/minute: 12
  Requests/hour: 720
  Data transfer/hour: 36000KB (35.16MB)

New (10s interval):
  Requests/minute: 6
  Requests/hour: 360
  Data transfer/hour: 18000KB (17.58MB)

Reduction in requests: 50.00%
Status: ✓ Significant improvement
```

### 3. Database Index Verification Only

If you just want to verify indexes:

```bash
cd server
npm run test:indexes
```

## Manual Frontend Testing

For comprehensive frontend testing, you need to use browser DevTools:

### Step 1: React DevTools Profiler

1. Install React DevTools browser extension
2. Start the application: `npm run dev` (from root)
3. Open browser and navigate to `http://localhost:3000`
4. Open DevTools > Profiler tab
5. Click "Record" button (⏺)
6. Navigate to Cafe page
7. Perform actions: filter orders, search, scroll
8. Stop recording (⏹)
9. Analyze results:
   - Check render times (should be < 1000ms for initial render)
   - Verify only affected components re-render
   - Confirm memoized components don't re-render unnecessarily

### Step 2: Chrome Performance Tab

1. Open DevTools > Performance tab
2. Click "Record" button
3. Navigate to Cafe/Billing pages
4. Perform typical user actions
5. Stop recording
6. Check metrics:
   - **FCP (First Contentful Paint)**: Should be < 1.5s
   - **TTI (Time to Interactive)**: Should be < 3s
   - **TBT (Total Blocking Time)**: Should be < 300ms

### Step 3: Network Tab

1. Open DevTools > Network tab
2. Clear network log
3. Navigate to Cafe page
4. Check API requests:
   - ✓ Response times < 500ms
   - ✓ Content-Encoding: gzip
   - ✓ Response sizes are reasonable
5. Wait and observe polling:
   - ✓ Requests occur every 10 seconds (not 5)
   - ✓ When no active sessions, polling stops

### Step 4: Memory Tab

1. Open DevTools > Memory tab
2. Take heap snapshot
3. Navigate to Cafe page
4. Take another heap snapshot
5. Compare snapshots:
   - ✓ No significant memory increase
   - ✓ No detached DOM nodes
   - ✓ Event listeners are cleaned up

## Interpreting Results

### ✓ Good Performance (All targets met)

- API responses < 500ms
- Compression savings > 30%
- Indexes being used (efficiency > 90%)
- Frontend renders < 1000ms
- Minimal re-renders
- No memory leaks

### ⚠ Acceptable Performance (Some targets met)

- API responses 500-1000ms
- Compression savings 20-30%
- Index efficiency 70-90%
- Frontend renders 1000-2000ms

### ✗ Poor Performance (Needs attention)

- API responses > 1000ms
- Compression savings < 20%
- Collection scans (no index usage)
- Frontend renders > 2000ms
- Excessive re-renders
- Memory leaks detected

## Troubleshooting

### Test fails with "Authentication failed"

**Solution:** Ensure you have an admin user in the database:
```bash
cd server
npm run seed:admin
```

### Test fails with "MongoDB connection failed"

**Solution:** 
1. Check MongoDB is running: `mongod --version`
2. Verify connection string in `server/.env`
3. Ensure MongoDB service is started

### API response times are slow

**Possible causes:**
1. Database doesn't have indexes - run `npm run test:indexes` to verify
2. Too much data being returned - check pagination is working
3. Populate operations are too deep - verify selective field projection
4. Server is under load - test on idle system

### Compression not working

**Possible causes:**
1. Compression middleware not installed - check `server/server.js`
2. Client not sending Accept-Encoding header
3. Response size too small (< 1KB) - compression may be skipped

### Frontend renders are slow

**Possible causes:**
1. Memoization not working - check useMemo dependencies
2. Too many components re-rendering - use React DevTools Profiler
3. Large data sets - consider virtual scrolling
4. Expensive calculations - verify they're memoized

## Recording Results

After running tests, update the results in:
```
.kiro/specs/orders-billing-performance/PERFORMANCE_TEST_RESULTS.md
```

Fill in the [TBD] placeholders with actual values from your test runs.

## Next Steps

After completing all tests:

1. ✅ Document results in PERFORMANCE_TEST_RESULTS.md
2. ✅ Compare before/after metrics
3. ✅ Verify all requirements are met (5.3, 5.4)
4. ✅ Create summary of improvements
5. ✅ Share results with team
6. ✅ Monitor performance in production

## Quick Reference Commands

```bash
# Backend performance test
cd server && npm run test:performance

# Frontend performance analysis
cd server && npm run test:frontend-perf

# Index verification only
cd server && npm run test:indexes

# Start application for manual testing
npm run dev

# Create admin user if needed
cd server && npm run seed:admin
```

## Support

If you encounter issues:
1. Check prerequisites are met
2. Review error messages carefully
3. Verify environment configuration
4. Check MongoDB logs
5. Review server logs

---

**Happy Testing! 🚀**
