# الربط المرتب للجلسات بالطاولات

## الترتيب المحسن للعمليات

### Case 1: الطاولة تحتوي على فاتورة غير مدفوعة بالكامل

#### الترتيب الصحيح:
1. **إضافة الجلسة إلى فاتورة الطاولة**
2. **حذف الجلسة من الفاتورة القديمة**
3. **دمج فاتورة الجلسة مع فاتورة الطاولة**

```javascript
// STEP 1: إضافة الجلسة إلى فاتورة الطاولة
Logger.info(`✅ STEP 1: Adding session to table bill ${existingTableBill.billNumber}`);

// التحقق من عدم وجود الجلسة مسبقاً
const sessionAlreadyInTableBill = existingTableBill.sessions.some(s => {
    const sIdStr = s._id ? s._id.toString() : s.toString();
    return sIdStr === sessionIdStr;
});

if (!sessionAlreadyInTableBill) {
    existingTableBill.sessions.push(session._id);
    Logger.info(`✅ STEP 1: Added session ${session.deviceName} to table bill`);
}

// حفظ فاتورة الطاولة مع الجلسة الجديدة
await existingTableBill.calculateSubtotal();
await existingTableBill.save();

// STEP 2: حذف الجلسة من الفاتورة القديمة
Logger.info(`🗑️ STEP 2: Removing session from old session bill ${sessionBill.billNumber}`);

sessionBill.sessions = sessionBill.sessions.filter(s => {
    const sIdStr = s._id ? s._id.toString() : s.toString();
    return sIdStr !== sessionIdStr;
});

Logger.info(`✅ STEP 2: Removed session from old bill (remaining sessions: ${sessionBill.sessions.length})`);

// حفظ فاتورة الجلسة بعد إزالة الجلسة
await sessionBill.calculateSubtotal();
await sessionBill.save();

// تحديث مرجع الفاتورة في الجلسة
session.bill = existingTableBill._id;
await session.save();

// STEP 3: دمج فاتورة الجلسة مع فاتورة الطاولة
Logger.info(`🔄 STEP 3: Merging session bill ${sessionBill.billNumber} with table bill ${existingTableBill.billNumber}`);

// نقل الجلسات المتبقية
if (sessionBill.sessions && sessionBill.sessions.length > 0) {
    existingTableBill.sessions.push(...sessionBill.sessions);
}

// نقل الطلبات
if (sessionBill.orders && sessionBill.orders.length > 0) {
    existingTableBill.orders.push(...sessionBill.orders);
}

// نقل المدفوعات
if (sessionBill.payments && sessionBill.payments.length > 0) {
    existingTableBill.payments.push(...sessionBill.payments);
    existingTableBill.paid += sessionBill.paid;
}

// نقل المدفوعات الجزئية
if (sessionBill.partialPayments && sessionBill.partialPayments.length > 0) {
    existingTableBill.partialPayments.push(...sessionBill.partialPayments);
}

// نقل sessionPayments
if (sessionBill.sessionPayments && sessionBill.sessionPayments.length > 0) {
    existingTableBill.sessionPayments.push(...sessionBill.sessionPayments);
}

// إضافة ملاحظات الدمج
let mergeNotes = `\n[تم دمج فاتورة ${sessionBill.billNumber}]`;
if (sessionBill.notes && sessionBill.notes.trim()) {
    mergeNotes += `\n[من ${sessionBill.billNumber}]: ${sessionBill.notes}`;
}
existingTableBill.notes += mergeNotes;

// إعادة حساب المجاميع النهائية
await existingTableBill.calculateSubtotal();
existingTableBill.remaining = existingTableBill.total - existingTableBill.paid;
await existingTableBill.save();

// حذف فاتورة الجلسة القديمة
await sessionBill.deleteOne();
```

### Case 2: الطاولة لا تحتوي على فاتورة غير مدفوعة

```javascript
// إضافة الطاولة إلى فاتورة الجلسة الحالية
sessionBill.table = tableId;
sessionBill.billType = "cafe";
sessionBill.customerName = `طاولة ${table.number}`;
sessionBill.notes += `\n[تم ربط الفاتورة بالطاولة ${table.number}]`;
await sessionBill.save();
```

## المزايا الجديدة

### ✅ ترتيب منطقي واضح
- **STEP 1**: إضافة الجلسة للوجهة الجديدة أولاً
- **STEP 2**: إزالة الجلسة من المصدر القديم
- **STEP 3**: دمج باقي البيانات

### ✅ تجنب فقدان البيانات
- الجلسة تُضاف للفاتورة الجديدة قبل إزالتها من القديمة
- لا يوجد لحظة تكون فيها الجلسة بدون فاتورة

### ✅ تحديث تدريجي
- حفظ بعد كل خطوة مهمة
- إعادة حساب المجاميع في الوقت المناسب
- تحديث مرجع الفاتورة في الجلسة فوراً

### ✅ تسجيل مفصل
```javascript
Logger.info(`✅ STEP 1: Added session ${session.deviceName} to table bill`);
Logger.info(`✅ STEP 2: Removed session from old bill (remaining sessions: ${sessionBill.sessions.length})`);
Logger.info(`🔄 STEP 3: Merging session bill ${sessionBill.billNumber} with table bill ${existingTableBill.billNumber}`);
Logger.info(`✅ CASE 1 COMPLETED: Successfully merged bills into ${existingTableBill.billNumber}`);
```

## البيانات المنقولة في STEP 3

### ✅ الجلسات المتبقية
- أي جلسات أخرى في فاتورة الجلسة القديمة

### ✅ الطلبات
- جميع الطلبات من فاتورة الجلسة

### ✅ المدفوعات
- المدفوعات العادية (`payments`)
- المدفوعات الجزئية (`partialPayments`)
- مدفوعات الجلسات (`sessionPayments`)

### ✅ الملاحظات
- دمج الملاحظات مع تسمية المصدر
- إضافة معلومات الدمج

## النتيجة النهائية

### ✅ فاتورة واحدة موحدة
- تحتوي على جميع الجلسات والطلبات
- مجاميع صحيحة ومحدثة
- ملاحظات شاملة عن العمليات

### ✅ تتبع كامل
- تسجيل مفصل لكل خطوة
- معلومات واضحة عن النتيجة النهائية
- إحصائيات شاملة

## الملفات المحدثة
- `server/controllers/sessionController.js` - تحديث `linkSessionToTable` بالترتيب الجديد

الآن ربط الجلسات بالطاولات يتبع ترتيباً منطقياً ومرتباً! 🎯✨