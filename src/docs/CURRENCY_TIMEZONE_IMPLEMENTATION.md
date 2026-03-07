# Currency and Timezone Implementation Guide

## Overview
This document explains how currency and timezone settings work throughout the Bomba application.

## Architecture

### 1. Database Storage
Currency and timezone are stored in the Organization model:
```javascript
// server/models/Organization.js
{
  currency: {
    type: String,
    enum: ['EGP', 'SAR', 'AED', 'USD', 'EUR', 'GBP'],
    default: 'EGP'
  },
  timezone: {
    type: String,
    enum: ['Africa/Cairo', 'Asia/Riyadh', 'Asia/Dubai'],
    default: 'Africa/Cairo'
  }
}
```

### 2. Loading on Login
When a user logs in, settings are automatically loaded:

```typescript
// src/context/AppContext.tsx - loadAndApplySettings()
const loadAndApplySettings = async () => {
  // Load organization settings
  const orgResponse = await api.getOrganization();
  if (orgResponse.success && orgResponse.data) {
    const { currency, timezone } = orgResponse.data;
    
    // Store in localStorage for fast access
    if (currency) localStorage.setItem('organizationCurrency', currency);
    if (timezone) localStorage.setItem('organizationTimezone', timezone);
  }
};
```

### 3. OrganizationContext
Provides global access to currency and timezone:

```typescript
// src/context/OrganizationContext.tsx
const { currency, timezone, refreshOrganizationSettings } = useOrganization();
```

## Using Currency in Your Components

### Method 1: Using formatCurrency from utils (Recommended)
The simplest way - automatically uses organization currency:

```typescript
import { formatCurrency } from '../utils/formatters';
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { i18n } = useTranslation();
  
  return (
    <div>
      {formatCurrency(1500, i18n.language)}
      {/* Output: "1,500.00 ج.م" (Arabic) or "1,500.00 EGP" (English) */}
    </div>
  );
};
```

### Method 2: Using useCurrency hook
For more control:

```typescript
import { useCurrency } from '../hooks/useCurrency';

const MyComponent = () => {
  const { formatCurrency, getCurrencySymbol, currency } = useCurrency();
  
  return (
    <div>
      <p>{formatCurrency(1500)}</p>
      <p>Currency: {currency}</p>
      <p>Symbol: {getCurrencySymbol()}</p>
    </div>
  );
};
```

### Method 3: Creating a local formatCurrency function
For components that need custom formatting:

```typescript
import { formatCurrency as formatCurrencyUtil } from '../utils/formatters';
import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

const MyComponent = () => {
  const { i18n } = useTranslation();
  
  const formatCurrency = useCallback((amount: number) => {
    const currency = localStorage.getItem('organizationCurrency') || 'EGP';
    return formatCurrencyUtil(amount, i18n.language, currency);
  }, [i18n.language]);
  
  return <div>{formatCurrency(1500)}</div>;
};
```

## Using Timezone in Your Components

### Using useTimezone hook

```typescript
import { useTimezone } from '../hooks/useTimezone';

const MyComponent = () => {
  const { 
    timezone,
    toOrgTimezone,
    formatInOrgTimezone,
    nowInOrgTimezone,
    startOfDayInOrgTimezone,
    endOfDayInOrgTimezone
  } = useTimezone();
  
  // Get current time in organization timezone
  const now = nowInOrgTimezone();
  
  // Format a date in organization timezone
  const formatted = formatInOrgTimezone(new Date(), 'YYYY-MM-DD HH:mm');
  
  // Get start of day in organization timezone
  const startOfDay = startOfDayInOrgTimezone();
  
  return (
    <div>
      <p>Timezone: {timezone}</p>
      <p>Current time: {formatted}</p>
    </div>
  );
};
```

### Using dateHelpers utilities

```typescript
import { 
  convertToOrgTimezone,
  formatDateInOrgTimezone,
  getCurrentTimeInOrgTimezone
} from '../utils/dateHelpers';

// Convert any date to organization timezone
const orgDate = convertToOrgTimezone(new Date());

// Format date in organization timezone
const formatted = formatDateInOrgTimezone(new Date(), 'DD/MM/YYYY HH:mm');

// Get current time in organization timezone
const now = getCurrentTimeInOrgTimezone();
```

## Supported Currencies

| Code | Arabic Symbol | English/French Symbol | Name |
|------|---------------|----------------------|------|
| EGP  | ج.م           | EGP                  | Egyptian Pound |
| SAR  | ر.س           | SAR                  | Saudi Riyal |
| AED  | د.إ           | AED                  | UAE Dirham |
| USD  | $             | $                    | US Dollar |
| EUR  | €             | €                    | Euro |
| GBP  | £             | £                    | British Pound |

