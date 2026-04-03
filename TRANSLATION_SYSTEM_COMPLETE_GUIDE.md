# Translation System - Complete Implementation Guide

## Overview

The Bomba system now has a comprehensive translation infrastructure supporting 146 languages with proper error handling, formatting, and RTL support.

---

## System Architecture

### 1. Translation Files
**Location**: `src/i18n/locales/`
- **Source Language**: Arabic (`ar.json`)
- **Target Languages**: 145 other languages
- **Total**: 146 language files

### 2. Translation Scripts
**Location**: `src/i18n/`

#### `translate-api-direct.js`
- Translates from Arabic to all other languages
- Uses Google Translate API
- Handles rate limiting (3s between strings, 10s between languages)
- Supports retry logic (5 attempts with 5s delay)
- Translates everything including numbers and symbols

#### `clear-translations.js`
- Deletes all translation files except ar.json
- Used when starting fresh translation

---

## Translation Structure

### Core Sections in ar.json

```json
{
  "common": {
    // Common UI elements
    "save": "حفظ",
    "cancel": "إلغاء",
    "close": "إغلاق",
    // ...
  },
  "auth": {
    // Authentication messages
    "login": "تسجيل الدخول",
    "logout": "تسجيل الخروج",
    // ...
  },
  "errors": {
    // Error codes (NEW)
    "NOT_VERIFIED": "الحساب غير مفعل...",
    "INVALID_CREDENTIALS": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    // ...
  },
  "toast": {
    // Toast notifications
    "session": {
      "started": "تم بدء جلسة جديدة على {{deviceName}}"
    }
  },
  "timeLabels": {
    // Time formatting
    "am": "ص",
    "pm": "م",
    "at": "الساعة"
  }
}
```

---

## Usage Patterns

### 1. Basic Translation
```typescript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();
  
  return <button>{t('common.save')}</button>;
};
```

### 2. Translation with Variables
```typescript
// In ar.json: "welcome": "مرحباً بك يا {{name}}!"
t('auth.welcome', { name: user.name })
// Output: "مرحباً بك يا أحمد!"
```

### 3. Error Code Translation
```typescript
import { isValidErrorCode, getErrorMessageKey } from '../constants/errorCodes';

if (isValidErrorCode(errorCode)) {
  const message = t(getErrorMessageKey(errorCode));
  // message = translated error in current language
}
```

### 4. Nested Keys
```typescript
// Access nested translations
t('toast.session.started', { deviceName: 'PS5-1' })
t('reports.timeLabels.am')
```

---

## Formatting Utilities

### 1. Currency Formatting
**File**: `src/utils/formatters.ts`

```typescript
import { formatCurrency } from '../utils/formatters';

// Formats with current language
formatCurrency(1500, i18n.language)
// Arabic: "١٬٥٠٠ جنيه"
// English: "1,500 EGP"
// French: "1 500 £E"
```

**Supported Currencies**: Arabic (جنيه), English (EGP), French (£E)
**Fallback**: English → Arabic → Currency code

### 2. Number Formatting
```typescript
import { formatDecimal } from '../utils/formatters';

formatDecimal(1234.56, i18n.language)
// Arabic: "١٬٢٣٤٫٥٦"
// English: "1,234.56"
```

### 3. Date/Time Formatting
**File**: `src/utils/timeFormat.ts`

```typescript
import { formatDateTime, formatTimeWithTranslation } from '../utils/timeFormat';

// With translated AM/PM
formatDateTime(date, i18n.language, timezone)
// Arabic: "٢٠٢٤-٠٣-١٥ ٣:٣٠ م"
// English: "2024-03-15 3:30 PM"

// Time only
formatTimeWithTranslation(date, i18n.language)
// Arabic: "٣:٣٠ م"
// English: "3:30 PM"
```

**Features**:
- Automatic AM/PM translation
- Arabic numeral conversion
- Timezone support
- RTL-aware formatting

### 4. Organization Context Formatting
**File**: `src/context/OrganizationContext.tsx`

```typescript
const { formatTime, formatDate, formatCurrency } = useOrganization();

// These automatically use organization settings
formatTime(date)      // Uses org timezone + language
formatDate(date)      // Uses org timezone + language
formatCurrency(1500)  // Uses org currency + language
```

---

## RTL Support

### 1. Language Detection
```typescript
import { useLanguage } from '../context/LanguageContext';

const { isRTL, direction } = useLanguage();

// isRTL = true for Arabic
// direction = 'rtl' or 'ltr'
```

### 2. Conditional Styling
```typescript
<div className={`${isRTL ? 'text-right' : 'text-left'}`}>
  {content}
</div>

<div className={`${isRTL ? 'mr-4' : 'ml-4'}`}>
  {content}
</div>
```

### 3. Document Direction
Automatically set in `AppContext.tsx`:
```typescript
document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
document.body.dir = isRTL ? 'rtl' : 'ltr';
```

---

## Error Handling System

### 1. Error Codes
**File**: `src/constants/errorCodes.ts`

```typescript
export const AUTH_ERROR_CODES = {
  NOT_VERIFIED: 'NOT_VERIFIED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  // ...
};
```

### 2. Error Handler
**File**: `src/utils/errorHandler.ts`

```typescript
import { ErrorHandler } from '../utils/errorHandler';

try {
  // API call
} catch (error) {
  const appError = ErrorHandler.handle(error);
  const message = ErrorHandler.getUserMessage(appError, t);
  
  if (ErrorHandler.shouldLogout(appError)) {
    logout();
  }
}
```

