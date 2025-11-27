# Session Partial Payment Implementation

## Overview

This document describes the implementation of the partial payment system for PlayStation and Computer sessions in the Bomba system. This feature allows users to make partial payments for gaming sessions, enabling customers to pay in installments.

## Implementation Details

### 1. Bill Model (`server/models/Bill.js`)

#### Schema Fields

Added `sessionPayments` array to track partial payments for sessions:

```javascript
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
}]
```

#### Methods

**`paySessionPartial(sessionId, amount, paymentMethod, userId)`**

Processes a partial payment for a specific session.

**Parameters:**
- `sessionId` (ObjectId): The ID of the session to pay for
- `amount` (Number): The payment amount
- `paymentMethod` (String): Payment method ('cash', 'card', or 'transfer')
- `userId` (ObjectId): The ID of the user making the payment

**Returns:**
```javascript
{
  sessionId: ObjectId,
  paidAmount: Number,
  remaining: Number
}
```

**Validation:**
- Rejects if `sessionId` is not provided
- Rejects if `amount` is <= 0
- Rejects if session is not found in the bill
- Rejects if `amount` exceeds `remainingAmount`

**Behavior:**
1. Validates input parameters
2. Finds the session payment record
3. Adds payment to the session's payments array
4. Updates `paidAmount` and `remainingAmount`
5. Records payment in `paymentHistory`
6. Calls `calculateRemainingAmount()` to update bill totals

**`calculateRemainingAmount()`**

Updated to include session payments when calculating the total paid amount.

```javascript
// Collects paid amounts from:
// 1. itemPayments (new system)
// 2. sessionPayments (new system)
// 3. payments (legacy system for compatibility)

this.paid = totalPaid;
this.remaining = Math.max(0, this.total - totalPaid);
```

### 2. Controller (`server/controllers/billingController.js`)

**`paySessionPartial(req, res)`**

API endpoint handler for session partial payments.

**Route:** `POST /api/bills/:id/pay-session-partial`

**Request Body:**
```javascript
{
  sessionId: String,      // Required
  amount: Number,         // Required, must be > 0
  paymentMethod: String   // Optional, defaults to 'cash'
}
```

**Response (Success):**
```javascript
{
  success: true,
  message: "تم دفع جزء من الجلسة بنجاح",
  data: {
    bill: Bill,           // Populated bill object
    sessionId: ObjectId,
    paidAmount: Number,
    sessionRemaining: Number,
    billRemaining: Number,
    billStatus: String
  }
}
```

**Response (Error):**
```javascript
{
  success: false,
  message: String,
  remainingAmount: Number  // Only for overpayment errors
}
```

**Features:**
- Validates bill exists and is not paid/cancelled
- Validates session exists in the bill
- Validates payment amount
- Updates table status if bill has a table (Requirement 2.4)
- Emits Socket.IO event for real-time updates
- Creates notification for payment
- Populates bill data for response

### 3. Routes (`server/routes/billsRoutes.js`)

Added route:
```javascript
router.post("/:id/pay-session-partial", authorize("billing", "all"), paySessionPartial);
```

**Authorization:** Requires 'billing' or 'all' permission

## Requirements Validation

### Requirement 4.1: Partial Payment Recording
✅ **Implemented**: `paySessionPartial()` records the payment amount and calculates remaining balance

### Requirement 4.2: Overpayment Rejection
✅ **Implemented**: Validates `amount <= remainingAmount` and throws error if exceeded

### Requirement 4.3: Payment History
✅ **Implemented**: Each payment is added to `sessionPayments.payments` array and `paymentHistory`

### Requirement 4.5: Bill Status Update
✅ **Implemented**: `calculateRemainingAmount()` updates bill status when all items and sessions are paid

## Testing

### Property-Based Tests

All property-based tests pass successfully:

