# Design Document

## Overview

هذا التصميم يحل مشكلة عدم ظهور الفواتير والطلبات القديمة في النظام. المشكلة الحالية هي أن الـ API يعيد فقط آخر 50 سجل بشكل افتراضي، مما يمنع المستخدمين من الوصول إلى البيانات القديمة. الحل يتضمن:

1. تحسين الـ pagination في الـ Backend API
2. إضافة infinite scroll في الـ Frontend
3. إضافة فلاتر تاريخية للبحث
4. تطبيق الحل على كل من الفواتير والطلبات

## Architecture

### Current Architecture Issues

- الـ API يستخدم pagination لكن الـ Frontend لا يستخدمه بشكل صحيح
- الـ Frontend يطلب البيانات مرة واحدة فقط عند تحميل الصفحة
- لا توجد آلية لتحميل المزيد من البيانات
- الـ limit الافتراضي (50) يخفي البيانات القديمة

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Billing/Cafe Pages                                   │  │
│  │  - Initial load: page=1, limit=50                     │  │
│  │  - Infinite scroll: page++                            │  │
│  │  - Date filter: reset to page=1                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AppContext                                           │  │
│  │  - fetchBills(page, filters)                          │  │
│  │  - fetchOrders(page, filters)                         │  │
│  │  - Accumulate results                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                     Backend API                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  GET /api/billing?page=X&limit=Y&startDate=Z          │  │
│  │  GET /api/orders?page=X&limit=Y&startDate=Z           │  │
│  │                                                        │  │
│  │  Returns:                                              │  │
│  │  {                                                     │  │
│  │    data: [...],                                        │  │
│  │    pagination: {                                       │  │
│  │      page, limit, total, hasMore, totalPages          │  │
│  │    }                                                   │  │
│  │  }                                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend API Changes

#### 1. Bills Controller (`getBills`)

**Current Implementation:**
- يقبل `page` و `limit` لكن لا يعيد metadata كافية
- الـ pagination موجودة لكن غير مستخدمة بشكل صحيح

**Proposed Changes:**
- إضافة `startDate` و `endDate` parameters للفلترة
- تحسين pagination metadata
- إضافة `hasMore` flag لمعرفة إذا كان هناك المزيد من البيانات

```javascript
// New query parameters
const {
    status,
    tableNumber,
    page = 1,
    limit = 50,
    startDate,  // NEW
    endDate,    // NEW
    customerName,
} = req.query;

// Add date filtering
if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
}

// Enhanced pagination response
res.json({
    success: true,
    count: bills.length,
    total,
    data: bills,
    pagination: {
        page: effectivePage,
        limit: effectiveLimit,
        hasMore: (effectivePage * effectiveLimit) < total,
        totalPages: Math.ceil(total / effectiveLimit)
    }
});
```

#### 2. Orders Controller (`getOrders`)

**Current Implementation:**
- مشابه لـ `getBills` - يحتاج نفس التحسينات

**Proposed Changes:**
- نفس التحسينات المطبقة على `getBills`
- إضافة date filtering
- تحسين pagination metadata

### Frontend Changes

#### 1. AppContext Updates

**New State:**
```typescript
const [billsPage, setBillsPage] = useState(1);
const [billsHasMore, setBillsHasMore] = useState(true);
const [billsLoading, setBillsLoading] = useState(false);
const [billsFilters, setBillsFilters] = useState({});

const [ordersPage, setOrdersPage] = useState(1);
const [ordersHasMore, setOrdersHasMore] = useState(true);
const [ordersLoading, setOrdersLoading] = useState(false);
const [ordersFilters, setOrdersFilters] = useState({});
```

**Updated Functions:**
```typescript
// Fetch bills with pagination
const fetchBills = async (page = 1, filters = {}, append = false) => {
    if (billsLoading) return;
    setBillsLoading(true);
    
    try {
        const response = await api.getBills({ 
            page, 
            limit: 50,
            ...filters 
        });
        
        if (response.success && response.data) {
            if (append) {
                setBills(prev => [...prev, ...response.data]);
            } else {
                setBills(response.data);
            }
            setBillsHasMore(response.pagination?.hasMore || false);
            setBillsPage(page);
        }
    } finally {
        setBillsLoading(false);
    }
};

// Load more bills
const loadMoreBills = async () => {
    if (billsHasMore && !billsLoading) {
        await fetchBills(billsPage + 1, billsFilters, true);
    }
};

// Apply filters
const applyBillsFilters = async (filters) => {
    setBillsFilters(filters);
    setBillsPage(1);
    await fetchBills(1, filters, false);
};
```

