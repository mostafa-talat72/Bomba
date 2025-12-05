# إصلاح مطابقة العناصر في الدفع الجزئي

## المشكلة
عند محاولة الدفع الجزئي لبعض الأصناف (مثل "اضافة للمطعم" و "كريب بانيه")، كان النظام يظهر خطأ:
```
❌ لم يتم العثور على itemPayment مطابق للعنصر
```

السبب: عدم تطابق الأسماء بين `itemPayments` المحفوظة في الفاتورة والعناصر المعروضة في واجهة الدفع الجزئي.

## الحل المطبق

### 1. تحسين إنشاء itemPayments في Bill.js
**الملف**: `server/models/Bill.js`

تم تعديل ترتيب أولوية الحصول على اسم العنصر:
```javascript
// قبل:
const itemName = item.menuItem?.name || item.menuItem?.arabicName || item.name || "Unknown";

// بعد:
const itemName = item.name || item.menuItem?.name || item.menuItem?.arabicName || "Unknown";
```

**السبب**: عند إنشاء الطلبات، يتم حفظ `item.name` مباشرة، بينما `item.menuItem` قد يكون ObjectId فقط وليس populated. لذلك يجب إعطاء الأولوية لـ `item.name`.

### 2. تحسين منطق المطابقة في Billing.tsx
**الملف**: `src/pages/Billing.tsx`

تم تحسين منطق البحث عن `itemPayments` المطابقة:

#### أ. مقارنة الأسماء
```javascript
const itemNameTrimmed = item.itemName.trim();
const paymentNameTrimmed = ip.itemName.trim();
const nameMatch = paymentNameTrimmed === itemNameTrimmed;
```

#### ب. مقارنة السعر مع تحمل الأخطاء العشرية
```javascript
const priceMatch = Math.abs(ip.pricePerUnit - item.price) < 0.01;
```

#### ج. مقارنة الإضافات (addons)
```javascript
let addonsMatch = true;
if (item.addons && item.addons.length > 0 && ip.addons && ip.addons.length > 0) {
  const itemAddonsKey = item.addons.map((a: any) => `${a.name}:${a.price}`).sort().join('|');
  const paymentAddonsKey = ip.addons.map((a: any) => `${a.name}:${a.price}`).sort().join('|');
  addonsMatch = itemAddonsKey === paymentAddonsKey;
} else if ((item.addons && item.addons.length > 0) || (ip.addons && ip.addons.length > 0)) {
  addonsMatch = false;
}
```

#### د. الشرط النهائي
```javascript
return nameMatch && priceMatch && addonsMatch && remainingQty > 0;
```

### 3. إضافة حقل addons إلى ItemPayment interface
**الملفات**: 
- `src/services/api.ts`
- `src/utils/billAggregation.ts`

تم إضافة حقل `addons` إلى interface:
```typescript
export interface ItemPayment {
  // ... الحقول الأخرى
  addons?: Array<{
    name: string;
    price: number;
  }>;
  // ...
}
```

### 4. تحسين رسائل الخطأ
تم تغيير `console.error` إلى `console.warn` لأن الخطأ ليس حرجاً، وإضافة معلومات addons في رسالة التحذير.

## النتيجة
- ✅ تطابق دقيق للعناصر بناءً على الاسم والسعر والإضافات
- ✅ تحمل الأخطاء العشرية البسيطة في السعر
- ✅ دعم كامل للعناصر مع الإضافات (addons)
- ✅ رسائل تحذير واضحة عند عدم العثور على مطابقة

## الملفات المعدلة
1. `server/models/Bill.js` - تحسين إنشاء itemPayments
2. `src/pages/Billing.tsx` - تحسين منطق المطابقة
3. `src/services/api.ts` - إضافة addons إلى ItemPayment interface
4. `src/utils/billAggregation.ts` - إضافة addons إلى ItemPayment interface

## التاريخ
6 ديسمبر 2025
