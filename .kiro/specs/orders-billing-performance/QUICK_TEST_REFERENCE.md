# Quick Performance Test Reference

## 🚀 Quick Start

### Run All Tests
```bash
# Backend performance tests
cd server
npm run test:performance

# Frontend analysis
npm run test:frontend-perf

# Index verification
npm run test:indexes
```

## 📊 What Gets Tested

### Backend (Automated)
- ✅ Database indexes created and used
- ✅ API response times < 500ms
- ✅ Compression working (gzip)
- ✅ Query efficiency > 90%

### Frontend (Manual + Automated)
- ✅ Memoization effectiveness
- ✅ Render times < 1000ms
- ✅ Polling at 10s intervals
- ✅ No memory leaks

## 🎯 Success Criteria

| Metric | Target | Status |
|--------|--------|--------|
| Orders API (100 records) | < 500ms | [Run test] |
| Bills API (100 records) | < 500ms | [Run test] |
| Compression savings | > 30% | [Run test] |
| Index usage | Yes | [Run test] |
| Frontend render | < 1000ms | [Manual test] |
| Polling interval | 10s | [Manual test] |

## 📝 Record Results

Update: `.kiro/specs/orders-billing-performance/PERFORMANCE_TEST_RESULTS.md`

## 📚 Full Documentation

- **Testing Guide:** `TESTING_GUIDE.md`
- **Results Template:** `PERFORMANCE_TEST_RESULTS.md`
- **Summary:** `PERFORMANCE_VALIDATION_SUMMARY.md`

## ⚡ Quick Commands

```bash
# Backend tests
npm run test:performance      # Full performance test
npm run test:frontend-perf    # Frontend analysis
npm run test:indexes          # Index verification only

# Start app for manual testing
npm run dev                   # From root directory
```

## 🔍 Manual Testing Checklist

### React DevTools Profiler
- [ ] Open Profiler tab
- [ ] Record Cafe page navigation
- [ ] Check render times < 1000ms
- [ ] Verify minimal re-renders

### Chrome Network Tab
- [ ] Check API response times
- [ ] Verify gzip compression
- [ ] Confirm 10s polling interval
- [ ] Verify polling stops when inactive

### Chrome Memory Tab
- [ ] Take before snapshot
- [ ] Navigate to pages
- [ ] Take after snapshot
- [ ] Check for memory leaks

## 🐛 Troubleshooting

**Auth failed?** → Run `cd server && npm run seed:admin`  
**MongoDB error?** → Check MongoDB is running  
**Slow responses?** → Verify indexes with `npm run test:indexes`  
**No compression?** → Check server/server.js has compression middleware

## 📞 Need Help?

See full guide: `TESTING_GUIDE.md`
