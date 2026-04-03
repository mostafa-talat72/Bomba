# Hardcoded Strings - Complete Audit Report

## Status: ✅ Complete

---

## Summary

Found 100+ instances across 4 categories:
1. **Server Error Messages** (Backend) - 15+ instances - Priority: MEDIUM
2. **String Comparison Logic** (Frontend) - 20+ instances - Priority: HIGH  
3. **Console Logs** (Debug) - 50+ instances - Priority: LOW
4. **UI Text** (Titles/Placeholders) - 15+ instances - Priority: MEDIUM

---

## 1. SERVER-SIDE ERROR MESSAGES

### Files with hardcoded error messages:

**server/models/Session.js** (5 errors)
- Line 154, 326: "لم يتم العثور على بيانات الجهاز لحساب التكلفة"
- Line 255: "لا يمكن تعديل عدد الدراعات في جلسة غير نشطة"
- Line 259: "عدد الدراعات يجب أن يكون بين 1 و 4"
- Line 285: "الجلسة غير نشطة"

**server/models/InventoryItem.js** (4 errors)
- Line 260: "نوع الحركة غير صحيح"
- Line 264: "الكمية يجب أن تكون أكبر من صفر"
- Line 268: "السعر يجب أن يكون موجباً"
- Line 272: "السبب مطلوب"

**server/models/Bill.js** (4 errors)
- Line 1493: "يجب تحديد الأصناف والكميات المراد دفعها"
- Line 1609: "يجب تحديد الجلسة"
- Line 1613: "يجب إدخال مبلغ صحيح"
- Line 1621: "الجلسة غير موجودة في الفاتورة"

**server/utils/backup.js** (2 errors)
- Line 69, 140: "ملف النسخة الاحتياطية غير موجود"

**server/services/organizationWebsiteService.js** (1 error)
- Line 16: "فشل في إنشاء رابط الموقع"

**Recommendation**: Use error codes instead of messages. Frontend translates based on codes.

---

## 2. STRING COMPARISON LOGIC (HIGH PRIORITY)

### Authentication Pages - CRITICAL:

**src/pages/Login.tsx**
```typescript
Line 101: errorMessage.includes('غير مفعل') || errorMessage.includes('pending')
Line 104: errorMessage.includes('غير صحيحة') || errorMessage.includes('خطأ')
Line 106: errorMessage.includes('غير موجود')
```
Fix: Backend should return: `NOT_VERIFIED`, `INVALID_CREDENTIALS`, `USER_NOT_FOUND`

**src/pages/Register.tsx**
```typescript
Line 134: data.message?.includes('فشل إرسال رسالة التفعيل')
Line 136: data.message?.includes('موجود')
```
Fix: Use codes: `EMAIL_SEND_FAILED`, `EMAIL_EXISTS`

**src/pages/VerifyEmail.tsx**
```typescript
Line 29: data.message.includes('الحساب مفعل بالفعل')
```
Fix: Use code: `ALREADY_VERIFIED`

### Error Handling:

**src/context/AppContext.tsx**
```typescript
Line 379: response.message.includes('توكن غير صالح') || response.message.includes('انتهت صلاحية الجلسة')
```
Fix: Check `response.status === 401` instead

**src/utils/errorHandler.ts**
```typescript
Line 31: error.message?.includes('انتهت صلاحية')
```
Fix: Check `error.statusCode === 401`

**src/pages/GamingDevices.tsx**
```typescript
Line 535: errorMessage.includes('in use') || errorMessage.includes('قيد الاستخدام')
Line 537: errorMessage.includes('not found') || errorMessage.includes('غير موجود')
```
Fix: Use error codes from backend

### Business Logic (Lower Priority):

**src/pages/Inventory.tsx**
- Line 399: `reason.includes('طلب رقم') || reason.includes('فاتورة')`
- Line 1036, 1106: `error?.message?.includes('موجود بالفعل')`
- Line 2536: Checking reason field for order references

