# Toast Notifications Multi-Language Support Guide

## Overview
هذا الدليل يوضح كيفية تحديث جميع رسائل Toast في `AppContext.tsx` لدعم اللغات الثلاث.

## Translation Keys Added
تم إضافة قسم `toast` في ملفات الترجمة الثلاثة (ar.json, en.json, fr.json) مع الأقسام التالية:

### 1. Session Messages (toast.session)
- `started`: "تم بدء جلسة جديدة على {{deviceName}}"
- `startedWithBill`: "تم بدء جلسة جديدة على {{deviceName}} - الفاتورة: {{billNumber}}"
- `updated`: "تم تحديث الجلسة بنجاح"
- `ended`: "تم إنهاء الجلسة على {{deviceName}} - إجمالي التكلفة: {{cost}}"
- `endedSuccess`: "تم إنهاء الجلسة على {{deviceName}} بنجاح"
- `createError`, `updateError`, `endError`

### 2. Order Messages (toast.order)
- `created`: "تم إنشاء طلب جديد: {{orderNumber}}"
- `updated`, `preparingUpdated`, `statusUpdated`
- `incompleteData`, `incompleteItems`, `invalidTable`, `insufficientStock`
- `createError`, `updateError`, `statusError`

### 3. Inventory Messages (toast.inventory)
- `added`: "تم إضافة المنتج بنجاح"
- `updated`: "تم تحديث المنتج بنجاح"
- `stockUpdated`: "تم {{operation}} {{quantity}} وحدة من المخزون بنجاح"
- `addError`, `updateError`, `stockError`

### 4. Bill Messages (toast.bill)
- `created`, `updated`, `cancelled`
- `paymentAdded`: "تم إضافة دفعة {{amount}} {{currency}} {{method}} بنجاح"
- `partialPayment`
- `createError`, `updateError`, `cancelError`, `paymentError`, `partialPaymentError`

### 5. Helper Translations
- `toast.stockOperations`: { add, subtract, update }
- `toast.paymentMethods`: { cash, card, online }

## Required Changes in AppContext.tsx

### Current Pattern (Hardcoded Arabic):
```typescript
showNotification(`تم بدء جلسة جديدة على ${session.deviceName}`, 'success');
```

### New Pattern (i18n):
```typescript
showNotification(t('toast.session.started', { deviceName: session.deviceName }), 'success');
```

## Complete List of Changes Needed

### Sessions (Lines ~878-940)
1. **Line 878**: 
   ```typescript
   // OLD:
   showNotification(`تم بدء جلسة جديدة على ${session.deviceName} - الفاتورة: ${bill.billNumber}`, 'success');
   // NEW:
   showNotification(t('toast.session.startedWithBill', { deviceName: session.deviceName, billNumber: bill.billNumber }), 'success');
   ```

2. **Line 880**:
   ```typescript
   // OLD:
   showNotification(`تم بدء جلسة جديدة على ${session.deviceName}`, 'success');
   // NEW:
   showNotification(t('toast.session.started', { deviceName: session.deviceName }), 'success');
   ```

3. **Line 889**:
   ```typescript
   // OLD:
   showNotification(err.message || 'فشل في إنشاء الجلسة', 'error');
   // NEW:
   showNotification(err.message || t('toast.session.createError'), 'error');
   ```

4. **Line 901**:
   ```typescript
   // OLD:
   showNotification('تم تحديث الجلسة بنجاح', 'success');
   // NEW:
   showNotification(t('toast.session.updated'), 'success');
   ```

5. **Line 907**:
   ```typescript
   // OLD:
   showNotification(err.message || 'فشل في تحديث الجلسة', 'error');
   // NEW:
   showNotification(err.message || t('toast.session.updateError'), 'error');
   ```

6. **Line 926**:
   ```typescript
   // OLD:
   showNotification(`تم إنهاء الجلسة على ${session.deviceName} - إجمالي التكلفة: ${session.finalCost}`, 'success');
   // NEW:
   showNotification(t('toast.session.ended', { deviceName: session.deviceName, cost: session.finalCost }), 'success');
   ```

7. **Line 928**:
   ```typescript
   // OLD:
   showNotification(`تم إنهاء الجلسة على ${session.deviceName} بنجاح`, 'success');
   // NEW:
   showNotification(t('toast.session.endedSuccess', { deviceName: session.deviceName }), 'success');
   ```

