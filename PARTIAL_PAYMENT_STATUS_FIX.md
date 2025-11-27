# إصلاح حالة الفاتورة عند الدفع الجزئي

## التاريخ
2024-11-25

## المشكلة
عند دفع 3 أصناف من 9، كانت الفاتورة تتحول إلى حالة "مدفوعة بالكامل" وتظهر رسالة "تم دفع جميع المبالغ المطلوبة" بالرغم من أن 6 أصناف لا تزال غير مدفوعة.

## السبب
في ملف `server/models/Bill.js`، دالة `calculateSubtotal` كانت تحدث حالة الفاتورة بناءً على:

```javascript
if (this.paid >= this.total) {
    this.status = "paid";
}
```

المشكلة هي أن هذا المنطق **لا يتحقق من أن جميع الأصناف مدفوعة**. إذا كان:
- `this.paid = 100 EGP` (دفع 3 أصناف)
- `this.total = 100 EGP` (بعد خصم أو ضريبة)
- لكن هناك 6 أصناف أخرى غير مدفوعة

فإن الفاتورة ستتحول إلى `paid` بالرغم من وجود أصناف غير مدفوعة!

## الحل

تم تحديث المنطق ليتحقق من:
1. `this.paid >= this.total` (المبلغ المدفوع يغطي الإجمالي)
2. **جميع الأصناف مدفوعة** (`itemPayments.every(item => item.isPaid)`)
3. **جميع الجلسات مدفوعة** (`sessionPayments.every(session => session.remainingAmount === 0)`)

```javascript
// Check if all items are paid (for partial payment system)
const allItemsPaid = this.itemPayments && this.itemPayments.length > 0
    ? this.itemPayments.every(item => item.isPaid)
    : true; // If no itemPayments, consider items as paid

// Check if all sessions are paid (for partial payment system)
const allSessionsPaid = this.sessionPayments && this.sessionPayments.length > 0
    ? this.sessionPayments.every(session => session.remainingAmount === 0)
    : true; // If no sessionPayments, consider sessions as paid

if (this.paid >= this.total && allItemsPaid && allSessionsPaid) {
    this.status = "paid";
    this.remaining = 0;
} else if (this.paid > 0) {
    this.status = "partial";
} else {
    this.status = this.status || "draft";
}
```

## كيف يعمل الآن

### سيناريو 1: دفع 3 أصناف من 9
- `this.paid = 30 EGP` (3 أصناف × 10 EGP)
- `this.total = 90 EGP` (9 أصناف × 10 EGP)
- `allItemsPaid = false` (6 أصناف لا تزال غير مدفوعة)
- **النتيجة**: `status = "partial"` ✅

### سيناريو 2: دفع جميع الأصناف (9 من 9)
- `this.paid = 90 EGP`
- `this.total = 90 EGP`
- `allItemsPaid = true` (جميع الأصناف مدفوعة)
- **النتيجة**: `status = "paid"` ✅

### سيناريو 3: دفع 3 أصناف من 9 مع خصم
- `this.paid = 30 EGP` (3 أصناف × 10 EGP)
- `this.total = 45 EGP` (90 EGP - 50% خصم)
- `allItemsPaid = false` (6 أصناف لا تزال غير مدفوعة)
- **النتيجة**: `status = "partial"` ✅ (حتى لو كان المبلغ المدفوع أكبر من النصف)

### سيناريو 4: فاتورة بدون itemPayments (نظام قديم)
- `this.paid = 100 EGP`
- `this.total = 100 EGP`
- `itemPayments = []` (فاتورة قديمة)
- `allItemsPaid = true` (لا توجد itemPayments، نعتبرها مدفوعة)
- **النتيجة**: `status = "paid"` ✅ (للتوافق مع النظام القديم)

## الملفات المعدلة

1. **server/models/Bill.js**
   - تحديث دالة `calculateSubtotal` (السطور 869-873)
   - إضافة فحص `allItemsPaid` و `allSessionsPaid`

## الاختبار

### اختبار يدوي:
1. افتح صفحة Billing
2. اختر فاتورة بها 9 أصناف غير مدفوعة
3. اضغط "دفع جزئي للأصناف"
4. اختر 3 أصناف فقط
5. اضغط "تأكيد الدفع"
6. **النتيجة المتوقعة**:
   - ✅ يتم دفع 3 أصناف فقط
   - ✅ الفاتورة تبقى في حالة "partial"
   - ✅ الـ 6 أصناف الأخرى تبقى ظاهرة كغير مدفوعة
   - ✅ يمكن دفع الأصناف المتبقية لاحقاً

### اختبار باستخدام السكريبت:
```bash
cd server
node scripts/testPartialPaymentFlow.js
```

## ملاحظات مهمة

### التوافق مع النظام القديم
الكود يدعم الفواتير القديمة التي لا تحتوي على `itemPayments`:
- إذا كانت `itemPayments` فارغة أو غير موجودة، يتم اعتبار الأصناف مدفوعة
- هذا يضمن أن الفواتير القديمة تعمل بشكل صحيح

### الأولوية
الأولوية في تحديد الحالة:
1. إذا `paid >= total` **و** جميع الأصناف مدفوعة **و** جميع الجلسات مدفوعة → `paid`
2. إذا `paid > 0` → `partial`
3. خلاف ذلك → `draft`

### الجلسات النشطة
إذا كانت هناك جلسة نشطة (session.status === 'active'):
- الفاتورة لا يمكن أن تكون `paid` حتى لو كانت جميع الأصناف مدفوعة
- يجب إنهاء الجلسة أولاً

## النتيجة

✅ الدفع الجزئي يعمل بشكل صحيح الآن
✅ الفاتورة لا تتحول إلى "مدفوعة" إلا إذا كانت جميع الأصناف والجلسات مدفوعة
✅ التوافق مع النظام القديم محفوظ
✅ المنطق واضح وسهل الفهم