**src/pages/Dashboard.tsx**
- Line 383: `session.deviceType.includes('PlayStation') || session.deviceType.includes('بلايستيشن')`

**src/pages/ConsumptionReport.tsx**
- Line 950: `lowerCategory.includes('بلايستيشن') || lowerCategory.includes('playstation')`
- Line 954: `lowerCategory.includes('كمبيوتر') || lowerCategory.includes('computer')`

**src/pages/Billing.tsx**
- Line 1324: `result.message && result.message.includes('دمج')`

---

## 3. CONSOLE LOGS (LOW PRIORITY)

50+ files contain console.log/error/warn statements. These are for debugging and don't need translation.

**Recommendation**: Keep error logs, remove debug logs in production.

---

## 4. HARDCODED UI TEXT (MEDIUM PRIORITY)

### Titles needing translation:

**src/pages/ReportsPage.tsx**
- Lines 905, 914, 922, 931: "Total Revenue", "Total Orders", "Avg. Order Value", "Total Sessions"
- Fix: `title={t('reports.totalRevenue')}` etc.

**src/pages/ComparisonDemo.tsx**
- Lines 126, 135, 145, 155: "إجمالي الإيرادات", "عدد الطلبات", "عدد الجلسات", "متوسط الطلب"
- Fix: Use translation keys

**src/components/ToastNotification.tsx**
- Line 106: `title="إغلاق"`
- Fix: `title={t('common.close')}`

**src/components/payroll/PayrollManagement.tsx**
- Line 715: `title="معلومات الترحيل"`
- Line 1066: `title="دفع الراتب"`
- Fix: Use translation keys

**src/components/IconPickerModal.tsx**
- Line 153: `title="اختر أيقونة"`
- Line 162: `placeholder="ابحث عن أيقونة..."`
- Fix: Use translation keys

### Placeholders:

**src/components/payroll/AttendanceManagement.tsx**
- Lines 964, 977: `placeholder="اختر الوقت"`
- Fix: `placeholder={t('common.selectTime')}`

**src/components/LanguageSwitcherAuth.tsx**
- Line 115: `placeholder="Search languages..."`
- Fix: `placeholder={t('common.searchLanguages')}`

**src/pages/Settings.tsx**
- Multiple URL placeholders (lines 1258, 1371, 1387, etc.)
- Note: URL examples may not need translation

---

## ✅ ALREADY FIXED

1. `src/utils/pdfExport.tsx` - Error message uses translation
2. `src/services/api.ts` - Removed hardcoded error message

---

## ACTION PLAN

### Phase 1: HIGH PRIORITY (Must Fix)
1. Create `ERROR_CODES.ts` constant file
2. Update backend to return error codes
3. Fix authentication pages (Login, Register, VerifyEmail)
4. Fix error handlers (AppContext, errorHandler.ts)
5. Fix GamingDevices.tsx error handling

### Phase 2: MEDIUM PRIORITY (Should Fix)
1. Replace hardcoded titles with t() calls
2. Replace hardcoded placeholders with t() calls
3. Consider backend i18n for server error messages
4. Add missing translation keys to ar.json

### Phase 3: LOW PRIORITY (Optional)
1. Review business logic string checks
2. Clean up console logs for production
3. Consider using enums for device types and categories

---

## Translation Keys Needed

Add to ar.json:
```json
{
  "common": {
    "close": "إغلاق",
    "selectTime": "اختر الوقت",
    "searchLanguages": "ابحث عن اللغات..."
  },
  "reports": {
    "totalRevenue": "إجمالي الإيرادات",
    "totalOrders": "عدد الطلبات",
    "avgOrderValue": "متوسط الطلب",
    "totalSessions": "عدد الجلسات"
  },
  "payroll": {
    "carryforwardInfo": "معلومات الترحيل",
    "paySalary": "دفع الراتب"
  },
  "icons": {
    "selectIcon": "اختر أيقونة",
    "searchIcon": "ابحث عن أيقونة..."
  }
}
```
