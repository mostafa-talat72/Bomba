# العملية النهائية لربط الجلسات بالطاولات

## تطبيق نفس منطق changeSessionTable

تم تحديث `linkSessionToTable` لتتبع نفس الخطوات المستخدمة في `changeSessionTable` بالضبط.

## Case 1: الطاولة تحتوي على فاتورة غير مدفوعة بالكامل

### الترتيب المطبق (نفس changeSessionTable):

#### **STEP 1: إضافة الجلسة إلى فاتورة الطاولة**
```javascript
// Add session to table bill first (same as changeSessionTable)
const sessionAlreadyInTableBill = existingTableBill.sessions.some(s => {
    const sIdStr = s._id ? s._id.toString() : s.toString();
    return sIdStr === sessionIdStr;
});

if (!sessionAlreadyInTableBill) {
    existingTableBill.sessions.push(session._id);
    Logger.info(`✅ STEP 1: Added session to table bill`, {
        sessionId: sessionIdStr,
        tableBillId: existingTableBill._id.toString(),
        totalSessions: existingTableBill.sessions.length,
    });
}

await existingTableBill.calculateSubtotal();
await existingTableBill.save();

// Update session's bill reference
session.bill = existingTableBill._id;
await session.save();
```

#### **STEP 2: حذف الجلسة من الفاتورة القديمة**
```javascript
// Remove session from old bill (same as changeSessionTable)
sessionBill.sessions = sessionBill.sessions.filter(s => {
    const sIdStr = s._id ? s._id.toString() : s.toString();
    return sIdStr !== sessionIdStr;
});

Logger.info(`✅ STEP 2: Removed session from old bill`, {
    sessionId: sessionIdStr,
    sessionBillId: sessionBill._id.toString(),
    remainingSessions: sessionBill.sessions.length,
});

await sessionBill.calculateSubtotal();
await sessionBill.save();
```

#### **STEP 3: دمج الفاتورة الفارغة مع فاتورة الطاولة**
```javascript
// Check if old bill is now empty and merge with destination bill (same as changeSessionTable)
const updatedSessionBill = await Bill.findById(sessionBill._id);
if (updatedSessionBill && 
    updatedSessionBill.sessions.length === 0 && 
    updatedSessionBill.orders.length === 0) {
    
    Logger.info(`🔄 STEP 3: Old bill is now empty, merging with table bill...`);
    
    // Copy payments
    if (updatedSessionBill.payments && updatedSessionBill.payments.length > 0) {
        existingTableBill.payments = existingTableBill.payments || [];
        existingTableBill.payments.push(...updatedSessionBill.payments);
        
        const transferredAmount = updatedSessionBill.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
        existingTableBill.paid = (existingTableBill.paid || 0) + transferredAmount;
    }
    
    // Copy partial payments
    if (updatedSessionBill.partialPayments && updatedSessionBill.partialPayments.length > 0) {
        existingTableBill.partialPayments = existingTableBill.partialPayments || [];
        existingTableBill.partialPayments.push(...updatedSessionBill.partialPayments);
    }
    
    // Add merge notes
    const currentNotes = existingTableBill.notes || '';
    existingTableBill.notes = currentNotes + `\n[تم دمج فاتورة فارغة ${updatedSessionBill.billNumber}]`;
    
    // Update totals
    await existingTableBill.calculateSubtotal();
    existingTableBill.remaining = existingTableBill.total - (existingTableBill.paid || 0);
    await existingTableBill.save();
    
    // Delete empty bill
    await updatedSessionBill.deleteOne();
}
```

## Case 2: الطاولة لا تحتوي على فاتورة غير مدفوعة

```javascript
// إضافة الطاولة إلى فاتورة الجلسة الحالية
sessionBill.table = tableId;
sessionBill.billType = "cafe";
sessionBill.customerName = `طاولة ${table.number}`;
sessionBill.notes += `\n[تم ربط الفاتورة بالطاولة ${table.number}]`;
await sessionBill.save();
```

## المطابقة الكاملة مع changeSessionTable

### ✅ نفس الترتيب
1. إضافة الجلسة للوجهة الجديدة
2. حذف الجلسة من المصدر القديم
3. دمج الفاتورة الفارغة مع الوجهة

### ✅ نفس التسجيل
```javascript
Logger.info(`✅ STEP 1: Added session to table bill`);
Logger.info(`✅ STEP 2: Removed session from old bill`);
Logger.info(`🔄 STEP 3: Old bill is now empty, merging with table bill...`);
```

### ✅ نفس معالجة البيانات
- نقل المدفوعات والمدفوعات الجزئية
- دمج الملاحظات مع تسمية المصدر
- إعادة حساب المجاميع
- حذف الفاتورة الفارغة

### ✅ نفس التحديثات
- تحديث مرجع الفاتورة في الجلسة
- حفظ تدريجي بعد كل خطوة
- إعادة حساب المجاميع في الوقت المناسب

## المزايا

### ✅ الاتساق
- نفس المنطق في كلا الوظيفتين
- سلوك متوقع ومتسق

### ✅ الموثوقية
- منطق مجرب ومختبر من changeSessionTable
- تجنب الأخطاء والتناقضات

### ✅ الصيانة
- كود موحد وسهل الصيانة
- تحديث واحد يؤثر على كلا الوظيفتين

## الملفات المحدثة
- `server/controllers/sessionController.js` - تحديث `linkSessionToTable` لتطابق `changeSessionTable`

الآن `linkSessionToTable` تتبع نفس العملية المستخدمة في `changeSessionTable` بالضبط! 🎯✨