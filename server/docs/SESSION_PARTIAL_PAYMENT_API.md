# Session Partial Payment API

## Endpoint

```
POST /api/bills/:id/pay-session-partial
```

## Description

This endpoint allows users to make partial payments for PlayStation or Computer sessions within a bill. The payment is deducted from the session's remaining balance, and the bill's total remaining amount is recalculated.

## Authentication

Requires authentication with `billing` permission.

## Request Parameters

### URL Parameters

- `id` (required): The Bill ID (MongoDB ObjectId)

### Body Parameters

```json
{
  "sessionId": "string (required) - MongoDB ObjectId of the session",
  "amount": "number (required) - Payment amount (must be > 0)",
  "paymentMethod": "string (optional) - Payment method: 'cash', 'card', or 'transfer' (default: 'cash')"
}
```

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "تم دفع جزء من الجلسة بنجاح",
  "data": {
    "bill": {
      // Full bill object with populated fields
    },
    "sessionId": "ObjectId",
    "paidAmount": 50,
    "sessionRemaining": 30,
    "billRemaining": 100,
    "billStatus": "partial"
  }
}
```

### Error Responses

#### 400 Bad Request - Missing sessionId

```json
{
  "success": false,
  "message": "يجب تحديد الجلسة"
}
```

#### 400 Bad Request - Invalid amount

```json
{
  "success": false,
  "message": "يجب إدخال مبلغ صحيح أكبر من صفر"
}
```

#### 400 Bad Request - Amount exceeds remaining

```json
{
  "success": false,
  "message": "المبلغ (100 جنيه) أكبر من المبلغ المتبقي (50 جنيه)",
  "remainingAmount": 50
}
```

#### 400 Bad Request - Bill already paid

```json
{
  "success": false,
  "message": "لا يمكن دفع جلسة من فاتورة مدفوعة بالكامل"
}
```

#### 400 Bad Request - Bill cancelled

```json
{
  "success": false,
  "message": "لا يمكن دفع جلسة من فاتورة ملغاة"
}
```

#### 404 Not Found - Bill not found

```json
{
  "success": false,
  "message": "الفاتورة غير موجودة"
}
```

#### 404 Not Found - Session not in bill

```json
{
  "success": false,
  "message": "الجلسة غير موجودة في الفاتورة"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "message": "خطأ في الدفع الجزئي للجلسة",
  "error": "Error details"
}
```

## Example Usage

### Example 1: Pay 50 EGP of a 100 EGP session

```bash
curl -X POST http://localhost:5000/api/bills/507f1f77bcf86cd799439011/pay-session-partial \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "sessionId": "507f1f77bcf86cd799439012",
    "amount": 50,
    "paymentMethod": "cash"
  }'
```

### Example 2: Pay remaining 30 EGP with card

```bash
curl -X POST http://localhost:5000/api/bills/507f1f77bcf86cd799439011/pay-session-partial \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "sessionId": "507f1f77bcf86cd799439012",
    "amount": 30,
    "paymentMethod": "card"
  }'
```

## Business Logic

1. **Validation**: The endpoint validates that:
   - The bill exists and belongs to the user's organization
   - The bill is not already paid or cancelled
   - The session exists in the bill
   - The payment amount is positive and doesn't exceed the session's remaining balance

2. **Payment Processing**: When a valid payment is made:
   - The payment is added to the session's payment array
   - The session's `paidAmount` is increased
   - The session's `remainingAmount` is decreased
   - A payment history entry is created with type "partial-session"
   - The bill's overall remaining amount is recalculated

3. **Table Status Update**: After payment:
   - The system checks if all bills for the table are paid
   - If all bills are paid, the table status is set to "empty"
   - If any bills remain unpaid, the table status stays "occupied"

4. **Real-time Notifications**:
   - A Socket.IO event "bill-updated" is emitted with type "session-payment"
   - A Socket.IO event "table-status-update" is emitted if table status changes
   - A notification is created for the payment

## Related Endpoints

- `POST /api/bills/:id/pay-items` - Pay for specific items in a bill
- `POST /api/bills/:id/payment` - Make a full payment on a bill
- `GET /api/bills/:id` - Get bill details including payment history

## Requirements Validated

This endpoint validates the following requirements from the specification:

- **Requirement 4.1**: Display session cost with partial payment option
- **Requirement 4.2**: Validate amount doesn't exceed remaining balance
- **Requirement 4.3**: Deduct payment from session's remaining balance
- **Requirement 4.4**: Accumulate multiple partial payments
- **Requirement 4.5**: Allow payments until full session cost is paid
