# اختبار نظام الدفع الجزئي

## الإصلاحات المطبقة:

### 1. إصلاح Frontend (billAggregation.ts)
```typescript
// تغيير id من key إلى itemId بتنسيق Backend
id: itemId, // Use backend expected format: ${orderId}-${itemIndex}
orderId: order._id, // Add orderId for backend
```

### 2. إصلاح Frontend (Billing.tsx)
```typescript
// إرسال itemId مباشرة بدلاً من itemName + price
itemsByOrder[aggregatedItem.orderId].push({
  itemId: item.itemId, // إرسال itemId مباشرة
  quantity: item.quantity
});
```

### 3. إصلاح Backend (billingController.js)
```javascript
// البحث عن العنصر باستخدام itemIndex من itemId
const itemIndex = parseInt(paymentItem.itemId.split('-').pop() || '-1');
const orderItem = order.items[itemIndex];
```

### 4. إصلاح Backend (Bill.js)
```javascript
// منع remaining من أن يكون سالباً
this.remaining = Math.max(0, calculatedRemaining);
```

## خطوات الاختبار:

1. **تأكد من تشغيل الخادم**
   ```bash
   # في مجلد server
   npm run dev
   ```

2. **افتح Frontend**
   ```bash
   # في المجلد الرئيسي
   npm run client:dev
   ```

3. **اختبار الدفع الجزئي**:
   - أنشئ فاتورة جديدة مع عدة أصناف
   - اختر "دفع جزئي للمشروبات"
   - اختر كميات جزئية من بعض الأصناف
   - اضغط "تأكيد الدفع"
   - تحقق من:
     - ✅ عدم ظهور أخطاء في Console
     - ✅ تحديث الفاتورة فوراً
     - ✅ عرض الكميات المتبقية بشكل صحيح
     - ✅ حالة الفاتورة = "partial"

## المشاكل المحلولة:

- ❌ `itemId: undefined` → ✅ `itemId: ${orderId}-${itemIndex}`
- ❌ `remaining: -9` → ✅ `remaining: Math.max(0, calculated)`
- ❌ إرسال `itemName + price` → ✅ إرسال `itemId + quantity`
- ❌ البحث بـ `indexOf` → ✅ البحث بـ `itemIndex`

## إذا استمرت المشاكل:

1. **تحقق من Console في المتصفح**
2. **تحقق من Network tab للطلبات**
3. **تحقق من logs الخادم**
4. **تأكد من أن البيانات تصل بالتنسيق الصحيح**

النظام الآن يجب أن يعمل بشكل صحيح! 🎯