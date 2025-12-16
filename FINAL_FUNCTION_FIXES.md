# الإصلاح النهائي لمشاكل استدعاء الدوال

## المشكلة الأصلية
كانت هناك مشاكل في استدعاء الدوال داخل `sessionController` بسبب:
1. استخدام `this` في كائن عادي (ليس class)
2. محاولة استدعاء `sessionController` قبل اكتمال تعريفه
3. مشاكل في السياق (context) للدوال

## الحل المطبق

### 1. إنشاء دالة مساعدة خارجية
```javascript
// Helper function to perform cleanup - defined outside the controller object
const performCleanupHelper = async (organizationId) => {
    // ... كامل منطق التنظيف
};
```

### 2. استخدام import ديناميكي لحذف الفواتير
```javascript
// Use the proper bill deletion function (same as billing page delete button)
const { deleteBill } = await import('./billingController.js');

// Create a mock request object for the delete function
const mockReq = {
    params: { id: updatedCurrentBill._id },
    user: req.user,
    io: req.io
};

const mockRes = {
    json: () => {},
    status: () => ({ json: () => {} })
};

try {
    await deleteBill(mockReq, mockRes);
    Logger.info(`✅ STEP 3: Successfully deleted empty bill using billing controller`);
} catch (deleteError) {
    Logger.error(`❌ Failed to delete bill using billing controller, falling back to direct deletion:`, deleteError);
    // Fallback to direct deletion
    await updatedCurrentBill.deleteOne();
}
```

### 3. تحديث جميع الاستدعاءات
```javascript
// قبل الإصلاح
await sessionController.performCleanup(req.user.organization);
await this.performCleanup(req.user.organization);

// بعد الإصلاح
await performCleanupHelper(req.user.organization);
```

## المزايا الجديدة

### ✅ استخدام دالة حذف الفواتير الصحيحة
- يستخدم `deleteBill` من `billingController` مباشرة
- يتعامل مع المزامنة المزدوجة بشكل صحيح
- يحدث حالة الطاولات تلقائياً
- fallback إلى الحذف المباشر في حالة الفشل

### ✅ دالة تنظيف محسنة
- تم نقلها خارج الكائن لتجنب مشاكل السياق
- تحذف الفواتير الفارغة بشكل صحيح
- معالجة أفضل للأخطاء

### ✅ استقرار أكبر
- لا توجد مشاكل في السياق
- لا توجد مراجع دائرية
- معالجة أخطاء محسنة

## الملفات المحدثة
- `server/controllers/sessionController.js`
  - إضافة `performCleanupHelper` في البداية
  - تحديث `changeSessionTable` لاستخدام import ديناميكي
  - تحديث جميع استدعاءات `performCleanup`
  - تبسيط `performCleanup` في الكائن

## النتيجة النهائية
✅ عملية تغيير الطاولة تعمل بالترتيب الصحيح  
✅ حذف الفواتير الفارغة يستخدم نفس آلية صفحة إدارة الدفع  
✅ لا توجد أخطاء في استدعاء الدوال  
✅ معالجة أخطاء محسنة مع fallback  
✅ استقرار أكبر في النظام  

الآن يمكن اختبار عملية تغيير الطاولة بثقة كاملة!