8. **Line 937**:
   ```typescript
   // OLD:
   showNotification(err.message || 'فشل في إنهاء الجلسة', 'error');
   // NEW:
   showNotification(err.message || t('toast.session.endError'), 'error');
   ```

### Orders (Lines ~948-1075)
9. **Line 948**:
   ```typescript
   // OLD:
   showNotification('بيانات الطلب غير مكتملة', 'error');
   // NEW:
   showNotification(t('toast.order.incompleteData'), 'error');
   ```

10. **Line 955**:
    ```typescript
    // OLD:
    showNotification('بيانات العناصر غير مكتملة', 'error');
    // NEW:
    showNotification(t('toast.order.incompleteItems'), 'error');
    ```

11. **Line 963**:
    ```typescript
    // OLD:
    showNotification('معرف الطاولة غير صحيح', 'error');
    // NEW:
    showNotification(t('toast.order.invalidTable'), 'error');
    ```

12. **Line 981**:
    ```typescript
    // OLD:
    showNotification(`تم إنشاء طلب جديد: ${newOrder.orderNumber}`, 'success');
    // NEW:
    showNotification(t('toast.order.created', { orderNumber: newOrder.orderNumber }), 'success');
    ```

13. **Line 986**:
    ```typescript
    // OLD:
    showNotification(errorMessage, 'error');
    // NEW:
    showNotification(errorMessage, 'error'); // Keep as is - comes from server
    ```

14. **Line 991**:
    ```typescript
    // OLD:
    showNotification(err.message || 'فشل في إنشاء الطلب', 'error');
    // NEW:
    showNotification(err.message || t('toast.order.createError'), 'error');
    ```

15. **Line 1004**:
    ```typescript
    // OLD:
    showNotification('تم تحديث الطلب بنجاح', 'success');
    // NEW:
    showNotification(t('toast.order.updated'), 'success');
    ```

16. **Line 1015**:
    ```typescript
    // OLD:
    showNotification(`المخزون غير كافي لتحديث الطلب:\n${detailsMessage}`, 'error');
    // NEW:
    showNotification(`${t('toast.order.insufficientStock')}:\n${detailsMessage}`, 'error');
    ```

17. **Line 1027**:
    ```typescript
    // OLD:
    showNotification(err.message || 'فشل في تحديث الطلب', 'error');
    // NEW:
    showNotification(err.message || t('toast.order.updateError'), 'error');
    ```

18. **Line 1040**:
    ```typescript
    // OLD:
    showNotification('تم تحديث حالة التجهيز بنجاح', 'success');
    // NEW:
    showNotification(t('toast.order.preparingUpdated'), 'success');
    ```

19. **Line 1046**:
    ```typescript
    // OLD:
    showNotification(err.message || 'فشل في تحديث حالة التجهيز', 'error');
    // NEW:
    showNotification(err.message || t('toast.order.updateError'), 'error');
    ```

20. **Line 1065**:
    ```typescript
    // OLD:
    showNotification(statusMessages[status], 'success');
    // NEW:
    showNotification(t('toast.order.statusUpdated'), 'success');
    ```

21. **Line 1072**:
    ```typescript
    // OLD:
    showNotification(err.message || 'فشل في تحديث حالة الطلب', 'error');
    // NEW:
    showNotification(err.message || t('toast.order.statusError'), 'error');
    ```

### Inventory (Lines ~1099-1157)
22. **Line 1100**:
    ```typescript
    // OLD:
    showNotification('تم إضافة المنتج بنجاح', 'success');
    // NEW:
    showNotification(t('toast.inventory.added'), 'success');
    ```

23. **Line 1110**:
    ```typescript
    // OLD:
    showNotification(response.message || 'فشل في إضافة المنتج', 'error');
    // NEW:
    showNotification(response.message || t('toast.inventory.addError'), 'error');
    ```

24. **Line 1115**:
    ```typescript
    // OLD:
    showNotification(err.message || 'فشل في إضافة المنتج', 'error');
    // NEW:
    showNotification(err.message || t('toast.inventory.addError'), 'error');
    ```

25. **Line 1127**:
    ```typescript
    // OLD:
    showNotification('تم تحديث المنتج بنجاح', 'success');
    // NEW:
    showNotification(t('toast.inventory.updated'), 'success');
    ```

