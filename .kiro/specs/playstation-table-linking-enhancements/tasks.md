# Implementation Plan

- [x] 1. Backend: تحسين منطق إنهاء الجلسة









  - تعديل دالة `endSession` في `server/controllers/sessionController.js`
  - إضافة فحص حالة ربط الجلسة بطاولة قبل طلب اسم العميل
  - إذا كانت الجلسة مرتبطة بطاولة، السماح بالإنهاء بدون اسم عميل
  - إذا لم تكن مرتبطة، التحقق من وجود اسم العميل وإرجاع خطأ إذا كان مفقوداً
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.1 كتابة اختبار خاصية لمنطق طلب اسم العميل


  - **Property 1: Customer name requirement based on table linking**
  - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 1.2 كتابة اختبار خاصية لحفظ اسم العميل

  - **Property 2: Customer name persistence**
  - **Validates: Requirements 1.4**

- [x] 1.3 كتابة اختبار خاصية لمعالجة فواتير الجلسات المرتبطة بطاولة

  - **Property 3: Table-linked session bill handling**
  - **Validates: Requirements 1.5**

- [x] 2. Frontend: تحديث واجهة إنهاء الجلسة





  - تعديل دالة `handleEndSession` في `src/pages/PlayStation.tsx`
  - إضافة فحص حالة ربط الجلسة بطاولة قبل عرض نافذة طلب اسم العميل
  - إذا كانت مرتبطة بطاولة، إنهاء الجلسة مباشرة بدون عرض النافذة
  - إذا لم تكن مرتبطة، عرض نافذة طلب اسم العميل كما هو حالياً
  - تحديث دالة `handleEndSessionWithCustomerName` لتمرير اسم العميل فقط عند الحاجة
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 3. Frontend: تحسين عرض أزرار الربط وفك الربط
  - تحديث عرض الجلسات النشطة في `src/pages/PlayStation.tsx`
  - التأكد من عرض زر "فك الربط" للجلسات المرتبطة بطاولة
  - التأكد من عرض زر "ربط بطاولة" للجلسات غير المرتبطة
  - تحسين تصميم الأزرار لتكون واضحة ومميزة
  - _Requirements: 2.1, 5.1, 5.2_

- [ ] 3.1 كتابة اختبار خاصية لعرض زر فك الربط
  - **Property 4: Unlink button visibility**
  - **Validates: Requirements 2.1**

- [ ] 3.2 كتابة اختبار خاصية لعرض حالة الربط
  - **Property 14: Linking status display**
  - **Validates: Requirements 5.1, 5.2**

- [ ] 4. Backend: إضافة endpoint لربط جلسة بطاولة مع دمج الفواتير
  - إنشاء دالة `linkSessionToTable` جديدة في `server/controllers/sessionController.js`
  - البحث عن فاتورة موجودة غير مدفوعة على الطاولة المحددة
  - إذا وجدت فاتورة، دمج فاتورة الجلسة مع فاتورة الطاولة
  - إذا لم توجد فاتورة، نقل فاتورة الجلسة إلى الطاولة
  - استخدام MongoDB transactions لضمان atomicity
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4.1 إنشاء دالة مساعدة `mergeBills` لدمج الفواتير
  - نقل جميع الجلسات من الفاتورة المصدر إلى الفاتورة المستهدفة
  - نقل جميع الطلبات من الفاتورة المصدر إلى الفاتورة المستهدفة
  - نقل جميع سجلات الدفع من الفاتورة المصدر إلى الفاتورة المستهدفة
  - جمع المبالغ المدفوعة من كلا الفاتورتين
  - إعادة حساب الإجمالي للفاتورة المستهدفة
  - تحديث مراجع الجلسات للإشارة إلى الفاتورة المستهدفة
  - حذف الفاتورة المصدر بعد نجاح الدمج
  - تسجيل عملية الدمج في السجلات
  - _Requirements: 3.1, 3.2, 3.5, 4.1, 4.2, 4.4, 4.5_

- [ ] 4.2 كتابة اختبار خاصية لدمج الفواتير مع التنظيف
  - **Property 6: Bill merging with cleanup**
  - **Validates: Requirements 3.1, 3.2**

