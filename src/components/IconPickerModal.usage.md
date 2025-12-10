# IconPickerModal Component Usage

## Overview
The IconPickerModal component provides a user-friendly interface for selecting icons from the Lucide React icon library. It's specifically designed for the Cost Category Management feature.

## Features Implemented
✅ Modal interface with search functionality
✅ Grid display of commonly used cost category icons (100+ icons)
✅ Real-time icon filtering based on search term
✅ Visual preview of selected icon
✅ Responsive design with dark mode support
✅ RTL (Right-to-Left) support for Arabic interface
✅ Keyboard support (ESC to close)
✅ Hover effects and smooth transitions

## Props

```typescript
interface IconPickerModalProps {
  isOpen: boolean;           // Controls modal visibility
  onClose: () => void;       // Callback when modal is closed
  onSelect: (iconName: string) => void;  // Callback when icon is selected
  selectedIcon?: string;     // Currently selected icon (optional)
}
```

## Usage Example

```typescript
import { useState } from 'react';
import IconPickerModal from './components/IconPickerModal';

const CategoryForm = () => {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('DollarSign');

  const handleIconSelect = (iconName: string) => {
    setSelectedIcon(iconName);
    // Icon picker automatically closes after selection
  };

  return (
    <div>
      <button onClick={() => setShowIconPicker(true)}>
        اختر أيقونة
      </button>

      <IconPickerModal
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        onSelect={handleIconSelect}
        selectedIcon={selectedIcon}
      />
    </div>
  );
};
```

## Icon Categories Included

The component includes 100+ commonly used icons organized by category:

### Financial Icons
- DollarSign, CreditCard, Wallet, Receipt, ShoppingCart

### Business Icons
- Briefcase, Building, Users, Target, TrendingUp

### Utilities Icons
- Home, Zap, Wrench, Tool, Hammer

### Transportation Icons
- Car, Truck, Fuel

### Technology Icons
- Monitor, Smartphone, Laptop, Server, Database

### Communication Icons
- Phone, Mail, Wifi, Bell

### Office Icons
- FileText, Clipboard, Calendar, Folder

### And many more...

## Search Functionality

The search input filters icons in real-time as you type. The search is case-insensitive and matches against icon names.

Example searches:
- "dollar" → Shows DollarSign
- "card" → Shows CreditCard
- "home" → Shows Home
- "phone" → Shows Phone, Smartphone

## Styling

The component uses Tailwind CSS classes and follows the existing design system:
- Supports dark mode
- RTL layout for Arabic
- Responsive grid (6 columns on mobile, 8 on tablet, 10 on desktop)
- Hover effects with scale animation
- Selected icon highlighted with blue ring

## Accessibility

- Keyboard navigation (ESC to close)
- Focus management (search input auto-focused)
- Clear visual feedback for selected icon
- Tooltip showing icon name on hover

## Requirements Validation

This component satisfies the following requirements:

✅ **Requirement 1.5**: Icon selection from Lucide React library
✅ **Requirement 8.1**: Icon picker modal display
✅ **Requirement 8.2**: Commonly used icons for cost categories
✅ **Requirement 8.3**: Real-time icon search filtering
✅ **Requirement 8.4**: Immediate preview update on selection

## Integration Points

This component is designed to be used in:
1. **CategoryManagerModal** - For creating/editing cost categories
2. **Cost Category Management** - Part of the costs management enhancement feature

## Default Icon

If no icon is selected, the system uses "DollarSign" as the default icon (as per Requirement 8.5).
