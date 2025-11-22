# المهام بعد الترحيل (Post-Migration Tasks)

بعد نجاح ترحيل البيانات من `tableNumber` إلى `table` ObjectId، يجب تحديث الكود لاستخدام النظام الجديد.

## ✅ Checklist

- [ ] 1. تحديث Models
- [ ] 2. تحديث Controllers
- [ ] 3. تحديث Routes & Validation
- [ ] 4. تحديث Frontend Types
- [ ] 5. تحديث Frontend Components
- [ ] 6. تحديث API Calls
- [ ] 7. إضافة Indexes
- [ ] 8. اختبار شامل
- [ ] 9. حذف الكود القديم
- [ ] 10. توثيق التغييرات

---

## 1️⃣ تحديث Models

### Bill.js
```javascript
// ❌ حذف
tableNumber: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
}

// ✅ إضافة
table: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Table",
    default: null,
}

// ✅ تحديث Index
billSchema.index({ organization: 1, table: 1, createdAt: -1 });
```

### Order.js
```javascript
// ❌ حذف
tableNumber: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
}

// ✅ إضافة
table: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Table",
    default: null,
}

// ✅ تحديث Index
orderSchema.index({ organization: 1, table: 1, createdAt: -1 });
```

---

## 2️⃣ تحديث Controllers

### billController.js

#### Create Bill
```javascript
// ❌ قبل
const bill = new Bill({
    tableNumber: req.body.tableNumber,
    // ...
});

// ✅ بعد
const bill = new Bill({
    table: req.body.tableId,  // من Frontend
    // ...
});
```

#### Get Bills
```javascript
// ❌ قبل
const bills = await Bill.find({ organization: orgId })
    .sort({ createdAt: -1 });

// ✅ بعد
const bills = await Bill.find({ organization: orgId })
    .populate('table')  // ✅ populate table data
    .sort({ createdAt: -1 });
```

#### Get Bill by ID
```javascript
// ❌ قبل
const bill = await Bill.findById(billId);

// ✅ بعد
const bill = await Bill.findById(billId)
    .populate('table')
    .populate('orders')
    .populate('sessions');
```

#### Filter by Table
```javascript
// ❌ قبل
const bills = await Bill.find({ 
    tableNumber: tableNumber,
    organization: orgId 
});

// ✅ بعد
const bills = await Bill.find({ 
    table: tableId,  // ObjectId
    organization: orgId 
}).populate('table');
```

### orderController.js

#### Create Order
```javascript
// ❌ قبل
const order = new Order({
    tableNumber: req.body.tableNumber,
    // ...
});

// ✅ بعد
const order = new Order({
    table: req.body.tableId,
    // ...
});
```

#### Get Orders
```javascript
// ❌ قبل
const orders = await Order.find({ organization: orgId })
    .sort({ createdAt: -1 });

// ✅ بعد
const orders = await Order.find({ organization: orgId })
    .populate('table')
    .sort({ createdAt: -1 });
```

### reportController.js

#### Sales by Table
```javascript
// ❌ قبل
const salesByTable = await Bill.aggregate([
    { $match: { organization: orgId } },
    { $group: {
        _id: "$tableNumber",
        total: { $sum: "$total" }
    }}
]);

// ✅ بعد
const salesByTable = await Bill.aggregate([
    { $match: { organization: orgId } },
    { $lookup: {
        from: "tables",
        localField: "table",
        foreignField: "_id",
        as: "tableData"
    }},
    { $unwind: { path: "$tableData", preserveNullAndEmptyArrays: true } },
    { $group: {
        _id: "$table",
        tableNumber: { $first: "$tableData.number" },
        total: { $sum: "$total" },
        count: { $sum: 1 }
    }}
]);
```

---

## 3️⃣ تحديث Routes & Validation

### billRoutes.js
```javascript
// ✅ تحديث validation
router.post(
    "/",
    auth,
    [
        body("tableId")
            .optional()
            .isMongoId()
            .withMessage("معرف الطاولة غير صحيح"),
        // ...
    ],
    billController.createBill
);
```