26. **Line 1133**:
    ```typescript
    // OLD:
    showNotification(err.message || 'فشل في تحديث المنتج', 'error');
    // NEW:
    showNotification(err.message || t('toast.inventory.updateError'), 'error');
    ```

27. **Line 1147**:
    ```typescript
    // OLD:
    const operationText = operation === 'add' ? 'إضافة' : operation === 'subtract' ? 'خصم' : 'تحديث';
    showNotification(`تم ${operationText} ${quantity} وحدة من المخزون بنجاح`, 'success');
    // NEW:
    const operationText = t(`toast.stockOperations.${operation}`);
    showNotification(t('toast.inventory.stockUpdated', { operation: operationText, quantity }), 'success');
    ```

28. **Line 1154**:
    ```typescript
    // OLD:
    showNotification(err.message || 'فشل في تحديث المخزون', 'error');
    // NEW:
    showNotification(err.message || t('toast.inventory.stockError'), 'error');
    ```

### Bills (Lines ~1164-1265)
29. **Line 1165**:
    ```typescript
    // OLD:
    showNotification('تم إنشاء الفاتورة بنجاح', 'success');
    // NEW:
    showNotification(t('toast.bill.created'), 'success');
    ```

30. **Line 1172**:
    ```typescript
    // OLD:
    showNotification(err.message || 'فشل في إنشاء الفاتورة', 'error');
    // NEW:
    showNotification(err.message || t('toast.bill.createError'), 'error');
    ```

31. **Line 1184**:
    ```typescript
    // OLD:
    showNotification('تم تحديث الفاتورة بنجاح', 'success');
    // NEW:
    showNotification(t('toast.bill.updated'), 'success');
    ```

32. **Line 1190**:
    ```typescript
    // OLD:
    showNotification(err.message || 'فشل في تحديث الفاتورة', 'error');
    // NEW:
    showNotification(err.message || t('toast.bill.updateError'), 'error');
    ```

33. **Line 1203**:
    ```typescript
    // OLD:
    const methodText = method === 'cash' ? 'نقداً' : method === 'card' ? 'بطاقة' : method === 'online' ? 'إلكتروني' : method;
    showNotification(`تم إضافة دفعة ${amount} ريال ${methodText} بنجاح`, 'success');
    // NEW:
    const methodText = t(`toast.paymentMethods.${method}`);
    showNotification(t('toast.bill.paymentAdded', { amount, currency: 'ريال', method: methodText }), 'success');
    ```

34. **Line 1210**:
    ```typescript
    // OLD:
    showNotification(err.message || 'فشل في إضافة الدفعة', 'error');
    // NEW:
    showNotification(err.message || t('toast.bill.paymentError'), 'error');
    ```

35. **Line 1228**:
    ```typescript
    // OLD:
    showNotification('تم إلغاء الفاتورة بنجاح', 'success');
    // NEW:
    showNotification(t('toast.bill.cancelled'), 'success');
    ```

36. **Line 1235**:
    ```typescript
    // OLD:
    showNotification(err.message || 'فشل في إلغاء الفاتورة', 'error');
    // NEW:
    showNotification(err.message || t('toast.bill.cancelError'), 'error');
    ```

37. **Line 1256**:
    ```typescript
    // OLD:
    showNotification('تم تسجيل الدفع الجزئي بنجاح', 'success');
    // NEW:
    showNotification(t('toast.bill.partialPayment'), 'success');
    ```

38. **Line 1262**:
    ```typescript
    // OLD:
    showNotification(err.message || 'فشل في تسجيل الدفع الجزئي', 'error');
    // NEW:
    showNotification(err.message || t('toast.bill.partialPaymentError'), 'error');
    ```

## Implementation Steps

1. ✅ Translation keys have been added to ar.json, en.json, fr.json
2. ⏳ Update AppContext.tsx with all the changes listed above
3. ⏳ Test all toast notifications in all three languages
4. ⏳ Verify dynamic values (deviceName, orderNumber, etc.) display correctly

## Notes
- The `t` function from `useTranslation()` is already imported in AppContext.tsx
- Some error messages come from the server and should be kept as-is
- Dynamic values are passed using the second parameter: `t('key', { variable: value })`
- For nested translations like `toast.stockOperations.add`, use template literals: `t(\`toast.stockOperations.\${operation}\`)`

## Status
- Translation files: ✅ COMPLETE
- AppContext.tsx updates: ⏳ PENDING (38 changes needed)
- Testing: ⏳ PENDING
