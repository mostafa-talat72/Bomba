# Design Document

## Overview

This design document outlines the enhancement of the Costs Management System in the Bomba application. The system will provide dynamic cost category management with custom icons and colors, improved user interface with real-time filtering, automatic payment status management, and seamless synchronization between local and Atlas MongoDB databases.

The enhancement focuses on three main areas:
1. **Backend Improvements**: Enhanced API endpoints, automatic status calculation, and dual database sync
2. **Frontend Enhancements**: Improved UI/UX with icon picker, color customization, and real-time filtering
3. **Data Synchronization**: Ensuring all cost and category operations sync properly between databases

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Costs Page   │  │ Category     │  │ Icon Picker  │      │
│  │              │  │ Manager      │  │ Modal        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Cost         │  │ Category     │  │ Sync         │      │
│  │ Controller   │  │ Controller   │  │ Middleware   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Mongoose ODM
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                            │
│  ┌──────────────┐                    ┌──────────────┐       │
│  │ Local        │◄──── Sync ────────►│ Atlas        │       │
│  │ MongoDB      │                    │ MongoDB      │       │
│  └──────────────┘                    └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Cost Creation Flow**:
   - User fills cost form → Frontend validates → API request → Controller validates
   - Controller creates cost in Local MongoDB → Sync middleware triggers
   - Sync worker queues operation → Worker syncs to Atlas MongoDB
   - Response sent to frontend → UI updates

2. **Category Management Flow**:
   - User creates/updates category → API request → Controller validates uniqueness
   - Controller saves to Local MongoDB → Sync middleware triggers
   - Sync worker syncs to Atlas → Response sent → UI updates

3. **Status Automation Flow**:
   - Cost saved → Pre-save hook executes → Calculate remainingAmount
   - Check payment conditions → Update status automatically
   - Check due date → Update to overdue if needed → Save to database

## Components and Interfaces

### Backend Components

#### 1. Cost Model Enhancement

```javascript
// server/models/Cost.js
const costSchema = new mongoose.Schema({
  category: { type: ObjectId, ref: 'CostCategory', required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  remainingAmount: { type: Number, default: 0, min: 0 },
  date: { type: Date, required: true, default: Date.now },
  dueDate: { type: Date, default: null },
  status: { 
    type: String, 
    enum: ['pending', 'paid', 'partially_paid', 'overdue', 'cancelled'],
    default: 'pending' 
  },
  paymentMethod: { 
    type: String, 
    enum: ['cash', 'card', 'transfer', 'check'],
    default: 'cash' 
  },
  vendor: { type: String },
  notes: { type: String },
  organization: { type: ObjectId, ref: 'Organization', required: true },
  createdBy: { type: ObjectId, ref: 'User', required: true }
});

// Pre-save hook for automatic status calculation
costSchema.pre('save', function(next) {
  // Calculate remaining amount
  this.remainingAmount = Math.max(0, this.amount - this.paidAmount);
  
  // Auto-update status based on payment
  if (this.paidAmount >= this.amount) {
    this.status = 'paid';
    this.remainingAmount = 0;
  } else if (this.paidAmount > 0) {
    this.status = 'partially_paid';
  } else if (this.dueDate && this.dueDate < new Date()) {
    this.status = 'overdue';
  } else {
    this.status = 'pending';
  }
  
  next();
});
```

#### 2. Cost Category Model

```javascript
// server/models/CostCategory.js
const costCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  icon: { type: String, required: true, default: 'DollarSign' },
  color: { type: String, default: '#3B82F6' },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  organization: { type: ObjectId, ref: 'Organization', required: true },
  createdBy: { type: ObjectId, ref: 'User', required: true }
});

// Unique index for name per organization
costCategorySchema.index({ organization: 1, name: 1 }, { unique: true });
```

#### 3. Cost Controller API

