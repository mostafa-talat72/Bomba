# إصلاح مشكلة عرض العناصر المدفوعة

## المشكلة
كانت صفحة Billing.tsx تعرض رسالة "جميع العناصر مدفوعة بالكامل" بالرغم من وجود طلبات غير مدفوعة.

## السبب
الكود كان يستخدم `partialPayments` (النظام القديم) بدلاً من `itemPayments` (النظام الجديد المحسّن).

## الإصلاح

### 1. تحديث استخدام itemPayments في Billing.tsx

تم استبدال جميع استخدامات `selectedBill?.partialPayments` بـ `selectedBill?.itemPayments` في:

- دالة `handlePayForItems()` - السطر 678
- دالة `handleSelectAllItems()` - السطر 733
- عرض العناصر في نافذة الدفع الجزئي - السطر 2305
- عرض العناصر في نافذة الدفع الجزئي (موقع آخر) - السطر 2465
- ملخص الدفع - السطر 2510
- حساب المبلغ المتبقي - السطر 2553

### 2. إزالة منطق الدفع الجزئي للإضافات

تم إزالة الكود الذي كان يحاول معاملة الإضافات (addons) كعناصر منفصلة يمكن دفعها بشكل مستقل.

**السبب:** الإضافات هي جزء من العنصر الرئيسي وليست عناصر منفصلة. عندما يتم دفع العنصر، يتم دفع إضافاته معه.

**التغيير:** تم تبسيط عرض الإضافات لتكون معلومات فقط بدون أزرار دفع منفصلة.

## النتيجة

الآن عند فتح نافذة الدفع الجزئي للأصناف:
- ✅ يتم عرض العناصر غير المدفوعة بشكل صحيح
- ✅ يتم حساب الكميات المدفوعة والمتبقية بدقة
- ✅ يتم استخدام نظام `itemPayments` الجديد المحسّن
- ✅ الإضافات تُعرض كمعلومات فقط مع العنصر الرئيسي

## الملفات المعدلة

### Frontend:
- `src/pages/Billing.tsx` - تحديث 6 مواقع لاستخدام itemPayments بدلاً من partialPayments
- `src/pages/Billing.tsx` - تبسيط عرض الإضافات
- `src/pages/Billing.tsx` - إزالة استدعاء updateBillStatus غير الضروري من handlePartialPayment

### Backend:
- `server/controllers/billingController.js` - إضافة populate لـ itemPayments.paidBy في دالة getBill (مسارين)
- `server/controllers/billingController.js` - إضافة populate لـ sessionPayments.payments.paidBy

### Scripts:
- `server/scripts/checkItemPayments.js` - سكريبت جديد للتحقق من بيانات itemPayments

## الإصلاحات التفصيلية

### 1. إصلاح Frontend (Billing.tsx)
- استبدال `partialPayments` بـ `itemPayments` في 6 مواقع
- إزالة استدعاء `updateBillStatus` من `handlePartialPayment` الذي كان يسبب تحديث غير متوقع للبيانات
- تبسيط عرض الإضافات (addons) لتكون معلومات فقط

### 2. إصلاح Backend (billingController.js)
- إضافة `.populate("itemPayments.paidBy", "name")` في دالة getBill
- إضافة `.populate("sessionPayments.payments.paidBy", "name")` في دالة getBill
- التأكد من إرجاع بيانات itemPayments كاملة من API

### 3. المشكلة الأساسية
المشكلة كانت مزيج من:
1. Frontend يستخدم `partialPayments` القديم بدلاً من `itemPayments` الجديد
2. استدعاء `updateBillStatus` في `handlePartialPayment` كان يسبب تحديث البيانات قبل فتح النافذة
3. Backend لم يكن يقوم بـ populate لحقل `itemPayments.paidBy`

## ملاحظات

- صفحة `BillView.tsx` كانت تستخدم `itemPayments` بشكل صحيح من البداية
- دالة `aggregateItemsWithPayments` في `src/utils/billAggregation.ts` تعمل بشكل صحيح
- النظام القديم `partialPayments` لا يزال موجوداً في قاعدة البيانات للتوافق مع البيانات القديمة
- دالة `getBills` كانت تحتوي على populate صحيح لـ itemPayments

## كيفية التحقق

استخدم السكريبت للتحقق من البيانات:
```bash
cd server
node scripts/checkItemPayments.js
```

## الإصلاح الإضافي: استخدام payForItems بدلاً من addPartialPayment

### المشكلة الثانية
بعد الإصلاح الأول، كانت العناصر تختفي بعد تأكيد الدفع الجزئي.

### السبب
الكود كان يستخدم `addPartialPayment` (النظام القديم) بدلاً من `api.payForItems` (النظام الجديد).

### الإصلاح
- تم تحديث `handlePartialPaymentSubmit` لاستخدام `api.payForItems`
- تم إنشاء منطق للبحث عن `itemPayments` IDs المطابقة للعناصر المحددة
- تم إزالة استدعاء `updateBillStatus` الذي كان يسبب تحديث غير متوقع

### الكود الجديد
```typescript
// البحث عن itemPayments IDs المطابقة للعناصر المحددة
const itemPaymentIds: string[] = [];

itemsToPay.forEach(item => {
  selectedBill?.itemPayments?.forEach((payment: any) => {
    if (
      payment.itemName === item.itemName &&
      payment.pricePerUnit === item.price &&
      !payment.isPaid
    ) {
      itemPaymentIds.push(payment._id || payment.id);
    }
  });
});

// استخدام API الجديد
const response = await api.payForItems(selectedBill.id || selectedBill._id, {
  itemIds: itemPaymentIds,
  paymentMethod: partialPaymentMethod
});
```

## التاريخ
2024-11-24 (تحديث 2)
