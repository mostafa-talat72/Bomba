# CostFormModal Component Usage

## Overview
The `CostFormModal` component provides a comprehensive form for creating and editing cost entries in the Bomba cost management system. It includes all required fields with validation, automatic remaining amount calculation, and visual feedback for payment status.

## Features

### Core Functionality
- ✅ Create new cost entries
- ✅ Edit existing cost entries
- ✅ Category selection with icon and color display
- ✅ Automatic remaining amount calculation
- ✅ Payment status visual feedback
- ✅ Date and due date pickers
- ✅ Payment method selection
- ✅ Vendor and notes fields
- ✅ Form validation

### Requirements Implemented
- **Requirement 2.1**: All required fields (category, description, amount, date)
- **Requirement 2.2**: Calculated remainingAmount display (amount - paidAmount)
- **Requirement 2.3**: Visual feedback for payment status changes

## Props

```typescript
interface CostFormModalProps {
  isOpen: boolean;           // Controls modal visibility
  onClose: () => void;       // Called when modal is closed
  onSave: () => void;        // Called after successful save
  editingCost?: Cost | null; // Cost to edit (null for new cost)
  categories: CostCategory[]; // Available cost categories
}
```

## Usage Example

```tsx
import { useState } from 'react';
import CostFormModal from '../components/CostFormModal';

function CostsPage() {
  const [showCostModal, setShowCostModal] = useState(false);
  const [editingCost, setEditingCost] = useState<Cost | null>(null);
  const [categories, setCategories] = useState<CostCategory[]>([]);

  const handleAddNew = () => {
    setEditingCost(null);
    setShowCostModal(true);
  };

  const handleEdit = (cost: Cost) => {
    setEditingCost(cost);
    setShowCostModal(true);
  };

  const handleSave = () => {
    // Refresh costs list
    fetchCosts();
    setShowCostModal(false);
    setEditingCost(null);
  };

  return (
    <>
      <button onClick={handleAddNew}>إضافة تكلفة</button>
      
      <CostFormModal
        isOpen={showCostModal}
        onClose={() => {
          setShowCostModal(false);
          setEditingCost(null);
        }}
        onSave={handleSave}
        editingCost={editingCost}
        categories={categories}
      />
    </>
  );
}
```

## Form Fields

### Required Fields
1. **القسم (Category)** - Dropdown with icon and color display
2. **الوصف (Description)** - Text input for cost description
3. **المبلغ الإجمالي (Total Amount)** - Number input (min: 0)
4. **التاريخ (Date)** - Date picker

### Optional Fields
1. **المبلغ المدفوع (Paid Amount)** - Number input (0 to total amount)
2. **تاريخ الاستحقاق (Due Date)** - Date picker
3. **طريقة الدفع (Payment Method)** - Dropdown (cash, card, transfer, check)
4. **المورد (Vendor)** - Text input
5. **ملاحظات (Notes)** - Textarea

## Automatic Calculations

### Remaining Amount
The component automatically calculates and displays the remaining amount:
```
remainingAmount = amount - paidAmount
```

The remaining amount is displayed in a highlighted box with visual feedback:
- Shows the calculated value in real-time
- Updates as user changes amount or paidAmount
- Cannot be negative (minimum is 0)

### Payment Status Feedback
The form provides visual feedback about the automatic status that will be set:

1. **Fully Paid** (paidAmount >= amount)
   - Green message: "سيتم تحديث حالة الدفع تلقائياً إلى 'مدفوع'"

2. **Partially Paid** (0 < paidAmount < amount)
   - Blue message: "سيتم تحديث حالة الدفع تلقائياً إلى 'مدفوع جزئياً'"

3. **Pending** (paidAmount = 0)
   - No message (default state)

## Validation Rules

1. **Category**: Must be selected
2. **Description**: Cannot be empty
3. **Amount**: Must be greater than 0
4. **Paid Amount**: 
   - Cannot be negative
   - Cannot exceed total amount
5. **Date**: Required field

## API Integration

### Create New Cost
```typescript
POST /api/costs
Body: {
  category: string,
  description: string,
  amount: number,
  paidAmount: number,
  date: string,
  dueDate?: string,
  paymentMethod: string,
  vendor?: string,
  notes?: string
}
```

### Update Existing Cost
```typescript
PUT /api/costs/:id
Body: {
  category: string,
  description: string,
  amount: number,
  paidAmount: number,
  date: string,
  dueDate?: string,
  paymentMethod: string,
  vendor?: string,
  notes?: string
}
```

## Category Display

When a category is selected, the form displays:
- Category icon with the category's color
- Icon appears on the left side of the dropdown
- Icon background uses 20% opacity of the category color

## User Experience Features

### Loading States
- Submit button shows "جاري الحفظ..." during save
- Submit button is disabled during save operation
- Cancel button is disabled during save operation

### Success Notifications
- "تم إضافة التكلفة بنجاح" for new costs
- "تم تحديث التكلفة بنجاح" for updates

### Error Handling
- Validation errors show specific messages
- API errors display server error messages
- All errors use the notification system

### Form Reset
- Form resets when switching between create/edit modes
- Form resets when modal is closed
- Default values are set for new costs

## Styling

The component uses:
- Tailwind CSS for styling
- Dark mode support
- RTL (right-to-left) layout for Arabic
- Responsive design (mobile-friendly)
- Focus states for accessibility
- Hover effects for interactive elements

## Accessibility

- All form fields have proper labels
- Required fields are marked with red asterisk
- Form uses semantic HTML
- Keyboard navigation supported
- ESC key closes modal (inherited from Modal component)
- Click outside closes modal (inherited from Modal component)

## Dependencies

- `react`: Core React library
- `lucide-react`: Icon library
- `Modal`: Base modal component
- `api`: API service for HTTP requests
- `useApp`: Context hook for notifications

## Notes

- The component automatically handles date formatting (ISO to input format)
- Category can be either a string ID or a populated object
- The status field is not editable - it's calculated automatically by the backend
- Due date is optional and can be left empty
- Vendor and notes are optional fields