```javascript
// server/controllers/costController.js

// GET /api/costs - Get all costs with filtering
export const getCosts = async (req, res) => {
  const { category, status, startDate, endDate, vendor, search } = req.query;
  
  const query = { organization: req.user.organization };
  if (category) query.category = category;
  if (status && status !== 'all') query.status = status;
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }
  if (vendor) query.vendor = { $regex: vendor, $options: 'i' };
  if (search) {
    query.$or = [
      { description: { $regex: search, $options: 'i' } },
      { vendor: { $regex: search, $options: 'i' } }
    ];
  }
  
  const costs = await Cost.find(query)
    .populate('category', 'name icon color')
    .sort({ date: -1 });
    
  res.json({ success: true, data: costs });
};

// POST /api/costs - Create new cost
export const createCost = async (req, res) => {
  const cost = await Cost.create({
    ...req.body,
    organization: req.user.organization,
    createdBy: req.user._id
  });
  
  res.status(201).json({ success: true, data: cost });
};

// PUT /api/costs/:id - Update cost
export const updateCost = async (req, res) => {
  const cost = await Cost.findOneAndUpdate(
    { _id: req.params.id, organization: req.user.organization },
    req.body,
    { new: true, runValidators: true }
  );
  
  res.json({ success: true, data: cost });
};

// POST /api/costs/:id/payment - Add payment
export const addPayment = async (req, res) => {
  const { paymentAmount, paymentMethod } = req.body;
  const cost = await Cost.findOne({
    _id: req.params.id,
    organization: req.user.organization
  });
  
  cost.paidAmount += paymentAmount;
  cost.paymentMethod = paymentMethod;
  await cost.save(); // Triggers pre-save hook for status update
  
  res.json({ success: true, data: cost });
};
```

#### 4. Cost Category Controller API

```javascript
// server/controllers/costCategoryController.js

// GET /api/cost-categories - Get all categories
export const getCostCategories = async (req, res) => {
  const categories = await CostCategory.find({
    organization: req.user.organization
  }).sort({ sortOrder: 1, name: 1 });
  
  res.json({ success: true, data: categories });
};

// POST /api/cost-categories - Create category
export const createCostCategory = async (req, res) => {
  // Check for duplicate name
  const existing = await CostCategory.findOne({
    name: req.body.name.trim(),
    organization: req.user.organization
  });
  
  if (existing) {
    return res.status(400).json({
      success: false,
      message: 'يوجد قسم بنفس الاسم بالفعل'
    });
  }
  
  const category = await CostCategory.create({
    ...req.body,
    organization: req.user.organization,
    createdBy: req.user._id
  });
  
  res.status(201).json({ success: true, data: category });
};

// PUT /api/cost-categories/:id - Update category
export const updateCostCategory = async (req, res) => {
  const category = await CostCategory.findOneAndUpdate(
    { _id: req.params.id, organization: req.user.organization },
    req.body,
    { new: true, runValidators: true }
  );
  
  res.json({ success: true, data: category });
};

// DELETE /api/cost-categories/:id - Delete category
export const deleteCostCategory = async (req, res) => {
  // Check if category has costs
  const costsCount = await Cost.countDocuments({
    category: req.params.id,
    organization: req.user.organization
  });
  
  if (costsCount > 0) {
    return res.status(400).json({
      success: false,
      message: `لا يمكن حذف القسم لأنه يحتوي على ${costsCount} تكلفة`
    });
  }
  
  await CostCategory.findOneAndDelete({
    _id: req.params.id,
    organization: req.user.organization
  });
  
  res.json({ success: true, message: 'تم حذف القسم بنجاح' });
};
```

### Frontend Components

#### 1. Costs Page Component

```typescript
// src/pages/Costs.tsx

interface CostsPageState {
  costs: Cost[];
  categories: CostCategory[];
  selectedCategory: string | null;
  selectedStatus: string;
  searchTerm: string;
  loading: boolean;
  stats: {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
  };
}

const CostsPage = () => {
  // State management
  const [state, setState] = useState<CostsPageState>({...});
  
  // Fetch costs with filters
  const fetchCosts = async () => {
    const params = {
      category: selectedCategory,
      status: selectedStatus,
      search: searchTerm
    };
    const response = await api.get('/costs', { params });
    setCosts(response.data.data);
    calculateStats(response.data.data);
  };
  
  // Real-time filtering
  useEffect(() => {
    fetchCosts();
  }, [selectedCategory, selectedStatus]);
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCosts();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  return (
    <div className="costs-page">
      <StatisticsCards stats={stats} />
      <CategoryFilter 
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />
      <CostsTable 
        costs={filteredCosts}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};
```

