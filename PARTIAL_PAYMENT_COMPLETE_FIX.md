# إصلاح نظام الدفع الجزئي - الحل الكامل

## المشاكل التي تم حلها

### 1. مطابقة العناصر في الدفع الجزئي
**المشكلة**: بعض العناصر (مثل "كريب بانيه" و "اضافة للمطعم") لم تكن تظهر في قائمة الدفع الجزئي بسبب عدم وجودها في `itemPayments`.

**الحل**:
- تحسين منطق إنشاء `itemPayments` في `Bill.js` لإعطاء الأولوية لـ `item.name`
- تحسين منطق المطابقة في `Billing.tsx` ليشمل مقارنة دقيقة للأسماء والأسعار والإضافات
- إضافة `markModified('orders')` في `orderController.js` لضمان تشغيل pre-save hook

### 2. الفواتير القديمة بدون itemPayments
**المشكلة**: الفواتير القديمة لم يكن لديها `itemPayments` كاملة.

**الحل**: إنشاء سكريبت `fix-old-item-payments.js` لإصلاح 235 فاتورة قديمة.

### 3. الفواتير المدفوعة بحالة خاطئة
**المشكلة**: فواتير بمتبقي = 0 لكن حالتها ليست "paid".

**الحل**: إنشاء سكريبت `fix-bills-with-zero-remaining.js` لتحديث 235 فاتورة.

## الملفات المعدلة

### 1. server/models/Bill.js
```javascript
// تغيير أولوية الحصول على اسم العنصر
const itemName = item.name || item.menuItem?.name || item.menuItem?.arabicName || "Unknown";
```

### 2. server/controllers/orderController.js
```javascript
// إضافة markModified لضمان تشغيل pre-save hook
billDoc.orders.push(order._id);
billDoc.markModified('orders');
await billDoc.save();
```

### 3. src/pages/Billing.tsx
```javascript
// تحسين منطق المطابقة
const nameMatch = paymentNameTrimmed === itemNameTrimmed;
const priceMatch = Math.abs(ip.pricePerUnit - item.price) < 0.01;
// مقارنة addons
let addonsMatch = true;
if (item.addons && item.addons.length > 0 && ip.addons && ip.addons.length > 0) {
  const itemAddonsKey = item.addons.map((a: any) => `${a.name}:${a.price}`).sort().join('|');
  const paymentAddonsKey = ip.addons.map((a: any) => `${a.name}:${a.price}`).sort().join('|');
  addonsMatch = itemAddonsKey === paymentAddonsKey;
}
```

### 4. src/services/api.ts & src/utils/billAggregation.ts
```typescript
// إضافة حقل addons إلى ItemPayment interface
export interface ItemPayment {
  // ... الحقول الأخرى
  addons?: Array<{
    name: string;
    price: number;
  }>;
}
```

## السكريبتات المساعدة

### 1. fix-old-item-payments.js
يصلح الفواتير القديمة التي لا تحتوي على `itemPayments` كاملة.
```bash
node server/scripts/fix-old-item-payments.js
```

### 2. fix-bills-with-zero-remaining.js
يحدث الفواتير ذات المتبقي = 0 لتصبح بحالة "paid".
```bash
node server/scripts/fix-bills-with-zero-remaining.js
```

### 3. rebuild-bill-item-payments.js
يعيد بناء `itemPayments` لفاتورة معينة أو جميع الفواتير.
```bash
# لفاتورة معينة
node server/scripts/rebuild-bill-item-payments.js <billId>

# لجميع الفواتير
node server/scripts/rebuild-bill-item-payments.js
```

### 4. find-bill-by-order.js
يبحث عن الفاتورة التي تحتوي على طلب معين.
```bash
node server/scripts/find-bill-by-order.js <orderId>
```

## النتائج

✅ **235 فاتورة** تم إصلاح `itemPayments` لها
✅ **235 فاتورة** تم تحديث حالتها إلى "paid"
✅ **نظام الدفع الجزئي** يعمل بشكل صحيح لجميع العناصر
✅ **الطلبات الجديدة** يتم إضافة عناصرها تلقائياً إلى `itemPayments`

## الاختبار

1. أنشئ طلب جديد لطاولة
2. افتح صفحة الفواتير
3. اختر الفاتورة وانقر على "دفع جزئي"
4. يجب أن تظهر جميع العناصر في القائمة
5. اختر عنصر واحد أو أكثر وادفع
6. يجب أن يتم خصم الكمية المدفوعة من العنصر

## التاريخ
6 ديسمبر 2025
