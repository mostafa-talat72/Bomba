# Design Document

## Overview

هذا التصميم يحسّن تجربة ربط جلسات البلايستيشن بالطاولات من خلال ثلاثة تحسينات رئيسية:

1. **منطق طلب اسم العميل الذكي**: طلب اسم العميل فقط عند إنهاء جلسة غير مرتبطة بطاولة
2. **إمكانية فك الربط**: إضافة خيار لفك ربط جلسة نشطة من طاولة
3. **دمج الفواتير الذكي**: دمج الفواتير تلقائياً عند ربط جلسة نشطة بطاولة لها فاتورة موجودة

هذه التحسينات تقلل من الخطوات غير الضرورية، تمنع تكرار الفواتير، وتحسن تجربة المستخدم بشكل عام.

## Architecture

### Current System Analysis

**الوضع الحالي:**
- عند بدء جلسة، يتم إنشاء فاتورة جديدة تلقائياً
- عند إنهاء جلسة، يُطلب اسم العميل دائماً بغض النظر عن حالة الربط بالطاولة
- يمكن ربط جلسة بطاولة من خلال تحديث الفاتورة المرتبطة بها
- لا يوجد خيار لفك ربط جلسة من طاولة
- عند ربط جلسة بطاولة، قد تنتهي بفاتورتين منفصلتين (فاتورة الجلسة + فاتورة الطاولة)

**المشاكل:**
1. طلب اسم العميل غير ضروري عندما تكون الجلسة مرتبطة بطاولة
2. عدم القدرة على تصحيح الأخطاء بفك ربط جلسة من طاولة
3. تكرار الفواتير عند ربط جلسة بطاولة لها فاتورة موجودة

### Proposed Architecture

**التحسينات المقترحة:**

1. **منطق طلب اسم العميل الشرطي**:
   - فحص حالة ربط الجلسة بطاولة قبل إنهائها
   - إذا كانت مرتبطة بطاولة → إنهاء مباشر بدون طلب اسم
   - إذا لم تكن مرتبطة → طلب اسم العميل كحقل إلزامي

2. **آلية فك الربط**:
   - إضافة endpoint جديد في API لفك ربط جلسة من طاولة
   - إضافة زر "فك الربط" في واجهة المستخدم للجلسات المرتبطة
   - معالجة الفاتورة بذكاء (إنشاء فاتورة جديدة أو تحديث الموجودة)

3. **دمج الفواتير الذكي**:
   - عند ربط جلسة نشطة بطاولة، فحص وجود فاتورة غير مدفوعة على الطاولة
   - إذا وجدت فاتورة → دمج الجلسة مع الفاتورة الموجودة وحذف الفاتورة القديمة
   - إذا لم توجد فاتورة → نقل فاتورة الجلسة إلى الطاولة

## Components and Interfaces

### Frontend Components (PlayStation.tsx)

#### 1. Session End Modal Logic
```typescript
interface SessionEndModalProps {
  session: Session;
  isLinkedToTable: boolean;
  onEnd: (sessionId: string, customerName?: string) => Promise<void>;
}

// منطق العرض الشرطي
const shouldShowCustomerNameInput = (session: Session): boolean => {
  const bill = typeof session.bill === 'object' ? session.bill : null;
  const isLinkedToTable = bill ? !!(bill as any)?.table : false;
  return !isLinkedToTable;
}
```

#### 2. Unlink Table Button
```typescript
interface UnlinkTableButtonProps {
  session: Session;
  onUnlink: (session: Session) => void;
  disabled?: boolean;
}

// عرض الزر فقط للجلسات المرتبطة بطاولة
const shouldShowUnlinkButton = (session: Session): boolean => {
  const bill = typeof session.bill === 'object' ? session.bill : null;
  const isLinkedToTable = bill ? !!(bill as any)?.table : false;
  return isLinkedToTable && session.status === 'active';
}
```