#### 2. Category Manager Modal

```typescript
// src/components/CategoryManagerModal.tsx

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: CostCategory) => void;
  editingCategory?: CostCategory | null;
}

const CategoryManagerModal = ({ isOpen, onClose, onSave, editingCategory }: CategoryManagerProps) => {
  const [formData, setFormData] = useState({
    name: '',
    icon: 'DollarSign',
    color: '#3B82F6',
    description: '',
    sortOrder: 0
  });
  
  const [showIconPicker, setShowIconPicker] = useState(false);
  
  const handleSubmit = async () => {
    if (editingCategory) {
      await api.put(`/cost-categories/${editingCategory._id}`, formData);
    } else {
      await api.post('/cost-categories', formData);
    }
    onSave();
    onClose();
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="category-form">
        <input
          type="text"
          placeholder="اسم القسم"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
        />
        
        <div className="icon-color-picker">
          <button onClick={() => setShowIconPicker(true)}>
            <Icon name={formData.icon} color={formData.color} />
            اختر أيقونة
          </button>
          
          <input
            type="color"
            value={formData.color}
            onChange={(e) => setFormData({...formData, color: e.target.value})}
          />
        </div>
        
        <textarea
          placeholder="الوصف (اختياري)"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
        />
        
        <button onClick={handleSubmit}>حفظ</button>
      </div>
      
      {showIconPicker && (
        <IconPickerModal
          onSelect={(icon) => {
            setFormData({...formData, icon});
            setShowIconPicker(false);
          }}
          onClose={() => setShowIconPicker(false)}
        />
      )}
    </Modal>
  );
};
```

#### 3. Icon Picker Modal

```typescript
// src/components/IconPickerModal.tsx

const COST_ICONS = [
  'DollarSign', 'CreditCard', 'Wallet', 'Receipt', 'ShoppingCart',
  'Home', 'Zap', 'Wrench', 'Users', 'Truck', 'Package',
  'Coffee', 'Utensils', 'Wifi', 'Phone', 'Mail', 'FileText'
];

interface IconPickerModalProps {
  onSelect: (icon: string) => void;
  onClose: () => void;
}

const IconPickerModal = ({ onSelect, onClose }: IconPickerModalProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredIcons = COST_ICONS.filter(icon =>
    icon.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <Modal isOpen onClose={onClose}>
      <div className="icon-picker">
        <input
          type="text"
          placeholder="ابحث عن أيقونة..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        
        <div className="icon-grid">
          {filteredIcons.map(iconName => {
            const Icon = LucideIcons[iconName];
            return (
              <button
                key={iconName}
                onClick={() => onSelect(iconName)}
                className="icon-button"
              >
                <Icon className="w-6 h-6" />
                <span>{iconName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
```

#### 4. Cost Form Modal

```typescript
// src/components/CostFormModal.tsx

interface CostFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingCost?: Cost | null;
  categories: CostCategory[];
}

const CostFormModal = ({ isOpen, onClose, onSave, editingCost, categories }: CostFormProps) => {
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    amount: 0,
    paidAmount: 0,
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    status: 'pending',
    paymentMethod: 'cash',
    vendor: '',
    notes: ''
  });
  
  const handleSubmit = async () => {
    if (editingCost) {
      await api.put(`/costs/${editingCost._id}`, formData);
    } else {
      await api.post('/costs', formData);
    }
    onSave();
    onClose();
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="cost-form">
        <select
          value={formData.category}
          onChange={(e) => setFormData({...formData, category: e.target.value})}
          required
        >
          <option value="">اختر القسم</option>
          {categories.map(cat => (
            <option key={cat._id} value={cat._id}>{cat.name}</option>
          ))}
        </select>
        
        <input
          type="text"
          placeholder="الوصف"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          required
        />
        
        <input
          type="number"
          placeholder="المبلغ"
          value={formData.amount}
          onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
          required
        />
        
        <input
          type="number"
          placeholder="المبلغ المدفوع"
          value={formData.paidAmount}
          onChange={(e) => setFormData({...formData, paidAmount: parseFloat(e.target.value)})}
        />
        
        <input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({...formData, date: e.target.value})}
          required
        />
        
        <input
          type="date"
          placeholder="تاريخ الاستحقاق (اختياري)"
          value={formData.dueDate}
          onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
        />
        
        <select
          value={formData.paymentMethod}
          onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
        >
          <option value="cash">نقدي</option>
          <option value="card">بطاقة</option>
          <option value="transfer">تحويل</option>
          <option value="check">شيك</option>
        </select>
        
        <input
          type="text"
          placeholder="المورد (اختياري)"
          value={formData.vendor}
          onChange={(e) => setFormData({...formData, vendor: e.target.value})}
        />
        
        <textarea
          placeholder="ملاحظات (اختياري)"
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
        />
        
        <button onClick={handleSubmit}>حفظ</button>
      </div>
    </Modal>
  );
};
```

