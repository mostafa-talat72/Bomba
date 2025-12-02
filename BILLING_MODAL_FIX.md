# إصلاح مشكلة تداخل الفواتير في نافذة إدارة الدفع

## المشكلة
عند فتح نافذة إدارة الدفع لفاتورة معينة، كانت تتداخل فاتورة أخرى وتظهر بدلاً منها، خصوصاً إذا كانت تحتوي على جلسة نشطة.

## السبب
كان هناك useEffect يقوم بتحديث `selectedBill` تلقائياً كل 5 ثوان للفواتير التي تحتوي على جلسات نشطة، وهذا كان يحدث حتى عندما تكون نافذة الدفع مفتوحة، مما يسبب تبديل الفاتورة المعروضة.

## الحل المطبق

### 1. تحديث useEffect الأول (مراقبة تغييرات bills)
```typescript
// قبل الإصلاح
if (selectedBill && bills.length > 0 && !showPaymentModal) {
  // تحديث selectedBill
}

// بعد الإصلاح
if (selectedBill && bills.length > 0 && 
    !showPaymentModal && 
    !showPartialPaymentModal && 
    !showSessionPaymentModal) {
  // تحديث selectedBill
}
```

### 2. تحديث useEffect الثاني (تحديث الجلسات النشطة)
```typescript
// قبل الإصلاح
if (selectedBill && (selectedBill._id === bill._id || selectedBill.id === bill.id)) {
  const billRes = await api.getBill(bill._id || bill.id);
  if (billRes.success && billRes.data) {
    setSelectedBill(billRes.data);
  }
}

// بعد الإصلاح
if (selectedBill && 
    (selectedBill._id === bill._id || selectedBill.id === bill.id) &&
    !showPaymentModal && 
    !showPartialPaymentModal && 
    !showSessionPaymentModal) {
  const billRes = await api.getBill(bill._id || bill.id);
  if (billRes.success && billRes.data) {
    setSelectedBill(billRes.data);
  }
}
```

### 3. تحديث dependencies للـ useEffect
```typescript
// قبل الإصلاح
}, [bills.length, bills.map(b => (b.sessions || []).map(s => s.status).join(',')).join(',')]);

// بعد الإصلاح
}, [bills.length, bills.map(b => (b.sessions || []).map(s => s.status).join(',')).join(','), 
    showPaymentModal, showPartialPaymentModal, showSessionPaymentModal]);
```

## النتيجة
- ✅ عند فتح نافذة إدارة الدفع، لا يتم تحديث `selectedBill` تلقائياً
- ✅ الفاتورة المعروضة تبقى ثابتة حتى يتم إغلاق النافذة
- ✅ التحديث التلقائي للجلسات النشطة يستمر في الخلفية دون التأثير على النافذة المفتوحة
- ✅ بعد إغلاق النافذة، يعود التحديث التلقائي للعمل بشكل طبيعي

## النوافذ المحمية
1. `showPaymentModal` - نافذة إدارة الدفع الرئيسية
2. `showPartialPaymentModal` - نافذة الدفع الجزئي للأصناف
3. `showSessionPaymentModal` - نافذة الدفع الجزئي للجلسات

## الملفات المعدلة
- `src/pages/Billing.tsx`

## ملاحظات
- الإصلاح لا يؤثر على التحديث التلقائي للفواتير في القائمة الرئيسية
- الإصلاح لا يؤثر على تحديث تكلفة الجلسات النشطة في الخلفية
- الإصلاح يضمن تجربة مستخدم سلسة عند إدارة الدفعات
