# إصلاح حساب المبلغ المحصل والمتبقي في الفواتير

## المشكلة

كان هناك خطأ في حساب المبلغ المحصل (`paid`) والمبلغ المتبقي (`remaining`) في صفحة الفواتير. المشكلة كانت في مكانين:

### 1. Backend - دالة calculateRemainingAmount

الكود السابق كان يستخدم منطق "إما/أو" عند حساب المدفوعات:

```javascript
if (usingNewSystem) {
    // حساب من itemPayments و sessionPayments فقط
    // تجاهل payments array تماماً
} else {
    // حساب من payments array فقط
}
```

هذا المنطق كان يفترض أن الفاتورة تستخدم **إما** النظام الجديد (itemPayments/sessionPayments) **أو** النظام القديم (payments array)، لكن في الواقع:

1. بعض الفواتير تحتوي على دفعات كاملة في `payments` array **بالإضافة** إلى دفعات جزئية في `itemPayments`
2. عند إضافة دفعة كاملة، يتم إضافتها إلى `payments` array مع `type: 'full'`
3. الكود القديم كان يتجاهل هذه الدفعات الكاملة إذا كانت الفاتورة تحتوي على `itemPayments`

### 2. Frontend - حساب الإحصائيات

في صفحة الفواتير، كان الكود يحسب المبلغ المتبقي بطريقة خاطئة:

```typescript
const remaining = total - paid;
```

بدلاً من استخدام `bill.remaining` المحسوب والمحفوظ في قاعدة البيانات.

### النتيجة

- المبلغ المحصل (`paid`) كان أقل من الواقع في بعض الفواتير
- المبلغ المتبقي (`remaining`) كان أكبر من الواقع
- الإحصائيات (إجمالي المبلغ المحصل والمتبقي) كانت غير دقيقة
- الفواتير المدفوعة جزئياً كانت تظهر كأنها غير مدفوعة

## الحل

### 1. Backend - تعديل calculateRemainingAmount

تم تعديل دالة `calculateRemainingAmount` لحساب **جميع** أنواع الدفعات معاً:

```javascript
// 1. حساب المدفوع من الأصناف (itemPayments)
if (hasItemPayments) {
    this.itemPayments.forEach((item) => {
        totalPaidFromItems += item.paidAmount || 0;
    });
}

// 2. حساب المدفوع من الجلسات (sessionPayments)
if (hasSessionPayments) {
    this.sessionPayments.forEach((session) => {
        totalPaidFromSessions += session.paidAmount || 0;
    });
}

// 3. حساب المدفوع من الدفعات الكاملة (payments array)
if (hasFullPayments) {
    this.payments.forEach((payment) => {
        const paymentType = payment.type || 'full';
        
        // نحسب الدفعة فقط إذا كانت من نوع 'full'
        if (paymentType === 'full' || (!hasItemPayments && !hasSessionPayments)) {
            totalPaidFromFullPayments += payment.amount || 0;
        }
    });
}

// 4. جمع جميع المدفوعات
const totalPaid = totalPaidFromItems + totalPaidFromSessions + totalPaidFromFullPayments;
```

### 2. Frontend - استخدام bill.remaining

تم تعديل حساب الإحصائيات لاستخدام `bill.remaining` مباشرة:

```typescript
const billStats = useMemo(() => {
    return filteredBills.reduce((acc, bill) => {
      const total = Number(bill.total) || 0;
      const paid = Number(bill.paid) || 0;
      // استخدام bill.remaining مباشرة من قاعدة البيانات
      const remaining = Number(bill.remaining) || 0;

      return {
        totalBills: acc.totalBills + 1,
        totalPaid: acc.totalPaid + paid,
        totalRemaining: acc.totalRemaining + remaining,
        // ...
      };
    }, { /* ... */ });
  }, [filteredBills]);
```

### التحسينات

1. **حساب شامل**: يتم حساب جميع أنواع الدفعات (itemPayments + sessionPayments + payments)
2. **تجنب الحساب المزدوج**: الدفعات من نوع `partial-items` و `partial-session` لا يتم حسابها من `payments` array لأنها محسوبة في `itemPayments` و `sessionPayments`
3. **توافق عكسي**: الفواتير القديمة التي تستخدم `payments` array فقط ستعمل بشكل صحيح
4. **دقة أعلى**: استخدام `calculateRemainingAmount` في `calculateSubtotal` لضمان الاتساق
5. **إحصائيات دقيقة**: استخدام القيم المحسوبة والمحفوظة في قاعدة البيانات بدلاً من إعادة حسابها

## كيفية تطبيق الإصلاح

### 1. تشغيل السكريبت لإصلاح الفواتير الموجودة

```bash
cd server
node scripts/fix-bill-calculations.js
```

هذا السكريبت سيقوم بـ:
- جلب جميع الفواتير من قاعدة البيانات
- إعادة حساب `paid` و `remaining` لكل فاتورة
- حفظ الفواتير المعدلة
- عرض تقرير بالفواتير التي تم إصلاحها

### 2. إعادة تشغيل الخادم

بعد تشغيل السكريبت، أعد تشغيل الخادم لتطبيق التغييرات:

```bash
npm restart
```

## التحقق من الإصلاح

بعد تطبيق الإصلاح، تحقق من:

1. **صفحة الفواتير**: تأكد من أن المبلغ المحصل والمتبقي صحيحان في كل فاتورة
2. **الإحصائيات**: تأكد من أن إجمالي المبلغ المحصل والمتبقي في الإحصائيات صحيح
3. **تفاصيل الفاتورة**: افتح فاتورة وتحقق من أن المبلغ المدفوع والمتبقي يتطابقان مع الدفعات الفعلية

## الملفات المعدلة

- `server/models/Bill.js`: تعديل `calculateRemainingAmount` و `calculateSubtotal`
- `src/pages/Billing.tsx`: تعديل حساب الإحصائيات لاستخدام `bill.remaining`
- `server/scripts/fix-bill-calculations.js`: سكريبت جديد لإصلاح الفواتير الموجودة
- `server/docs/BILL_CALCULATION_FIX.md`: هذا الملف (التوثيق)

## ملاحظات مهمة

1. **النسخ الاحتياطي**: يُنصح بعمل نسخة احتياطية من قاعدة البيانات قبل تشغيل السكريبت
2. **الأداء**: السكريبت قد يستغرق وقتاً طويلاً إذا كان هناك عدد كبير من الفواتير
3. **الاختبار**: اختبر الإصلاح على بيئة التطوير أولاً قبل تطبيقه على الإنتاج
4. **الـ Cache**: امسح الـ cache في المتصفح بعد تطبيق الإصلاح