## Data Models

### Cost Category Model

```typescript
interface CostCategory {
  _id: string;
  name: string;
  icon: string;              // Lucide icon name
  color: string;             // Hex color code
  description?: string;
  isActive: boolean;
  sortOrder: number;
  organization: string;      // ObjectId reference
  createdBy: string;         // ObjectId reference
  createdAt: Date;
  updatedAt: Date;
}
```

### Cost Model

```typescript
interface Cost {
  _id: string;
  category: CostCategory;    // Populated reference
  description: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;   // Calculated field
  date: Date;
  dueDate?: Date;
  status: 'pending' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
  paymentMethod: 'cash' | 'card' | 'transfer' | 'check';
  vendor?: string;
  notes?: string;
  organization: string;      // ObjectId reference
  createdBy: string;         // ObjectId reference
  createdAt: Date;
  updatedAt: Date;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After reviewing all testable properties from the prework analysis, I've identified the following consolidations to eliminate redundancy:

**Redundancies Identified:**
1. Properties 2.2, 2.3, 7.1, 7.2, 7.3, 7.4 all test status calculation logic - these can be combined into comprehensive status calculation properties
2. Properties 2.5 and 7.5 both test payment addition - can be combined
3. Properties 4.1, 4.2, 4.3, 4.4 all test sync consistency - can be consolidated into fewer comprehensive sync properties

**Consolidated Properties:**
- Status calculation properties (7.1-7.4) will be combined into two comprehensive properties: one for payment-based status and one for date-based status
- Sync properties (4.1-4.4) will be combined into two properties: one for create/update sync and one for delete sync
- Payment properties (2.5, 7.5) will be combined into one comprehensive payment addition property

### Correctness Properties

**Property 1: Category field persistence**
*For any* cost category created with name, icon, color, and description, retrieving that category should return all the same field values
**Validates: Requirements 1.1**

**Property 2: Category list ordering**
*For any* set of cost categories, when retrieved from the system, they should be sorted first by sortOrder (ascending) then by name (alphabetically)
**Validates: Requirements 1.2**

**Property 3: Category name uniqueness**
*For any* existing category in an organization, attempting to update another category to use the same name should be rejected by the system
**Validates: Requirements 1.3**

**Property 4: Category deletion protection**
*For any* category that has associated costs, attempting to delete that category should be prevented and return the count of associated costs
**Validates: Requirements 1.4**

**Property 5: Cost required fields validation**
*For any* cost creation attempt missing category, description, amount, or date fields, the system should reject the creation
**Validates: Requirements 2.1**

**Property 6: Remaining amount calculation**
*For any* cost entry, remainingAmount should always equal (amount - paidAmount), and should never be negative
**Validates: Requirements 2.2**

**Property 7: Payment-based status calculation**
*For any* cost entry where paidAmount >= amount, status should be "paid" and remainingAmount should be 0; where 0 < paidAmount < amount, status should be "partially_paid"; where paidAmount = 0 and no overdue condition exists, status should be "pending"
**Validates: Requirements 2.3, 7.1, 7.2, 7.4**

**Property 8: Date-based status calculation**
*For any* cost entry where paidAmount = 0 and dueDate is in the past, status should automatically be "overdue"
**Validates: Requirements 2.4, 7.3**

**Property 9: Payment addition maintains invariants**
*For any* cost entry, when a payment is added, the system should update paidAmount (increasing by payment amount), recalculate remainingAmount correctly, and update status according to payment-based status rules
**Validates: Requirements 2.5, 7.5**

**Property 10: Category creation sync consistency**
*For any* cost category created in the system, the category should exist with identical data in both Local MongoDB and Atlas MongoDB
**Validates: Requirements 4.1**

**Property 11: Cost operation sync consistency**
*For any* cost entry created or updated in the system, the cost should exist with identical data in both Local MongoDB and Atlas MongoDB
**Validates: Requirements 4.2**

**Property 12: Category deletion sync consistency**
*For any* cost category deleted from the system, the category should be removed from both Local MongoDB and Atlas MongoDB
**Validates: Requirements 4.3**

**Property 13: Cost deletion sync consistency**
*For any* cost entry deleted from the system, the cost should be removed from both Local MongoDB and Atlas MongoDB
**Validates: Requirements 4.4**

**Property 14: Category filter correctness**
*For any* category filter applied, all returned costs should belong to that category, and no costs from other categories should be returned
**Validates: Requirements 6.1**

**Property 15: Status filter correctness**
*For any* status filter applied, all returned costs should have that status, and no costs with other statuses should be returned
**Validates: Requirements 6.2**

**Property 16: Multiple filter combination**
*For any* combination of category and status filters applied, all returned costs should match both filter criteria (AND logic)
**Validates: Requirements 6.3**

**Property 17: Filter reset completeness**
*For any* filtered view, when all filters are cleared, the system should return all costs belonging to the organization
**Validates: Requirements 6.4**

**Property 18: Default icon assignment**
*For any* category created without specifying an icon, the system should assign "DollarSign" as the default icon value
**Validates: Requirements 8.5**

## Error Handling

### Backend Error Handling

1. **Validation Errors**
   - Missing required fields → 400 Bad Request with specific field errors
   - Invalid data types → 400 Bad Request with validation message
   - Duplicate category names → 400 Bad Request with conflict message

2. **Database Errors**
   - Local MongoDB connection failure → 500 Internal Server Error (critical)
   - Atlas MongoDB connection failure → Log warning, continue with local only
   - Sync queue full → Log error, reject operation with 503 Service Unavailable

3. **Business Logic Errors**
   - Delete category with costs → 400 Bad Request with cost count
   - Payment exceeds remaining amount → 400 Bad Request with limit message
   - Invalid status transition → 400 Bad Request with explanation

4. **Sync Errors**
   - Sync operation failure → Log error, add to retry queue
   - Max retries exceeded → Log critical error, alert admin
   - Data inconsistency detected → Log warning, trigger reconciliation

### Frontend Error Handling

1. **Network Errors**
   - API request timeout → Show retry dialog
   - Connection lost → Show offline indicator
   - Server error → Show user-friendly error message

2. **Validation Errors**
   - Form validation → Show inline error messages
   - Required fields → Highlight missing fields
   - Invalid format → Show format requirements

3. **User Feedback**
   - Success operations → Show success toast notification
   - Failed operations → Show error toast with retry option
   - Loading states → Show skeleton loaders or spinners

## Testing Strategy

### Unit Testing

**Backend Unit Tests:**
- Cost model pre-save hook logic
- Status calculation functions
- Payment addition method
- Category uniqueness validation
- Sync middleware integration

**Frontend Unit Tests:**
- Component rendering with different props
- Form validation logic
- Filter combination logic
- Icon picker search functionality
- Color picker integration

### Property-Based Testing

The system will use **fast-check** library for JavaScript/TypeScript property-based testing. Each property-based test will run a minimum of 100 iterations to ensure comprehensive coverage.

**Test Configuration:**
```typescript
import fc from 'fast-check';

