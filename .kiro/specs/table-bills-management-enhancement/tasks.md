# Implementation Plan

- [x] 1. إزالة فلترة التاريخ من Backend





  - إزالة منطق فلترة التاريخ من `getBills()` في `billingController.js`
  - التأكد من أن جميع الفواتير تُعرض بغض النظر عن تاريخ الإنشاء
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 1.2 إزالة جميع حدود البيانات من Frontend و Backend








  - تحديث `fetchBills()` في `AppContext.tsx` لإزالة `limit: 100`
  - تحديث `fetchOrders()` في `AppContext.tsx` لإزالة `limit: 100`
  - تحديث `getNotifications()` في `AppContext.tsx` لإزالة `limit: 100`
  - تحديث `getBills()` في `billingController.js` لإزالة `effectiveLimit`
  - تحديث `getOrders()` في `orderController.js` لإزالة `effectiveLimit`
  - جلب جميع البيانات بدون حد لضمان ظهور البيانات القديمة
  - التأكد من أن الطاولات القديمة تظهر محجوزة إذا كان عليها فواتير غير مدفوعة
  - _Requirements: 1.1, 2.1, 9.1_

- [ ] 1.1 كتابة property test لإزالة فلترة التاريخ





  - **Property 1: Bills query ignores date filters completely**
  - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 2. تحديث نظام حالة الطاولات








  - إضافة دالة `updateTableStatusIfNeeded()` في `billingController.js`
  - تحديث حالة الطاولة عند إنشاء/تحديث/حذف فاتورة
  - إضافة hooks في Bill model لتحديث حالة الطاولة تلقائياً
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

\
- [ ]* 2.2 كتابة property test لحالة الطاولة عند دفع جميع الفواتير
  - **Property 3: Table status empty when all bills paid**
  - **Validates: Requirements 2.2**

- [ ]* 2.3 كتابة property test لتحديث حالة الطاولة عند إنشاء فاتورة
  - **Property 4: Table status updates on bill creation**
  - **Validates: Requirements 2.3**

- [ ]* 2.4 كتابة property test لتحديث حالة الطاولة عند الدفع
  - **Property 5: Table status updates on bill payment**
  - **Validates: Requirements 2.4**

- [ ]* 2.5 كتابة property test لتحديث حالة الطاولة عند الحذف
  - **Property 6: Table status updates on bill deletion**
  - **Validates: Requirements 2.5**

- [x] 3. تحسين نظام الدفع الجزئي للأصناف





  - إضافة method `payForItems()` في Bill model
  - إضافة controller function `payForItems()` في `billingController.js`
  - تحديث `calculateRemainingAmount()` لحساب المبلغ من `itemPayments`
  - إضافة route جديد `POST /api/bills/:id/pay-items`
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ]* 3.1 كتابة property test لتجميع الأصناف المتشابهة
  - **Property 7: Item aggregation combines same items**
  - **Validates: Requirements 3.1, 6.1**

- [ ]* 3.2 كتابة property test لتحديث حالة الصنف عند الدفع
  - **Property 8: Item payment updates state correctly**
  - **Validates: Requirements 3.2**

- [ ]* 3.3 كتابة property test لحساب كميات الأصناف
  - **Property 9: Item quantities calculated correctly**
  - **Validates: Requirements 3.3**

- [ ]* 3.4 كتابة property test لحالة الفاتورة عند دفع جميع الأصناف
  - **Property 10: Bill status reflects all items paid**
  - **Validates: Requirements 3.4, 4.5**

- [x] 4. إضافة نظام الدفع الجزئي للجلسات





  - إضافة method `paySessionPartial()` في Bill model
  - إضافة controller function `paySessionPartial()` في `billingController.js`
  - تحديث `calculateRemainingAmount()` لحساب المبلغ من `sessionPayments`
  - إضافة route جديد `POST /api/bills/:id/pay-session-partial`
  - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [ ]* 4.1 كتابة property test للدفع الجزئي للجلسة
  - **Property 11: Session partial payment calculates correctly**
  - **Validates: Requirements 4.1**

