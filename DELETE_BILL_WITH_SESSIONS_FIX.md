# إصلاح حذف الفاتورة مع الجلسات المرتبطة

## المشكلة
عند حذف فاتورة مرتبطة بجلسة (Session)، كانت الفاتورة تُحذف لكن الجلسة تبقى في قاعدة البيانات.

## الحل

### 1. تحديث دالة `deleteBill` في Backend
**الملف**: `server/controllers/billingController.js`

#### قبل التعديل:
```javascript
// Remove bill reference from sessions before deletion
await Session.updateMany({ bill: bill._id }, { $unset: { bill: 1 } });
```
كان الكود يزيل فقط مرجع الفاتورة من الجلسات، لكن الجلسات نفسها تبقى.

#### بعد التعديل:
```javascript
// Delete all sessions associated with this bill (cascade delete)
if (bill.sessions && bill.sessions.length > 0) {
    const sessionDeleteResult = await Session.deleteMany({ _id: { $in: bill.sessions } });
    Logger.info(`✓ Deleted ${sessionDeleteResult.deletedCount} sessions associated with bill ${bill.billNumber}`);
}
```
الآن يتم حذف جميع الجلسات المرتبطة بالفاتورة (cascade delete).

### 2. إضافة DELETE Route
**الملف**: `server/routes/billsRoutes.js`

تم إضافة:
- استيراد `deleteBill` من controller
- إضافة `.delete()` method للـ route `/:id`

```javascript
router
    .route("/:id")
    .get(authorize("billing", "all"), getBill)
    .put(authorize("billing", "all"), updateBill)
    .delete(authorize("billing", "all"), deleteBill);  // ← جديد
```

## كيف يعمل النظام الآن

عند حذف فاتورة:

1. ✅ **حذف الطلبات (Orders)**: جميع الطلبات المرتبطة بالفاتورة تُحذف
2. ✅ **حذف الجلسات (Sessions)**: جميع الجلسات المرتبطة بالفاتورة تُحذف
3. ✅ **حذف الفاتورة**: الفاتورة نفسها تُحذف
4. ✅ **تحديث حالة الطاولة**: إذا كانت الفاتورة مرتبطة بطاولة، يتم تحديث حالتها
5. ✅ **إشعار Socket.IO**: يتم إرسال إشعار بحذف الفاتورة

## مثال على السيناريو

### قبل الحذف:
```javascript
// Bill
{
  _id: "bill123",
  billNumber: "B-001",
  sessions: ["session456", "session789"],
  orders: ["order111", "order222"]
}

// Sessions
{ _id: "session456", bill: "bill123", deviceName: "PS5-1" }
{ _id: "session789", bill: "bill123", deviceName: "PS5-2" }

// Orders
{ _id: "order111", bill: "bill123" }
{ _id: "order222", bill: "bill123" }
```

### بعد حذف الفاتورة:
```javascript
// ✅ Bill: محذوفة
// ✅ Sessions: محذوفة (session456, session789)
// ✅ Orders: محذوفة (order111, order222)
```

## الفرق بين Cancel و Delete

### Cancel (إلغاء):
- الفاتورة تبقى في قاعدة البيانات
- الحالة تتغير إلى `cancelled`
- المبالغ تصبح صفر
- الطلبات والجلسات تبقى لكن يتم إزالة مرجع الفاتورة منها

### Delete (حذف):
- الفاتورة تُحذف نهائياً من قاعدة البيانات
- جميع الطلبات المرتبطة تُحذف (cascade)
- جميع الجلسات المرتبطة تُحذف (cascade)
- حالة الطاولة تُحدث تلقائياً

## API Endpoint

```
DELETE /api/billing/:id
Authorization: Bearer <token>
Permissions: billing, all
```

### Response Success:
```json
{
  "success": true,
  "message": "تم حذف الفاتورة بنجاح"
}
```

### Response Error:
```json
{
  "success": false,
  "message": "الفاتورة غير موجودة"
}
```

## اختبار التغييرات

1. أنشئ فاتورة جديدة مع جلسة بلايستيشن
2. تحقق من وجود الجلسة في قاعدة البيانات
3. احذف الفاتورة من صفحة الفواتير
4. تحقق من أن:
   - الفاتورة محذوفة
   - الجلسة محذوفة
   - الطلبات محذوفة
   - حالة الطاولة محدثة (إن وجدت)

## ملاحظات مهمة

- ⚠️ **الحذف نهائي**: لا يمكن استرجاع البيانات بعد الحذف
- ✅ **Cascade Delete**: يتم حذف جميع البيانات المرتبطة تلقائياً
- ✅ **Logging**: يتم تسجيل عدد الجلسات والطلبات المحذوفة في الـ logs
- ✅ **Real-time Updates**: يتم إرسال إشعارات Socket.IO لتحديث الواجهة

## الملفات المعدلة

1. `server/controllers/billingController.js` - تحديث دالة `deleteBill`
2. `server/routes/billsRoutes.js` - إضافة DELETE route واستيراد `deleteBill`
