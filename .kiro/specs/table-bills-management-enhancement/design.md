# Design Document

## Overview

هذا التصميم يحدد كيفية تحسين نظام إدارة الفواتير والطاولات في نظام Bomba. التصميم يركز على:
1. إزالة فلترة التاريخ عند الاستعلام عن فواتير طاولة معينة
2. تحديث تلقائي لحالة الطاولات بناءً على الفواتير غير المدفوعة
3. تحسين نظام الدفع الجزئي للأصناف مع تجميع الأصناف المتشابهة
4. إضافة دفع جزئي لجلسات البلايستيشن
5. تحسين عرض تفاصيل الدفع في واجهة المستخدم

## Architecture

### Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API Layer                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  billingController.js                                 │   │
│  │  - getBills() - modified                              │   │
│  │  - addPayment() - modified                            │   │
│  │  - payForItems() - new                                │   │
│  │  - paySessionPartial() - new                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Model Layer                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Bill.js                                              │   │
│  │  - itemPayments: Array                                │   │
│  │  - sessionPayments: Array                             │   │
│  │  - paymentHistory: Array                              │   │
│  │  - payForItems() - new method                         │   │
│  │  - paySessionPartial() - new method                   │   │
│  │  - calculateRemainingAmount() - modified              │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Table.js                                             │   │
│  │  - status: String (empty/occupied)                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Database Layer                              │
│                    MongoDB                                   │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Pages Layer                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Billing.tsx - modified                               │   │
│  │  - Table bills modal                                  │   │
│  │  - Partial payment modal                              │   │
│  │  - Session partial payment modal                      │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  BillView.tsx - modified                              │   │
│  │  - Aggregated items table                             │   │
│  │  - Session payment details                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Services Layer                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  api.ts - modified                                    │   │
│  │  - getBills() - support table parameter              │   │
│  │  - payForItems() - new                                │   │
│  │  - paySessionPartial() - new                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                Real-time Layer                               │
│                  Socket.IO                                   │
│  - bill-update events                                        │
│  - table-status-update events                                │
│  - payment-received events                                   │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend Components

#### 1. Bill Model Extensions

**New Fields:**
```javascript
// في Bill.js
itemPayments: [{
  orderId: ObjectId,
  itemId: String,
  itemName: String,
  quantity: Number,
  pricePerUnit: Number,
  totalPrice: Number,
  paidAmount: Number,
  isPaid: Boolean,
  paidAt: Date,
  paidBy: ObjectId
}]

sessionPayments: [{
  sessionId: ObjectId,
  sessionCost: Number,
  paidAmount: Number,
  remainingAmount: Number,
  payments: [{
    amount: Number,
    paidAt: Date,
    paidBy: ObjectId,
    method: String
  }]
}]

paymentHistory: [{
  timestamp: Date,
  amount: Number,
  method: String,
  paidBy: ObjectId,
  type: String, // 'full', 'partial-items', 'partial-session', 'mixed'
  details: {
    paidItems: [{
      itemName: String,
      quantity: Number,
      amount: Number
    }],
    paidSessions: [{
      sessionId: ObjectId,
      amount: Number,
      remainingAfter: Number
    }]
  }
}]
```

**New Methods:**
```javascript
// دفع أصناف محددة
Bill.payForItems(itemIds, paymentMethod, userId)

// دفع جزئي لجلسة
Bill.paySessionPartial(sessionId, amount, paymentMethod, userId)

// حساب المبلغ المتبقي من جميع أنواع الدفع
Bill.calculateRemainingAmount()
```

#### 2. Controller Modifications

**getBills() Modifications:**
```javascript
// في billingController.js
export const getBills = async (req, res) => {
  // إزالة معاملات التاريخ بالكامل - لا نستخدمها بعد الآن
  const { startDate, endDate, ...filters } = req.query;
  
  const query = { ...filters };
  
  // دعم الاستعلام بالطاولة
  if (filters.table) {
    query.table = new mongoose.Types.ObjectId(filters.table);
  } else if (filters.tableNumber) {
    // دعم القديم
    query.tableNumber = filters.tableNumber;
  }
  
  // لا نطبق أي فلترة بالتاريخ - تم إزالتها بالكامل
  
  // ... باقي الكود
}
```

