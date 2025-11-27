# Design Document

## Overview

هذا التصميم يهدف إلى إصلاح مشكلة في نظام ربط الطلبات بالطاولات والفواتير. المشكلة الحالية هي أن بعض الطلبات تُنشأ بدون ربط صحيح بالفواتير، مما يؤدي إلى:

1. طلبات موجودة في قاعدة البيانات ولكن غير مرتبطة بفاتورة
2. طاولات تظهر كفارغة رغم وجود طلبات عليها
3. فواتير لا تظهر في صفحة الفواتير رغم وجود طلبات مرتبطة بها

**الحل المقترح:**
- تحسين منطق إنشاء الطلبات لضمان ربط كل طلب بفاتورة
- تحديث حالة الطاولة تلقائياً عند إنشاء/حذف طلبات
- إضافة آليات للتحقق من تناسق البيانات
- تحسين التزامن بين الصفحات عبر Socket.IO

## Architecture

### Current System Analysis

**الوضع الحالي:**

من خلال فحص الكود، وجدنا أن منطق إنشاء الطلبات في `server/controllers/orderController.js` يحتوي على المنطق الصحيح:

```javascript
// البحث عن فاتورة غير مدفوعة للطاولة
if (table && !billToUse) {
    const existingBill = await Bill.findOne({
        table: table,
        organization: req.user.organization,
        status: { $in: ['draft', 'partial', 'overdue'] }
    }).sort({ createdAt: -1 });
    
    if (existingBill) {
        billToUse = existingBill._id;
    } else {
        // إنشاء فاتورة جديدة
        const newBill = await Bill.create({...});
        billToUse = newBill._id;
    }
    
    // تحديث حالة الطاولة
    tableDoc.status = 'occupied';
    await tableDoc.save();
}
```

**المشاكل المحتملة:**

1. **عدم معالجة الأخطاء بشكل كامل**: إذا فشل إنشاء الفاتورة، قد يتم إنشاء الطلب بدون فاتورة
2. **عدم تحديث حالة الطاولة في جميع الحالات**: قد لا يتم تحديث حالة الطاولة إذا كانت الفاتورة موجودة مسبقاً
3. **عدم التحقق من تناسق البيانات**: لا يوجد تحقق من أن الطلب مرتبط بفاتورة قبل الحفظ
4. **مشاكل في التزامن**: قد لا يتم تحديث الواجهة الأمامية فوراً

### Proposed Architecture

**التحسينات المقترحة:**

1. **تحسين معالجة الأخطاء**:
   - استخدام transactions لضمان atomicity
   - التراجع عن جميع التغييرات عند فشل أي جزء
   - رسائل خطأ واضحة ومفيدة

2. **ضمان ربط الطلب بفاتورة**:
   - التحقق من وجود bill قبل حفظ الطلب
   - إنشاء فاتورة تلقائياً إذا لم توجد
   - تسجيل جميع عمليات الربط

3. **تحديث حالة الطاولة بشكل موثوق**:
   - تحديث حالة الطاولة في جميع الحالات (إنشاء/تعديل/حذف)
   - التحقق من وجود فواتير غير مدفوعة قبل تغيير الحالة
   - إرسال تحديثات Socket.IO لحالة الطاولة

4. **تحسين التزامن**:
   - إرسال أحداث Socket.IO لجميع التغييرات
   - تحديث الواجهة الأمامية فوراً
   - إعادة جلب البيانات عند الحاجة

## Components and Interfaces

### Backend Components

#### 1. Order Controller - Enhanced Create Order