// Configure test runs
const testConfig = {
  numRuns: 100,
  verbose: true
};
```

**Property Test Structure:**
Each property-based test must:
1. Be tagged with a comment referencing the design document property
2. Generate random valid inputs using fast-check arbitraries
3. Execute the operation under test
4. Assert the property holds for all generated inputs

**Example Property Test:**
```typescript
// Feature: costs-management-enhancement, Property 6: Remaining amount calculation
describe('Cost remaining amount calculation', () => {
  it('should always equal amount minus paidAmount', () => {
    fc.assert(
      fc.property(
        fc.record({
          amount: fc.float({ min: 0, max: 100000 }),
          paidAmount: fc.float({ min: 0, max: 100000 })
        }),
        async ({ amount, paidAmount }) => {
          const cost = await Cost.create({
            category: testCategory._id,
            description: 'Test cost',
            amount,
            paidAmount: Math.min(paidAmount, amount),
            organization: testOrg._id,
            createdBy: testUser._id
          });
          
          expect(cost.remainingAmount).toBe(
            Math.max(0, amount - Math.min(paidAmount, amount))
          );
        }
      ),
      testConfig
    );
  });
});
```

### Integration Testing

**API Integration Tests:**
- Complete CRUD operations for costs
- Complete CRUD operations for categories
- Filter combinations
- Payment addition flow
- Sync operations between databases

**Database Integration Tests:**
- Dual database sync verification
- Transaction rollback scenarios
- Connection failure recovery
- Data consistency checks

### End-to-End Testing

**User Workflows:**
- Create category → Create cost → Add payment → Verify status
- Filter costs by category and status
- Update category icon and color
- Delete empty category
- Attempt to delete category with costs

## Performance Considerations

### Backend Optimizations

1. **Database Indexing**
   ```javascript
   // Cost indexes
   costSchema.index({ organization: 1, category: 1 });
   costSchema.index({ organization: 1, status: 1 });
   costSchema.index({ organization: 1, date: -1 });
   
   // Category indexes
   costCategorySchema.index({ organization: 1, name: 1 }, { unique: true });
   costCategorySchema.index({ organization: 1, sortOrder: 1 });
   ```

2. **Query Optimization**
   - Use lean() for read-only queries
   - Populate only required fields
   - Implement pagination for large result sets
   - Cache frequently accessed categories

3. **Sync Optimization**
   - Batch sync operations
   - Use bulk write operations
   - Implement exponential backoff for retries
   - Queue management with priority levels

### Frontend Optimizations

1. **Rendering Performance**
   - Use React.memo for expensive components
   - Implement virtual scrolling for large lists
   - Debounce search input (300ms)
   - Lazy load modals and heavy components

2. **State Management**
   - Minimize re-renders with proper state structure
   - Use useCallback for event handlers
   - Implement optimistic UI updates
   - Cache API responses

3. **Network Optimization**
   - Implement request deduplication
   - Use SWR or React Query for caching
   - Compress API responses
   - Implement request cancellation

## Security Considerations

1. **Authentication & Authorization**
   - All API endpoints require valid JWT token
   - Verify organization ownership for all operations
   - Implement role-based access control

2. **Input Validation**
   - Sanitize all user inputs
   - Validate data types and ranges
   - Prevent SQL/NoSQL injection
   - Limit file upload sizes

3. **Data Protection**
   - Encrypt sensitive data at rest
   - Use HTTPS for all communications
   - Implement rate limiting
   - Log security events

## Deployment Considerations

1. **Environment Configuration**
   - Separate configs for development/production
   - Environment variables for sensitive data
   - Feature flags for gradual rollout

2. **Database Migration**
   - Create migration script for existing costs
   - Add default categories if none exist
   - Verify data integrity after migration
   - Backup before deployment

3. **Monitoring**
   - Track sync queue size and lag
   - Monitor API response times
   - Alert on sync failures
   - Log all critical operations

## Future Enhancements

1. **Advanced Features**
   - Recurring cost automation
   - Budget tracking and alerts
   - Cost forecasting
   - Multi-currency support
   - Attachment uploads

2. **Reporting**
   - Cost trends analysis
   - Category comparison charts
   - Export to Excel/PDF
   - Custom report builder

3. **Integration**
   - Accounting software integration
   - Bank statement import
   - Receipt OCR scanning
   - Email notifications