**New Controller Functions:**
```javascript
// دفع أصناف محددة
export const payForItems = async (req, res) => {
  const { itemIds, paymentMethod } = req.body;
  const bill = await Bill.findById(req.params.id);
  
  const result = bill.payForItems(itemIds, paymentMethod, req.user._id);
  await bill.save();
  
  // تحديث حالة الطاولة إذا لزم الأمر
  await updateTableStatusIfNeeded(bill);
  
  // إرسال إشعار Socket.IO
  req.io.emit('payment-received', { bill });
  
  res.json({ success: true, data: bill });
}

// دفع جزئي لجلسة
export const paySessionPartial = async (req, res) => {
  const { sessionId, amount, paymentMethod } = req.body;
  const bill = await Bill.findById(req.params.id);
  
  const result = bill.paySessionPartial(sessionId, amount, paymentMethod, req.user._id);
  await bill.save();
  
  // تحديث حالة الطاولة إذا لزم الأمر
  await updateTableStatusIfNeeded(bill);
  
  // إرسال إشعار Socket.IO
  req.io.emit('payment-received', { bill });
  
  res.json({ success: true, data: bill });
}

// دالة مساعدة لتحديث حالة الطاولة
async function updateTableStatusIfNeeded(bill) {
  if (!bill.table) return;
  
  // البحث عن فواتير غير مدفوعة للطاولة
  const unpaidBills = await Bill.find({
    table: bill.table,
    status: { $in: ['draft', 'partial', 'overdue'] }
  });
  
  const newStatus = unpaidBills.length > 0 ? 'occupied' : 'empty';
  
  await Table.findByIdAndUpdate(bill.table, { status: newStatus });
  
  // إرسال إشعار Socket.IO
  req.io.emit('table-status-update', {
    tableId: bill.table,
    status: newStatus
  });
}
```

### Frontend Components

#### 1. Billing Page Modifications

**New State:**
```typescript
const [selectedTable, setSelectedTable] = useState<Table | null>(null);
const [showTableBillsModal, setShowTableBillsModal] = useState(false);
const [tableBillsFilter, setTableBillsFilter] = useState('unpaid');
const [showItemPaymentModal, setShowItemPaymentModal] = useState(false);
const [showSessionPaymentModal, setShowSessionPaymentModal] = useState(false);
const [selectedItems, setSelectedItems] = useState<string[]>([]);
const [selectedSession, setSelectedSession] = useState<Session | null>(null);
const [sessionPaymentAmount, setSessionPaymentAmount] = useState('');
```

**New Functions:**
```typescript
// فتح نافذة فواتير الطاولة
const handleTableClick = async (table: Table) => {
  setSelectedTable(table);
  // جلب جميع فواتير الطاولة بدون فلترة تاريخ
  const bills = await api.getBills({ table: table._id });
  setShowTableBillsModal(true);
}

// دفع أصناف محددة
const handlePayForItems = async () => {
  await api.payForItems(selectedBill._id, {
    itemIds: selectedItems,
    paymentMethod
  });
  
  // تحديث البيانات
  await fetchBills();
  await fetchTables();
  
  setShowItemPaymentModal(false);
}

// دفع جزئي لجلسة
const handlePaySessionPartial = async () => {
  await api.paySessionPartial(selectedBill._id, {
    sessionId: selectedSession._id,
    amount: parseFloat(sessionPaymentAmount),
    paymentMethod
  });
  
  // تحديث البيانات
  await fetchBills();
  
  setShowSessionPaymentModal(false);
}
```

#### 2. BillView Page Modifications

