# Remaining Hardcoded Strings - TODO List

## Status: Phase 1 Complete ✅

Phase 1 (High Priority - Authentication) has been completed. This document tracks remaining work.

---

## Phase 2: UI Text Replacements (Medium Priority)

### 1. ReportsPage.tsx
**Location**: Stat card titles (lines 905, 914, 922, 931)

**Current**:
```typescript
title="Total Revenue"
title="Total Orders"
title="Avg. Order Value"
title="Total Sessions"
```

**Fix**:
```typescript
title={t('reports.totalRevenue')}
title={t('reports.totalOrders')}
title={t('reports.avgOrderValue')}
title={t('reports.totalSessions')}
```

**Translation Keys Needed** (already added to ar.json):
```json
{
  "reports": {
    "totalRevenue": "إجمالي الإيرادات",
    "totalOrders": "عدد الطلبات",
    "avgOrderValue": "متوسط الطلب",
    "totalSessions": "عدد الجلسات"
  }
}
```

---

### 2. ComparisonDemo.tsx
**Location**: Stat titles (lines 126, 135, 145, 155)

**Current**:
```typescript
"إجمالي الإيرادات"
"عدد الطلبات"
"عدد الجلسات"
"متوسط الطلب"
```

**Fix**: Use same translation keys as ReportsPage
```typescript
{t('reports.totalRevenue')}
{t('reports.totalOrders')}
{t('reports.totalSessions')}
{t('reports.avgOrderValue')}
```

---

### 3. ToastNotification.tsx
**Location**: Close button title (line 106)

**Current**:
```typescript
title="إغلاق"
```

**Fix**:
```typescript
title={t('common.close')}
```

**Translation Key**: Already exists in ar.json as `common.close`

---

### 4. PayrollManagement.tsx
**Location**: Modal titles (lines 715, 1066)

**Current**:
```typescript
title="معلومات الترحيل"
title="دفع الراتب"
```

**Fix**:
```typescript
title={t('payroll.carryforwardInfo')}
title={t('payroll.paySalary')}
```

**Translation Keys Needed**:
```json
{
  "payroll": {
    "carryforwardInfo": "معلومات الترحيل",
    "paySalary": "دفع الراتب"
  }
}
```

---

### 5. IconPickerModal.tsx
**Location**: Title and placeholder (lines 153, 162)

**Current**:
```typescript
title="اختر أيقونة"
placeholder="ابحث عن أيقونة..."
```

**Fix**:
```typescript
title={t('icons.selectIcon')}
placeholder={t('icons.searchIcon')}
```

**Translation Keys Needed**:
```json
{
  "icons": {
    "selectIcon": "اختر أيقونة",
    "searchIcon": "ابحث عن أيقونة..."
  }
}
```

---

### 6. AttendanceManagement.tsx
**Location**: Time picker placeholder (lines 964, 977)

**Current**:
```typescript
placeholder="اختر الوقت"
```

**Fix**:
```typescript
placeholder={t('common.selectTime')}
```

**Translation Key Needed**:
```json
{
  "common": {
    "selectTime": "اختر الوقت"
  }
}
```

---

### 7. LanguageSwitcherAuth.tsx
**Location**: Search placeholder (line 115)

**Current**:
```typescript
placeholder="Search languages..."
```

**Fix**:
```typescript
placeholder={t('common.searchLanguages')}
```

**Translation Key Needed**:
```json
{
  "common": {
    "searchLanguages": "ابحث عن اللغات..."
  }
}
```

---

## Phase 3: Business Logic String Checks (Lower Priority)

### 1. GamingDevices.tsx
**Location**: Error message checks (lines 535, 537)

**Current**:
```typescript
errorMessage.includes('in use') || errorMessage.includes('قيد الاستخدام')
errorMessage.includes('not found') || errorMessage.includes('غير موجود')
```

**Fix**: Backend should return error codes
```typescript
if (error.code === DEVICE_ERROR_CODES.DEVICE_IN_USE) {
  // Handle device in use
}
if (error.code === DEVICE_ERROR_CODES.DEVICE_NOT_FOUND) {
  // Handle device not found
}
```

---

### 2. Inventory.tsx
**Location**: Reason field checks (lines 399, 1036, 1106, 2536)

**Current**:
```typescript
reason.includes('طلب رقم') || reason.includes('فاتورة')
error?.message?.includes('موجود بالفعل')
```

