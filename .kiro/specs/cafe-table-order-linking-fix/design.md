# Design Document

## Overview

This design addresses critical issues in the Cafe management system where orders linked to tables incorrectly appear in the "unlinked bills" section, and performance issues exist with order creation and updates. The solution ensures proper table-order-bill linking using MongoDB ObjectIds consistently across the stack, implements real-time Socket.IO updates for immediate UI feedback, and optimizes database queries for faster response times.

## Architecture

### System Components

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
│                 │
│  - Cafe.tsx     │
│  - Billing.tsx  │
│  - AppContext   │
└────────┬────────┘
         │
         │ HTTP + Socket.IO
         │
┌────────▼────────┐
│   Backend       │
│   (Express)     │
│                 │
│  - Controllers  │
│  - Models       │
│  - Socket       │
└────────┬────────┘
         │
         │ Mongoose
         │
┌────────▼────────┐
│   MongoDB       │
│                 │
│  - Tables       │
│  - Orders       │
│  - Bills        │
└─────────────────┘
```

### Data Flow

1. **Order Creation Flow**:
   - User selects table (by ObjectId)
   - Frontend sends order with `table: ObjectId`
   - Backend creates order with table reference
   - Backend finds/creates bill with same table reference
   - Backend emits Socket.IO event
   - Frontend updates UI immediately

2. **Bill Categorization Flow**:
   - Backend populates `table` field in bills
   - Frontend checks `bill.table` existence
   - If `bill.table` exists → "Table Bills"
   - If `bill.table` is null/undefined → "Unlinked Bills"

3. **Table Status Update Flow**:
   - Order created/bill paid/bill deleted
   - Backend updates table status
   - Backend emits Socket.IO event
   - Frontend updates table color/status immediately

## Components and Interfaces

### Backend Models

#### Table Model
```javascript
{
  _id: ObjectId,
  number: Number,
  section: ObjectId (ref: 'TableSection'),
  isActive: Boolean,
  status: String // 'empty' | 'occupied' | 'reserved'
}
```

#### Order Model
```javascript
{
  _id: ObjectId,
  table: ObjectId (ref: 'Table'), // MUST be ObjectId, not number
  bill: ObjectId (ref: 'Bill'),
  items: [{
    menuItem: ObjectId,
    name: String,
    price: Number,
    quantity: Number
  }],
  status: String,
  organization: ObjectId
}
```

#### Bill Model
```javascript
{
  _id: ObjectId,
  table: ObjectId (ref: 'Table'), // MUST be ObjectId, not number
  orders: [ObjectId] (ref: 'Order'),
  sessions: [ObjectId] (ref: 'Session'),
  status: String, // 'draft' | 'partial' | 'paid' | 'cancelled'
  total: Number,
  paid: Number,
  remaining: Number,
  organization: ObjectId
}
```

### Backend Controllers

#### orderController.js

**createOrder()**
- Accept `table` as ObjectId from request
- Validate table exists using ObjectId
- Find existing unpaid bill for table using `Bill.findOne({ table: tableObjectId })`
- If no bill exists, create new bill with `table: tableObjectId`
- Link order to bill
- Emit Socket.IO event: `order-created`
- Return populated order with table data

**updateOrder()**
- Update order items
- Recalculate bill totals
- Emit Socket.IO event: `order-updated`
- Return updated order

**deleteOrder()**
- Remove order from bill
- If bill has no more orders/sessions, delete bill
- Update table status to 'empty'
- Emit Socket.IO event: `order-deleted`

#### billingController.js

**getBills()**
- Query bills with `.populate('table', 'number name')`
- Return bills with populated table data
- Frontend will categorize based on `bill.table` presence

**addPayment()**
- Process payment
- If `bill.remaining === 0`, set `bill.status = 'paid'`
- If bill is paid, update table status to 'empty'
- Emit Socket.IO event: `payment-received`

**deleteBill()**
- Delete all associated orders
- Update table status to 'empty'
- Emit Socket.IO event: `bill-deleted`

### Frontend Components

#### Cafe.tsx

**State Management**
```typescript
const [selectedTable, setSelectedTable] = useState<Table | null>(null);
const [tableStatuses, setTableStatuses] = useState<Record<string, {
  hasUnpaid: boolean;
  orders: Order[];
}>>({});
```

**Table Status Logic**
```typescript
// Check if table has unpaid bills
const isOccupied = (table: Table) => {
  const bills = getBillsForTable(table._id);
  return bills.some(bill => 
    bill.status === 'draft' || 
    bill.status === 'partial' || 
    bill.status === 'overdue'
  );
};
```

**Order Creation**
```typescript
const handleSaveOrder = async () => {
  const orderData = {
    table: selectedTable._id, // Use ObjectId, not number
    items: currentOrderItems,
    notes: orderNotes
  };
  
  const order = await createOrder(orderData);
  
  // Optimistic UI update
  setTableStatuses(prev => ({
    ...prev,
    [selectedTable._id]: {
      hasUnpaid: true,
      orders: [...prev[selectedTable._id]?.orders || [], order]
    }
  }));
  
  // Print immediately
  printOrderBySections(order, ...);
  
  // Refresh in background
  fetchAllTableStatuses();
};
```

#### Billing.tsx

**Bill Categorization**
```typescript
// Categorize bills by table linkage
const tableBills = bills.filter(bill => bill.table && bill.table._id);
const unlinkedBills = bills.filter(bill => !bill.table);