```javascript
// server/controllers/orderController.js

export const createOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { table, customerName, customerPhone, items, notes, bill } = req.body;
        
        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new Error('يجب إضافة عنصر واحد على الأقل للطلب');
        }
        
        // Validate and get table if provided
        let tableDoc = null;
        if (table) {
            if (!mongoose.Types.ObjectId.isValid(table)) {
                throw new Error('معرف الطاولة غير صحيح');
            }
            
            tableDoc = await Table.findById(table).session(session);
            if (!tableDoc) {
                throw new Error('الطاولة غير موجودة');
            }
        }
        
        // Process items and calculate totals
        const processedItems = [];
        let subtotal = 0;
        
        for (const item of items) {
            // ... معالجة العناصر
        }
        
        // Find or create bill
        let billToUse = bill;
        
        if (table && !billToUse) {
            // البحث عن فاتورة غير مدفوعة للطاولة
            const existingBill = await Bill.findOne({
                table: table,
                organization: req.user.organization,
                status: { $in: ['draft', 'partial', 'overdue'] }
            }).sort({ createdAt: -1 }).session(session);
            
            if (existingBill) {
                billToUse = existingBill._id;
                Logger.info(`✓ Found existing bill for table ${tableDoc.number}`);
            } else {
                // إنشاء فاتورة جديدة
                const billData = {
                    table: table,
                    customerName: customerName || `طاولة ${tableDoc.number}`,
                    customerPhone: customerPhone || null,
                    orders: [],
                    sessions: [],
                    subtotal: 0,
                    total: 0,
                    discount: 0,
                    tax: 0,
                    paid: 0,
                    remaining: 0,
                    status: 'draft',
                    paymentMethod: 'cash',
                    billType: 'cafe',
                    createdBy: req.user._id,
                    organization: req.user.organization,
                };
                
                const newBill = await Bill.create([billData], { session });
                billToUse = newBill[0]._id;
                Logger.info(`✓ Created new bill for table ${tableDoc.number}`);
            }
        } else if (!table && !billToUse) {
            // إنشاء فاتورة للطلب بدون طاولة
            const billData = {
                customerName: customerName || 'عميل',
                customerPhone: customerPhone || null,
                orders: [],
                sessions: [],
                subtotal: 0,
                total: 0,
                discount: 0,
                tax: 0,
                paid: 0,
                remaining: 0,
                status: 'draft',
                paymentMethod: 'cash',
                billType: 'cafe',
                createdBy: req.user._id,
                organization: req.user.organization,
            };
            
            const newBill = await Bill.create([billData], { session });
            billToUse = newBill[0]._id;
            Logger.info(`✓ Created new bill for order without table`);
        }
        
        // Verify bill exists before creating order
        if (!billToUse) {
            throw new Error('فشل في إنشاء أو العثور على فاتورة للطلب');
        }
        
        // Create order with bill reference
        const orderData = {
            ...req.body,
            items: processedItems,
            subtotal: subtotal,
            finalAmount: subtotal - (req.body.discount || 0),
            organization: req.user.organization,
            createdBy: req.user._id,
            status: 'pending',
            bill: billToUse, // ربط الطلب بالفاتورة
        };
        
        const order = await Order.create([orderData], { session });
        
        // Add order to bill
        const billDoc = await Bill.findById(billToUse).session(session);
        if (!billDoc.orders.includes(order[0]._id)) {
            billDoc.orders.push(order[0]._id);
            await billDoc.save({ session });
        }
        
        // Recalculate bill totals
        await billDoc.calculateSubtotal();
        await billDoc.save({ session });
        
        // Update table status if table is provided
        if (tableDoc) {
            tableDoc.status = 'occupied';
            await tableDoc.save({ session });
            Logger.info(`✓ Updated table ${tableDoc.number} status to occupied`);
        }
        
        // Commit transaction
        await session.commitTransaction();
        
        // Populate order for response
        const populatedOrder = await Order.findById(order[0]._id)
            .populate('createdBy', 'name')
            .populate('bill')
            .populate('table', 'number name')
            .populate('organization', 'name');
        
        // Emit Socket.IO events
        if (req.io) {
            req.io.notifyOrderUpdate('created', populatedOrder);
            req.io.emit('bill-update', { 
                type: 'created', 
                bill: billDoc 
            });
            if (tableDoc) {
                req.io.emit('table-status-update', { 
                    tableId: tableDoc._id, 
                    status: 'occupied' 
                });
            }
        }
        
        res.status(201).json({
            success: true,
            message: 'تم إنشاء الطلب بنجاح',
            data: populatedOrder,
        });
        
    } catch (error) {
        // Rollback transaction on error
        await session.abortTransaction();
        
        Logger.error('Error creating order:', error);
        
        res.status(500).json({
            success: false,
            message: error.message || 'خطأ في إنشاء الطلب',
            error: error.message,
        });
    } finally {
        session.endSession();
    }
};
```

