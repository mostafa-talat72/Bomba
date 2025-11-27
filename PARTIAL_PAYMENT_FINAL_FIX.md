# إصلاح نهائي لنظام الدفع الجزئي للأصناف

## المشاكل التي تم حلها

### 1. العناصر لا تظهر عند فتح نافذة الدفع
**السبب:** استخدام `partialPayments` القديم بدلاً من `itemPayments` الجديد  
**الإصلاح:** تحديث 6 مواقع في `Billing.tsx` لاستخدام `itemPayments`

### 2. العناصر تختفي بعد فتح النافذة
**السبب:** استدعاء `updateBillStatus` في `handlePartialPayment` يسبب تحديث غير متوقع  
**الإصلاح:** إزالة الاستدعاء غير الضروري

### 3. Backend لا يُرجع بيانات itemPayments كاملة
**السبب:** عدم وجود populate لـ `itemPayments.paidBy`  
**الإصلاح:** إضافة populate في دالة `getBill`

### 4. العناصر تختفي بعد تأكيد الدفع
**السبب:** استخدام `addPartialPayment` القديم بدلاً من `payForItems` الجديد  
**الإصلاح:** تحديث `handlePartialPaymentSubmit` لاستخدام `api.payForItems`

### 5. الكمية المدفوعة لا تظهر بشكل صحيح
**السبب:** منطق خاطئ في إضافة `itemPaymentIds` - كان يضيف نفس ID عدة مرات  
**الإصلاح:** تحديث المنطق ليضيف كل `itemPayment._id` مرة واحدة فقط

## الكود النهائي الصحيح

```typescript
// في handlePartialPaymentSubmit
const itemPaymentIds: string[] = [];

itemsToPay.forEach(item => {
  let remainingQuantityToPay = item.quantity;
  
  // البحث في itemPayments عن العناصر المطابقة
  selectedBill?.itemPayments?.forEach((payment: any) => {
    if (
      remainingQuantityToPay > 0 &&
      payment.itemName === item.itemName &&
      payment.pricePerUnit === item.price &&
      !payment.isPaid
    ) {
      // كل itemPayment يمثل كمية محددة من صنف واحد
      // نضيف الـ ID مرة واحدة فقط لكل itemPayment
      itemPaymentIds.push(payment._id || payment.id);
      remainingQuantityToPay -= payment.quantity;
    }
  });
});

const response = await api.payForItems(selectedBill.id || selectedBill._id, {
  itemIds: itemPaymentIds,
  paymentMethod: partialPaymentMethod
});
```

## كيف يعمل النظام الآن

### بنية البيانات:
- كل `itemPayment` في `bill.itemPayments` يمثل صنف واحد من طلب واحد
- مثال: إذا كان هناك 3 طلبات كل منها يحتوي على "قهوة"، سيكون هناك 3 `itemPayments` منفصلة

### عملية الدفع:
1. المستخدم يختار "قهوة" ويحدد الكمية = 2
2. النظام يبحث عن `itemPayments` غير مدفوعة للقهوة
3. يضيف أول 2 `itemPayment._id` إلى القائمة
4. يرسل الطلب إلى `payForItems` في الـ backend
5. الـ backend يحدث `isPaid = true` لكل `itemPayment`
6. دالة `aggregateItemsWithPayments` تحسب الكمية المدفوعة بجمع كل `itemPayments` التي `isPaid = true`

### النتيجة:
- ✅ العناصر تظهر بشكل صحيح
- ✅ الكمية المدفوعة تُحسب بدقة
- ✅ الكمية المتبقية تُحدث بشكل صحيح
- ✅ العناصر الأخرى تبقى ظاهرة بعد الدفع

## الملفات المعدلة

### Frontend:
- `src/pages/Billing.tsx` - 8 تعديلات رئيسية
- `src/utils/billAggregation.ts` - لا تحتاج تعديل (تعمل بشكل صحيح)

### Backend:
- `server/controllers/billingController.js` - إضافة populate في مسارين
- `server/models/Bill.js` - لا تحتاج تعديل (تعمل بشكل صحيح)

## الإصلاح الإضافي: استخراج الفاتورة من الاستجابة

### المشكلة السادسة
الكميات المدفوعة لا تظهر بشكل صحيح عند إعادة فتح النافذة.

### السبب
الاستجابة من `payForItems` تحتوي على `{ bill, paidItems, totalPaid, ... }` وليس الفاتورة مباشرة.  
الكود كان يحاول استخدام `response.data` مباشرة بدلاً من `response.data.bill`.

### الإصلاح
```typescript
// استخراج الفاتورة من الاستجابة بشكل صحيح
const updatedBill = response.data.bill || response.data;
setSelectedBill(updatedBill);
```

## كيف يعمل النظام الآن (النسخة النهائية)

### عند فتح نافذة الدفع:
1. يتم حساب `remainingQuantity` لكل صنف من `itemPayments`
2. تظهر فقط الأصناف التي `remainingQuantity > 0`
3. يتم إعادة تعيين `itemQuantities` إلى `{}`

### عند اختيار كمية:
1. الحد الأدنى = 0
2. الحد الأقصى = `item.remainingQuantity`
3. لا يمكن تجاوز الكمية المتبقية

### عند تأكيد الدفع:
1. يتم البحث عن `itemPayments` غير مدفوعة
2. يتم إرسال `itemPaymentIds` إلى الـ backend
3. الـ backend يحدث `isPaid = true` لكل `itemPayment`
4. يتم استخراج الفاتورة المحدثة من `response.data.bill`
5. يتم تحديث `selectedBill` بالبيانات الجديدة

### عند إعادة فتح النافذة:
1. يتم حساب `remainingQuantity` من البيانات المحدثة
2. تظهر فقط الأصناف غير المدفوعة
3. الكميات تعكس ما تم دفعه مسبقاً

## التاريخ
2024-11-24 (الإصلاح النهائي - التحديث 2)
