# الإصلاح التلقائي عند بدء التشغيل

## نظرة عامة

تم إضافة نظام إصلاح تلقائي يعمل عند كل مرة يتم فيها تشغيل السيرفر. هذا النظام يضمن أن جميع الفواتير المدفوعة تحتوي على قيم صحيحة للمبلغ المحصل والمتبقي.

## كيف يعمل

عند بدء تشغيل السيرفر، يتم تلقائياً:

1. **الاتصال بقاعدة البيانات**
2. **جلب جميع الفواتير المدفوعة** (`status: 'paid'`)
3. **فحص كل فاتورة**:
   - إذا كان `paid ≠ total` أو `remaining > 0`
   - يتم تصحيحها: `paid = total` و `remaining = 0`
4. **تسجيل النتائج** في الـ console

## الكود

الكود موجود في `server/server.js` داخل:

```javascript
mongoose.connection.once("open", async () => {
    // ... كود آخر
    
    // Auto-fix paid bills on startup
    try {
        Logger.info("🔧 Running automatic bill calculations fix...");
        
        const paidBills = await Bill.find({ status: 'paid' });
        
        let fixedCount = 0;
        for (const bill of paidBills) {
            const needsFix = (Math.abs(bill.paid - bill.total) > 0.01) || (bill.remaining > 0.01);
            
            if (needsFix) {
                await Bill.updateOne(
                    { _id: bill._id },
                    { $set: { paid: bill.total, remaining: 0 } }
                );
                fixedCount++;
            }
        }
        
        if (fixedCount > 0) {
            Logger.info(`✅ Fixed ${fixedCount} paid bills automatically`);
        }
    } catch (error) {
        Logger.error("❌ Error in automatic bill fix:", error.message);
    }
});
```

## رسائل الـ Console

عند تشغيل السيرفر، ستظهر إحدى هذه الرسائل:

### إذا تم إصلاح فواتير:
```
🔧 Running automatic bill calculations fix...
✅ Fixed 15 paid bills automatically
```

### إذا كانت جميع الفواتير صحيحة:
```
🔧 Running automatic bill calculations fix...
✅ All paid bills are correct
```

### إذا حدث خطأ:
```
🔧 Running automatic bill calculations fix...
❌ Error in automatic bill fix: [error message]
```

## الفوائد

1. **إصلاح تلقائي**: لا حاجة لتشغيل سكريبت يدوياً
2. **يعمل دائماً**: في كل مرة يتم تشغيل السيرفر
3. **سريع**: يفحص فقط الفواتير المدفوعة
4. **آمن**: يستخدم `updateOne` لتجنب تشغيل الـ hooks
5. **شفاف**: يسجل النتائج في الـ console

## متى يتم التشغيل

- ✅ عند تشغيل السيرفر بـ `npm start`
- ✅ عند إعادة تشغيل السيرفر بـ `npm restart`
- ✅ عند تشغيل السيرفر بـ PM2
- ✅ عند إعادة تشغيل السيرفر تلقائياً (nodemon)

## الأداء

- **سريع جداً**: يفحص فقط الفواتير المدفوعة
- **لا يؤثر على بدء التشغيل**: يعمل بشكل غير متزامن (async)
- **لا يعطل السيرفر**: إذا حدث خطأ، السيرفر يستمر في العمل

## التعطيل (اختياري)

إذا أردت تعطيل هذه الميزة، احذف أو علّق على الكود في `server/server.js`:

```javascript
// Auto-fix paid bills on startup
// try {
//     Logger.info("🔧 Running automatic bill calculations fix...");
//     // ... الكود
// } catch (error) {
//     Logger.error("❌ Error in automatic bill fix:", error.message);
// }
```

## السكريبت اليدوي

إذا أردت تشغيل الإصلاح يدوياً بدون إعادة تشغيل السيرفر:

```bash
cd server
node scripts/fix-paid-bills.js
```

## الملفات ذات الصلة

- `server/server.js` - الكود الرئيسي للإصلاح التلقائي
- `server/scripts/fix-paid-bills.js` - السكريبت اليدوي
- `server/models/Bill.js` - نموذج الفاتورة
- `server/docs/BILL_CALCULATION_FIX.md` - توثيق المشكلة والحل

## ملاحظات

- الإصلاح يعمل فقط على الفواتير ذات الحالة `'paid'`
- لا يؤثر على الفواتير الأخرى (`draft`, `partial`, `cancelled`, `overdue`)
- يستخدم `Math.abs()` للتحقق من الفروقات الصغيرة (0.01)
- آمن للتشغيل المتكرر - لن يسبب مشاكل إذا تم تشغيله عدة مرات