#### 3. Link Table Modal Enhancement
```typescript
interface LinkTableModalProps {
  session: Session;
  tables: Table[];
  onLink: (sessionId: string, tableId: string) => Promise<void>;
}

// منطق الربط مع دمج الفواتير
const handleLinkWithMerge = async (sessionId: string, tableId: string) => {
  // سيتم التعامل مع الدمج في الـ backend
  await api.linkSessionToTable(sessionId, tableId);
}
```

### Backend Controllers

#### 1. Session Controller - End Session Enhancement
```javascript
// server/controllers/sessionController.js

endSession: async (req, res) => {
  const { id } = req.params;
  const { customerName } = req.body;
  
  const session = await Session.findById(id).populate('bill');
  
  // فحص حالة الربط بالطاولة
  const bill = session.bill;
  const isLinkedToTable = bill && bill.table;
  
  // إذا لم تكن مرتبطة بطاولة ولم يتم توفير اسم العميل
  if (!isLinkedToTable && (!customerName || customerName.trim() === '')) {
    return res.status(400).json({
      success: false,
      message: 'اسم العميل مطلوب للجلسات غير المرتبطة بطاولة',
      error: 'Customer name required'
    });
  }
  
  // تحديث اسم العميل إذا تم توفيره
  if (customerName && customerName.trim() !== '') {
    session.customerName = customerName.trim();
  }
  
  // إنهاء الجلسة
  await session.endSession();
  // ... باقي المنطق
}
```

#### 2. Session Controller - Link to Table with Merge
```javascript
// server/controllers/sessionController.js

linkSessionToTable: async (req, res) => {
  const { sessionId } = req.params;
  const { tableId } = req.body;
  
  const session = await Session.findById(sessionId).populate('bill');
  const sessionBill = await Bill.findById(session.bill);
  
  // البحث عن فاتورة موجودة على الطاولة
  const existingTableBill = await Bill.findOne({
    table: tableId,
    organization: req.user.organization,
    status: { $in: ['draft', 'partial', 'overdue'] }
  }).sort({ createdAt: -1 });
  
  if (existingTableBill) {
    // دمج الفواتير
    await mergeBills(sessionBill, existingTableBill, session);
  } else {
    // نقل الفاتورة إلى الطاولة
    sessionBill.table = tableId;
    await sessionBill.save();
  }
  
  // ... باقي المنطق
}

// دالة مساعدة لدمج الفواتير
async function mergeBills(sourceBill, targetBill, session) {
  // نقل الجلسة إلى الفاتورة المستهدفة
  if (!targetBill.sessions.includes(session._id)) {
    targetBill.sessions.push(session._id);
  }
  
  // نقل المدفوعات
  if (sourceBill.payments && sourceBill.payments.length > 0) {
    targetBill.payments.push(...sourceBill.payments);
  }
  
  // جمع المبالغ المدفوعة
  targetBill.paid += sourceBill.paid || 0;
  
  // إعادة حساب الإجمالي
  await targetBill.calculateSubtotal();
  await targetBill.save();
  
  // تحديث مرجع الفاتورة في الجلسة
  session.bill = targetBill._id;
  await session.save();
  
  // حذف الفاتورة القديمة
  await Bill.findByIdAndDelete(sourceBill._id);
  
  Logger.info(`✓ Merged bills: ${sourceBill.billNumber} → ${targetBill.billNumber}`);
}
```

#### 3. Session Controller - Unlink from Table (Already Exists)
```javascript
// موجود بالفعل في الكود الحالي
// server/controllers/sessionController.js

unlinkTableFromSession: async (req, res) => {
  // المنطق الحالي جيد ويعمل بشكل صحيح
  // يحتاج فقط إلى تحديث بسيط في الواجهة الأمامية
}
```

## Data Models

