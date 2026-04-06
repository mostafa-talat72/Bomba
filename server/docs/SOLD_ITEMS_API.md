# Sold Items API Documentation

## Endpoint: Get Sold Items Report

### Request
```
GET /api/reports/sold-items
```

### Authentication
- Requires: JWT Token
- Permission: `reports` or `all`

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| dateFilter | string | No | Filter by date period: `all`, `today`, `week`, `month` |

### Response Format

```json
{
  "success": true,
  "data": [
    {
      "itemName": "قهوة تركية",
      "totalQuantity": 45,
      "totalRevenue": 450,
      "orderCount": 15,
      "details": [
        {
          "orderId": "507f1f77bcf86cd799439011",
          "orderNumber": "ORD-001",
          "billId": "507f1f77bcf86cd799439012",
          "billNumber": "BILL-001",
          "tableName": "طاولة 5",
          "tableSection": "القسم الداخلي",
          "quantity": 3,
          "price": 10,
          "total": 30,
          "orderDate": "2024-03-19T10:30:00.000Z",
          "customerName": "أحمد محمد"
        }
      ]
    }
  ],
  "count": 25
}
```

### Response Fields

#### Main Item Object
- `itemName` (string): Name of the sold item
- `totalQuantity` (number): Total quantity sold
- `totalRevenue` (number): Total revenue from this item
- `orderCount` (number): Number of orders containing this item
- `details` (array): Array of order details

#### Detail Object
- `orderId` (string): MongoDB ObjectId of the order
- `orderNumber` (string): Human-readable order number
- `billId` (string): MongoDB ObjectId of the associated bill
- `billNumber` (string): Human-readable bill number (empty if no bill)
- `tableName` (string): Name of the table (empty if no table)
- `tableSection` (string): Name of the table section (empty if no section)
- `quantity` (number): Quantity of this item in the order
- `price` (number): Price per unit
- `total` (number): Total price (quantity × price)
- `orderDate` (string): ISO 8601 date string
- `customerName` (string): Name of the customer (empty if not provided)

### Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "غير مصرح لك بالوصول"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "ليس لديك صلاحية للوصول إلى هذا المورد"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "خطأ في جلب بيانات الأصناف المباعة",
  "error": "Error details..."
}
```

### Example Usage

#### JavaScript/TypeScript
```typescript
const response = await api.getSoldItems('week');
if (response.success) {
  const soldItems = response.data;
  console.log(`Found ${soldItems.length} items`);
}
```

#### cURL
```bash
curl -X GET \
  'http://localhost:5000/api/reports/sold-items?dateFilter=week' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Notes

1. **Date Filtering**:
   - `all`: Returns all sold items (no date filter)
   - `today`: Returns items sold today (from 00:00:00)
   - `week`: Returns items sold in the last 7 days
   - `month`: Returns items sold in the last 30 days

2. **Cancelled Orders**: Cancelled orders are automatically excluded from the results

3. **Aggregation**: Items with the same name are automatically aggregated together

4. **Sorting**: Results are sorted by order creation date (newest first) before aggregation

5. **Population**: The endpoint automatically populates:
   - Table information (name and section)
   - Bill information (bill number)

6. **Performance**: For large datasets, consider adding pagination in future versions

### Database Models Used

- **Order**: Main source of sold items data
- **Bill**: For bill number information
- **Table**: For table and section information

### Related Endpoints

- `GET /api/reports/sales` - General sales report
- `GET /api/reports/inventory` - Inventory report
- `GET /api/orders` - List all orders