```
✓ Property 8: Session partial payment validation (4010 ms)
✓ Property 9: Session partial payments accumulate correctly (4170 ms)
✓ Property 10: Session allows payments until fully paid (3982 ms)
✓ Property 11: Payment history contains complete data (4192 ms)
✓ Property 12: Payment history consistency (4663 ms)
✓ Property 14: Session payment status tracking (4171 ms)
```

### Verification Script

Created `server/scripts/verifyPaySessionPartial.js` which verifies:
- ✅ Method exists and is callable
- ✅ Schema fields are properly defined
- ✅ Payment validation works correctly
- ✅ Payment history tracking works
- ✅ `calculateRemainingAmount()` includes session payments

## Usage Example

### Making a Partial Payment

```javascript
// Client-side API call
const response = await api.paySessionPartial(billId, {
  sessionId: '507f1f77bcf86cd799439011',
  amount: 50,
  paymentMethod: 'cash'
});

// Response
{
  success: true,
  message: "تم دفع جزء من الجلسة بنجاح",
  data: {
    bill: { ... },
    sessionId: '507f1f77bcf86cd799439011',
    paidAmount: 50,
    sessionRemaining: 50,
    billRemaining: 150,
    billStatus: 'partial'
  }
}
```

### Error Handling

```javascript
try {
  await api.paySessionPartial(billId, {
    sessionId: sessionId,
    amount: 150,  // More than remaining
    paymentMethod: 'cash'
  });
} catch (error) {
  // error.response.data.message: "المبلغ (150 جنيه) أكبر من المبلغ المتبقي (100 جنيه)"
  // error.response.data.remainingAmount: 100
}
```

## Integration with Other Features

### Table Status Updates
When a session payment is made, the system automatically:
1. Checks if the bill is fully paid
2. Updates the table status if needed (Requirement 2.4)
3. Emits Socket.IO event for real-time UI updates

### Real-time Updates
Socket.IO events are emitted on payment:
```javascript
io.emit('bill-updated', {
  billId: bill._id,
  type: 'session-payment',
  bill: bill
});
```

### Notifications
System creates notifications for:
- Partial payments: `'partial_payment'` type
- Full payment: `'paid'` type (when bill becomes fully paid)

## Database Schema

### sessionPayments Structure

```javascript
{
  sessionId: ObjectId('507f1f77bcf86cd799439011'),
  sessionCost: 100,
  paidAmount: 50,
  remainingAmount: 50,
  payments: [
    {
      amount: 30,
      paidAt: ISODate('2024-01-15T10:30:00Z'),
      paidBy: ObjectId('507f1f77bcf86cd799439012'),
      method: 'cash'
    },
    {
      amount: 20,
      paidAt: ISODate('2024-01-15T11:00:00Z'),
      paidBy: ObjectId('507f1f77bcf86cd799439012'),
      method: 'card'
    }
  ]
}
```

### paymentHistory Entry

```javascript
{
  timestamp: ISODate('2024-01-15T10:30:00Z'),
  amount: 30,
  method: 'cash',
  paidBy: ObjectId('507f1f77bcf86cd799439012'),
  type: 'partial-session',
  details: {
    paidItems: [],
    paidSessions: [
      {
        sessionId: ObjectId('507f1f77bcf86cd799439011'),
        amount: 30,
        remainingAfter: 70
      }
    ]
  }
}
```

## Performance Considerations

- Session payments are stored in an embedded array for fast access
- Payment history is indexed for efficient querying
- `calculateRemainingAmount()` is optimized to iterate once through all payment types
- Socket.IO events are emitted asynchronously to avoid blocking the response

## Future Enhancements

Potential improvements for future versions:
1. Support for payment refunds
2. Payment method-specific validation rules
3. Automatic payment reminders for unpaid sessions
4. Payment analytics and reporting
5. Multi-currency support

## Conclusion

The session partial payment system is fully implemented and tested. All requirements (4.1, 4.2, 4.3, 4.5) are met, and the system integrates seamlessly with existing features like table status updates, real-time notifications, and payment history tracking.