### Session Model
```javascript
// server/models/Session.js
// لا يحتاج إلى تعديل - البنية الحالية كافية

{
  deviceNumber: Number,
  deviceName: String,
  deviceType: String,
  deviceId: ObjectId,
  customerName: String,  // يتم تحديثه بناءً على حالة الربط
  controllers: Number,
  bill: ObjectId,  // مرجع للفاتورة
  status: String,  // 'active' | 'ended'
  // ... باقي الحقول
}
```

### Bill Model
```javascript
// server/models/Bill.js
// لا يحتاج إلى تعديل - البنية الحالية كافية

{
  billNumber: String,
  customerName: String,
  table: ObjectId,  // مرجع للطاولة (اختياري)
  sessions: [ObjectId],  // قائمة الجلسات
  orders: [ObjectId],  // قائمة الطلبات
  payments: [Payment],  // قائمة المدفوعات
  paid: Number,
  remaining: Number,
  status: String,  // 'draft' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  // ... باقي الحقول
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

بعد مراجعة جميع الخصائص المحددة في التحليل الأولي، تم تحديد بعض الخصائص المتكررة أو التي يمكن دمجها:

**Redundancies Identified:**
1. Properties 1.1 و 1.2 يمكن دمجها في خاصية واحدة تختبر المنطق الشرطي لطلب اسم العميل
2. Properties 3.1 و 3.2 مرتبطتان - دمج الفواتير يتضمن بالضرورة حذف الفاتورة القديمة
3. Properties 5.1 و 5.2 يمكن دمجها في خاصية واحدة تختبر عرض حالة الربط
4. Properties 7.4 و 7.5 هي invariants عامة يمكن اختبارها معاً

**Consolidated Properties:**
- دمج 1.1 و 1.2 → Property 1: Customer name requirement based on table linking
- دمج 3.1 و 3.2 → Property 6: Bill merging with cleanup
- دمج 5.1 و 5.2 → Property 11: Display of linking status
- دمج 7.4 و 7.5 → Property 18: System invariants

### Correctness Properties

Property 1: Customer name requirement based on table linking
*For any* session being ended, if the session is not linked to a table, then customer name must be provided and the system should reject ending without it; if the session is linked to a table, then customer name is optional and the system should allow ending without it
**Validates: Requirements 1.1, 1.2, 1.3**

Property 2: Customer name persistence
*For any* session that is ended with a customer name provided, both the session and its associated bill should have the customer name saved correctly
**Validates: Requirements 1.4**

Property 3: Table-linked session bill handling
*For any* session linked to a table that is ended, the bill should be saved without requiring a specific customer name or should use the table reference
**Validates: Requirements 1.5**

Property 4: Unlink button visibility
*For any* active session that is linked to a table, the system should display an unlink option in the user interface
**Validates: Requirements 2.1**

Property 5: Unlink operation success
*For any* session linked to a table, when unlink is confirmed, the session's bill should no longer have a table reference and the change should be persisted to the database
**Validates: Requirements 2.3, 2.5**

Property 6: Bill merging with cleanup
*For any* active session being linked to a table that has an unpaid bill, the session should be added to the existing table bill, and the old session bill should be deleted from the database
**Validates: Requirements 3.1, 3.2**

Property 7: Bill transfer to table
*For any* active session being linked to a table without an unpaid bill, the session's bill should be transferred to the specified table with the table reference updated
**Validates: Requirements 3.3, 3.4**

Property 8: Bill merging completeness
*For any* two bills being merged, all sessions, orders, and items from both bills should be present in the final merged bill
**Validates: Requirements 3.5**

Property 9: Payment aggregation during merge
*For any* two bills being merged, the total paid amount in the final bill should equal the sum of paid amounts from both source bills
**Validates: Requirements 4.1**

Property 10: Payment records preservation
*For any* two bills being merged, all payment records from both bills should be preserved in the final bill's payment history
**Validates: Requirements 4.2**

Property 11: Merge operation atomicity
*For any* bill merge operation, if the merge fails, both original bills should remain unchanged in the database
**Validates: Requirements 4.3**

Property 12: Merge-then-delete ordering
*For any* bill merge operation, the old bill should only be deleted after the merge operation has successfully completed
**Validates: Requirements 4.4**

Property 13: Merge operation logging
*For any* bill merge operation, the system should create a log entry recording the merge for audit purposes
**Validates: Requirements 4.5**

Property 14: Linking status display
*For any* active session displayed in the PlayStation page, the user interface should clearly show whether the session is linked to a table and display the table number if linked
**Validates: Requirements 5.1, 5.2**

Property 15: Invalid table rejection
*For any* attempt to link a session to a non-existent table, the system should reject the operation and display an error message
**Validates: Requirements 6.1**

Property 16: Unlink non-linked session handling
*For any* attempt to unlink a session that is not linked to a table, the system should display an appropriate message indicating the session is not linked
**Validates: Requirements 6.2**

Property 17: Ended session linking
*For any* ended session being linked to a table, the system should update only the bill's table reference without modifying the session itself
**Validates: Requirements 6.4**

Property 18: Input validation
*For any* link, unlink, or merge operation, the system should validate all inputs before executing the operation
**Validates: Requirements 6.5**

Property 19: System invariants
*For any* point in time, every active session should be linked to exactly one bill, and every unpaid bill should be linked to at most one table
**Validates: Requirements 7.4, 7.5**

Property 20: Table state consistency on link
*For any* session being linked to a table, the table's state should be updated to reflect the presence of an active session
**Validates: Requirements 7.1**

Property 21: Table state consistency on unlink
*For any* session being unlinked from a table, the table's state should be updated based on whether other bills or sessions remain on that table
**Validates: Requirements 7.2**

Property 22: Reference consistency after merge
*For any* bill merge operation, all references in the database (from sessions, orders, etc.) should point to the final merged bill
**Validates: Requirements 7.3**

## Error Handling

### Frontend Error Handling

1. **Network Errors**:
   - عرض رسائل خطأ واضحة عند فشل الاتصال بالخادم
   - إعادة المحاولة التلقائية للعمليات الحرجة
   - الاحتفاظ بالحالة السابقة عند فشل العملية

2. **Validation Errors**:
   - التحقق من صحة المدخلات قبل إرسالها إلى الخادم
   - عرض رسائل خطأ واضحة للمستخدم
   - تعطيل الأزرار أثناء معالجة الطلبات

3. **State Management**:
   - استخدام loading states لتحسين تجربة المستخدم
   - تحديث الواجهة فوراً بعد نجاح العمليات
   - التعامل مع الحالات الاستثنائية بشكل صحيح

### Backend Error Handling

1. **Database Errors**:
   - استخدام transactions للعمليات الحرجة (دمج الفواتير)
   - Rollback عند فشل أي جزء من العملية
   - تسجيل الأخطاء في السجلات للتدقيق

2. **Validation Errors**:
   - التحقق من صحة جميع المدخلات
   - إرجاع رسائل خطأ واضحة ومفيدة
   - استخدام HTTP status codes المناسبة

3. **Business Logic Errors**:
   - التحقق من حالة الجلسة قبل تنفيذ العمليات
   - التحقق من وجود الفواتير والطاولات
   - منع العمليات غير الصالحة

### Error Recovery Strategies

1. **Merge Operation Failure**:
```javascript
try {
  // Start transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  
  // Perform merge operations
  await mergeBills(sourceBill, targetBill, session);
  
  // Commit transaction
  await session.commitTransaction();
} catch (error) {
  // Rollback transaction
  await session.abortTransaction();
  
  // Log error
  Logger.error('Bill merge failed:', error);
  
  // Return error to client
  return res.status(500).json({
    success: false,
    message: 'فشل دمج الفواتير',
    error: error.message
  });
} finally {
  session.endSession();
}
```

2. **Unlink Operation Failure**:
```javascript
try {
  // Validate session and bill exist
  if (!session || !bill) {
    throw new Error('Session or bill not found');
  }
  
  // Perform unlink
  await unlinkSessionFromTable(session, bill);
  
} catch (error) {
  // Keep original state
  Logger.error('Unlink failed:', error);
  
  // Return error
  return res.status(500).json({
    success: false,
    message: 'فشل فك الربط',
    error: error.message
  });
}
```

## Testing Strategy

### Unit Testing

**Frontend Unit Tests:**
1. Test conditional rendering of customer name input based on table linking status
2. Test unlink button visibility for linked sessions
3. Test link table modal functionality
4. Test error message display for various error scenarios

**Backend Unit Tests:**
1. Test `endSession` with and without customer name based on table linking
2. Test `linkSessionToTable` with existing and non-existing table bills
3. Test `unlinkTableFromSession` for various scenarios
4. Test `mergeBills` helper function for data integrity

### Property-Based Testing

**Testing Framework:** fast-check (for JavaScript/TypeScript)

**Property Test Configuration:**
- Minimum 100 iterations per property test
- Use custom generators for Session, Bill, and Table objects
- Test with various edge cases (empty bills, multiple sessions, etc.)

**Key Property Tests:**

1. **Property 1: Customer name requirement**
```typescript
// Feature: playstation-table-linking-enhancements, Property 1
fc.assert(
  fc.property(
    sessionGenerator(),
    async (session) => {
      const isLinkedToTable = session.bill?.table != null;
      
      if (!isLinkedToTable) {
        // Should require customer name
        const result = await endSession(session.id, undefined);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Customer name required');
      } else {
        // Should not require customer name
        const result = await endSession(session.id, undefined);
        expect(result.success).toBe(true);
      }
    }
  ),
  { numRuns: 100 }
);
```

2. **Property 6: Bill merging with cleanup**
```typescript
// Feature: playstation-table-linking-enhancements, Property 6
fc.assert(
  fc.property(
    sessionWithBillGenerator(),
    tableWithBillGenerator(),
    async (session, table) => {
      const sessionBillId = session.bill._id;
      const tableBillId = table.bill._id;
      
      // Link session to table
      await linkSessionToTable(session.id, table._id);
      
      // Session should be in table bill
      const tableBill = await Bill.findById(tableBillId);
      expect(tableBill.sessions).toContain(session._id);
      
      // Old session bill should be deleted
      const oldBill = await Bill.findById(sessionBillId);
      expect(oldBill).toBeNull();
    }
  ),
  { numRuns: 100 }
);
```

3. **Property 9: Payment aggregation**
```typescript
// Feature: playstation-table-linking-enhancements, Property 9
fc.assert(
  fc.property(
    billWithPaymentsGenerator(),
    billWithPaymentsGenerator(),
    async (bill1, bill2) => {
      const totalPaidBefore = bill1.paid + bill2.paid;
      
      // Merge bills
      const mergedBill = await mergeBills(bill1, bill2);
      
      // Total paid should be sum of both
      expect(mergedBill.paid).toBe(totalPaidBefore);
    }
  ),
  { numRuns: 100 }
);
```

4. **Property 19: System invariants**
```typescript
// Feature: playstation-table-linking-enhancements, Property 19
fc.assert(
  fc.property(
    systemStateGenerator(),
    async (systemState) => {
      // Every active session should have exactly one bill
      for (const session of systemState.activeSessions) {
        expect(session.bill).toBeDefined();
        const billCount = await Bill.countDocuments({ sessions: session._id });
        expect(billCount).toBe(1);
      }
      
      // Every unpaid bill should have at most one table
      for (const bill of systemState.unpaidBills) {
        if (bill.table) {
          expect(bill.table).toBeDefined();
          // Should not have multiple table references
          expect(Array.isArray(bill.table)).toBe(false);
        }
      }
    }
  ),
  { numRuns: 100 }
);
```

### Integration Testing

1. **End-to-End Session Lifecycle**:
   - Create session → Link to table → End session → Verify bill
   - Create session → End without table → Verify customer name required
   - Create session → Link to table → Unlink → End → Verify customer name required

2. **Bill Merging Scenarios**:
   - Session with bill + Table with bill → Merge → Verify single bill
   - Session with payments + Table with payments → Merge → Verify all payments
   - Multiple sessions on same table → Verify all in same bill

3. **Error Scenarios**:
   - Link to non-existent table → Verify error
   - Unlink non-linked session → Verify error
   - Merge with database failure → Verify rollback

### Test Data Generators

```typescript
// Custom generators for property-based testing