- [ ] 4.3 كتابة اختبار خاصية لنقل الفاتورة إلى طاولة
  - **Property 7: Bill transfer to table**
  - **Validates: Requirements 3.3, 3.4**

- [ ] 4.4 كتابة اختبار خاصية لاكتمال دمج الفواتير
  - **Property 8: Bill merging completeness**
  - **Validates: Requirements 3.5**

- [ ] 4.5 كتابة اختبار خاصية لجمع المدفوعات أثناء الدمج
  - **Property 9: Payment aggregation during merge**
  - **Validates: Requirements 4.1**

- [ ] 4.6 كتابة اختبار خاصية للحفاظ على سجلات الدفع
  - **Property 10: Payment records preservation**
  - **Validates: Requirements 4.2**

- [ ] 4.7 كتابة اختبار خاصية لـ atomicity عملية الدمج
  - **Property 11: Merge operation atomicity**
  - **Validates: Requirements 4.3**

- [ ] 4.8 كتابة اختبار خاصية لترتيب الدمج ثم الحذف
  - **Property 12: Merge-then-delete ordering**
  - **Validates: Requirements 4.4**

- [ ] 4.9 كتابة اختبار خاصية لتسجيل عمليات الدمج
  - **Property 13: Merge operation logging**
  - **Validates: Requirements 4.5**

- [ ] 5. Backend: إضافة route للـ endpoint الجديد
  - إضافة route في `server/routes/sessionRoutes.js`
  - `PUT /api/sessions/:sessionId/link-table`
  - ربط الـ route بدالة `linkSessionToTable`
  - إضافة authorization middleware المناسب
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 6. Frontend: تحديث دالة ربط الجلسة بطاولة
  - تعديل دالة `handleLinkTableToSession` في `src/pages/PlayStation.tsx`
  - استخدام الـ endpoint الجديد بدلاً من تحديث الفاتورة مباشرة
  - معالجة الاستجابة وعرض رسائل النجاح/الفشل المناسبة
  - تحديث البيانات بعد نجاح العملية
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 7. Frontend: إضافة دالة في API service
  - إضافة دالة `linkSessionToTable` في `src/services/api.ts`
  - استقبال `sessionId` و `tableId` كمعاملات
  - إرسال طلب PUT إلى `/api/sessions/:sessionId/link-table`
  - إرجاع الاستجابة بشكل مناسب
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 8. Backend: تحسين معالجة الأخطاء في عمليات الدمج
  - إضافة try-catch blocks مع transactions
  - إضافة rollback عند فشل أي جزء من العملية
  - إرجاع رسائل خطأ واضحة ومفيدة
  - تسجيل الأخطاء في السجلات
  - _Requirements: 4.3, 6.3_

- [ ] 9. Backend: إضافة التحقق من صحة المدخلات
  - التحقق من وجود الجلسة والطاولة قبل الربط
  - التحقق من أن الجلسة نشطة
  - التحقق من أن الطاولة موجودة
  - إرجاع أخطاء واضحة للحالات غير الصالحة
  - _Requirements: 6.1, 6.5_

- [ ] 9.1 كتابة اختبار خاصية لرفض الطاولات غير الموجودة
  - **Property 15: Invalid table rejection**
  - **Validates: Requirements 6.1**

- [ ] 9.2 كتابة اختبار خاصية للتحقق من صحة المدخلات
  - **Property 18: Input validation**
  - **Validates: Requirements 6.5**

- [ ] 10. Backend: تحديث منطق فك الربط (إذا لزم الأمر)
  - مراجعة دالة `unlinkTableFromSession` الموجودة
  - التأكد من أنها تعمل بشكل صحيح مع التحسينات الجديدة
  - إضافة أي تحسينات ضرورية
  - _Requirements: 2.3, 2.5_

- [ ] 10.1 كتابة اختبار خاصية لنجاح عملية فك الربط
  - **Property 5: Unlink operation success**
  - **Validates: Requirements 2.3, 2.5**