- [ ]* 4.2 كتابة property test لرفض الدفع الزائد للجلسة
  - **Property 12: Session payment rejects overpayment**
  - **Validates: Requirements 4.2**

- [ ]* 4.3 كتابة property test لتسجيل دفعات الجلسة
  - **Property 13: Session payment recorded in history**
  - **Validates: Requirements 4.3**

- [x] 5. تحسين دالة تجميع الأصناف





  - إنشاء دالة `aggregateItemsWithPayments()` في Frontend
  - دعم تجميع الأصناف بناءً على الاسم والسعر والإضافات
  - حساب الكميات المدفوعة والمتبقية لكل صنف
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 5.1 كتابة property test للأصناف بأسعار مختلفة
  - **Property 14: Items with different prices are separate**
  - **Validates: Requirements 6.2**

- [ ]* 5.2 كتابة property test لتجميع الأصناف بنفس الإضافات
  - **Property 15: Items with same addons are combined**
  - **Validates: Requirements 6.3**

- [ ]* 5.3 كتابة property test لتوزيع الدفع على الطلبات
  - **Property 16: Payment distributed across orders**
  - **Validates: Requirements 6.4**

- [ ]* 5.4 كتابة property test لاتساق التجميع عبر الصفحات
  - **Property 17: Aggregation consistency across views**
  - **Validates: Requirements 6.5**

- [x] 6. تحديث صفحة Billing.tsx





  - إزالة فلترة التاريخ من الواجهة الأمامية
  - إضافة نافذة منبثقة لعرض فواتير الطاولة
  - إضافة نافذة منبثقة للدفع الجزئي للأصناف
  - إضافة نافذة منبثقة للدفع الجزئي للجلسات
  - تحديث دالة `handlePayForItems()` لاستخدام API الجديد
  - إضافة دالة `handlePaySessionPartial()` للدفع الجزئي للجلسات
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 6.1 كتابة property test لفلتر الفواتير غير المدفوعة
  - **Property 18: Bill filter works correctly**
  - **Validates: Requirements 7.2**

- [x] 7. تحديث صفحة BillView.tsx





  - تحديث دالة `aggregateItemsWithPayments()` لاستخدام `itemPayments`
  - إضافة عرض تفاصيل الدفع الجزئي للأصناف
  - إضافة عرض تفاصيل الدفع الجزئي للجلسات
  - تمييز الأصناف المدفوعة بالكامل بلون مختلف
  - إضافة علامة "مدفوع بالكامل" للجلسات المدفوعة
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8. تحديث API service (api.ts)




  - إضافة دالة `payForItems()` للدفع الجزئي للأصناف
  - إضافة دالة `paySessionPartial()` للدفع الجزئي للجلسات
  - تحديث دالة `getBills()` لإزالة معاملات التاريخ
  - _Requirements: 1.1, 3.1, 4.1_

- [x] 9. تحسين Socket.IO events





  - التأكد من إرسال `bill-update` عند إنشاء/تحديث/حذف فاتورة
  - التأكد من إرسال `payment-received` عند الدفع الكامل أو الجزئي
  - التأكد من إرسال `table-status-update` عند تحديث حالة الطاولة
  - تحديث Billing.tsx للاستماع لجميع الأحداث
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 10. تحديث دالة الطباعة





  - تحديث `printBill()` لتضمين تفاصيل الدفع الجزئي للأصناف
  - تحديث `printBill()` لتضمين تفاصيل الدفع الجزئي للجلسات
  - عرض الكميات المدفوعة والمتبقية في الطباعة
  - _Requirements: 5.3_

- [x] 11. Checkpoint - التأكد من عمل جميع الاختبارات





  - Ensure all tests pass, ask the user if questions arise.
ةة