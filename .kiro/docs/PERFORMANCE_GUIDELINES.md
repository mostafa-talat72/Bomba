# Performance Guidelines

## Console Statements
❌ **لا تستخدم console.log, console.error, console.warn في الكود**

### Why?
- تؤثر على الأداء بشكل كبير
- تبطئ التطبيق خاصة في الإنتاج
- تستهلك الذاكرة
- تملأ DevTools بالرسائل غير المفيدة

### Alternatives

#### For Development Debugging
استخدم breakpoints في VS Code أو المتصفح بدلاً من console.log:
```typescript
// ❌ Bad

// ✅ Good
// Use breakpoint here and inspect variables
```

#### For Error Logging (Backend)
استخدم Logger المخصص:
```javascript
// ❌ Bad
console.error('Error:', error);

// ✅ Good
import Logger from '../middleware/logger.js';
Logger.error('Error occurred', { error: error.message, stack: error.stack });
```

#### For Performance Monitoring (Backend)
يمكن تعطيل performance logging من ملف `.env`:
```env
# Disable performance logging to improve performance
ENABLE_PERFORMANCE_LOGGING=false
```

#### For User Notifications (Frontend)
استخدم showNotification:
```typescript
// ❌ Bad
console.error('Failed to save');

// ✅ Good
showNotification('فشل في الحفظ', 'error');
```

## Other Performance Tips

### 1. Avoid Unnecessary Re-renders
```typescript
// ✅ Use useMemo for expensive calculations
const expensiveValue = useMemo(() => {
  return calculateExpensiveValue(data);
}, [data]);

// ✅ Use useCallback for functions passed to children
const handleClick = useCallback(() => {
  doSomething();
}, []);
```

### 2. Optimize API Calls
```typescript
// ✅ Use smart polling instead of constant polling
const { data } = useSmartPolling(fetchData, {
  interval: 5000,
  enabled: isActive
});
```

### 3. Lazy Load Components
```typescript
// ✅ Lazy load heavy components
const HeavyComponent = lazy(() => import('./HeavyComponent'));
```

### 4. Avoid Large Loops in Render
```typescript
// ❌ Bad
{items.map(item => {
  const processed = expensiveOperation(item); // Called on every render!
  return <Item data={processed} />;
})}

// ✅ Good
const processedItems = useMemo(() => 
  items.map(item => expensiveOperation(item)),
  [items]
);
{processedItems.map(item => <Item data={item} />)}
```

### 5. Database Queries
```javascript
// ✅ Use indexes
orderSchema.index({ organization: 1, status: 1, createdAt: -1 });

// ✅ Use lean() for read-only queries
const orders = await Order.find({ status: 'pending' }).lean();

// ✅ Select only needed fields
const users = await User.find().select('name email');
```

## Monitoring Performance

### Frontend
استخدم React DevTools Profiler لقياس الأداء

### Backend
استخدم Performance Monitoring Middleware:
```javascript
const { performanceMonitor } = require('./middleware/performanceMonitor');
router.get('/api/orders', performanceMonitor, getOrders);
```

## Remember
🚀 **Performance is a feature!**
