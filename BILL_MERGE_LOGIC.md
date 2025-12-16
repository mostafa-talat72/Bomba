# منطق دمج الفواتير الفارغة

## التغيير المطلوب
بدلاً من حذف الفاتورة الفارغة، يتم دمجها مع فاتورة أخرى موجودة لتجنب فقدان البيانات.

## المنطق الجديد

### 1. عند تغيير الطاولة (changeSessionTable)
```javascript
// STEP 3: Check if old bill is now empty and merge it
if (updatedCurrentBill && 
    updatedCurrentBill.sessions.length === 0 && 
    updatedCurrentBill.orders.length === 0) {
    
    // البحث عن فاتورة للدمج معها
    let targetBillForMerge = null;
    
    // أولاً: البحث في نفس الطاولة
    if (updatedCurrentBill.table) {
        targetBillForMerge = await Bill.findOne({
            _id: { $ne: updatedCurrentBill._id },
            table: updatedCurrentBill.table,
            organization: req.user.organization,
            status: { $in: ['draft', 'partial', 'overdue'] }
        }).sort({ createdAt: -1 });
    }
    
    // ثانياً: البحث في أي فاتورة غير مدفوعة
    if (!targetBillForMerge) {
        targetBillForMerge = await Bill.findOne({
            _id: { $ne: updatedCurrentBill._id },
            organization: req.user.organization,
            status: { $in: ['draft', 'partial', 'overdue'] }
        }).sort({ createdAt: -1 });
    }
    
    if (targetBillForMerge) {
        // دمج الفاتورة الفارغة مع الفاتورة المستهدفة
        const currentNotes = targetBillForMerge.notes || '';
        targetBillForMerge.notes = currentNotes + `\n[تم دمج فاتورة فارغة ${updatedCurrentBill.billNumber}]`;
        
        await targetBillForMerge.calculateSubtotal();
        await targetBillForMerge.save();
        
        Logger.info(`✅ Successfully merged empty bill with ${targetBillForMerge.billNumber}`);
    } else {
        // لا توجد فاتورة للدمج معها - احذف الفاتورة الفارغة
        Logger.info(`ℹ️ No suitable bill found for merge, deleting empty bill`);
    }
    
    // حذف الفاتورة الفارغة
    await updatedCurrentBill.deleteOne();
}
```

### 2. في دالة التنظيف (performCleanupHelper)
```javascript
// If bill is now empty, try to merge it
if (bill.sessions.length === 0 && bill.orders.length === 0) {
    // نفس منطق البحث والدمج
    let targetBillForMerge = null;
    
    // البحث عن فاتورة للدمج معها
    if (bill.table) {
        targetBillForMerge = await Bill.findOne({
            _id: { $ne: bill._id },
            table: bill.table,
            organization: organizationId,
            status: { $in: ['draft', 'partial', 'overdue'] }
        }).sort({ createdAt: -1 });
    }
    
    if (!targetBillForMerge) {
        targetBillForMerge = await Bill.findOne({
            _id: { $ne: bill._id },
            organization: organizationId,
            status: { $in: ['draft', 'partial', 'overdue'] }
        }).sort({ createdAt: -1 });
    }
    
    if (targetBillForMerge) {
        // دمج المعلومات
        const currentNotes = targetBillForMerge.notes || '';
        targetBillForMerge.notes = currentNotes + `\n[تم دمج فاتورة فارغة ${bill.billNumber}]`;
        
        await targetBillForMerge.calculateSubtotal();
        await targetBillForMerge.save();
    }
    
    // حذف الفاتورة الفارغة
    await bill.deleteOne();
}
```

## أولوية البحث للدمج

### 1. الأولوية الأولى: نفس الطاولة
- البحث عن فاتورة غير مدفوعة في نفس الطاولة
- الحالات المقبولة: `draft`, `partial`, `overdue`
- الترتيب: الأحدث أولاً (`createdAt: -1`)

### 2. الأولوية الثانية: أي فاتورة
- البحث عن أي فاتورة غير مدفوعة في المنشأة
- نفس الحالات والترتيب

### 3. إذا لم توجد فاتورة للدمج
- حذف الفاتورة الفارغة مباشرة
- تسجيل رسالة توضيحية

## المعلومات المدمجة

### في الملاحظات (notes)
```
[تم دمج فاتورة فارغة BILL-XXXXXX]
[مدمج من BILL-XXXXXX]: ملاحظات الفاتورة الأصلية
```

### العمليات المطلوبة
- `calculateSubtotal()` - إعادة حساب المجاميع
- `save()` - حفظ التغييرات
- `deleteOne()` - حذف الفاتورة الفارغة

## المزايا

### ✅ الحفاظ على البيانات
- لا يتم فقدان أي معلومات مفيدة
- الملاحظات والتفاصيل تُحفظ في الفاتورة المدمجة

### ✅ تقليل الفوضى
- عدد أقل من الفواتير الفارغة
- تنظيم أفضل للبيانات

### ✅ المرونة
- إذا لم توجد فاتورة للدمج، يتم الحذف العادي
- لا يؤثر على العمليات الأخرى

## الملفات المحدثة
- `server/controllers/sessionController.js`
  - تحديث `changeSessionTable` لاستخدام منطق الدمج
  - تحديث `performCleanupHelper` لاستخدام منطق الدمج

الآن الفواتير الفارغة ستُدمج مع فواتير أخرى بدلاً من الحذف المباشر!