const sessionGenerator = () => fc.record({
  _id: fc.string(),
  deviceNumber: fc.integer({ min: 1, max: 10 }),
  deviceName: fc.string(),
  deviceType: fc.constant('playstation'),
  status: fc.constantFrom('active', 'ended'),
  bill: fc.option(billGenerator(), { nil: null }),
  customerName: fc.option(fc.string(), { nil: undefined })
});

const billGenerator = () => fc.record({
  _id: fc.string(),
  billNumber: fc.string(),
  table: fc.option(fc.string(), { nil: null }),
  sessions: fc.array(fc.string()),
  orders: fc.array(fc.string()),
  paid: fc.float({ min: 0, max: 1000 }),
  remaining: fc.float({ min: 0, max: 1000 }),
  status: fc.constantFrom('draft', 'partial', 'paid', 'overdue'),
  payments: fc.array(paymentGenerator())
});

const tableGenerator = () => fc.record({
  _id: fc.string(),
  number: fc.integer({ min: 1, max: 50 }),
  status: fc.constantFrom('available', 'occupied', 'reserved')
});

const paymentGenerator = () => fc.record({
  amount: fc.float({ min: 0, max: 500 }),
  method: fc.constantFrom('cash', 'card', 'transfer'),
  timestamp: fc.date(),
  reference: fc.option(fc.string(), { nil: undefined })
});

