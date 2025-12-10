# CategoryManagerModal Component

## Overview

The `CategoryManagerModal` component provides a comprehensive interface for managing cost categories in the Bomba application. It allows users to create, edit, and delete cost categories with custom icons, colors, and descriptions.

## Features

- **Create Categories**: Add new cost categories with custom properties
- **Edit Categories**: Update existing category details
- **Delete Categories**: Remove categories (with protection for categories that have associated costs)
- **Icon Selection**: Choose from a wide range of Lucide React icons via the integrated IconPickerModal
- **Color Customization**: Select custom colors using a color picker
- **Sort Order**: Define the display order of categories
- **Real-time Updates**: Automatically refreshes the category list after changes

## Props

```typescript
interface CategoryManagerModalProps {
  isOpen: boolean;           // Controls modal visibility
  onClose: () => void;       // Callback when modal is closed
  onSave: () => void;        // Callback after successful save/delete operations
}
```

## Usage Example

```tsx
import { useState } from 'react';
import CategoryManagerModal from '../components/CategoryManagerModal';

const CostsPage = () => {
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const handleCategorySave = () => {
    // Refresh costs and categories after changes
    fetchCategories();
    fetchCosts();
  };

  return (
    <div>
      <button onClick={() => setShowCategoryModal(true)}>
        إدارة الأقسام
      </button>

      <CategoryManagerModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSave={handleCategorySave}
      />
    </div>
  );
};
```

## Category Data Structure

```typescript
interface CostCategory {
  _id: string;
  name: string;
  icon: string;              // Lucide icon name (e.g., 'DollarSign')
  color: string;             // Hex color code (e.g., '#3B82F6')
  description?: string;
  isActive: boolean;
  sortOrder: number;
}
```

## Form Fields

### Required Fields
- **Name**: Category name (e.g., "رواتب", "إيجار", "صيانة")

### Optional Fields
- **Icon**: Lucide React icon (default: 'DollarSign')
- **Color**: Hex color code (default: '#3B82F6')
- **Description**: Brief description of the category
- **Sort Order**: Display order (default: 0, lower numbers appear first)

## API Integration

The component integrates with the following backend endpoints:

- `GET /api/cost-categories` - Fetch all categories
- `POST /api/cost-categories` - Create new category
- `PUT /api/cost-categories/:id` - Update existing category
- `DELETE /api/cost-categories/:id` - Delete category

## Validation

### Client-side Validation
- Name field is required
- Name must not be empty or whitespace only

### Server-side Validation
- Category names must be unique within an organization
- Categories with associated costs cannot be deleted
- Returns appropriate error messages for validation failures

## Error Handling

The component handles various error scenarios:

1. **Duplicate Name**: Shows error message when trying to create/update with an existing name
2. **Delete Protection**: Prevents deletion of categories with associated costs and displays the count
3. **Network Errors**: Displays user-friendly error messages for API failures

## Features in Detail

### Creating a Category

1. Click "إضافة قسم جديد" button
2. Fill in the category name (required)
3. Click the icon button to open IconPickerModal
4. Select a color using the color picker
5. Optionally add a description and sort order
6. Click "حفظ" to save

### Editing a Category

1. Click the edit icon (✏️) next to a category
2. Modify the desired fields
3. Click "حفظ" to update

### Deleting a Category

1. Click the delete icon (🗑️) next to a category
2. Confirm the deletion in the dialog
3. If the category has associated costs, deletion will be prevented with an error message

## Styling

The component uses Tailwind CSS with dark mode support:
- Responsive design (mobile-friendly)
- Smooth transitions and hover effects
- Color-coded category previews
- Loading states for async operations

## Dependencies

- React
- Lucide React (for icons)
- Modal component
- IconPickerModal component
- API service
- AppContext (for notifications)

## Notes

- Categories are sorted by `sortOrder` (ascending) then by `name` (alphabetically)
- The default icon is 'DollarSign' if none is selected
- The default color is '#3B82F6' (blue)
- All operations trigger the `onSave` callback for parent component updates
- The component automatically resets the form when closed or after successful operations
