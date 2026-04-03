# ملخص إصلاح حساب التقارير

## المشكلة
كانت التقارير في صفحة التقارير والتقارير المرسلة عبر الإيميل وملفات PDF تحسب بشكل خاطئ وتظهر قيم صفرية، بينما صفحة تقرير الاستهلاك تحسب بشكل صحيح.

## السبب الجذري
1. **استخدام حقول خاطئة للتاريخ**: كانت الوظائف تستخدم `createdAt` أو `startTime` بدلاً من `endTime` لتصفية الجلسات المكتملة
2. **عدم استخدام `finalCost`**: بعض الأماكن لم تستخدم `finalCost` (السعر بعد الخصم) بشكل صحيح
3. **عدم حساب الساعات من `controllersHistory`**: لم يتم استخدام `controllersHistory` لحساب الساعات الفعلية بدقة
4. **التقرير الشهري لا يُرسل عند إعادة تشغيل السيرفر**: لم يكن هناك آلية "catch-up" للتقارير الشهرية الفائتة

## الملفات المعدلة

### 1. server/controllers/reportController.js

#### التغييرات الرئيسية:

**أ. وظيفة `getSalesReportData`:**
- ✅ تبسيط الكود ليطابق منطق صفحة تقرير الاستهلاك تماماً
- ✅ جلب الطلبات بـ `createdAt` (صحيح)
- ✅ جلب الجلسات بـ `endTime` و `status: "completed"` فقط
- ✅ استخدام `finalAmount` للطلبات
- ✅ استخدام `finalCost` للجلسات
- ✅ حساب المنتجات الأكثر مبيعاً بشكل صحيح

**ب. وظيفة `getSessionsReportData`:**
- ✅ تغيير تصفية الجلسات من `startTime` إلى `endTime`
- ✅ إضافة فلتر `status: "completed"` فقط
- ✅ حساب المدة من `controllersHistory` إذا كان متوفراً
- ✅ استخدام `Number(session.finalCost)` للتأكد من القيم الرقمية

**ج. وظيفة `getSessionsDataByType`:**
- ✅ تغيير من `createdAt` إلى `endTime`
- ✅ تغيير من `status: { $in: ['completed', 'active'] }` إلى `status: 'completed'` فقط
- ✅ حساب المدة من `controllersHistory` بدقة
- ✅ استخدام `Number(session.finalCost)`

**د. وظيفة `getPeakHoursData`:**
- ✅ تغيير تصفية الجلسات من `createdAt` إلى `endTime`

**هـ. وظيفة `getStaffPerformanceData`:**
- ✅ تغيير من `startTime` إلى `endTime`
- ✅ تغيير من `status: { $in: ['completed', 'active'] }` إلى `status: 'completed'` فقط

**و. استخدامات `Session.aggregate`:**
- ✅ في `getDashboardStats`: تغيير من `startTime` إلى `endTime` + إضافة `status: "completed"`
- ✅ في `getFinancialReport`: تغيير من `createdAt` إلى `endTime`
- ✅ في `previousSessionsRevenue`: تغيير من `createdAt` إلى `endTime`

### 2. server/utils/scheduler.js

#### التغييرات:

**أ. وظيفة `generateDailyReportForOrganization`:**
- ✅ تغيير تصفية الجلسات من `createdAt` إلى `endTime`
- ✅ التأكد من استخدام `finalCost` للجلسات
- ✅ التأكد من استخدام `finalAmount` للطلبات

**ب. وظيفة `generateMonthlyReportForOrganization`:**
- ✅ تغيير تصفية الجلسات من `createdAt` إلى `endTime`
- ✅ التأكد من استخدام `finalCost` للجلسات
- ✅ التأكد من استخدام `finalAmount` للطلبات
- ✅ **إضافة حفظ `lastMonthlyReportSentAt`** بعد إرسال التقرير

**ج. وظيفة `initializeOrganizationMonthlyReportSchedules`:**
- ✅ **إضافة آلية "catch-up"** للتقارير الشهرية الفائتة
- ✅ فحص إذا كان اليوم هو أول يوم من الشهر
- ✅ فحص إذا لم يتم إرسال التقرير بعد
- ✅ إرسال التقرير تلقائياً إذا فات موعده

### 3. server/models/Organization.js

#### التغييرات:
- ✅ إضافة حقل `lastMonthlyReportSentAt` في `reportSettings` schema
- ✅ تحديث تعليق `lastReportSentAt` ليوضح أنه للتقرير اليومي

## المنطق الصحيح للحساب