## Supported Timezones

| Timezone | Location | UTC Offset |
|----------|----------|------------|
| Africa/Cairo | Egypt | UTC+2 (UTC+3 in summer) |
| Asia/Riyadh | Saudi Arabia | UTC+3 |
| Asia/Dubai | UAE | UTC+4 |

## Updating Settings

### From Settings Page
When admin updates currency/timezone in Settings:

```typescript
// src/pages/Settings.tsx
const handleOrganizationUpdate = async () => {
  const { success } = await updateOrganization(organization);
  if (success) {
    // Refresh organization settings in OrganizationContext
    await refreshOrganizationSettings();
    // All components will now use new currency/timezone
  }
};
```

### Programmatically
```typescript
import { useOrganization } from '../context/OrganizationContext';

const MyComponent = () => {
  const { setCurrency, setTimezone, refreshOrganizationSettings } = useOrganization();
  
  const updateSettings = async () => {
    // Update in database first
    await api.updateOrganization({ currency: 'SAR', timezone: 'Asia/Riyadh' });
    
    // Then refresh context
    await refreshOrganizationSettings();
  };
};
```

## Print Files

All print files automatically use organization currency:

```typescript
// src/utils/printBill.ts
const organizationCurrency = localStorage.getItem('organizationCurrency') || 'EGP';
const language = localStorage.getItem('language') || 'ar';

const getCurrencySymbol = (curr: string, lang: string): string => {
  const symbols = {
    'EGP': { 'ar': 'ج.م', 'en': 'EGP', 'fr': 'EGP' },
    'SAR': { 'ar': 'ر.س', 'en': 'SAR', 'fr': 'SAR' },
    // ... other currencies
  };
  return symbols[curr]?.[lang] || curr;
};
```

## Best Practices

### ✅ DO
- Use `formatCurrency()` from utils/formatters for simple currency formatting
- Use `useCurrency()` hook when you need access to currency code or symbol
- Use `useTimezone()` hook for all date/time operations
- Always pass `i18n.language` to formatCurrency for multi-language support
- Call `refreshOrganizationSettings()` after updating organization settings

### ❌ DON'T
- Don't hardcode currency symbols (use getCurrencySymbol instead)
- Don't hardcode timezone (use organization timezone)
- Don't use `new Date()` directly for display (use timezone utilities)
- Don't forget to handle currency in print files
- Don't use formatCurrency without language parameter

## Testing

### Manual Testing Checklist
1. Login to application
2. Go to Settings → Organization
3. Change currency (e.g., from EGP to SAR)
4. Verify all pages show new currency:
   - Dashboard
   - Billing
   - Reports
   - Inventory
   - Menu
5. Print a bill → verify currency is correct
6. Change language → verify currency symbol changes
7. Change timezone → verify dates display correctly

### Automated Testing
```typescript
// Example test
describe('Currency Display', () => {
  it('should use organization currency', () => {
    localStorage.setItem('organizationCurrency', 'SAR');
    const result = formatCurrency(1500, 'ar');
    expect(result).toContain('ر.س');
  });
});
```

## Troubleshooting

### Currency not updating
1. Check if `organizationCurrency` is in localStorage
2. Verify organization settings in database
3. Check if `refreshOrganizationSettings()` was called after update
4. Clear browser cache and reload

### Wrong currency symbol
1. Check current language (`i18n.language`)
2. Verify `getCurrencySymbol()` is using correct language
3. Check if currency code is valid

### Timezone issues
1. Verify `organizationTimezone` in localStorage
2. Check if dayjs timezone plugin is loaded
3. Ensure dates are converted using timezone utilities

## Migration Guide

If you have existing code that uses hardcoded currency:

### Before
```typescript
const formatted = `${amount.toFixed(2)} ج.م`;
```

### After
```typescript
import { formatCurrency } from '../utils/formatters';
import { useTranslation } from 'react-i18next';

const { i18n } = useTranslation();
const formatted = formatCurrency(amount, i18n.language);
```

## Related Files
- `src/context/OrganizationContext.tsx` - Main context
- `src/hooks/useCurrency.ts` - Currency hook
- `src/hooks/useTimezone.ts` - Timezone hook
- `src/utils/formatters.ts` - Formatting utilities
- `src/utils/dateHelpers.ts` - Date/timezone utilities
- `server/models/Organization.js` - Database model
- `server/controllers/organizationController.js` - API endpoints