#### 2. Order Controller - Enhanced Delete Order

```javascript
// server/controllers/orderController.js

export const deleteOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        }).populate('bill').populate('table').session(session);
        
        if (!order) {
            throw new Error('الطلب غير موجود');
        }
        
        const billId = order.bill?._id || order.bill;
        const tableId = order.table?._id || order.table;
        
        // Remove order from bill
        if (billId) {
            const billDoc = await Bill.findById(billId).session(session);
            if (billDoc) {
                billDoc.orders = billDoc.orders.filter(
                    orderId => orderId.toString() !== order._id.toString()
                );
                
                // If bill has no more orders and no sessions, delete it
                if (billDoc.orders.length === 0 && billDoc.sessions.length === 0) {
                    await Bill.findByIdAndDelete(billId).session(session);
                    Logger.info(`✓ Deleted empty bill ${billDoc.billNumber}`);
                } else {
                    // Recalculate bill totals
                    await billDoc.calculateSubtotal();
                    await billDoc.save({ session });
                }
            }
        }
        
        // Delete order
        await Order.findByIdAndDelete(order._id).session(session);
        
        // Update table status if needed
        if (tableId) {
            const tableDoc = await Table.findById(tableId).session(session);
            if (tableDoc) {
                // Check if table has any other unpaid bills
                const unpaidBills = await Bill.countDocuments({
                    table: tableId,
                    organization: req.user.organization,
                    status: { $in: ['draft', 'partial', 'overdue'] }
                }).session(session);
                
                if (unpaidBills === 0) {
                    tableDoc.status = 'available';
                    await tableDoc.save({ session });
                    Logger.info(`✓ Updated table ${tableDoc.number} status to available`);
                }
            }
        }
        
        // Commit transaction
        await session.commitTransaction();
        
        // Emit Socket.IO events
        if (req.io) {
            req.io.notifyOrderUpdate('deleted', { id: order._id });
            if (billId) {
                req.io.emit('bill-update', { 
                    type: 'deleted', 
                    billId: billId 
                });
            }
            if (tableId) {
                const tableDoc = await Table.findById(tableId);
                req.io.emit('table-status-update', { 
                    tableId: tableId, 
                    status: tableDoc?.status || 'available' 
                });
            }
        }
        
        res.json({
            success: true,
            message: 'تم حذف الطلب بنجاح',
        });
        
    } catch (error) {
        await session.abortTransaction();
        
        Logger.error('Error deleting order:', error);
        
        res.status(500).json({
            success: false,
            message: error.message || 'خطأ في حذف الطلب',
            error: error.message,
        });
    } finally {
        session.endSession();
    }
};
```

#### 3. Order Controller - Enhanced Update Order

```javascript
// server/controllers/orderController.js

export const updateOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { status, notes, items } = req.body;
        
        const order = await Order.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        }).populate('bill').session(session);
        
        if (!order) {
            throw new Error('الطلب غير موجود');
        }
        
        // Update order fields
        if (status) order.status = status;
        if (notes !== undefined) order.notes = notes;
        
        // Update items if provided
        if (Array.isArray(items)) {
            // ... معالجة تحديث العناصر
            order.items = processedItems;
            order.subtotal = calculateSubtotal(processedItems);
            order.finalAmount = order.subtotal - (order.discount || 0);
        }
        
        await order.save({ session });
        
        // Update bill totals if order is linked to a bill
        if (order.bill) {
            const billDoc = await Bill.findById(order.bill).session(session);
            if (billDoc) {
                await billDoc.calculateSubtotal();
                await billDoc.save({ session });
            }
        }
        
        // Commit transaction
        await session.commitTransaction();
        
        // Populate order for response
        const updatedOrder = await Order.findById(order._id)
            .populate('createdBy', 'name')
            .populate('bill')
            .populate('table', 'number name');
        
        // Emit Socket.IO events
        if (req.io) {
            req.io.notifyOrderUpdate('updated', updatedOrder);
            if (order.bill) {
                req.io.emit('bill-update', { 
                    type: 'updated', 
                    billId: order.bill 
                });
            }
        }
        
        res.json({
            success: true,
            message: 'تم تحديث الطلب بنجاح',
            data: updatedOrder,
        });
        
    } catch (error) {
        await session.abortTransaction();
        
        Logger.error('Error updating order:', error);
        
        res.status(500).json({
            success: false,
            message: error.message || 'خطأ في تحديث الطلب',
            error: error.message,
        });
    } finally {
        session.endSession();
    }
};
```