// Group table bills by table number
const billsByTable = tableBills.reduce((acc, bill) => {
  const tableNumber = bill.table.number;
  if (!acc[tableNumber]) acc[tableNumber] = [];
  acc[tableNumber].push(bill);
  return acc;
}, {});
```

**Display Logic**
```tsx
{/* Table Bills Section */}
<div>
  <h2>فواتير الطاولات</h2>
  {Object.entries(billsByTable).map(([tableNumber, bills]) => (
    <div key={tableNumber}>
      <h3>طاولة {tableNumber}</h3>
      {bills.map(bill => <BillItem bill={bill} />)}
    </div>
  ))}
</div>

{/* Unlinked Bills Section */}
<div>
  <h2>فواتير غير مرتبطة بطاولة</h2>
  {unlinkedBills.map(bill => <BillItem bill={bill} />)}
</div>
```

### Socket.IO Events

#### Backend Emissions
```javascript
// Order events
io.emit('order-update', { type: 'created', order });
io.emit('order-update', { type: 'updated', order });
io.emit('order-update', { type: 'deleted', orderId });

// Bill events
io.emit('bill-update', { type: 'created', bill });
io.emit('bill-update', { type: 'payment-received', bill });
io.emit('bill-update', { type: 'deleted', billId });

// Table events
io.emit('table-status-update', { tableId, status });
```

#### Frontend Listeners
```typescript
useEffect(() => {
  socket.on('order-update', (data) => {
    if (data.type === 'created') {
      // Add order to list
      // Update table status
    }
  });
  
  socket.on('bill-update', (data) => {
    if (data.type === 'payment-received') {
      // Update bill in list
      // If paid, update table status
    }
  });
  
  socket.on('table-status-update', (data) => {
    // Update table color/status immediately
    setTableStatuses(prev => ({
      ...prev,
      [data.tableId]: { ...prev[data.tableId], status: data.status }
    }));
  });
}, []);
```

## Data Models

### Table Reference Consistency

**Problem**: Mixed use of `tableNumber` (Number) and `table` (ObjectId)

**Solution**: Use `table` (ObjectId) consistently

```javascript
// ❌ WRONG - Using table number
const order = {
  tableNumber: 5,
  items: [...]
};

