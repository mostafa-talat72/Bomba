# تشغيل Migration Script

إذا كانت الطاولات تظهر "فاضية" رغم وجود طلبات، يجب تشغيل migration script لتحويل البيانات القديمة.

## الخطوات:

### 1. افتح Terminal في مجلد server
```bash
cd server
```

### 2. شغل migration script
```bash
node scripts/migrateTableNumberToObjectId.js
```

### 3. انتظر حتى ينتهي Script
سيقوم بتحويل جميع الطلبات والفواتير من `tableNumber` إلى `table` ObjectId

### 4. أعد تحميل الصفحة
بعد انتهاء Migration، أعد تحميل صفحة Cafe وستظهر الطاولات بحالتها الصحيحة

## ملاحظات:
- Script آمن ويمكن تشغيله عدة مرات
- يقوم بعمل backup قبل التعديل
- يعرض تقرير مفصل عن التغييرات

## إذا واجهت مشاكل:
1. تأكد من أن MongoDB يعمل
2. تأكد من أن ملف `.env` في مجلد server يحتوي على `MONGODB_URI` صحيح
3. شاهد console logs للتفاصيل
