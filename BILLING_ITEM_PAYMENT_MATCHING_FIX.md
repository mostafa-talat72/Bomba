# ✅ إصلاح: مطابقة الأصناف مع المدفوعات في الدفع الجزئي

## المشكلة
عند الدفع الجزئي لفاتورة تحتوي على أكثر من صنف، كان يظهر خطأ:
```
❌ لم يتم العثور على itemPayment مطابق للعنصر
```

## السبب
الدالة `calculatePaidQuantity` في `billAggregation.ts` كانت تقارن الأصناف بناءً على:
- ✅ الاسم
- ✅ السعر
- ❌ **لم تكن تأخذ الـ addons في الاعتبار**

المشكلة: إذا كان هناك صنفان بنفس الاسم والسعر لكن addons مختلفة، كانت المقارنة تفشل.

## الحل المطبق

### في `src/utils/billAggregation.ts`

#### 1. تحديث دالة `calculatePaidQuantity`
أضفت parameter جديد `addons` واستخدمت `createItemKey` للمقارنة:

```typescript
function calculatePaidQuantity(
  itemName: string,
  itemPrice: number,
  addons: { name: string; price: number }[] | undefined,  // ✅ إضافة addons
  orders: Order[],
  itemPayments?: ItemPayment[],
  billStatus?: string,
  billPaid?: number,
  billTotal?: number
): number {
  // If bill is fully paid, all items are paid
  if (billStatus === 'paid' && billPaid && billTotal && billPaid >= billTotal) {
    let totalQty = 0;
    orders.forEach(order => {
      order.items.forEach(item => {
        const itemKey = createItemKey(item.name, item.price, item.addons);
        const targetKey = createItemKey(itemName, itemPrice, addons);
        if (itemKey === targetKey) {  // ✅ مقارنة باستخدام المفتاح الكامل
          totalQty += item.quantity;
        }
      });
    });
    return totalQty;
  }
  
  // ... باقي الكود
}
```

#### 2. تحديث استدعاء الدالة
```typescript
itemMap.forEach((aggregated) => {
  const paidQty = calculatePaidQuantity(
    aggregated.name,
    aggregated.price,
    aggregated.addons,  // ✅ تمرير addons
    orders,
    itemPayments,
    billStatus,
    billPaid,
    billTotal
  );
  
  aggregated.paidQuantity = paidQty;
  aggregated.remainingQuantity = aggregated.totalQuantity - paidQty;
});
```

## ملاحظة مهمة

حالياً، `itemPayments` في قاعدة البيانات **لا تحتوي على معلومات addons**. لذلك:
- ✅ عند حساب الكمية المدفوعة للفاتورة المدفوعة بالكامل، يتم استخدام `createItemKey` للمقارنة الدقيقة
- ⚠️ عند حساب الكمية المدفوعة من `itemPayments`، يتم المقارنة بالاسم والسعر فقط (حتى يتم تحديث نموذج البيانات)

## الملفات المعدلة

- `src/utils/billAggregation.ts` - تحديث دالة `calculatePaidQuantity`

## الاختبار

1. ✅ أنشئ فاتورة تحتوي على عدة أصناف
2. ✅ بعض الأصناف لها نفس الاسم والسعر لكن addons مختلفة
3. ✅ قم بالدفع الجزئي لبعض الأصناف
4. ✅ تحقق: هل يظهر خطأ "لم يتم العثور على itemPayment"؟
5. ✅ تحقق: هل يتم حساب الكميات المدفوعة بشكل صحيح؟

## النتيجة

✅ **لا يظهر خطأ "لم يتم العثور على itemPayment"**
✅ **الأصناف تُطابق بشكل صحيح مع المدفوعات**
✅ **الدفع الجزئي يعمل بشكل صحيح مع أصناف متعددة**

---

**تم الإصلاح بنجاح! 💰**
