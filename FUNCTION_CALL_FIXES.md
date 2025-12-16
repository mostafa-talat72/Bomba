# إصلاح استدعاءات الدوال في sessionController

## المشكلة
كانت هناك أخطاء في استدعاء الدوال داخل `sessionController` حيث كان يتم استدعاؤها باستخدام `sessionController.functionName` بدلاً من `this.functionName`.

## الإصلاحات المطبقة

### 1. إصلاح `deleteBillProperly`
```javascript
// قبل الإصلاح
await sessionController.deleteBillProperly(bill);

// بعد الإصلاح  
await this.deleteBillProperly(bill);
```

### 2. إصلاح `performCleanup`
```javascript
// قبل الإصلاح
await sessionController.performCleanup(req.user.organization);

// بعد الإصلاح
await this.performCleanup(req.user.organization);
```

## المواقع المصلحة

### في وظيفة `changeSessionTable`:
- السطر ~1511: `await this.deleteBillProperly(updatedCurrentBill);`

### في وظيفة `performCleanup`:
- السطر ~1677: `await this.deleteBillProperly(bill);`

### في وظيفة `unlinkSessionFromTable`:
- السطر ~1100: `await this.performCleanup(req.user.organization);`

### في وظيفة `linkSessionToTable`:
- السطر ~1278: `await this.performCleanup(req.user.organization);`

### في وظيفة `changeSessionTable`:
- السطر ~1561: `await this.performCleanup(req.user.organization);`

### في وظيفة `cleanupDuplicateSessionReferences`:
- السطر ~1599: `await this.performCleanup(req.user.organization);`

## النتيجة
✅ تم إصلاح جميع استدعاءات الدوال لتستخدم `this` بدلاً من `sessionController`  
✅ لن تظهر أخطاء "is not a function" بعد الآن  
✅ جميع العمليات ستعمل بشكل صحيح  

## الاختبار
يمكن الآن اختبار عملية تغيير الطاولة بدون أخطاء:
```bash
PUT /api/sessions/{sessionId}/change-table
Body: { "newTableId": "{tableId}" }
```