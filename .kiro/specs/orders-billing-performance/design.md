# Design Document

## Overview

تصميم شامل لتحسين أداء صفحات الطلبات والفواتير في نظام Bomba من خلال تحسين استعلامات قاعدة البيانات، إضافة فهارس، تقليل البيانات المنقولة، وتحسين معالجة البيانات في الواجهة الأمامية.

## Architecture

### Current Architecture Issues

1. **Over-fetching Data**: استعلامات قاعدة البيانات تجلب جميع الحقول حتى غير المستخدمة
2. **Excessive Populates**: عمليات populate متعددة ومتداخلة تبطئ الاستعلامات
3. **No Pagination Enforcement**: عدم وجود حد افتراضي معقول للبيانات المسترجعة
4. **Missing Indexes**: عدم وجود فهارس على الحقول المستخدمة في الاستعلامات
5. **Frequent Polling**: التحديث التلقائي كل 5 ثوانٍ يضع حملاً زائداً
6. **Unnecessary Re-renders**: عدم استخدام memoization يسبب إعادة رسم غير ضرورية

### Improved Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Cafe Page    │  │ Billing Page │  │ AppContext   │      │
│  │ - Memoized   │  │ - Memoized   │  │ - Smart      │      │
│  │ - Optimized  │  │ - Optimized  │  │   Polling    │      │
│  │   Rendering  │  │   Rendering  │  │ - Caching    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Order        │  │ Billing      │  │ Compression  │      │
│  │ Controller   │  │ Controller   │  │ Middleware   │      │
│  │ - Selective  │  │ - Selective  │  │ - Gzip       │      │
│  │   Fields     │  │   Fields     │  │              │      │
│  │ - Limited    │  │ - Limited    │  │              │      │
│  │   Populates  │  │   Populates  │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Mongoose
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    MongoDB Database                          │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ Orders       │  │ Bills        │                         │
│  │ Collection   │  │ Collection   │                         │
│  │ + Indexes    │  │ + Indexes    │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Backend API Optimization

#### Order Controller (`server/controllers/orderController.js`)

**Optimized getOrders Function:**

```javascript
export const getOrders = async (req, res) => {
    const { status, tableNumber, page = 1, limit = 50 } = req.query;
    
    const query = {
        organization: req.user.organization
    };
    if (status) query.status = status;
    if (tableNumber) query.tableNumber = tableNumber;
    
    // Selective field projection
    const orders = await Order.find(query)
        .select('orderNumber customerName tableNumber status items total createdAt')
        .populate('createdBy', 'name')
        .populate('bill', 'billNumber status')
        .sort({ createdAt: -1 })
        .limit(Math.min(limit, 100)) // Max 100 records
        .skip((page - 1) * limit)
        .lean(); // Convert to plain JS objects for better performance
    
    return res.json({
        success: true,
        data: orders,
        pagination: {
            page,
            limit,
            hasMore: orders.length === limit
        }
    });
};
```

#### Billing Controller (`server/controllers/billingController.js`)

**Optimized getBills Function:**

```javascript
export const getBills = async (req, res) => {
    const { status, tableNumber, page = 1, limit = 50 } = req.query;
    
    const query = {
        organization: req.user.organization
    };
    if (status) query.status = status;
    if (tableNumber) query.tableNumber = tableNumber;
    
    // Selective field projection
    const bills = await Bill.find(query)
        .select('billNumber customerName tableNumber status total paid remaining orders sessions createdAt')
        .populate({
            path: 'orders',
            select: 'orderNumber status items',
            options: { limit: 10 } // Limit populated orders
        })
        .populate({
            path: 'sessions',
            select: 'deviceName deviceType status finalCost',
            options: { limit: 5 } // Limit populated sessions
        })
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(Math.min(limit, 100))
        .skip((page - 1) * limit)
        .lean();
    
    return res.json({
        success: true,
        data: bills,
        pagination: {
            page,
            limit,
            hasMore: bills.length === limit
        }
    });
};
```

### 2. Database Indexes

#### Order Model Indexes

```javascript
// Compound index for common queries
orderSchema.index({ organization: 1, status: 1, createdAt: -1 });
orderSchema.index({ organization: 1, tableNumber: 1, createdAt: -1 });
orderSchema.index({ organization: 1, createdAt: -1 });
```

#### Bill Model Indexes

```javascript
// Compound index for common queries
billSchema.index({ organization: 1, status: 1, createdAt: -1 });
billSchema.index({ organization: 1, tableNumber: 1, createdAt: -1 });
billSchema.index({ organization: 1, createdAt: -1 });
// Text index for customer name search
billSchema.index({ customerName: 'text' });
```

