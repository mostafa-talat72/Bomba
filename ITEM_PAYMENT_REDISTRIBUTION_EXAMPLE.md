# مثال على إعادة توزيع المدفوعات عند حذف الأصناف

## السيناريو:
فاتورة تحتوي على:
- قهوة (1) - معرف القائمة: `64f1a2b3c4d5e6f7g8h9i0j1` - مدفوع 50 من 100 جنيه
- قهوة (2) - معرف القائمة: `64f1a2b3c4d5e6f7g8h9i0j1` - غير مدفوعة 100 جنيه  
- شاي (1) - معرف القائمة: `64f1a2b3c4d5e6f7g8h9i0j2` - غير مدفوع 50 جنيه

## عند حذف القهوة الأولى:

### الطريقة القديمة (خاطئة):
```javascript
// كان يستخدم: "قهوة|100" كمفتاح
// مشكلة: قد يخلط بين أصناف مختلفة لها نفس الاسم والسعر
```

### الطريقة الجديدة (صحيحة):
```javascript
// يستخدم: "64f1a2b3c4d5e6f7g8h9i0j1" كمفتاح
// النتيجة: المبلغ المدفوع (50 جنيه) سينتقل للقهوة الثانية فقط
// الشاي لن يتأثر لأن له معرف مختلف
```

## الكود الجديد:

```javascript
// دالة تحديد المفتاح للإعادة التوزيع
function getItemRedistributionKey(item) {
    if (item.menuItemId && mongoose.Types.ObjectId.isValid(item.menuItemId)) {
        return item.menuItemId.toString(); // الطريقة الصحيحة
    }
    // للتوافق مع النظام القديم
    return `${item.name || item.itemName}|${item.price || item.pricePerUnit}`;
}

// دالة التحقق من إمكانية مشاركة المدفوعات
function canSharePayments(item1, item2) {
    // إذا كان لكلاهما menuItemId، قارنهما
    if (item1.menuItemId && item2.menuItemId) {
        return item1.menuItemId.toString() === item2.menuItemId.toString();
    }
    
    // إذا كان لكلاهما مرجع menuItem، قارنهما
    if (item1.menuItem && item2.menuItem) {
        const id1 = item1.menuItem._id || item1.menuItem;
        const id2 = item2.menuItem._id || item2.menuItem;
        return id1.toString() === id2.toString();
    }
    
    // الطريقة القديمة: مقارنة الاسم والسعر (أقل دقة)
    const name1 = item1.name || item1.itemName;
    const name2 = item2.name || item2.itemName;
    const price1 = item1.price || item1.pricePerUnit;
    const price2 = item2.price || item2.pricePerUnit;
    
    return name1 === name2 && Math.abs(price1 - price2) < 0.01;
}
```

## المزايا الجديدة:

### 1. دقة أكبر في التوزيع:
- لا يخلط بين أصناف مختلفة لها نفس الاسم
- يأخذ في الاعتبار الإضافات والتخصيصات
- يتعامل مع تغيير الأسعار بشكل صحيح

### 2. مرونة في التوافق:
- يدعم النظام القديم للفواتير الموجودة
- ينتقل تدريجياً للنظام الجديد
- لا يكسر الوظائف الحالية

### 3. تسجيل أفضل:
```javascript
// يسجل عملية إعادة التوزيع بتفاصيل أكثر
paymentHistory.push({
    quantity: quantityToAdd,
    amount: amountToAdd,
    paidAt: new Date(),
    method: 'redistribution',
    note: `Redistributed from deleted item: ${deletedItemName}`,
    originalItemId: deletedItemId,
    redistributionKey: itemKey
});
```

## مثال عملي:

```javascript
// قبل الحذف:
itemPayments = [
    {
        itemId: "order123-0",
        menuItemId: "64f1a2b3c4d5e6f7g8h9i0j1",
        itemName: "قهوة",
        paidAmount: 50,
        totalPrice: 100
    },
    {
        itemId: "order123-1", 
        menuItemId: "64f1a2b3c4d5e6f7g8h9i0j1",
        itemName: "قهوة",
        paidAmount: 0,
        totalPrice: 100
    }
]

// بعد حذف الصنف الأول:
itemPayments = [
    {
        itemId: "order123-1",
        menuItemId: "64f1a2b3c4d5e6f7g8h9i0j1", 
        itemName: "قهوة",
        paidAmount: 50, // تم نقل المبلغ هنا
        totalPrice: 100,
        paymentHistory: [
            {
                method: 'redistribution',
                amount: 50,
                note: 'Redistributed from deleted item: قهوة'
            }
        ]
    }
]
```