**New Functions:**
```typescript
// تجميع الأصناف المتشابهة مع معلومات الدفع
function aggregateItemsWithPayments(
  orders: Order[],
  itemPayments: Bill['itemPayments']
) {
  const map = new Map<string, AggregatedItem>();
  
  orders.forEach(order => {
    order.items.forEach(item => {
      // مفتاح فريد: اسم + سعر + إضافات
      const addonsKey = (item.addons || [])
        .map(a => `${a.name}:${a.price}`)
        .sort()
        .join('|');
      const key = `${item.name}|${item.price}|${addonsKey}`;
      
      if (!map.has(key)) {
        map.set(key, {
          name: item.name,
          price: item.price,
          addons: item.addons,
          totalQuantity: item.quantity,
          paidQuantity: 0,
          remainingQuantity: item.quantity
        });
      } else {
        const agg = map.get(key)!;
        agg.totalQuantity += item.quantity;
        agg.remainingQuantity += item.quantity;
      }
    });
  });
  
  // حساب الكميات المدفوعة
  if (itemPayments) {
    itemPayments.forEach(payment => {
      // البحث عن الصنف المطابق
      for (const [key, item] of map.entries()) {
        if (item.name === payment.itemName && item.price === payment.pricePerUnit) {
          if (payment.isPaid) {
            item.paidQuantity += payment.quantity;
            item.remainingQuantity -= payment.quantity;
          }
        }
      }
    });
  }
  
  return Array.from(map.values());
}

// عرض تفاصيل دفع الجلسة
function renderSessionPaymentDetails(session: Session, sessionPayment: SessionPayment) {
  return (
    <div className="session-payment-details">
      <div className="payment-row">
        <span>التكلفة الإجمالية:</span>
        <span>{formatCurrency(sessionPayment.sessionCost)}</span>
      </div>
      <div className="payment-row">
        <span>المدفوع:</span>
        <span className="text-green-600">{formatCurrency(sessionPayment.paidAmount)}</span>
      </div>
      <div className="payment-row">
        <span>المتبقي:</span>
        <span className="text-orange-600">{formatCurrency(sessionPayment.remainingAmount)}</span>
      </div>
      
      {sessionPayment.payments.length > 0 && (
        <div className="payment-history">
          <h4>سجل الدفعات:</h4>
          {sessionPayment.payments.map((payment, idx) => (
            <div key={idx} className="payment-entry">
              <span>{formatCurrency(payment.amount)}</span>
              <span>{formatDate(payment.paidAt)}</span>
              <span>{payment.method}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Data Models

### Bill Model Schema

```javascript
{
  // الحقول الموجودة...
  
  // حقول جديدة للدفع الجزئي المحسّن
  itemPayments: [{
    orderId: { type: ObjectId, ref: 'Order', required: true },
    itemId: { type: String, required: true },
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    pricePerUnit: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
    paidBy: { type: ObjectId, ref: 'User' }
  }],
  
  sessionPayments: [{
    sessionId: { type: ObjectId, ref: 'Session', required: true },
    sessionCost: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    remainingAmount: { type: Number, required: true, min: 0 },
    payments: [{
      amount: { type: Number, required: true, min: 0 },
      paidAt: { type: Date, default: Date.now },
      paidBy: { type: ObjectId, ref: 'User', required: true },
      method: { type: String, enum: ['cash', 'card', 'transfer'], required: true }
    }]
  }],
  
  paymentHistory: [{
    timestamp: { type: Date, default: Date.now },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['cash', 'card', 'transfer', 'mixed'], required: true },
    paidBy: { type: ObjectId, ref: 'User', required: true },
    type: { 
      type: String, 
      enum: ['full', 'partial-items', 'partial-session', 'mixed'], 
      required: true 
    },
    details: {
      paidItems: [{
        itemName: String,
        quantity: Number,
        amount: Number
      }],
      paidSessions: [{
        sessionId: ObjectId,
        amount: Number,
        remainingAfter: Number
      }]
    }
  }]
}
```

### Table Model Schema

```javascript
{
  number: { type: Number, required: true },
  name: { type: String },
  section: { type: ObjectId, ref: 'TableSection' },
  status: { 
    type: String, 
    enum: ['empty', 'occupied'], 
    default: 'empty' 
  },
  isActive: { type: Boolean, default: true },
  organization: { type: ObjectId, ref: 'Organization', required: true }
}
```

## Error Handling

### Backend Error Scenarios

1. **Invalid Item IDs:**
   - Error: بعض الأصناف المحددة غير موجودة في الفاتورة
   - Status: 400
   - Response: `{ success: false, message: "...", invalidItems: [...] }`

2. **Already Paid Items:**
   - Error: بعض الأصناف مدفوعة بالفعل
   - Status: 400
   - Response: `{ success: false, message: "...", alreadyPaidItems: [...] }`

3. **Session Payment Exceeds Remaining:**
   - Error: المبلغ أكبر من المبلغ المتبقي
   - Status: 400
   - Response: `{ success: false, message: "المبلغ (X) أكبر من المبلغ المتبقي (Y)" }`

4. **Bill Not Found:**
   - Error: الفاتورة غير موجودة
   - Status: 404
   - Response: `{ success: false, message: "الفاتورة غير موجودة" }`

5. **Paid Bill Modification:**
   - Error: لا يمكن تعديل فاتورة مدفوعة بالكامل
   - Status: 400
   - Response: `{ success: false, message: "..." }`

### Frontend Error Handling

```typescript
try {
  await api.payForItems(billId, { itemIds, paymentMethod });
  showNotification('تم الدفع بنجاح', 'success');
} catch (error) {
  if (error.response?.status === 400) {
    showNotification(error.response.data.message, 'error');
  } else {
    showNotification('حدث خطأ في عملية الدفع', 'error');
  }
}
```

## Testing Strategy

### Unit Tests

سيتم كتابة unit tests للتحقق من:

1. **Bill Model Methods:**
   - `payForItems()` - دفع أصناف محددة
   - `paySessionPartial()` - دفع جزئي لجلسة
   - `calculateRemainingAmount()` - حساب المبلغ المتبقي

2. **Controller Functions:**
   - `getBills()` - فلترة بالطاولة بدون تاريخ
   - `payForItems()` - دفع أصناف
   - `paySessionPartial()` - دفع جزئي لجلسة
   - `updateTableStatusIfNeeded()` - تحديث حالة الطاولة

3. **Frontend Functions:**
   - `aggregateItemsWithPayments()` - تجميع الأصناف
   - `handlePayForItems()` - معالجة دفع الأصناف
   - `handlePaySessionPartial()` - معالجة دفع الجلسة

### Property-Based Tests

سيتم استخدام **fast-check** للـ property-based testing في JavaScript/TypeScript.

**تكوين الاختبارات:**
- كل property test سيتم تشغيله 100 مرة على الأقل
- كل property test سيتم وسمه بتعليق يشير إلى رقم الخاصية في وثيقة التصميم

**مكتبة الاختبار:**
- Backend: Jest + fast-check
- Frontend: Vitest + fast-check



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Bills query ignores date filters completely

*For any* query parameters including date range, when querying bills, the results should include all bills regardless of their creation date.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Table status reflects unpaid bills

*For any* table, if there exists at least one bill with status 'draft', 'partial', or 'overdue' for that table, then the table status should be 'occupied'.

**Validates: Requirements 2.1**

### Property 3: Table status empty when all bills paid

*For any* table, if all bills for that table have status 'paid' or 'cancelled', then the table status should be 'empty'.

**Validates: Requirements 2.2**

### Property 4: Table status updates on bill creation

*For any* table, when a new bill is created for that table, the table status should be updated immediately to reflect the presence of an unpaid bill.

**Validates: Requirements 2.3**

### Property 5: Table status updates on bill payment

*For any* bill, when the bill is fully paid (status changes to 'paid'), the associated table status should be updated immediately based on remaining unpaid bills.

**Validates: Requirements 2.4**

### Property 6: Table status updates on bill deletion

*For any* bill, when the bill is deleted, the associated table status should be updated immediately based on remaining bills.

**Validates: Requirements 2.5**

### Property 7: Item aggregation combines same items

*For any* bill with multiple orders containing the same item (same name, price, and addons), the aggregation function should combine them into a single entry with the sum of quantities.

**Validates: Requirements 3.1, 6.1**

### Property 8: Item payment updates state correctly

*For any* item in a bill, when payment is made for that item, the item's isPaid flag should be true, paidAmount should equal totalPrice, and paidAt should be set.

**Validates: Requirements 3.2**

### Property 9: Item quantities calculated correctly

*For any* item in a bill, the remaining quantity should always equal total quantity minus paid quantity, and both should be non-negative.

**Validates: Requirements 3.3**

### Property 10: Bill status reflects all items paid

*For any* bill, when all items have isPaid = true and all sessions are fully paid, the bill status should be 'paid'.

**Validates: Requirements 3.4, 4.5**

### Property 11: Session partial payment calculates correctly

*For any* session payment, when a partial payment is made, the paidAmount should increase by the payment amount and remainingAmount should decrease by the same amount.

**Validates: Requirements 4.1**

### Property 12: Session payment rejects overpayment

*For any* session payment, when attempting to pay an amount greater than remainingAmount, the system should reject the payment with an error.

**Validates: Requirements 4.2**

### Property 13: Session payment recorded in history

*For any* session partial payment, the payment should be added to the session's payments array with correct amount, timestamp, and user information.

**Validates: Requirements 4.3**

### Property 14: Items with different prices are separate

*For any* two items with the same name but different prices, the aggregation function should treat them as separate items.

**Validates: Requirements 6.2**

### Property 15: Items with same addons are combined

*For any* two items with the same name, price, and addons (in any order), the aggregation function should combine them into a single entry.

**Validates: Requirements 6.3**

### Property 16: Payment distributed across orders

*For any* aggregated item that comes from multiple orders, when payment is made for that item, the payment should be distributed proportionally across all source orders.

**Validates: Requirements 6.4**

### Property 17: Aggregation consistency across views

*For any* bill, the aggregation function should produce the same results when called from different parts of the application (Billing page vs BillView page).

**Validates: Requirements 6.5**

### Property 18: Bill filter works correctly

*For any* set of bills for a table, when filtering by 'unpaid', only bills with status 'draft', 'partial', or 'overdue' should be included in the results.

**Validates: Requirements 7.2**

### Property 19: Cafe page shows only unpaid bill orders

*For any* table in Cafe page, when displaying orders, only orders linked to unpaid bills (or orders with no bill) should be shown.

**Validates: Requirements 9.1, 9.2, 9.3**

### Property 20: Cafe page hides paid bill orders

*For any* order linked to a bill with status 'paid', that order should not appear in the table's order list in Cafe page.

**Validates: Requirements 9.2, 9.4**