- [ ] 10.2 كتابة اختبار خاصية لمعالجة فك ربط جلسة غير مرتبطة
  - **Property 16: Unlink non-linked session handling**
  - **Validates: Requirements 6.2**

- [ ] 11. Frontend: تحسين نافذة فك الربط
  - مراجعة نافذة فك الربط الموجودة
  - التأكد من عرض رسالة تأكيد واضحة
  - التأكد من طلب اسم العميل إذا لم يكن موجوداً
  - تحسين تجربة المستخدم
  - _Requirements: 2.2, 2.4_

- [ ] 12. Backend: إضافة تحديث حالة الطاولة عند الربط/فك الربط
  - تحديث حالة الطاولة عند ربط جلسة بها
  - تحديث حالة الطاولة عند فك ربط جلسة منها
  - التحقق من وجود جلسات أو فواتير أخرى على الطاولة
  - _Requirements: 7.1, 7.2_

- [ ] 12.1 كتابة اختبار خاصية لتناسق حالة الطاولة عند الربط
  - **Property 20: Table state consistency on link**
  - **Validates: Requirements 7.1**

- [ ] 12.2 كتابة اختبار خاصية لتناسق حالة الطاولة عند فك الربط
  - **Property 21: Table state consistency on unlink**
  - **Validates: Requirements 7.2**

- [ ] 13. Backend: إضافة ضمانات تناسق البيانات
  - التأكد من أن كل جلسة نشطة مرتبطة بفاتورة واحدة فقط
  - التأكد من أن كل فاتورة غير مدفوعة مرتبطة بطاولة واحدة فقط أو بدون طاولة
  - إضافة فحوصات في العمليات الحرجة
  - _Requirements: 7.3, 7.4, 7.5_

- [ ] 13.1 كتابة اختبار خاصية لـ invariants النظام
  - **Property 19: System invariants**
  - **Validates: Requirements 7.4, 7.5**

- [ ] 13.2 كتابة اختبار خاصية لتناسق المراجع بعد الدمج
  - **Property 22: Reference consistency after merge**
  - **Validates: Requirements 7.3**

- [ ] 14. Frontend: تحسين رسائل النجاح والخطأ
  - تحديث رسائل النجاح لتكون أكثر وضوحاً
  - تحديث رسائل الخطأ لتكون أكثر فائدة
  - إضافة رسائل تأكيد للعمليات الحرجة
  - _Requirements: 2.4, 4.3, 6.1, 6.2, 6.3_

- [ ] 15. Backend: معالجة حالة ربط جلسة منتهية
  - إضافة منطق خاص لربط جلسات منتهية بطاولة
  - تحديث الفاتورة فقط بدون تأثير على الجلسة
  - التحقق من أن الجلسة منتهية قبل تطبيق المنطق الخاص
  - _Requirements: 6.4_

- [ ] 15.1 كتابة اختبار خاصية لربط جلسة منتهية
  - **Property 17: Ended session linking**
  - **Validates: Requirements 6.4**

- [ ] 16. Checkpoint - التأكد من نجاح جميع الاختبارات
  - تشغيل جميع الاختبارات (unit tests و property tests)
  - التأكد من عدم وجود أخطاء
  - مراجعة أي مشاكل مع المستخدم إذا ظهرت

- [ ] 17. كتابة اختبارات تكامل شاملة
  - اختبار دورة حياة الجلسة الكاملة مع الربط وفك الربط
  - اختبار سيناريوهات دمج الفواتير المختلفة
  - اختبار معالجة الأخطاء في سيناريوهات مختلفة
  - _Requirements: All_

- [ ] 18. مراجعة نهائية وتحسينات الأداء
  - مراجعة الكود للتأكد من جودته
  - تحسين استعلامات قاعدة البيانات إذا لزم الأمر
  - إضافة indexes إذا لزم الأمر
  - التأكد من عدم وجود memory leaks
  - _Requirements: All_

- [ ] 19. Checkpoint النهائي - التأكد من نجاح جميع الاختبارات
  - تشغيل جميع الاختبارات مرة أخرى
  - التأكد من عمل جميع الميزات بشكل صحيح
  - مراجعة أي مشاكل مع المستخدم إذا ظهرت

