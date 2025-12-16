# الربط الذكي للجلسات بالطاولات

## المنطق المحسن

عند ربط جلسة بطاولة، يتم اتباع المنطق التالي:

### Case 1: الطاولة تحتوي على فاتورة غير مدفوعة بالكامل
**العملية**: دمج فاتورة الجلسة مع فاتورة الطاولة الموجودة

```javascript
if (existingTableBill && existingTableBill._id.toString() !== sessionBill._id.toString()) {
    // دمج فاتورة الجلسة مع فاتورة الطاولة
    
    // 1. نقل الجلسات
    existingTableBill.sessions.push(...sessionBill.sessions);
    
    // 2. نقل الطلبات (إن وجدت)
    existingTableBill.orders.push(...sessionBill.orders);
    
    // 3. نقل المدفوعات
    existingTableBill.payments.push(...sessionBill.payments);
    existingTableBill.paid += sessionBill.paid;
    
    // 4. نقل المدفوعات الجزئية
    existingTableBill.partialPayments.push(...sessionBill.partialPayments);
    
    // 5. إضافة ملاحظات الدمج
    existingTableBill.notes += `\n[تم دمج فاتورة ${sessionBill.billNumber}]`;
    
    // 6. تحديث مرجع الفاتورة في الجلسة
    session.bill = existingTableBill._id;
    
    // 7. إعادة حساب المجاميع
    await existingTableBill.calculateSubtotal();
    existingTableBill.remaining = existingTableBill.total - existingTableBill.paid;
    
    // 8. حذف فاتورة الجلسة القديمة
    await sessionBill.deleteOne();
}
```

### Case 2: الطاولة لا تحتوي على فاتورة غير مدفوعة
**العملية**: ربط الطاولة بفاتورة الجلسة الحالية

```javascript
else {
    // إضافة الطاولة إلى فاتورة الجلسة
    
    // 1. ربط الطاولة
    sessionBill.table = tableId;
    
    // 2. تغيير نوع الفاتورة
    sessionBill.billType = "cafe";
    
    // 3. تحديث اسم العميل
    sessionBill.customerName = `طاولة ${table.number}`;
    
    // 4. إضافة ملاحظة الربط
    sessionBill.notes += `\n[تم ربط الفاتورة بالطاولة ${table.number}]`;
    
    // 5. حفظ التغييرات
    await sessionBill.save();
}
```

## التفاصيل الفنية

### البحث عن الفاتورة الموجودة
```javascript
const existingTableBill = await Bill.findOne({
    table: tableId,
    organization: req.user.organization,
    status: { $in: ['draft', 'partial', 'overdue'] }  // غير مدفوعة بالكامل
}).sort({ createdAt: -1 });  // الأحدث أولاً
```

### نقل البيانات الشامل
- ✅ **الجلسات**: نقل جميع الجلسات
- ✅ **الطلبات**: نقل الطلبات (إن وجدت)
- ✅ **المدفوعات**: نقل المدفوعات العادية
- ✅ **المدفوعات الجزئية**: نقل المدفوعات الجزئية
- ✅ **الملاحظات**: دمج الملاحظات مع تسمية المصدر

### إعادة حساب المجاميع
```javascript
await existingTableBill.calculateSubtotal();
existingTableBill.remaining = existingTableBill.total - (existingTableBill.paid || 0);
await existingTableBill.save();
```

## أمثلة على الملاحظات

### Case 1: دمج الفواتير
```
الملاحظات الأصلية لفاتورة الطاولة
[تم دمج فاتورة BILL-251216123456]
[من BILL-251216123456]: ملاحظات فاتورة الجلسة الأصلية
```

### Case 2: ربط الطاولة
```
الملاحظات الأصلية لفاتورة الجلسة
[تم ربط الفاتورة بالطاولة 5]
```

## التسجيل المفصل

### Case 1: الدمج
```javascript
Logger.info(`🔗 CASE 1: Table ${table.number} has existing unpaid bill - merging session bill with table bill`);
Logger.info(`🔄 Merging session bill ${sessionBill.billNumber} into table bill ${existingTableBill.billNumber}`);
Logger.info(`✅ Transferred ${sessionBill.sessions.length} sessions to table bill`);
Logger.info(`💰 Transferred payments: ${sessionBill.paid || 0} EGP`);
Logger.info(`🗑️ Deleted old session bill ${sessionBill.billNumber}`);
```

### Case 2: الربط
```javascript
Logger.info(`📌 CASE 2: Table ${table.number} has no unpaid bill - linking table to session bill`);
Logger.info(`✅ Linked table ${table.number} to session bill ${sessionBill.billNumber}`);
```

## المزايا

### ✅ منطق واضح ومحدد
- حالتان واضحتان مع معالجة مختلفة لكل حالة
- قرارات ذكية بناءً على حالة الطاولة

### ✅ الحفاظ على البيانات
- لا يتم فقدان أي معلومات مفيدة
- نقل شامل لجميع أنواع البيانات

### ✅ التنظيم الأمثل
- تقليل عدد الفواتير عند الإمكان (Case 1)
- ربط منطقي عند عدم وجود تداخل (Case 2)

### ✅ التتبع الكامل
- تسجيل مفصل لكل عملية
- ملاحظات واضحة عن مصدر البيانات

## الملفات المحدثة
- `server/controllers/sessionController.js` - تحديث `linkSessionToTable`

الآن ربط الجلسات بالطاولات يتبع منطقاً ذكياً ومحسناً! 🎯✨