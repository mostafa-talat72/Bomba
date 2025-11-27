# إصلاح تهيئة itemPayments للفواتير الموجودة

## المشكلة
الكمية المدفوعة كانت تظهر 0 بالرغم من الدفع، والسبب هو أن `itemPayments` لم تكن موجودة في الفواتير القديمة.

## السبب
- الفواتير التي تم إنشاؤها قبل تطبيق نظام `itemPayments` الجديد لم يكن لديها هذا الحقل
- الـ pre-save hook في Bill model يُنشئ `itemPayments` فقط للفواتير الجديدة أو عند تعديل `orders`
- الفواتير الموجودة لم يتم تحديثها تلقائياً

## الحل
تم إنشاء سكريبت `initializeItemPayments.js` لتهيئة `itemPayments` لجميع الفواتير الموجودة.

### السكريبت
```bash
cd server
node scripts/initializeItemPayments.js
```

### ما يفعله السكريبت:
1. يبحث عن جميع الفواتير التي لديها `orders` لكن ليس لديها `itemPayments`
2. لكل فاتورة، ينشئ `itemPayments` من `orders.items`
3. كل `itemPayment` يحتوي على:
   - `orderId`: معرف الطلب
   - `itemId`: معرف فريد للصنف
   - `itemName`: اسم الصنف
   - `quantity`: الكمية
   - `pricePerUnit`: السعر لكل وحدة
   - `totalPrice`: السعر الإجمالي
   - `paidAmount`: 0 (غير مدفوع)
   - `isPaid`: false

### النتيجة
- تم تهيئة `itemPayments` لـ 57 فاتورة
- الآن جميع الفواتير لديها `itemPayments`
- نظام الدفع الجزئي يعمل بشكل صحيح

## الملفات المضافة
- `server/scripts/initializeItemPayments.js` - سكريبت التهيئة
- `server/scripts/checkItemPayments.js` - سكريبت التحقق (محدث)

## ملاحظات مهمة
- يجب تشغيل هذا السكريبت مرة واحدة فقط
- الفواتير الجديدة ستحصل على `itemPayments` تلقائياً عند الإنشاء
- إذا تم إضافة طلبات جديدة لفاتورة موجودة، سيتم تحديث `itemPayments` تلقائياً

## التاريخ
2024-11-24
