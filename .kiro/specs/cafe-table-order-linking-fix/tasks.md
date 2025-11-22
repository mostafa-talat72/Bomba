# Implementation Plan

- [x] 1. Update Backend Models and Schema






- [x] 1.1 Update Order model to ensure table field uses ObjectId reference

  - Modify Order schema to use `table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table' }`
  - Remove any `tableNumber` field references
  - Add index on `table` field for query performance
  - _Requirements: 1.1, 6.1, 6.2_


- [x] 1.2 Update Bill model to ensure table field uses ObjectId reference

  - Modify Bill schema to use `table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table' }`
  - Remove any `tableNumber` field references
  - Add index on `table` and `status` fields
  - _Requirements: 1.1, 6.1, 6.3_


- [x] 1.3 Add Table model status field if not exists

  - Ensure Table schema has `status` field with enum ['empty', 'occupied', 'reserved']
  - Set default status to 'empty'
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Update Backend Controllers - Order Management






- [x] 2.1 Update createOrder controller to use table ObjectId

  - Accept `table` as ObjectId from request body
  - Validate table ObjectId format using `mongoose.Types.ObjectId.isValid()`
  - Verify table exists in database
  - Find or create bill using `Bill.findOne({ table: tableObjectId, status: { $in: ['draft', 'partial', 'overdue'] } })`
  - Link order to bill
  - Update table status to 'occupied'
  - Emit Socket.IO event 'order-created'
  - _Requirements: 1.1, 2.1, 3.1, 3.2, 6.1, 6.2_


- [x] 2.2 Update updateOrder controller to recalculate bill totals

  - Update order items
  - Recalculate associated bill subtotal and total
  - Emit Socket.IO event 'order-updated'
  - _Requirements: 3.4_


- [x] 2.3 Update deleteOrder controller to handle table status

  - Remove order from bill
  - If bill has no more orders/sessions, delete bill
  - Update table status to 'empty' if bill is deleted
  - Restore inventory quantities for deleted items
  - Emit Socket.IO event 'order-deleted'
  - _Requirements: 2.3, 5.1, 5.3, 5.4_

- [x] 3. Update Backend Controllers - Bill Management





- [x] 3.1 Update getBills controller to populate table data


  - Use `.populate('table', 'number name section')` to get full table data
  - Ensure query uses ObjectId comparison for table filtering
  - Return bills with populated table information
  - _Requirements: 1.2, 6.3, 6.4_

- [x] 3.2 Update addPayment controller to handle table status


  - Process payment
  - If `bill.remaining === 0`, set `bill.status = 'paid'`
  - If bill is paid, update associated table status to 'empty'
  - Emit Socket.IO event 'payment-received'
  - _Requirements: 2.2, 2.4_

- [x] 3.3 Update deleteBill controller to cascade delete orders


  - Delete all orders associated with bill
  - Update table status to 'empty'
  - Emit Socket.IO event 'bill-deleted'
  - _Requirements: 2.3, 5.1, 5.2, 5.3_

- [x] 4. Update Socket.IO Event Handlers





- [x] 4.1 Add table-status-update event emission


  - Emit 'table-status-update' event when table status changes
  - Include tableId and new status in event dat+
  a
  - _Requirements: 2.4_

- [x] 4.2 Ensure order events include table information


  - Include populated table data in 'order-created' and 'order-updated' events
  - _Requirements: 3.2_

- [x] 5. Update Frontend - Cafe.tsx Component





- [x] 5.1 Update order creation to use table ObjectId

/0/8
  - Change `handleSaveOrder` to send `table: selectedTable._id` instead of `tableNumber`
  - Implement optimistic UI update for table status
  - Add error handling for invalid table references
  - _Requirements: 1.1, 2.1, 6.1_

- [x] 5.2 Implement immediate print after save


  - Call `printOrderBySections` immediately after successful order creation
  - Ensure print doesn't block UI updates
  - Update table status before showing print dialog
  - _Requirements: 4.2, 4.3, 4.4_

- [x] 5.3 Update table status display logic


  - Modify `isOccupied` function to check for bills with `status !== 'paid'`
  - Use `bill.table._id` for comparison instead of `tableNumber`
  - Update table colors based on occupied status
  - _Requirements: 1.2, 2.5_

- [x] 5.4 Add Socket.IO listeners for real-time updates


  - Listen for 'order-created' event and update table statuses
  - Listen for 'bill-updated' event and refresh table statuses
  - Listen for 'table-status-update' event and update UI immediately
  - Implement reconnection logic to refresh data on reconnect
  - _Requirements: 2.4, 2.5, 3.3_

- [x] 6. Update Frontend - Billing.tsx Component





- [x] 6.1 Implement bill categorization by table linkage


  - Create `tableBills` filter: `bills.filter(bill => bill.table && bill.table._id)`
  - Create `unlinkedBills` filter: `bills.filter(bill => !bill.table)`
  - Group table bills by table number
  - _Requirements: 1.2, 1.3, 1.5_

- [x] 6.2 Update bill display to show table information


  - Display table number for bills with table: `bill.table.number`
  - Show "غير مرتبطة بطاولة" for unlinked bills
  - Extract table number from populated table object
  - _Requirements: 1.4, 6.5_

- [x] 6.3 Add Socket.IO listeners for bill updates


  - Listen for 'bill-updated' event and refresh bills list
  - Listen for 'payment-received' event and update bill status
  - _Requirements: 2.4_

