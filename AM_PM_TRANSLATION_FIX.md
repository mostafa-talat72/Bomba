# إصلاح ترجمة AM/PM (ص/م)

## المشكلة
كانت اختصارات AM/PM تظهر بالإنجليزية في جميع اللغات بدلاً من استخدام الترجمة من ملف اللغة المختارة.

## الحل

### 1. إنشاء دوال مساعدة للتنسيق
تم إنشاء ملف `src/utils/timeFormat.ts` يحتوي على:
- `getTimeLabels()` - جلب الترجمات من ملف اللغة
- `formatTimeWithTranslation()` - تنسيق الوقت مع ترجمة AM/PM
- `formatDateTime()` - تنسيق التاريخ والوقت مع ترجمة AM/PM
- `formatDateRange()` - تنسيق نطاق التاريخ مع ترجمة AM/PM

### 2. تحديث formatters.ts
تم إضافة دالة `replaceAMPM()` لاستبدال AM/PM بالترجمة الصحيحة.

### 3. إصلاح OrganizationContext
تم تحديث `formatTime()` لاستخدام `replaceAMPM()`:
```typescript
const formatTime = (date: Date | string): string => {
  const formatted = formatDateInTimezone(date, timezone, locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  // Replace AM/PM with translated versions
  return replaceAMPM(formatted);
};
```

### 4. إصلاح GamingDevices.tsx
تم استبدال الكود اليدوي:
```typescript
// قبل
.replace('AM', 'ص')
.replace('PM', 'م')

// بعد
import { formatDateTime } from '../utils/timeFormat';
return formatDateTime(timeInZone, true);
```

## الصفحات المُصلحة

### ✅ تم الإصلاح:
1. **Dashboard.tsx** - يستخدم `formatTime()` من OrganizationContext (مُصلح تلقائياً)
   - عرض الوقت الحالي في الهيدر
   - عرض وقت بدء الجلسات النشطة
   
2. **GamingDevices.tsx** - يستخدم `formatDateTime()` من timeFormat.ts
   - عرض أوقات الجلسات
   
3. **OrganizationContext.tsx** - `formatTime()` يستخدم `replaceAMPM()`
   - جميع الصفحات التي تستخدم `formatTime` من Context ستعمل تلقائياً

## ملفات اللغة

### العربية (ar.json)
```json
"timeLabels": {
  "am": "ص",
  "pm": "م",
  "at": "في"
}
```

### العبرية (he.json)
```json
"timeLabels": {
  "am": "ע",
  "pm": "מ",
  "at": "כַּאֲשֵׁר"
}
```

### الإنجليزية (en.json)
```json
"timeLabels": {
  "am": "AM",
  "pm": "PM",
  "at": "at"
}
```

## الملفات التي تحتاج تحديث

### تحتاج إصلاح:
- ⏳ `src/pages/Reports.tsx` - استخدام `replaceAMPM()` في عرض التواريخ
- ⏳ `src/pages/ConsumptionReport.tsx` - استخدام `replaceAMPM()` في عرض التواريخ
- ⏳ `src/components/payroll/PendingAdvances.tsx` - استخدام `replaceAMPM()`
- ⏳ جميع الصفحات التي تستخدم `dayjs().format('hh:mm A')` مباشرة

## كيفية الاستخدام

### في أي صفحة تعرض وقت:

#### الطريقة 1: استخدام formatTime من OrganizationContext (موصى بها)
```typescript
import { useOrganization } from '../context/OrganizationContext';

const { formatTime } = useOrganization();
const timeStr = formatTime(new Date());
// النتيجة: "02:30 ص" (عربي)
// النتيجة: "02:30 AM" (إنجليزي)
// النتيجة: "02:30 ע" (عبري)
```

#### الطريقة 2: استخدام دوال timeFormat.ts
```typescript
import { formatDateTime, formatTimeWithTranslation } from '../utils/timeFormat';

// تنسيق تاريخ ووقت كامل
const formatted = formatDateTime(dayjs(), true);
// النتيجة: "18/03/2026 - 02:30 ص" (عربي)

// تنسيق وقت فقط
const timeOnly = formatTimeWithTranslation(dayjs(), 'hh:mm a');
// النتيجة: "02:30 ص" (عربي)
```

#### الطريقة 3: استبدال AM/PM في نص موجود
```typescript
import { replaceAMPM } from '../utils/formatters';

const formatted = dayjs().format('hh:mm A');
const translated = replaceAMPM(formatted);
// النتيجة: "02:30 ص" (عربي)
```

## الخطوات التالية

1. ✅ Dashboard - تم الإصلاح
2. ✅ GamingDevices - تم الإصلاح
3. ✅ OrganizationContext - تم الإصلاح
4. ⏳ تحديث Reports.tsx
5. ⏳ تحديث ConsumptionReport.tsx
6. ⏳ تحديث جميع الصفحات الأخرى

## ملاحظات

- الدوال الجديدة تدعم تحويل الأرقام للعربية تلقائياً
- الترجمات تُجلب من ملف اللغة المختارة تلقائياً
- يمكن إضافة ترجمات جديدة في `timeLabels` لأي لغة من الـ 146 لغة
- جميع الصفحات التي تستخدم `formatTime` من OrganizationContext ستعمل تلقائياً
