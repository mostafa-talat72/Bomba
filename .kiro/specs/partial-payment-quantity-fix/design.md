# Design Document

## Overview

هذا التصميم يهدف إلى إصلاح خطأ في نظام الدفع الجزئي حيث يقوم النظام حالياً بدفع كامل الكمية من الصنف بدلاً من الكمية المحددة فقط. المشكلة الأساسية هي أن هيكل البيانات الحالي `itemPayments` يتتبع حالة الدفع على مستوى الصنف بالكامل (isPaid: true/false) وليس على مستوى الكمية.

## Architecture

سنقوم بتعديل النظام الحالي ليدعم تتبع الكميات المدفوعة بدلاً من حالة الدفع الثنائية (مدفوع/غير مدفوع). التعديلات ستشمل:

1. **Backend (Bill Model)**: تعديل هيكل `itemPayments` لتتبع الكمية المدفوعة
2. **Backend (Controller)**: تعديل دالة `payForItems` لقبول الكميات
3. **Frontend (BillView)**: تعديل واجهة المستخدم لإدخال الكميات
4. **Frontend (API)**: تعديل استدعاء API لإرسال الكميات

## Components and Interfaces

### 1. Bill Model Schema Changes

**Current Structure:**
```javascript
itemPayments: [{
  orderId: ObjectId,
  itemId: String,
  itemName: String,
  quantity: Number,        // الكمية الإجمالية
  pricePerUnit: Number,
  totalPrice: Number,
  paidAmount: Number,      // المبلغ المدفوع (غير مستخدم حالياً)
  isPaid: Boolean,         // حالة ثنائية فقط
  paidAt: Date,
  paidBy: ObjectId
}]
```

**New Structure:**
```javascript
itemPayments: [{
  orderId: ObjectId,
  itemId: String,
  itemName: String,
  quantity: Number,           // الكمية الإجمالية
  paidQuantity: Number,       // الكمية المدفوعة (جديد)
  remainingQuantity: Number,  // الكمية المتبقية (محسوب)
  pricePerUnit: Number,
  totalPrice: Number,         // السعر الإجمالي للكمية الكاملة
  paidAmount: Number,         // المبلغ المدفوع (محسوب من paidQuantity)
  isPaid: Boolean,            // true عندما paidQuantity === quantity
  paidAt: Date,               // آخر تاريخ دفع
  paidBy: ObjectId,           // آخر مستخدم دفع
  paymentHistory: [{          // سجل الدفعات (جديد)
    quantity: Number,
    amount: Number,
    paidAt: Date,
    paidBy: ObjectId,
    method: String
  }]
}]
```

### 2. API Endpoint Changes

**Current Request:**
```javascript
POST /api/bills/:id/pay-items
{
  itemIds: ["itemId1", "itemId2"],
  paymentMethod: "cash"
}
```

**New Request:**
```javascript
POST /api/bills/:id/pay-items
{
  items: [
    { itemId: "itemId1", quantity: 2 },
    { itemId: "itemId2", quantity: 1 }
  ],
  paymentMethod: "cash"
}
```

### 3. Frontend Interface Changes

**Current UI:**
- Checkbox لتحديد الصنف بالكامل
- زر "دفع الأصناف المحددة"

**New UI:**
- Input field لإدخال الكمية المراد دفعها
- عرض الكمية المتبقية
- زر "دفع الكميات المحددة"
- Validation للتأكد من أن الكمية المدخلة لا تتجاوز الكمية المتبقية

## Data Models

### ItemPayment Model (Updated)

```typescript
interface ItemPayment {
  _id: string;
  orderId: string;
  itemId: string;
  itemName: string;
  quantity: number;           // الكمية الإجمالية
  paidQuantity: number;       // الكمية المدفوعة
  remainingQuantity: number;  // محسوب: quantity - paidQuantity
  pricePerUnit: number;
  totalPrice: number;         // السعر الإجمالي
  paidAmount: number;         // محسوب: paidQuantity * pricePerUnit
  isPaid: boolean;            // محسوب: paidQuantity === quantity
  paidAt?: Date;
  paidBy?: string;
  paymentHistory: PaymentHistoryEntry[];
}

interface PaymentHistoryEntry {
  quantity: number;
  amount: number;
  paidAt: Date;
  paidBy: string;
  method: 'cash' | 'card' | 'transfer';
}
```

### PayForItemsRequest Model