- [x] 7. Update Frontend - AppContext





- [x] 7.1 Update getTableStatus function to use ObjectId


  - Change table lookup to use `table._id` instead of `table.number`
  - Filter bills by `bill.table._id === tableId`
  - Return bills with unpaid status
  - _Requirements: 6.1, 6.3_

- [x] 7.2 Update createOrder function to accept table ObjectId


  - Ensure API call sends `table` as ObjectId
  - Handle response with populated table data
  - _Requirements: 1.1, 6.1_

- [x] 8. Performance Optimizations





- [x] 8.1 Add database indexes


  - Add index on Order: `{ table: 1, status: 1 }`
  - Add index on Order: `{ bill: 1 }`
  - Add index on Bill: `{ table: 1, status: 1 }`
  - Add index on Bill: `{ status: 1, createdAt: -1 }`
  - _Requirements: 3.1, 3.4_

- [x] 8.2 Optimize bill queries with selective population



  - Use `.select()` to limit fields returned
  - Populate only necessary fields: `populate('table', 'number name')`
  - Limit populated orders and sessions to essential fields
  - _Requirements: 3.1_

- [x] 8.3 Implement debounced Socket.IO emissions


  - Batch rapid updates to reduce event frequency
  - Use 100ms debounce for status updates
  - _Requirements: 3.4_

- [x] 9. Error Handling and Validation




- [x] 9.1 Add backend validation for table ObjectId

  - Validate ObjectId format in createOrder controller
  - Return 400 error for invalid ObjectId
  - Return 404 error if table doesn't exist
  - _Requirements: 6.2_

- [x] 9.2 Add frontend error handling


  - Handle network errors gracefully
  - Show loading indicators during operations
  - Revert optimistic updates on error
  - Handle Socket.IO disconnection/reconnection
  - _Requirements: 4.5_

- [x] 10. Data Migration





- [x] 10.1 Create migration script for existing data


  - Find all orders with `tableNumber` field
  - Convert `tableNumber` to `table` ObjectId reference
  - Find all bills with `tableNumber` field
  - Convert `tableNumber` to `table` ObjectId reference
  - Verify all references are valid
  - _Requirements: 6.1_

- [x] 10.2 Write unit tests for migration script


  - Test conversion of tableNumber to ObjectId
  - Test handling of missing tables
  - Test rollback on error
  - _Requirements: 6.1_

- [x] 11. Testing





- [x] 11.1 Write property test for table reference storage integrity (Property 1)


  - **Property 1: Table Reference Storage Integrity**
  - **Validates: Requirements 1.1, 6.1**
  - Generate random orders with table references
  - Verify stored table field is valid ObjectId
  - Run 100 iterations

- [x] 11.2 Write property test for bill categorization (Property 2)


  - **Property 2: Bill Categorization by Table Linkage**
  - **Validates: Requirements 1.2, 1.3, 1.5**
  - Generate random bills with and without tables
  - Verify categorization into table/unlinked sections
  - Run 100 iterations

- [x] 11.3 Write property test for table number display (Property 3)


  - **Property 3: Table Number Display**
  - **Validates: Requirements 1.4, 6.5**
  - Generate random bills with tables
  - Verify table number is displayed correctly
  - Run 100 iterations

- [x] 11.4 Write property test for table status on order creation (Property 4)

  - **Property 4: Table Status Transitions on Order Creation**
  - **Validates: Requirements 2.1**
  - Generate random orders for tables
  - Verify table status changes to 'occupied'
  - Run 100 iterations

- [x] 11.5 Write property test for table status on bill payment (Property 5)

  - **Property 5: Table Status Transitions on Bill Payment**
  - **Validates: Requirements 2.2**
  - Generate random bills with payments
  - Verify table status changes to 'empty' when paid
  - Run 100 iterations

- [x] 11.6 Write property test for table status on bill deletion (Property 6)

  - **Property 6: Table Status Transitions on Bill Deletion**
  - **Validates: Requirements 2.3, 5.2**
  - Generate random bills and delete them
  - Verify table status changes to 'empty'
  - Run 100 iterations

- [x] 11.7 Write property test for cascading order deletion (Property 16)

  - **Property 16: Cascading Order Deletion**
  - **Validates: Requirements 5.1**
  - Generate random bills with multiple orders
  - Delete bills and verify all orders are deleted
  - Run 100 iterations

- [x] 11.8 Write unit tests for order controller

  - Test createOrder with valid table ObjectId
  - Test createOrder with invalid table ObjectId
  - Test createOrder finds or creates bill
  - Test updateOrder recalculates bill totals
  - Test deleteOrder handles table status
  - _Requirements: 1.1, 2.1, 2.3, 6.2_

- [x] 11.9 Write unit tests for billing controller

  - Test getBills populates table data
  - Test addPayment updates table status when paid
  - Test deleteBill cascades to orders
  - Test deleteBill updates table status
  - _Requirements: 1.2, 2.2, 2.3, 5.1, 6.4_

- [x] 11.10 Write integration tests for complete flow

  - Test order creation → table occupied → bill created
  - Test bill payment → table empty
  - Test bill deletion → orders deleted → table empty
  - _Requirements: All_

- [x] 12. Final Checkpoint - Ensure all tests pass






  - Ensure all tests pass, ask the user if questions arise.