### للجلسات (PlayStation & Computer):
```javascript
// 1. تصفية بـ endTime (وقت انتهاء الجلسة)
Session.find({
    endTime: { $gte: startDate, $lte: endDate },
    status: "completed",
    organization: organizationId
})

// 2. استخدام finalCost (السعر بعد الخصم)
const revenue = sessions.reduce((sum, s) => sum + (Number(s.finalCost) || 0), 0);

// 3. حساب الساعات من controllersHistory
if (session.controllersHistory && session.controllersHistory.length > 0) {
    session.controllersHistory.forEach((period) => {
        const periodStart = new Date(period.from).getTime();
        const periodEnd = period.to ? new Date(period.to).getTime() : new Date(session.endTime).getTime();
        totalHours += (periodEnd - periodStart) / (1000 * 60 * 60);
    });
}
```

### للطلبات (Cafe):
```javascript
// 1. تصفية بـ createdAt (وقت إنشاء الطلب)
Order.find({
    createdAt: { $gte: startDate, $lte: endDate },
    organization: organizationId
})

// 2. استخدام finalAmount (المبلغ النهائي بعد الخصم)
const revenue = orders.reduce((sum, order) => sum + (Number(order.finalAmount) || 0), 0);
```

## آلية "Catch-up" للتقارير الفائتة

### التقرير اليومي:
- ✅ عند بدء السيرفر، يفحص إذا فات موعد التقرير اليوم
- ✅ يتحقق من `lastReportSentAt` لمعرفة إذا تم الإرسال اليوم
- ✅ إذا لم يُرسل، يرسله فوراً

### التقرير الشهري (الإضافة الجديدة):
- ✅ عند بدء السيرفر في أول يوم من الشهر، يفحص إذا فات موعد التقرير
- ✅ يتحقق من `lastMonthlyReportSentAt` لمعرفة إذا تم الإرسال هذا الشهر
- ✅ إذا لم يُرسل، يرسله فوراً

## التأثير

### قبل الإصلاح:
- ❌ التقارير تظهر قيم صفرية أو خاطئة
- ❌ الجلسات لا تُحسب في الفترة الصحيحة
- ❌ عدم دقة في حساب الإيرادات
- ❌ ملفات PDF تظهر بيانات خاطئة
- ❌ التقرير الشهري لا يُرسل إذا كان السيرفر مغلقاً

### بعد الإصلاح:
- ✅ التقارير تحسب بنفس منطق صفحة تقرير الاستهلاك
- ✅ الجلسات تُحسب بناءً على وقت الانتهاء الفعلي
- ✅ استخدام `finalCost` و `finalAmount` بشكل صحيح
- ✅ حساب دقيق للساعات من `controllersHistory`
- ✅ ملفات PDF والإيميلات تعرض البيانات الصحيحة
- ✅ **التقرير الشهري يُرسل تلقائياً حتى لو كان السيرفر مغلقاً وقت الإرسال المجدول**

## الاختبار المطلوب

1. ✅ اختبار صفحة التقارير (Reports)
2. ✅ اختبار التقارير اليومية المرسلة عبر الإيميل
3. ✅ اختبار التقارير الشهرية المرسلة عبر الإيميل
4. ✅ اختبار ملفات PDF المُصدّرة
5. ✅ مقارنة النتائج مع صفحة تقرير الاستهلاك
6. ✅ التأكد من حساب الجلسات في الفترة الصحيحة
7. ✅ التأكد من حساب الإيرادات بشكل صحيح
8. ✅ **اختبار آلية catch-up للتقرير الشهري عند إعادة تشغيل السيرفر في أول يوم من الشهر**

## ملاحظات مهمة

1. **endTime vs createdAt**: الجلسات يجب أن تُحسب بناءً على `endTime` لأن هذا هو الوقت الفعلي لإتمام الجلسة وحساب التكلفة النهائية
2. **finalCost**: يجب استخدام `finalCost` دائماً لأنه يحتوي على السعر بعد الخصم
3. **controllersHistory**: يوفر حساب دقيق للساعات خاصة عند تغيير عدد الأذرع أثناء الجلسة
4. **status: "completed"**: يجب تصفية الجلسات المكتملة فقط لضمان دقة البيانات
5. **lastMonthlyReportSentAt**: حقل جديد لتتبع آخر إرسال للتقرير الشهري ومنع الإرسال المكرر

## التوافق مع صفحة تقرير الاستهلاك

الآن جميع التقارير تستخدم نفس المنطق الموجود في `src/pages/ConsumptionReport.tsx`:
- ✅ نفس طريقة تصفية الجلسات (endTime)
- ✅ نفس طريقة حساب الإيرادات (finalCost)
- ✅ نفس طريقة حساب الساعات (controllersHistory)
- ✅ نفس طريقة تجميع البيانات حسب الأقسام
- ✅ آلية catch-up للتقارير اليومية والشهرية