### 3. Frontend Optimization

#### AppContext Smart Polling

```typescript
// Smart polling that adjusts based on activity
const useSmartPolling = (fetchFunction: () => Promise<void>, hasActivity: boolean) => {
    useEffect(() => {
        if (!hasActivity) return; // Don't poll if no activity
        
        const interval = setInterval(fetchFunction, 10000); // 10 seconds
        return () => clearInterval(interval);
    }, [hasActivity, fetchFunction]);
};
```

#### Memoized Components

```typescript
// Cafe.tsx - Memoize expensive computations
const filteredOrders = useMemo(() => {
    return orders.filter(order => {
        // Filter logic
    });
}, [orders, filterCriteria]);

const orderStats = useMemo(() => {
    return calculateStats(filteredOrders);
}, [filteredOrders]);
```

```typescript
// Billing.tsx - Memoize expensive computations
const filteredBills = useMemo(() => {
    return bills.filter(bill => {
        // Filter logic
    });
}, [bills, filterCriteria]);

const billStats = useMemo(() => {
    return calculateStats(filteredBills);
}, [filteredBills]);
```

### 4. Response Compression

#### Compression Middleware

```javascript
import compression from 'compression';

// Add to server.js
app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    },
    level: 6 // Balance between speed and compression ratio
}));
```

## Data Models

### Optimized Query Patterns

#### Before (Slow):
```javascript
const orders = await Order.find({ organization: orgId })
    .populate('createdBy')
    .populate('preparedBy')
    .populate('deliveredBy')
    .populate('bill')
    .sort({ createdAt: -1 });
```

#### After (Fast):
```javascript
const orders = await Order.find({ organization: orgId })
    .select('orderNumber customerName status items total createdAt')
    .populate('createdBy', 'name')
    .populate('bill', 'billNumber status')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
```

**Performance Improvement**: ~60-70% faster query execution

## Error Handling

### Query Timeout Handling

```javascript
const executeWithTimeout = async (query, timeoutMs = 5000) => {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
    });
    
    return Promise.race([query, timeoutPromise]);
};
```

### Graceful Degradation

```javascript
// If full data fetch fails, try with minimal data
try {
    const data = await fetchFullData();
    return data;
} catch (error) {
    console.warn('Full fetch failed, trying minimal fetch');
    return await fetchMinimalData();
}
```

## Testing Strategy

### Performance Testing

1. **Baseline Measurement**
   - Measure current response times for getOrders and getBills
   - Record current database query execution times
   - Document current frontend render times

2. **Load Testing**
   - Test with 100, 500, 1000 records
   - Measure response times at different data volumes
   - Verify pagination works correctly

3. **Index Effectiveness**
   - Use MongoDB explain() to verify index usage
   - Compare query execution times before/after indexes
   - Monitor index size and memory usage

4. **Frontend Performance**
   - Use React DevTools Profiler to measure render times
   - Verify memoization prevents unnecessary re-renders
   - Test with different data volumes

### Integration Testing

1. **API Endpoints**
   - Test getOrders with various filters
   - Test getBills with various filters
   - Verify pagination works correctly
   - Test with and without compression

2. **Frontend Components**
   - Test Cafe page loads correctly
   - Test Billing page loads correctly
   - Verify filtering and searching work
   - Test automatic refresh behavior

### Performance Benchmarks

**Target Metrics:**
- API response time: < 500ms for 100 records
- API response time: < 1000ms for 500 records
- Frontend initial render: < 1000ms
- Frontend filter/search: < 100ms
- Database query execution: < 200ms

## Implementation Phases

### Phase 1: Backend Optimization (Priority: High)
1. Add database indexes
2. Optimize getOrders controller
3. Optimize getBills controller
4. Add response compression
5. Test and measure improvements

### Phase 2: Frontend Optimization (Priority: High)
1. Add memoization to Cafe page
2. Add memoization to Billing page
3. Implement smart polling in AppContext
4. Test and measure improvements

### Phase 3: Advanced Optimizations (Priority: Medium)
1. Implement virtual scrolling for large lists
2. Add incremental data loading
3. Implement data caching strategy
4. Add performance monitoring

## Monitoring and Metrics

### Backend Metrics
- Query execution time
- Response size (before/after compression)
- API response time
- Database connection pool usage

### Frontend Metrics
- Time to first render
- Time to interactive
- Number of re-renders
- Memory usage

### Logging
```javascript
Logger.info('Query performance', {
    endpoint: '/api/orders',
    executionTime: queryTime,
    recordCount: results.length,
    compressed: res.get('Content-Encoding') === 'gzip'
});
```