#### 2. Billing Page Updates

**New UI Components:**
- Date range picker for filtering
- "Load More" button or infinite scroll
- Loading indicator
- "No more bills" message

**Implementation:**
```typescript
// Infinite scroll detection
useEffect(() => {
    const handleScroll = () => {
        const bottom = Math.ceil(window.innerHeight + window.scrollY) 
            >= document.documentElement.scrollHeight;
        
        if (bottom && billsHasMore && !billsLoading) {
            loadMoreBills();
        }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
}, [billsHasMore, billsLoading]);

// Date filter UI
<DatePicker.RangePicker
    onChange={(dates) => {
        if (dates) {
            applyBillsFilters({
                startDate: dates[0].toISOString(),
                endDate: dates[1].toISOString()
            });
        } else {
            applyBillsFilters({});
        }
    }}
/>
```

#### 3. Cafe Page Updates

**Similar Changes:**
- Apply same pagination logic to orders
- Add date filtering
- Add infinite scroll

## Data Models

لا توجد تغييرات على نماذج البيانات. التغييرات فقط في كيفية جلب وعرض البيانات.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

Before defining properties, let's identify and eliminate redundancy:

- Properties 1.3 and 3.5 both test pagination order consistency - can be combined
- Properties 1.2 and 4.2 test the same scroll behavior for different entities - can be generalized
- Properties 2.1 and 2.4 both test date filtering - 2.1 is more comprehensive

After reflection, here are the unique, non-redundant properties:

### Property 1: Pagination maintains chronological order

*For any* set of bills in the database, fetching page N and page N+1 should return bills in consistent chronological order (newest first) with no duplicates and no gaps between pages.

**Validates: Requirements 1.3, 3.5**

### Property 2: Date filter returns only bills within range

*For any* date range (startDate, endDate), all returned bills should have createdAt >= startDate and createdAt <= endDate.

**Validates: Requirements 2.1, 2.4**

### Property 3: Bills from any time period are accessible

*For any* bill with any createdAt date, that bill should be retrievable through pagination (possibly requiring multiple page loads).

**Validates: Requirements 1.5**

### Property 4: API respects pagination parameters

*For any* valid page number and limit value, the API should return exactly min(limit, remaining_records) bills starting from the correct offset.

**Validates: Requirements 3.1**

### Property 5: API returns correct pagination metadata

*For any* query, the pagination metadata should accurately reflect: current page, limit, total count, hasMore flag, and totalPages.

**Validates: Requirements 3.2**

### Property 6: API enforces maximum limit

*For any* limit value greater than 100, the API should cap the returned results at 100 records.

**Validates: Requirements 3.3**

### Property 7: Filtered pagination maintains functionality

*For any* status filter applied to orders, pagination should work correctly with accurate page counts and hasMore flags.

**Validates: Requirements 4.4**

## Error Handling

### Backend Error Scenarios

1. **Invalid Date Format**
   - Validate date strings before parsing
   - Return 400 Bad Request with clear error message
   - Example: "Invalid date format. Use ISO 8601 format (YYYY-MM-DD)"

2. **Invalid Page/Limit Parameters**
   - Validate that page and limit are positive integers
   - Default to page=1, limit=50 if invalid
   - Log warning for debugging

3. **Database Query Timeout**
   - Set reasonable timeout for queries (5 seconds)
   - Return 504 Gateway Timeout
   - Log error with query details

4. **Empty Result Set**
   - Return success with empty array
   - Set hasMore to false
   - Include total count of 0

### Frontend Error Scenarios

1. **Network Failure**
   - Show user-friendly error message
   - Provide retry button
   - Don't clear existing data

2. **Infinite Scroll Failure**
   - Stop attempting to load more
   - Show error message at bottom of list
   - Allow manual retry

3. **Invalid Date Selection**
   - Validate date range before sending request
   - Show error if endDate < startDate
   - Clear invalid selections

