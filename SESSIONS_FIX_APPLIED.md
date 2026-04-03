# ✅ تم إصلاح مشكلة حساب الجلسات في التقارير المرسلة عبر الإيميل

## المشكلة التي تم إصلاحها
الجلسات كانت تُحسب بصفر في التقارير المرسلة عبر الإيميل، بينما تظهر بشكل صحيح في صفحة التقارير وصفحة تقرير الاستهلاك.

## السبب
الكود في `scheduler.js` كان يستخدم `createdAt` لتصفية الجلسات بدلاً من `endTime`.

## الإصلاح المطبق

### قبل الإصلاح ❌
```javascript
Session.find({
    createdAt: { $gte: startOfReport, $lt: endOfReport },  // ❌ خطأ!
    status: "completed",
    organization: organization._id,
})
```

### بعد الإصلاح ✅
```javascript
Session.find({
    endTime: { $gte: startOfReport, $lte: endOfReport },  // ✅ صحيح!
    status: "completed",
    organization: organization._id,
})
```

## التغييرات المطبقة

### 1. في `generateDailyReportForOrganization`:
- ✅ تغيير `createdAt` إلى `endTime` للجلسات
- ✅ تغيير `$lt` إلى `$lte` لتضمين نهاية الفترة
- ✅ إضافة logging لعرض عدد الجلسات المجلوبة

### 2. في `generateMonthlyReportForOrganization`:
- ✅ تغيير `createdAt` إلى `endTime` للجلسات
- ✅ تغيير `$lt` إلى `$lte` لتضمين نهاية الفترة
- ✅ إضافة logging لعرض عدد الجلسات المجلوبة

## لماذا endTime وليس createdAt؟

1. **الجلسة تُنشأ عند البدء** (`createdAt`) لكن **تُحسب عند الانتهاء** (`endTime`)
2. **السعر النهائي** (`finalCost`) يُحسب فقط عند انتهاء الجلسة
3. **صفحة تقرير الاستهلاك** تستخدم `endTime` - لذلك يجب أن نستخدم نفس المنطق
4. **الـ endpoint `/api/sessions`** يستخدم `endTime` عند الفلترة بالتاريخ

## الاختبار

### 1. اختبر التقرير اليومي:
```bash
# اذهب إلى صفحة الإعدادات
# اضغط على "إرسال تقرير الآن"
# تحقق من السجلات (logs)
```

### 2. تحقق من السجلات:
يجب أن ترى:
```
📊 Data fetched for [organization]:
  - ordersCount: XX
  - sessionsCount: XX  ← يجب أن يكون أكبر من صفر!
  - costsCount: XX
```

### 3. تحقق من التقرير المرسل:
- افتح التقرير المرسل عبر الإيميل
- تحقق من قسم "الجلسات"
- يجب أن تظهر نفس الأرقام الموجودة في صفحة التقارير

## النتيجة المتوقعة

الآن التقارير المرسلة عبر الإيميل ستعرض:
- ✅ نفس عدد الجلسات الموجود في صفحة التقارير
- ✅ نفس إيرادات الجلسات (PlayStation & Computer)
- ✅ نفس الحسابات الموجودة في صفحة تقرير الاستهلاك

## الملفات المعدلة

- ✅ `server/utils/scheduler.js`
  - `generateDailyReportForOrganization` - السطر ~295
  - `generateMonthlyReportForOrganization` - السطر ~605

## ملاحظة مهمة

هذا الإصلاح يجعل `scheduler.js` يستخدم **نفس المنطق بالضبط** الموجود في:
- ✅ صفحة تقرير الاستهلاك (`ConsumptionReport.tsx`)
- ✅ صفحة التقارير (`Reports.tsx`)
- ✅ الـ endpoint `/api/sessions`
- ✅ الـ controller `reportController.js`

لذلك النتائج ستكون **متطابقة تماماً** 🎯

## تم الإصلاح بتاريخ
${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}