const sessionWithBillGenerator = () => fc.record({
  session: sessionGenerator(),
  bill: billGenerator()
}).map(({ session, bill }) => ({
  ...session,
  bill: bill._id,
  _bill: bill
}));

const tableWithBillGenerator = () => fc.record({
  table: tableGenerator(),
  bill: billGenerator()
}).map(({ table, bill }) => ({
  ...table,
  bill: bill._id,
  _bill: { ...bill, table: table._id }
}));
```

## Implementation Notes

### Critical Considerations

1. **Transaction Safety**:
   - استخدام MongoDB transactions لعمليات دمج الفواتير
   - ضمان atomicity للعمليات الحرجة
   - Rollback عند فشل أي جزء من العملية

2. **Performance**:
   - تحسين استعلامات قاعدة البيانات
   - استخدام indexes المناسبة
   - تقليل عدد الاستعلامات المتعددة

3. **Data Integrity**:
   - التحقق من صحة جميع المراجع قبل الحذف
   - ضمان عدم وجود orphaned records
   - الحفاظ على consistency بين الجلسات والفواتير

4. **User Experience**:
   - عرض loading states أثناء العمليات
   - رسائل خطأ واضحة ومفيدة
   - تحديث الواجهة فوراً بعد نجاح العمليات

### Migration Strategy

لا يوجد حاجة لـ migration للبيانات الموجودة، حيث أن التحسينات تتعلق بالمنطق فقط وليس ببنية البيانات.

### Rollback Plan

في حالة وجود مشاكل بعد النشر:
1. إعادة نشر النسخة السابقة من الكود
2. لا حاجة لـ rollback للبيانات (لم تتغير البنية)
3. مراجعة السجلات لتحديد المشاكل