**Recommendation**: 
- Use structured data instead of parsing reason strings
- Backend should return error codes for duplicate items

---

### 3. Dashboard.tsx
**Location**: Device type check (line 383)

**Current**:
```typescript
session.deviceType.includes('PlayStation') || session.deviceType.includes('بلايستيشن')
```

**Fix**: Use enum or constant
```typescript
const DEVICE_TYPES = {
  PLAYSTATION: 'PlayStation',
  COMPUTER: 'Computer'
};

if (session.deviceType === DEVICE_TYPES.PLAYSTATION) {
  // Handle PlayStation
}
```

---

### 4. ConsumptionReport.tsx
**Location**: Category checks (lines 950, 954)

**Current**:
```typescript
lowerCategory.includes('بلايستيشن') || lowerCategory.includes('playstation')
lowerCategory.includes('كمبيوتر') || lowerCategory.includes('computer')
```

**Fix**: Use constants
```typescript
const CATEGORIES = {
  PLAYSTATION: 'playstation',
  COMPUTER: 'computer'
};

if (lowerCategory.includes(CATEGORIES.PLAYSTATION)) {
  // Handle PlayStation category
}
```

---

### 5. Billing.tsx
**Location**: Merge message check (line 1324)

**Current**:
```typescript
result.message && result.message.includes('دمج')
```

**Fix**: Backend should return a `merged` boolean flag
```typescript
if (result.merged) {
  // Handle merged bills
}
```

---

## Phase 4: Backend Updates (Required for Full Implementation)

### Authentication Endpoints
**File**: `server/routes/auth.js`

Update to return error codes:
```javascript
// Before
return res.status(401).json({ 
  success: false, 
  message: 'الحساب غير مفعل' 
});

// After
return res.status(401).json({ 
  success: false, 
  code: 'NOT_VERIFIED',
  message: 'Account not verified' // Optional, for logging
});
```

### Model Validation Errors
**Files**: 
- `server/models/Session.js`
- `server/models/InventoryItem.js`
- `server/models/Bill.js`

Update validation errors to use codes:
```javascript
// Before
throw new Error('عدد الدراعات يجب أن يكون بين 1 و 4');

// After
const error = new Error('Invalid controller count');
error.code = 'INVALID_CONTROLLER_COUNT';
throw error;
```

---

## Implementation Steps

### Step 1: Add Missing Translation Keys
1. Open `src/i18n/locales/ar.json`
2. Add the translation keys listed above
3. Run translation script to translate to all languages

### Step 2: Update UI Components
1. Import `useTranslation` hook
2. Replace hardcoded strings with `t()` calls
3. Test in multiple languages

### Step 3: Update Business Logic
1. Create constants file for device types and categories
2. Replace string checks with constant comparisons
3. Update backend to return structured data

### Step 4: Backend Error Codes
1. Create error codes constants in backend
2. Update all error responses to include `code` field
3. Update error middleware to handle error codes
4. Test all error scenarios

---

## Testing Checklist

### UI Text
- [ ] ReportsPage stat cards display in current language
- [ ] ComparisonDemo titles display in current language
- [ ] Toast notification close button has correct title
- [ ] Payroll modals have translated titles
- [ ] Icon picker has translated title and placeholder
- [ ] Attendance time picker has translated placeholder
- [ ] Language switcher search has translated placeholder

### Business Logic
- [ ] Gaming devices error handling works with error codes
- [ ] Inventory duplicate detection works correctly
- [ ] Device type filtering works with constants
- [ ] Category filtering works with constants
- [ ] Bill merging detection works with boolean flag

### Backend
- [ ] All authentication errors return error codes
- [ ] All validation errors return error codes
- [ ] Error codes are consistent across endpoints
- [ ] Frontend correctly handles all error codes

---

## Priority Order

1. **Immediate**: Add missing translation keys to ar.json
2. **This Week**: Update UI components (Phase 2)
3. **Next Sprint**: Update business logic (Phase 3)
4. **Coordinate with Backend**: Implement error codes (Phase 4)

---

## Notes

- All translation keys should follow the pattern: `section.key`
- Error codes should be uppercase with underscores: `ERROR_CODE`
- Always provide fallback for backward compatibility
- Test in at least 3 languages: Arabic, English, French