```typescript
interface PayForItemsRequest {
  items: {
    itemId: string;
    quantity: number;
  }[];
  paymentMethod: 'cash' | 'card' | 'transfer';
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

بعد مراجعة جميع الخصائص المحددة في التحليل الأولي، وجدنا التكرارات التالية:
- الخاصية 3.2 مكررة مع 1.2 (تحديث الكمية المدفوعة)
- الخاصية 3.3 مكررة مع 2.1 (حساب المبلغ المتبقي)
- الخاصية 3.4 مكررة مع 1.4 (عرض البيانات)

سنقوم بإزالة الخصائص المكررة والاحتفاظ بالخصائص الأساسية فقط.

### Correctness Properties

Property 1: Payment amount calculation
*For any* item with a given quantity and price per unit, when paying for a specific quantity, the calculated payment amount should equal the specified quantity multiplied by the price per unit
**Validates: Requirements 1.1**

Property 2: Quantity tracking update
*For any* item payment, when paying for a partial quantity, the paid quantity should be updated to reflect the payment and the remaining quantity should equal the original quantity minus the paid quantity
**Validates: Requirements 1.2**

Property 3: Payment history recording
*For any* item payment, when a payment is made, the payment should be recorded in the payment history with the correct quantity, amount, timestamp, user, and method
**Validates: Requirements 1.3**

Property 4: Bill data display
*For any* bill, when displaying the bill, each item should show the original quantity, paid quantity, and remaining quantity
**Validates: Requirements 1.4**

Property 5: Duplicate payment prevention
*For any* item, when attempting to pay for a quantity that would exceed the remaining quantity, the system should reject the payment
**Validates: Requirements 1.5**

Property 6: Remaining amount calculation
*For any* item with partial payment, the remaining amount should equal the remaining quantity multiplied by the price per unit
**Validates: Requirements 2.1**

Property 7: Total paid amount aggregation
*For any* bill with multiple items, when paying for partial quantities of multiple items, the total paid amount should equal the sum of (paid quantity × price per unit) for all items
**Validates: Requirements 2.2**

Property 8: Bill status - fully paid
*For any* bill, when all quantities of all items are paid, the bill status should be "paid"
**Validates: Requirements 2.3**

Property 9: Bill status - partially paid
*For any* bill, when some but not all quantities are paid, the bill status should be "partial"
**Validates: Requirements 2.4**

Property 10: Initial quantity state
*For any* newly created bill, all items should have paid quantity initialized to zero
**Validates: Requirements 3.1**

Property 11: Overpayment rejection
*For any* item, when attempting to pay for a quantity greater than the remaining quantity, the system should reject the operation with an error message
**Validates: Requirements 4.1**

Property 12: Fully paid item rejection
*For any* item that is fully paid (remaining quantity is zero), when attempting to pay for additional quantity, the system should reject the operation with an error message
**Validates: Requirements 4.3**

## Error Handling

### Validation Errors

1. **Invalid Quantity**: عندما يحاول المستخدم دفع كمية صفر أو سالبة
   - Response: 400 Bad Request
   - Message: "يجب إدخال كمية صحيحة أكبر من صفر"

2. **Quantity Exceeds Remaining**: عندما تتجاوز الكمية المطلوبة الكمية المتبقية
   - Response: 400 Bad Request
   - Message: "الكمية المطلوبة ({quantity}) أكبر من الكمية المتبقية ({remainingQuantity})"

3. **Item Already Fully Paid**: عندما يحاول المستخدم دفع لصنف مدفوع بالكامل
   - Response: 400 Bad Request
   - Message: "الصنف '{itemName}' مدفوع بالكامل"

4. **Item Not Found**: عندما لا يوجد الصنف في الفاتورة
   - Response: 404 Not Found
   - Message: "الصنف غير موجود في الفاتورة"

5. **Bill Not Found**: عندما لا توجد الفاتورة
   - Response: 404 Not Found
   - Message: "الفاتورة غير موجودة"

6. **Bill Already Paid**: عندما تكون الفاتورة مدفوعة بالكامل
   - Response: 400 Bad Request
   - Message: "لا يمكن دفع أصناف من فاتورة مدفوعة بالكامل"

7. **Bill Cancelled**: عندما تكون الفاتورة ملغاة
   - Response: 400 Bad Request
   - Message: "لا يمكن دفع أصناف من فاتورة ملغاة"

### Database Errors

- استخدام try-catch blocks لالتقاط أخطاء قاعدة البيانات
- تسجيل الأخطاء باستخدام Logger
- إرجاع رسالة خطأ عامة للمستخدم مع تفاصيل في السجلات

## Testing Strategy

### Unit Testing

سنقوم بكتابة unit tests للتحقق من:

1. **Bill Model Methods**:
   - `payForItems()` مع كميات مختلفة
   - `calculateRemainingAmount()` مع دفعات جزئية
   - تهيئة `itemPayments` عند إنشاء فاتورة جديدة

2. **Controller Functions**:
   - `payForItems()` مع طلبات صحيحة
   - معالجة الأخطاء للطلبات غير الصحيحة
   - تحديث حالة الفاتورة بعد الدفع

3. **Frontend Components**:
   - عرض الكميات المدفوعة والمتبقية
   - التحقق من المدخلات قبل الإرسال
   - معالجة الاستجابات من API

### Property-Based Testing

سنستخدم **fast-check** (للـ JavaScript/TypeScript) لكتابة property-based tests. كل اختبار سيتم تشغيله على الأقل 100 مرة مع بيانات عشوائية مختلفة.

**Property-Based Tests Required:**

1. **Property 1 Test**: Payment amount calculation
   - **Feature: partial-payment-quantity-fix, Property 1: Payment amount calculation**
   - Generate random items with quantities and prices
   - Pay for random partial quantities
   - Verify: payment amount = quantity × price per unit

2. **Property 2 Test**: Quantity tracking update
   - **Feature: partial-payment-quantity-fix, Property 2: Quantity tracking update**
   - Generate random items
   - Pay for random partial quantities
   - Verify: paidQuantity updated correctly and remainingQuantity = original - paid

3. **Property 3 Test**: Payment history recording
   - **Feature: partial-payment-quantity-fix, Property 3: Payment history recording**
   - Generate random payments
   - Verify: each payment recorded in paymentHistory with correct data

4. **Property 4 Test**: Bill data display
   - **Feature: partial-payment-quantity-fix, Property 4: Bill data display**
   - Generate random bills
   - Verify: displayed data includes original, paid, and remaining quantities

5. **Property 5 Test**: Duplicate payment prevention
   - **Feature: partial-payment-quantity-fix, Property 5: Duplicate payment prevention**
   - Generate random items
   - Attempt to pay more than remaining quantity
   - Verify: payment rejected

6. **Property 6 Test**: Remaining amount calculation
   - **Feature: partial-payment-quantity-fix, Property 6: Remaining amount calculation**
   - Generate random items with partial payments
   - Verify: remaining amount = remaining quantity × price per unit

7. **Property 7 Test**: Total paid amount aggregation
   - **Feature: partial-payment-quantity-fix, Property 7: Total paid amount aggregation**
   - Generate bills with multiple items
   - Pay partial quantities for multiple items
   - Verify: total paid = sum of all (paid quantity × price per unit)

8. **Property 8 Test**: Bill status - fully paid
   - **Feature: partial-payment-quantity-fix, Property 8: Bill status - fully paid**
   - Generate random bills
   - Pay all quantities
   - Verify: bill.status === "paid"

9. **Property 9 Test**: Bill status - partially paid
   - **Feature: partial-payment-quantity-fix, Property 9: Bill status - partially paid**
   - Generate random bills
   - Pay some but not all quantities
   - Verify: bill.status === "partial"

10. **Property 10 Test**: Initial quantity state
    - **Feature: partial-payment-quantity-fix, Property 10: Initial quantity state**
    - Generate new bills
    - Verify: all items have paidQuantity === 0

11. **Property 11 Test**: Overpayment rejection
    - **Feature: partial-payment-quantity-fix, Property 11: Overpayment rejection**
    - Generate random items
    - Attempt to pay quantity > remaining
    - Verify: operation rejected with error

12. **Property 12 Test**: Fully paid item rejection
    - **Feature: partial-payment-quantity-fix, Property 12: Fully paid item rejection**
    - Generate fully paid items
    - Attempt to pay additional quantity
    - Verify: operation rejected with error

### Integration Testing

سنقوم بكتابة integration tests للتحقق من:

1. **End-to-End Payment Flow**:
   - إنشاء فاتورة جديدة
   - دفع كميات جزئية من عدة أصناف
   - التحقق من تحديث البيانات في قاعدة البيانات
   - التحقق من تحديث حالة الفاتورة

2. **API Endpoint Testing**:
   - اختبار POST `/api/bills/:id/pay-items` مع بيانات صحيحة
   - اختبار معالجة الأخطاء
   - اختبار التحقق من الصلاحيات

3. **Frontend-Backend Integration**:
   - اختبار إرسال البيانات من الفرونت إند
   - اختبار استقبال الاستجابات
   - اختبار تحديث الواجهة بعد الدفع

## Implementation Notes

### Migration Strategy

نظراً لأن النظام الحالي يستخدم `isPaid` (boolean) بدلاً من `paidQuantity` (number)، سنحتاج إلى:

1. **إضافة الحقول الجديدة** دون حذف القديمة (للتوافق)
2. **Migration Script** لتحويل البيانات الموجودة:
   - إذا `isPaid === true`: set `paidQuantity = quantity`
   - إذا `isPaid === false`: set `paidQuantity = 0`
3. **Backward Compatibility**: الحفاظ على `isPaid` محدث بناءً على `paidQuantity`

### Performance Considerations

- استخدام indexes على `itemPayments.itemId` لتسريع البحث
- تجنب populate غير الضروري عند جلب الفواتير
- استخدام lean() عند عدم الحاجة لـ Mongoose methods

### Security Considerations

- التحقق من صلاحيات المستخدم قبل السماح بالدفع
- التحقق من أن الفاتورة تنتمي لنفس المنظمة
- تسجيل جميع عمليات الدفع في paymentHistory للمراجعة

## Conclusion

هذا التصميم يحل مشكلة الدفع الجزئي بطريقة شاملة من خلال:
1. تتبع الكميات المدفوعة بدلاً من الحالة الثنائية
2. التحقق الصارم من المدخلات
3. حساب دقيق للمبالغ المتبقية
4. سجل كامل لجميع الدفعات
5. اختبارات شاملة لضمان الصحة