### Frontend Components

#### 1. Cafe Page - Enhanced Order Creation

```typescript
// src/pages/Cafe.tsx

const handleSaveOrder = async () => {
    if (!selectedTable || currentOrderItems.length === 0) {
        showNotification('يرجى إضافة عنصر واحد على الأقل', 'error');
        return;
    }
    
    try {
        const orderData = {
            table: selectedTable._id,
            customerName: selectedTable.number.toString(),
            items: currentOrderItems.map(item => ({
                menuItem: item.menuItem,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                notes: item.notes || null,
            })),
            notes: orderNotes || null,
        };
        
        setLoading(true);
        const order = await createOrder(orderData);
        
        if (order) {
            showNotification('تم إضافة الطلب بنجاح', 'success');
            
            // Close modal
            setShowOrderModal(false);
            setCurrentOrderItems([]);
            setOrderNotes('');
            
            // Print order
            printOrderBySections(order, menuSections, menuItemsMap, establishmentName);
            
            // Refresh data - Socket.IO will handle real-time updates
            // but we refresh to ensure consistency
            await Promise.all([
                fetchOrders(),
                fetchBills(),
                fetchTables()
            ]);
        }
    } catch (error: any) {
        Logger.error('Error creating order:', error);
        showNotification(error.message || 'خطأ في إضافة الطلب', 'error');
    } finally {
        setLoading(false);
    }
};
```

#### 2. Billing Page - Enhanced Bill Display

```typescript
// src/pages/Billing.tsx

// Filter bills to show only those with orders or sessions
const filteredBills = useMemo(() => {
    return bills.filter((bill: Bill) => {
        // Show bill if it has orders or sessions
        const hasOrders = bill.orders && bill.orders.length > 0;
        const hasSessions = bill.sessions && bill.sessions.length > 0;
        
        if (!hasOrders && !hasSessions) {
            return false;
        }
        
        // Apply status filter
        if (statusFilter !== 'all') {
            if (statusFilter === 'unpaid') {
                return bill.status === 'draft' || bill.status === 'partial' || bill.status === 'overdue';
            } else {
                return bill.status === statusFilter;
            }
        }
        
        return true;
    });
}, [bills, statusFilter]);
```

## Data Models

### Order Model
```javascript
// server/models/Order.js
// البنية الحالية جيدة - لا حاجة لتعديل

{
  orderNumber: String,
  table: ObjectId, // مرجع للطاولة (اختياري)
  customerName: String,
  items: [OrderItem],
  status: String,
  subtotal: Number,
  finalAmount: Number,
  bill: ObjectId, // مرجع للفاتورة (مطلوب)
  organization: ObjectId,
  createdBy: ObjectId,
  // ... باقي الحقول
}
```

### Bill Model
```javascript
// server/models/Bill.js
// البنية الحالية جيدة - لا حاجة لتعديل

{
  billNumber: String,
  customerName: String,
  table: ObjectId, // مرجع للطاولة (اختياري)
  orders: [ObjectId], // قائمة الطلبات
  sessions: [ObjectId], // قائمة الجلسات
  subtotal: Number,
  total: Number,
  paid: Number,
  remaining: Number,
  status: String, // 'draft' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  billType: String, // 'cafe' | 'playstation' | 'computer'
  organization: ObjectId,
  createdBy: ObjectId,
  // ... باقي الحقول
}
```

### Table Model
```javascript
// server/models/Table.js
// البنية الحالية جيدة - لا حاجة لتعديل

{
  number: Mixed, // رقم أو اسم الطاولة
  section: ObjectId, // مرجع للقسم
  organization: ObjectId,
  isActive: Boolean,
  status: String, // 'empty' | 'occupied' | 'reserved'
  createdBy: ObjectId,
  // ... باقي الحقول
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Acceptence Criteria Testing Prework