## Testing Strategy

### Unit Tests

1. **Backend API Tests**
   - Test getBills with various pagination parameters
   - Test date filtering with edge cases (same day, year boundaries)
   - Test limit enforcement (request 200, get 100)
   - Test default parameter handling
   - Test pagination metadata calculation

2. **Frontend Component Tests**
   - Test infinite scroll trigger
   - Test date filter application
   - Test loading states
   - Test error states

### Property-Based Tests

We will use **fast-check** for JavaScript/TypeScript property-based testing.

**Configuration:**
- Each property test should run minimum 100 iterations
- Use appropriate generators for dates, numbers, and strings
- Tag each test with the property number from this design document

**Test Implementation Guidelines:**

1. **Property 1: Pagination Order**
   ```typescript
   // Generate random bills with dates
   // Fetch page 1 and page 2
   // Verify: page1[last].createdAt >= page2[first].createdAt
   // Verify: no duplicates between pages
   ```

2. **Property 2: Date Filtering**
   ```typescript
   // Generate random date range
   // Fetch bills with date filter
   // Verify: all bills.createdAt within range
   ```

3. **Property 3: Historical Access**
   ```typescript
   // Create bill with random old date
   // Paginate through all pages
   // Verify: bill appears in results
   ```

4. **Property 4: Pagination Parameters**
   ```typescript
   // Generate random valid page and limit
   // Fetch bills
   // Verify: correct number of results
   // Verify: correct offset applied
   ```

5. **Property 5: Metadata Accuracy**
   ```typescript
   // Generate random query
   // Fetch bills
   // Verify: metadata.total matches actual count
   // Verify: metadata.hasMore is correct
   ```

6. **Property 6: Limit Enforcement**
   ```typescript
   // Request with limit > 100
   // Verify: results.length <= 100
   ```

7. **Property 7: Filtered Pagination**
   ```typescript
   // Generate random status filter
   // Fetch multiple pages
   // Verify: pagination works correctly
   // Verify: all results match filter
   ```

### Integration Tests

1. **End-to-End Pagination Flow**
   - Create 150 bills in database
   - Load page 1 (50 bills)
   - Load page 2 (50 bills)
   - Load page 3 (50 bills)
   - Verify: all 150 bills retrieved
   - Verify: no duplicates
   - Verify: correct chronological order

2. **Date Filter Integration**
   - Create bills across multiple months
   - Apply date filter for specific month
   - Verify: only bills from that month returned
   - Verify: pagination works within filtered results

3. **Infinite Scroll Simulation**
   - Simulate scroll events
   - Verify: pages load automatically
   - Verify: loading states update correctly
   - Verify: stops at last page

## Performance Considerations

### Backend Optimizations

1. **Database Indexing**
   - Ensure index on `createdAt` for efficient sorting
   - Ensure index on `organization` for filtering
   - Consider compound index: `(organization, createdAt)`

2. **Query Optimization**
   - Use `.lean()` for read-only queries
   - Limit populated fields to essential data
   - Use `.select()` to fetch only needed fields

3. **Caching Strategy**
   - Consider caching first page results (TTL: 30 seconds)
   - Invalidate cache on new bill creation
   - Don't cache filtered results

### Frontend Optimizations

1. **Debouncing**
   - Debounce scroll events (300ms)
   - Prevent multiple simultaneous requests

2. **Virtual Scrolling**
   - Consider implementing virtual scrolling for very large lists
   - Render only visible items + buffer

3. **Request Deduplication**
   - Prevent duplicate requests for same page
   - Cancel pending requests when filters change

## Migration Plan

### Phase 1: Backend Updates (Low Risk)

1. Add date filtering to `getBills` and `getOrders`
2. Enhance pagination metadata
3. Add tests
4. Deploy to production (backward compatible)

### Phase 2: Frontend Updates (Medium Risk)

1. Update AppContext with pagination state
2. Update Billing page with infinite scroll
3. Add date filter UI
4. Test thoroughly in staging

### Phase 3: Orders Page (Low Risk)

1. Apply same changes to Cafe/Orders page
2. Test and deploy

### Rollback Plan

- Backend changes are backward compatible
- Frontend can be rolled back independently
- No database migrations required