### orderRoutes.js
```javascript
// ✅ تحديث validation
router.post(
    "/",
    auth,
    [
        body("tableId")
            .optional()
            .isMongoId()
            .withMessage("معرف الطاولة غير صحيح"),
        // ...
    ],
    orderController.createOrder
);
```

---

## 4️⃣ تحديث Frontend Types

### src/types/index.ts
```typescript
// ✅ إضافة Table interface
export interface Table {
  _id: string;
  number: string | number;
  section: {
    _id: string;
    name: string;
    arabicName?: string;
  };
  organization: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ✅ تحديث Bill interface
export interface Bill {
  _id: string;
  billNumber: string;
  table?: Table;  // ✅ بدل tableNumber
  customerName?: string;
  // ...
}

// ✅ تحديث Order interface
export interface Order {
  _id: string;
  orderNumber: string;
  table?: Table;  // ✅ بدل tableNumber
  customerName?: string;
  // ...
}
```

---

## 5️⃣ تحديث Frontend Components

### Cafe.tsx
```typescript
// ❌ قبل
const createOrder = async (orderData: {
  tableNumber?: string;
  // ...
}) => {
  await api.post('/orders', orderData);
};

// ✅ بعد
const createOrder = async (orderData: {
  tableId?: string;  // ObjectId
  // ...
}) => {
  await api.post('/orders', orderData);
};

// ✅ عرض الطاولة
<div>
  الطاولة: {order.table?.number}
  القسم: {order.table?.section?.name}
</div>
```

### Bills.tsx
```typescript
// ❌ قبل
<Table.Column
  title="الطاولة"
  dataIndex="tableNumber"
  key="tableNumber"
/>

// ✅ بعد
<Table.Column
  title="الطاولة"
  key="table"
  render={(_, record: Bill) => (
    <span>
      {record.table?.number || '-'}
      {record.table?.section && (
        <span className="text-gray-500 text-sm">
          {' '}({record.table.section.name})
        </span>
      )}
    </span>
  )}
/>
```

### BillModal.tsx
```typescript
// ❌ قبل
const [tableNumber, setTableNumber] = useState<string>('');

// ✅ بعد
const [selectedTable, setSelectedTable] = useState<Table | null>(null);

// ✅ في الـ form
<Select
  value={selectedTable?._id}
  onChange={(value) => {
    const table = tables.find(t => t._id === value);
    setSelectedTable(table || null);
  }}
>
  {tables.map(table => (
    <Select.Option key={table._id} value={table._id}>
      {table.number} - {table.section.name}
    </Select.Option>
  ))}
</Select>

// ✅ عند الحفظ
const billData = {
  tableId: selectedTable?._id,
  // ...
};
```

---

## 6️⃣ تحديث API Calls

### src/services/api.ts
```typescript
// ✅ تحديث API calls
export const createBill = (data: {
  tableId?: string;  // بدل tableNumber
  // ...
}) => api.post('/bills', data);

export const createOrder = (data: {
  tableId?: string;  // بدل tableNumber
  // ...
}) => api.post('/orders', data);

// ✅ Filter by table
export const getBillsByTable = (tableId: string) => 
  api.get(`/bills?tableId=${tableId}`);
```

---

## 7️⃣ إضافة Indexes

### في MongoDB
```javascript
// Bill collection
db.bills.createIndex({ table: 1, organization: 1 });
db.bills.createIndex({ table: 1, status: 1 });

// Order collection
db.orders.createIndex({ table: 1, organization: 1 });
db.orders.createIndex({ table: 1, status: 1 });

// ❌ حذف indexes القديمة
db.bills.dropIndex({ tableNumber: 1, organization: 1 });
db.orders.dropIndex({ tableNumber: 1, organization: 1 });
```

---

## 8️⃣ اختبار شامل

### Backend Tests
```javascript
describe('Bill API with Table Reference', () => {
  it('should create bill with table reference', async () => {
    const table = await Table.create({...});
    const bill = await Bill.create({
      table: table._id,
      // ...
    });
    expect(bill.table).toBeDefined();
  });

  it('should populate table data', async () => {
    const bill = await Bill.findById(billId).populate('table');
    expect(bill.table.number).toBe('A1');
  });
});
```