### 3. Backend Response Format
```json
{
  "success": false,
  "code": "NOT_VERIFIED",
  "message": "Account not verified",
  "status": 401
}
```

---

## Adding New Translations

### Step 1: Add to ar.json
```json
{
  "mySection": {
    "myKey": "النص بالعربية"
  }
}
```

### Step 2: Run Translation Script
```bash
cd src/i18n
node translate-api-direct.js
```

This will:
1. Read ar.json
2. Translate to 145 languages
3. Save to respective language files
4. Take ~2-3 hours (rate limiting)

### Step 3: Use in Code
```typescript
t('mySection.myKey')
```

---

## Best Practices

### 1. Always Use Translation Keys
❌ **Bad**:
```typescript
<button>حفظ</button>
<button>Save</button>
```

✅ **Good**:
```typescript
<button>{t('common.save')}</button>
```

### 2. Use Formatting Functions
❌ **Bad**:
```typescript
`${amount} جنيه`
`${amount} EGP`
```

✅ **Good**:
```typescript
formatCurrency(amount, i18n.language)
```

### 3. Use Error Codes
❌ **Bad**:
```typescript
if (error.message.includes('not verified') || error.message.includes('غير مفعل')) {
  // Handle error
}
```

✅ **Good**:
```typescript
if (error.code === AUTH_ERROR_CODES.NOT_VERIFIED) {
  // Handle error
}
```

### 4. Provide Context for Variables
```json
{
  "orderCreated": "تم إنشاء الطلب رقم {{orderNumber}} بنجاح"
}
```

```typescript
t('toast.orderCreated', { orderNumber: '12345' })
```

### 5. Group Related Translations
```json
{
  "session": {
    "started": "تم بدء الجلسة",
    "ended": "تم إنهاء الجلسة",
    "updated": "تم تحديث الجلسة"
  }
}
```

---

## Language Switching

### 1. User Settings
**File**: `src/pages/Settings.tsx`

Users can change language from settings:
- Saves to backend via `updateGeneralSettings()`
- Applies immediately via `i18n.changeLanguage()`
- Persists across sessions

### 2. Auth Pages
**Component**: `LanguageSwitcherAuth.tsx`

Language switcher on login/register pages:
- Saves to localStorage
- No backend call (user not authenticated)
- Applied on next login

### 3. Programmatic Change
```typescript
import i18n from '../i18n';

// Change language
await i18n.changeLanguage('en');

// Get current language
const currentLang = i18n.language;
```

---

## Supported Languages (146 Total)

### Major Languages
- Arabic (ar) - Source
- English (en)
- French (fr)
- Spanish (es)
- German (de)
- Italian (it)
- Portuguese (pt)
- Russian (ru)
- Chinese Simplified (zh)
- Japanese (ja)
- Korean (ko)

### Regional Variants
- Chinese Traditional (zh-TW)
- Portuguese Brazil (pt-BR)
- Spanish Latin America (es-MX)

### And 133 more languages...

Full list in `src/i18n/translate-api-direct.js`

---

## Troubleshooting

### Issue: Translation Not Showing
**Solution**:
1. Check if key exists in ar.json
2. Run translation script
3. Clear browser cache
4. Check console for i18n errors

### Issue: Wrong Language Displayed
**Solution**:
1. Check `i18n.language` value
2. Verify language file exists
3. Check localStorage for saved language
4. Verify backend settings

### Issue: Numbers Not Formatted
**Solution**:
1. Use `formatDecimal()` or `formatCurrency()`
2. Pass `i18n.language` parameter
3. Check if language is supported

### Issue: AM/PM Not Translated
**Solution**:
1. Use `formatTimeWithTranslation()` or `formatDateTime()`
2. Check if `timeLabels` exist in language file
3. Use `replaceAMPM()` for custom formatting

---

## Performance Considerations

### 1. Translation Loading
- All translations loaded on app start
- Cached in memory
- No network requests after initial load

### 2. Language Switching
- Instant switch (no reload required)
- Minimal re-render (only text changes)
- Settings persisted to backend

### 3. Formatting Functions
- Optimized for performance
- Memoized where possible
- No unnecessary calculations

---

## Future Enhancements

### 1. Lazy Loading
Load language files on demand instead of all at once:
```typescript
i18n.use(Backend).init({
  backend: {
    loadPath: '/locales/{{lng}}.json'
  }
});
```

### 2. Pluralization
Add support for plural forms:
```json
{
  "items": "{{count}} عنصر",
  "items_plural": "{{count}} عناصر"
}
```

### 3. Context-Aware Translation
Different translations based on context:
```json
{
  "save": "حفظ",
  "save_male": "محفوظ",
  "save_female": "محفوظة"
}
```

### 4. Translation Management UI
Admin interface to:
- Edit translations without code changes
- Preview translations in real-time
- Export/import translation files

---

## Resources

### Documentation
- i18next: https://www.i18next.com/
- React i18next: https://react.i18next.com/
- Google Translate API: https://cloud.google.com/translate

### Files Reference
- Translation files: `src/i18n/locales/`
- Translation scripts: `src/i18n/`
- Formatting utilities: `src/utils/formatters.ts`, `src/utils/timeFormat.ts`
- Error codes: `src/constants/errorCodes.ts`
- Language context: `src/context/LanguageContext.tsx`

### Related Documents
- `ERROR_CODE_IMPLEMENTATION_SUMMARY.md` - Error handling system
- `REMAINING_HARDCODED_STRINGS_TODO.md` - Remaining work
- `HARDCODED_STRINGS_COMPLETE_AUDIT.md` - Full audit report
- `AM_PM_FIX_SUMMARY.md` - Time formatting fixes