// ✅ CORRECT - Using table ObjectId
const order = {
  table: "507f1f77bcf86cd799439011", // ObjectId
  items: [...]
};
```

### Bill-Table Linking

**Database Schema**:
```javascript
// Bill document
{
  _id: ObjectId("..."),
  table: ObjectId("507f1f77bcf86cd799439011"), // Reference to Table
  orders: [ObjectId("..."), ObjectId("...")],
  sessions: [ObjectId("...")],
  status: "draft",
  total: 150,
  paid: 0,
  remaining: 150
}
```

**Populated Response**:
```javascript
{
  _id: "...",
  table: {
    _id: "507f1f77bcf86cd799439011",
    number: 5,
    section: {...}
  },
  orders: [...],
  status: "draft",
  total: 150
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Table Reference Storage Integrity
*For any* order created with a table reference, the system SHALL store the table field as a valid MongoDB ObjectId, not as a number or string.
**Validates: Requirements 1.1, 6.1**

### Property 2: Bill Categorization by Table Linkage
*For any* bill, if it has a populated table field, it SHALL appear in the "table bills" section; otherwise it SHALL appear in the "unlinked bills" section.
**Validates: Requirements 1.2, 1.3, 1.5**

### Property 3: Table Number Display
*For any* bill with a table reference, the displayed bill information SHALL include the table number extracted from the populated table object.
**Validates: Requirements 1.4, 6.5**

### Property 4: Table Status Transitions on Order Creation
*For any* table, when an order is created for that table, the table status SHALL immediately change to "occupied".
**Validates: Requirements 2.1**

### Property 5: Table Status Transitions on Bill Payment
*For any* bill linked to a table, when the bill is fully paid (remaining = 0), the associated table status SHALL immediately change to "empty".
**Validates: Requirements 2.2**

### Property 6: Table Status Transitions on Bill Deletion
*For any* bill linked to a table, when the bill is deleted, the associated table status SHALL immediately change to "empty".
**Validates: Requirements 2.3, 5.2**

### Property 7: Real-time Event Emission
*For any* state change (order creation, order update, bill payment, bill deletion, table status change), the system SHALL emit a corresponding Socket.IO event to all connected clients.
**Validates: Requirements 2.4, 3.2, 5.3**

### Property 8: UI Responsiveness to Status Events
*For any* table status update event received by the frontend, the table display SHALL update its color and status text within 100 milliseconds.
**Validates: Requirements 2.5, 5.5**

### Property 9: Order Persistence Performance
*For any* order save operation, the system SHALL persist the order to the database within 500 milliseconds.
**Validates: Requirements 3.1, 4.1**

### Property 10: UI Update Performance
*For any* order creation event received by the frontend, the order SHALL appear in the display within 100 milliseconds.
**Validates: Requirements 3.3**

### Property 11: Update Propagation Performance
*For any* order update, the changes SHALL propagate to all connected clients within 500 milliseconds.
**Validates: Requirements 3.4**

### Property 12: Concurrent Order Handling
*For any* set of orders created simultaneously, the system SHALL process all orders without blocking or introducing delays beyond the normal processing time.
**Validates: Requirements 3.5**

### Property 13: Print Dialog Timing
*For any* completed save operation, the print dialog SHALL appear within 100 milliseconds of save completion.
**Validates: Requirements 4.2**

### Property 14: Non-blocking Print Operation
*For any* print operation triggered, the UI SHALL remain responsive and continue processing updates without blocking.
**Validates: Requirements 4.3**

### Property 15: Operation Ordering for Print
*For any* order that is saved and printed, the table status update SHALL complete before the print dialog is displayed.
**Validates: Requirements 4.4**

### Property 16: Cascading Order Deletion
*For any* bill that is deleted, all orders associated with that bill SHALL be deleted from the database.
**Validates: Requirements 5.1**

### Property 17: Inventory Restoration on Order Deletion
*For any* order that is deleted, the inventory quantities for all items in that order SHALL be restored by the amounts that were previously deducted.
**Validates: Requirements 5.4**

### Property 18: ObjectId Validation on Backend
*For any* table reference received by the backend, the system SHALL validate it as a valid MongoDB ObjectId and reject invalid formats.
**Validates: Requirements 6.2**

### Property 19: ObjectId Query Consistency
*For any* query filtering bills by table, the system SHALL use ObjectId comparison (not string or number comparison) to ensure correct results.
**Validates: Requirements 6.3**

### Property 20: Table Data Population
*For any* bill query that includes table data, the system SHALL use Mongoose populate to retrieve the complete table document with all fields.
**Validates: Requirements 6.4**



## Error Handling

### Backend Error Handling

#### Invalid Table Reference
```javascript
// Validate table ObjectId
if (!mongoose.Types.ObjectId.isValid(tableId)) {
  return res.status(400).json({
    success: false,
    message: 'معرف الطاولة غير صحيح'
  });
}

// Verify table exists
const table = await Table.findById(tableId);
if (!table) {
  return res.status(404).json({
    success: false,
    message: 'الطاولة غير موجودة'
  });
}
```

#### Bill Not Found
```javascript
const bill = await Bill.findById(billId);
if (!bill) {
  return res.status(404).json({
    success: false,
    message: 'الفاتورة غير موجودة'
  });
}
```

#### Order Creation Failure
```javascript
try {
  const order = await Order.create(orderData);
  // ... success handling
} catch (error) {
  Logger.error('خطأ في إنشاء الطلب', error);
  return res.status(500).json({
    success: false,
    message: 'خطأ في إنشاء الطلب',
    error: error.message
  });
}
```

#### Socket.IO Connection Errors
```javascript
// Graceful degradation if Socket.IO fails
try {
  io.emit('order-update', { type: 'created', order });
} catch (socketError) {
  Logger.error('فشل إرسال حدث Socket.IO', socketError);
  // Continue execution - don't fail the request
}
```

### Frontend Error Handling

#### Network Errors
```typescript
try {
  const order = await createOrder(orderData);
  // ... success handling
} catch (error) {
  showNotification('خطأ في إضافة الطلب', 'error');
  // Revert optimistic UI updates
  setTableStatuses(previousState);
}
```

#### Socket.IO Disconnection
```typescript
useEffect(() => {
  socket.on('disconnect', () => {
    showNotification('انقطع الاتصال - جاري إعادة الاتصال...', 'warning');
  });
  
  socket.on('reconnect', () => {
    showNotification('تم إعادة الاتصال', 'success');
    // Refresh data to sync state
    fetchAllTableStatuses();
    fetchBills();
  });
}, []);
```

#### Invalid Data Handling
```typescript
// Validate table selection
if (!selectedTable) {
  showNotification('يرجى اختيار طاولة أولاً', 'error');
  return;
}

// Validate order items
if (currentOrderItems.length === 0) {
  showNotification('يرجى إضافة عنصر واحد على الأقل', 'error');
  return;
}
```

## Testing Strategy

### Unit Testing

#### Backend Unit Tests

**Test File**: `server/__tests__/controllers/orderController.test.js`

```javascript
describe('Order Controller', () => {
  describe('createOrder', () => {
    it('should store table reference as ObjectId', async () => {
      const tableId = new mongoose.Types.ObjectId();
      const orderData = {
        table: tableId,
        items: [{ menuItem: '...', quantity: 1 }]
      };
      
      const order = await createOrder(orderData);
      expect(order.table).toBeInstanceOf(mongoose.Types.ObjectId);
      expect(order.table.toString()).toBe(tableId.toString());
    });
    
    it('should reject invalid table ObjectId', async () => {
      const orderData = {
        table: 'invalid-id',
        items: [{ menuItem: '...', quantity: 1 }]
      };
      
      await expect(createOrder(orderData)).rejects.toThrow();
    });
    
    it('should find or create bill for table', async () => {
      const table = await Table.create({ number: 5 });
      const orderData = {
        table: table._id,
        items: [{ menuItem: '...', quantity: 1 }]
      };
      
      const order1 = await createOrder(orderData);
      const order2 = await createOrder(orderData);
      
      expect(order1.bill.toString()).toBe(order2.bill.toString());
    });
  });
});
```

**Test File**: `server/__tests__/controllers/billingController.test.js`

```javascript
describe('Billing Controller', () => {
  describe('getBills', () => {
    it('should populate table data', async () => {
      const table = await Table.create({ number: 5 });
      const bill = await Bill.create({ table: table._id });
      
      const bills = await getBills();
      expect(bills[0].table).toBeDefined();
      expect(bills[0].table.number).toBe(5);
    });
  });
  
  describe('addPayment', () => {
    it('should update table status to empty when bill is paid', async () => {
      const table = await Table.create({ number: 5, status: 'occupied' });
      const bill = await Bill.create({ 
        table: table._id, 
        total: 100, 
        remaining: 100 
      });
      
      await addPayment(bill._id, { amount: 100 });
      
      const updatedTable = await Table.findById(table._id);
      expect(updatedTable.status).toBe('empty');
    });
  });
  
  describe('deleteBill', () => {
    it('should delete all associated orders', async () => {
      const bill = await Bill.create({});
      const order1 = await Order.create({ bill: bill._id });
      const order2 = await Order.create({ bill: bill._id });
      
      await deleteBill(bill._id);
      
      const orders = await Order.find({ bill: bill._id });
      expect(orders).toHaveLength(0);
    });
    
    it('should update table status to empty', async () => {
      const table = await Table.create({ number: 5, status: 'occupied' });
      const bill = await Bill.create({ table: table._id });
      
      await deleteBill(bill._id);
      
      const updatedTable = await Table.findById(table._id);
      expect(updatedTable.status).toBe('empty');
    });
  });
});
```

#### Frontend Unit Tests

**Test File**: `src/__tests__/pages/Cafe.test.tsx`

```typescript
describe('Cafe Component', () => {
  it('should categorize tables by occupied status', () => {
    const tables = [
      { _id: '1', number: 1 },
      { _id: '2', number: 2 }
    ];
    const bills = [
      { _id: 'b1', table: { _id: '1' }, status: 'draft' }
    ];
    
    const { getByText } = render(<Cafe tables={tables} bills={bills} />);
    
    // Table 1 should be occupied
    expect(getByText('محجوزة')).toBeInTheDocument();
    // Table 2 should be empty
    expect(getByText('فاضية')).toBeInTheDocument();
  });
  
  it('should use table ObjectId when creating order', async () => {
    const table = { _id: '507f1f77bcf86cd799439011', number: 5 };
    const createOrderMock = jest.fn();
    
    const { getByText } = render(
      <Cafe selectedTable={table} createOrder={createOrderMock} />
    );
    
    fireEvent.click(getByText('حفظ'));
    
    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        table: '507f1f77bcf86cd799439011'
      })
    );
  });
});
```

**Test File**: `src/__tests__/pages/Billing.test.tsx`

```typescript
describe('Billing Component', () => {
  it('should categorize bills with table in table section', () => {
    const bills = [
      { _id: 'b1', table: { _id: 't1', number: 5 }, status: 'draft' },
      { _id: 'b2', table: null, status: 'draft' }
    ];
    
    const { getByText } = render(<Billing bills={bills} />);
    
    expect(getByText('فواتير الطاولات')).toBeInTheDocument();
    expect(getByText('طاولة 5')).toBeInTheDocument();
    expect(getByText('فواتير غير مرتبطة بطاولة')).toBeInTheDocument();
  });
  
  it('should display table number for linked bills', () => {
    const bill = {
      _id: 'b1',
      table: { _id: 't1', number: 5 },
      billNumber: 'BILL-001'
    };
    
    const { getByText } = render(<BillItem bill={bill} />);
    
    expect(getByText(/طاولة.*5/)).toBeInTheDocument();
  });
});
```

### Property-Based Testing

We will use **fast-check** for JavaScript/TypeScript property-based testing.

**Installation**:
```bash
npm install --save-dev fast-check
```

**Configuration**:
- Each property test should run a minimum of 100 iterations
- Tests should use smart generators that constrain to valid input space
- Each test must be tagged with the property number from the design document

**Test File**: `server/__tests__/properties/tableOrderLinking.property.test.js`

```javascript
import fc from 'fast-check';
import mongoose from 'mongoose';
import { createOrder, deleteBill } from '../../controllers/orderController.js';
import { addPayment } from '../../controllers/billingController.js';
import Table from '../../models/Table.js';
import Bill from '../../models/Bill.js';
import Order from '../../models/Order.js';

/**
 * Feature: cafe-table-order-linking-fix, Property 1: Table Reference Storage Integrity
 * For any order created with a table reference, the system SHALL store the table field as a valid MongoDB ObjectId
 */
describe('Property 1: Table Reference Storage Integrity', () => {
  it('should store table reference as ObjectId for all orders', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tableNumber: fc.integer({ min: 1, max: 100 }),
          items: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              price: fc.double({ min: 1, max: 1000 }),
              quantity: fc.integer({ min: 1, max: 10 })
            }),
            { minLength: 1, maxLength: 5 }
          )
        }),
        async (orderData) => {
          // Create table
          const table = await Table.create({ number: orderData.tableNumber });
          
          // Create order with table ObjectId
          const order = await createOrder({
            table: table._id,
            items: orderData.items
          });
          
          // Verify table is stored as ObjectId
          expect(order.table).toBeInstanceOf(mongoose.Types.ObjectId);
          expect(mongoose.Types.ObjectId.isValid(order.table)).toBe(true);
          
          // Cleanup
          await Order.deleteOne({ _id: order._id });
          await Table.deleteOne({ _id: table._id });
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cafe-table-order-linking-fix, Property 2: Bill Categorization by Table Linkage
 * For any bill, if it has a populated table field, it SHALL appear in the "table bills" section
 */
describe('Property 2: Bill Categorization by Table Linkage', () => {
  it('should categorize bills correctly based on table linkage', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            hasTable: fc.boolean(),
            tableNumber: fc.integer({ min: 1, max: 100 }),
            total: fc.double({ min: 10, max: 1000 })
          }),
          { minLength: 5, maxLength: 20 }
        ),
        async (billsData) => {
          const createdBills = [];
          
          // Create bills with and without tables
          for (const billData of billsData) {
            let table = null;
            if (billData.hasTable) {
              table = await Table.create({ number: billData.tableNumber });
            }
            
            const bill = await Bill.create({
              table: table?._id || null,
              total: billData.total
            });
            
            createdBills.push({ bill, hasTable: billData.hasTable });
          }
          
          // Fetch bills with populated table
          const bills = await Bill.find({}).populate('table');
          
          // Categorize
          const tableBills = bills.filter(b => b.table);
          const unlinkedBills = bills.filter(b => !b.table);
          
          // Verify categorization
          const expectedTableBills = billsData.filter(b => b.hasTable).length;
          const expectedUnlinkedBills = billsData.filter(b => !b.hasTable).length;
          
          expect(tableBills.length).toBe(expectedTableBills);
          expect(unlinkedBills.length).toBe(expectedUnlinkedBills);
          
          // Cleanup
          await Bill.deleteMany({ _id: { $in: createdBills.map(b => b.bill._id) } });
          await Table.deleteMany({});
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cafe-table-order-linking-fix, Property 4: Table Status Transitions on Order Creation
 * For any table, when an order is created for that table, the table status SHALL immediately change to "occupied"
 */
describe('Property 4: Table Status Transitions on Order Creation', () => {
  it('should change table status to occupied when order is created', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tableNumber: fc.integer({ min: 1, max: 100 }),
          items: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              price: fc.double({ min: 1, max: 1000 }),
              quantity: fc.integer({ min: 1, max: 10 })
            }),
            { minLength: 1, maxLength: 5 }
          )
        }),
        async (orderData) => {
          // Create table with empty status
          const table = await Table.create({ 
            number: orderData.tableNumber,
            status: 'empty'
          });
          
          // Create order
          await createOrder({
            table: table._id,
            items: orderData.items
          });
          
          // Verify table status changed to occupied
          const updatedTable = await Table.findById(table._id);
          expect(updatedTable.status).toBe('occupied');
          
          // Cleanup
          await Order.deleteMany({ table: table._id });
          await Bill.deleteMany({ table: table._id });
          await Table.deleteOne({ _id: table._id });
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cafe-table-order-linking-fix, Property 5: Table Status Transitions on Bill Payment
 * For any bill linked to a table, when the bill is fully paid, the associated table status SHALL immediately change to "empty"
 */
describe('Property 5: Table Status Transitions on Bill Payment', () => {
  it('should change table status to empty when bill is fully paid', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tableNumber: fc.integer({ min: 1, max: 100 }),
          billTotal: fc.double({ min: 10, max: 1000 })
        }),
        async (data) => {
          // Create table with occupied status
          const table = await Table.create({ 
            number: data.tableNumber,
            status: 'occupied'
          });
          
          // Create bill
          const bill = await Bill.create({
            table: table._id,
            total: data.billTotal,
            remaining: data.billTotal,
            paid: 0
          });
          
          // Pay bill in full
          await addPayment(bill._id, {
            amount: data.billTotal,
            method: 'cash'
          });
          
          // Verify table status changed to empty
          const updatedTable = await Table.findById(table._id);
          expect(updatedTable.status).toBe('empty');
          
          // Cleanup
          await Bill.deleteOne({ _id: bill._id });
          await Table.deleteOne({ _id: table._id });
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cafe-table-order-linking-fix, Property 6: Table Status Transitions on Bill Deletion
 * For any bill linked to a table, when the bill is deleted, the associated table status SHALL immediately change to "empty"
 */
describe('Property 6: Table Status Transitions on Bill Deletion', () => {
  it('should change table status to empty when bill is deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tableNumber: fc.integer({ min: 1, max: 100 }),
          billTotal: fc.double({ min: 10, max: 1000 })
        }),
        async (data) => {
          // Create table with occupied status
          const table = await Table.create({ 
            number: data.tableNumber,
            status: 'occupied'
          });
          
          // Create bill
          const bill = await Bill.create({
            table: table._id,
            total: data.billTotal
          });
          
          // Delete bill
          await deleteBill(bill._id);
          
          // Verify table status changed to empty
          const updatedTable = await Table.findById(table._id);
          expect(updatedTable.status).toBe('empty');
          
          // Cleanup
          await Table.deleteOne({ _id: table._id });
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cafe-table-order-linking-fix, Property 16: Cascading Order Deletion
 * For any bill that is deleted, all orders associated with that bill SHALL be deleted from the database
 */
describe('Property 16: Cascading Order Deletion', () => {
  it('should delete all orders when bill is deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orderCount: fc.integer({ min: 1, max: 10 }),
          items: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              price: fc.double({ min: 1, max: 1000 }),
              quantity: fc.integer({ min: 1, max: 10 })
            }),
            { minLength: 1, maxLength: 5 }
          )
        }),
        async (data) => {
          // Create bill
          const bill = await Bill.create({ total: 100 });
          
          // Create multiple orders for the bill
          const orderIds = [];
          for (let i = 0; i < data.orderCount; i++) {
            const order = await Order.create({
              bill: bill._id,
              items: data.items
            });
            orderIds.push(order._id);
          }
          
          // Delete bill
          await deleteBill(bill._id);
          
          // Verify all orders are deleted
          const remainingOrders = await Order.find({ _id: { $in: orderIds } });
          expect(remainingOrders).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

**Test File**: `server/__tests__/integration/tableOrderBillFlow.test.js`

```javascript
describe('Table-Order-Bill Integration Flow', () => {
  it('should handle complete order lifecycle', async () => {
    // 1. Create table
    const table = await Table.create({ number: 5, status: 'empty' });
    
    // 2. Create order for table
    const order = await createOrder({
      table: table._id,
      items: [{ name: 'Coffee', price: 20, quantity: 1 }]
    });
    
    // 3. Verify table status is occupied
    let updatedTable = await Table.findById(table._id);
    expect(updatedTable.status).toBe('occupied');
    
    // 4. Verify bill was created
    const bill = await Bill.findById(order.bill);
    expect(bill).toBeDefined();
    expect(bill.table.toString()).toBe(table._id.toString());
    
    // 5. Pay bill
    await addPayment(bill._id, { amount: bill.total, method: 'cash' });
    
    // 6. Verify table status is empty
    updatedTable = await Table.findById(table._id);
    expect(updatedTable.status).toBe('empty');
    
    // Cleanup
    await Order.deleteOne({ _id: order._id });
    await Bill.deleteOne({ _id: bill._id });
    await Table.deleteOne({ _id: table._id });
  });
});
```

## Implementation Notes

### Performance Optimizations

1. **Database Indexing**:
   ```javascript
   // Order model
   orderSchema.index({ table: 1, status: 1 });
   orderSchema.index({ bill: 1 });
   
   // Bill model
   billSchema.index({ table: 1, status: 1 });
   billSchema.index({ status: 1, createdAt: -1 });
   ```

2. **Selective Field Population**:
   ```javascript
   // Only populate necessary fields
   await Bill.find({})
     .populate('table', 'number name')
     .populate('orders', 'orderNumber status total')
     .select('billNumber status total paid remaining');
   ```

3. **Optimistic UI Updates**:
   ```typescript
   // Update UI immediately, then sync with server
   setTableStatuses(prev => ({
     ...prev,
     [tableId]: { hasUnpaid: true, orders: [...orders, newOrder] }
   }));
   
   // Sync in background
   fetchAllTableStatuses();
   ```

4. **Debounced Socket.IO Events**:
   ```javascript
   // Batch multiple rapid updates
   const debouncedEmit = debounce((event, data) => {
     io.emit(event, data);
   }, 100);
   ```

### Migration Strategy

1. **Data Migration Script**:
   ```javascript
   // Migrate existing orders to use table ObjectId
   const orders = await Order.find({ tableNumber: { $exists: true } });
   
   for (const order of orders) {
     const table = await Table.findOne({ number: order.tableNumber });
     if (table) {
       order.table = table._id;
       order.tableNumber = undefined;
       await order.save();
     }
   }
   ```

2. **Backward Compatibility**:
   ```javascript
   // Support both old and new formats during transition
   const tableRef = req.body.table || req.body.tableNumber;
   const table = mongoose.Types.ObjectId.isValid(tableRef)
     ? await Table.findById(tableRef)
     : await Table.findOne({ number: tableRef });
   ```

### Deployment Checklist

- [ ] Run data migration script
- [ ] Update all API endpoints to use ObjectId
- [ ] Update frontend to send ObjectId
- [ ] Test Socket.IO events in production
- [ ] Monitor performance metrics
- [ ] Verify table status updates in real-time
- [ ] Test bill categorization with real data
- [ ] Verify print functionality works immediately after save