### Frontend Tests
```typescript
describe('Cafe Component', () => {
  it('should display table number and section', () => {
    const order = {
      table: {
        number: 'A1',
        section: { name: 'داخلي' }
      }
    };
    // test rendering
  });
});
```

### Manual Testing
- [ ] إنشاء فاتورة جديدة مع طاولة
- [ ] إنشاء طلب جديد مع طاولة
- [ ] عرض الفواتير والطلبات
- [ ] تصفية حسب الطاولة
- [ ] التقارير تعمل بشكل صحيح
- [ ] عرض بيانات الطاولة في كل مكان

---

## 9️⃣ حذف الكود القديم

### Backend
```bash
# البحث عن كل المراجع لـ tableNumber
grep -r "tableNumber" server/
```

### Frontend
```bash
# البحث عن كل المراجع لـ tableNumber
grep -r "tableNumber" src/
```

### حذف:
- [ ] كل المراجع لـ `tableNumber` في Models
- [ ] كل المراجع لـ `tableNumber` في Controllers
- [ ] كل المراجع لـ `tableNumber` في Validation
- [ ] كل المراجع لـ `tableNumber` في Frontend Types
- [ ] كل المراجع لـ `tableNumber` في Components

---

## 🔟 توثيق التغييرات

### CHANGELOG.md
```markdown
## [2.0.0] - 2024-11-20

### Changed
- **BREAKING:** Migrated from `tableNumber` to `table` ObjectId references
- Updated Bill and Order models to use table references
- Updated all API endpoints to accept `tableId` instead of `tableNumber`
- Updated frontend to use table objects instead of table numbers

### Migration
- Run `npm run migrate:tables` to migrate existing data
- See `TABLE_MIGRATION_GUIDE.md` for details
```

### API Documentation
```markdown
## Create Bill

**POST** `/api/bills`

**Body:**
```json
{
  "tableId": "673d9876543210fedcba4321",  // ObjectId (changed from tableNumber)
  "customerName": "أحمد محمد",
  // ...
}
```

**Response:**
```json
{
  "_id": "...",
  "table": {
    "_id": "673d9876543210fedcba4321",
    "number": "A1",
    "section": {
      "_id": "...",
      "name": "داخلي"
    }
  },
  // ...
}
```
```

---

## 📋 Final Checklist

قبل إطلاق التحديث للـ production:

- [ ] ✅ تم ترحيل البيانات بنجاح
- [ ] ✅ تم تحديث كل Models
- [ ] ✅ تم تحديث كل Controllers
- [ ] ✅ تم تحديث كل Routes & Validation
- [ ] ✅ تم تحديث Frontend Types
- [ ] ✅ تم تحديث Frontend Components
- [ ] ✅ تم تحديث API Calls
- [ ] ✅ تم إضافة Indexes الجديدة
- [ ] ✅ تم حذف Indexes القديمة
- [ ] ✅ تم اختبار كل الوظائف
- [ ] ✅ تم حذف الكود القديم
- [ ] ✅ تم توثيق التغييرات
- [ ] ✅ تم عمل نسخة احتياطية نهائية

---

## 🚀 الإطلاق

### Development
```bash
npm run dev
```

### Production
```bash
# 1. Backup
mongodump --uri="$MONGODB_URI" --out=./backup-production

# 2. Migrate
npm run migrate:tables

# 3. Deploy
npm run build:all
pm2 restart all
```

---

## 🆘 Rollback Plan

إذا حدثت مشكلة:

```bash
# 1. Stop application
pm2 stop all

# 2. Restore database
mongorestore --uri="$MONGODB_URI" --drop ./backup-production/bomba

# 3. Revert code
git revert <commit-hash>

# 4. Restart
pm2 start all
```

---

## ✨ النتيجة النهائية

بعد إكمال كل المهام:
- ✅ نظام أكثر أماناً وأداءً
- ✅ كود أنظف وأسهل في الصيانة
- ✅ queries أسرع وأكثر مرونة
- ✅ data integrity كاملة

**النظام جاهز للمستقبل! 🎉**
