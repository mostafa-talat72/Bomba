# إصلاح تنسيق الأرقام والتوقيت حسب اللغة

## المشكلة

عند اختيار لغة غير العربية (مثل العبرية)، كانت الأرقام والتوقيت تظهر بالأرقام العربية (٠١٢٣٤٥٦٧٨٩) بدلاً من الأرقام الغربية (0123456789).

### مثال على المشكلة:
```
اللغة المختارة: עברית (عبري)
النتيجة الخاطئة: התחל הפעלה חדשה - بلايستيشن 1٠٢:١٩
النتيجة الصحيحة: התחל הפעלה חדשה - بلايستיشن 102:19
```

## السبب

في ملف `server/utils/localeHelper.js`، كانت دالة `getUserLocale()` تعيد `'ar-EG'` كقيمة افتراضية لجميع اللغات غير المدعومة:

```javascript
// الكود القديم
export const getUserLocale = (user) => {
    const language = user?.preferences?.language || 'ar';
    switch(language) {
        case 'ar': return 'ar-EG';
        case 'en': return 'en-US';
        case 'fr': return 'fr-FR';
        default: return 'ar-EG';  // ❌ المشكلة هنا!
    }
};
```

عندما يختار المستخدم العبرية (he)، كانت الدالة تعيد 'ar-EG'، مما يجعل JavaScript يستخدم التنسيق العربي للأرقام.

## الحل

تم تحديث الدالة لدعم جميع اللغات الشائعة واستخدام 'en-US' كقيمة افتراضية:

```javascript
// الكود الجديد
export const getUserLocale = (user) => {
    const language = user?.preferences?.language || 'ar';
    
    const localeMap = {
        'ar': 'ar-EG',
        'en': 'en-US',
        'fr': 'fr-FR',
        'he': 'he-IL',  // Hebrew
        'es': 'es-ES',  // Spanish
        'de': 'de-DE',  // German
        // ... 30+ لغة أخرى
    };
    
    // ✅ استخدام en-US كقيمة افتراضية
    return localeMap[language] || 'en-US';
};
```

## التحديثات المنفذة

### 1. تحديث `getUserLocale()`
**الملف**: `server/utils/localeHelper.js`

- إضافة دعم لـ 30+ لغة شائعة
- تغيير القيمة الافتراضية من 'ar-EG' إلى 'en-US'
- اللغات المدعومة الآن:
  - العربية (ar-EG)
  - الإنجليزية (en-US)
  - الفرنسية (fr-FR)
  - العبرية (he-IL) ✅ جديد
  - الإسبانية (es-ES)
  - الألمانية (de-DE)
  - الإيطالية (it-IT)
  - البرتغالية (pt-PT)
  - الروسية (ru-RU)
  - الصينية (zh-CN)
  - اليابانية (ja-JP)
  - الكورية (ko-KR)
  - التركية (tr-TR)
  - الهولندية (nl-NL)
  - البولندية (pl-PL)
  - السويدية (sv-SE)
  - الدنماركية (da-DK)
  - النرويجية (no-NO)
  - الفنلندية (fi-FI)
  - التشيكية (cs-CZ)
  - المجرية (hu-HU)
  - الرومانية (ro-RO)
  - الأوكرانية (uk-UA)
  - اليونانية (el-GR)
  - التايلاندية (th-TH)
  - الفيتنامية (vi-VN)
  - الإندونيسية (id-ID)
  - الماليزية (ms-MY)
  - الهندية (hi-IN)
  - البنغالية (bn-BD)
  - الأوردو (ur-PK)
  - الفارسية (fa-IR)

### 2. تحديث `getLocaleFromLanguage()`
**الملف**: `server/utils/localeHelper.js`

- نفس التحديثات كما في `getUserLocale()`
- تستخدم في الصفحات العامة (مثل عرض الفاتورة بدون تسجيل دخول)

### 3. تحديث `isRTL()` و `isLanguageRTL()`
**الملف**: `server/utils/localeHelper.js`

- إضافة دعم لجميع اللغات RTL:
  - العربية (ar)
  - العبرية (he)
  - الفارسية (fa)
  - الأوردو (ur)
  - اليديشية (yi)
  - العبرية القديمة (iw)

```javascript
// الكود الجديد
export const isLanguageRTL = (language) => {
    const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi', 'iw'];
    return rtlLanguages.includes(language);
};
```

## كيف يعمل الآن

### 1. النشاط الأخير (Recent Activity)
عندما يطلب المستخدم النشاط الأخير:

```javascript
// في reportController.js
time: new Date(session.createdAt).toLocaleTimeString(getUserLocale(req.user), {
    hour: "2-digit",
    minute: "2-digit",
})
```

- إذا كانت اللغة عربية → يستخدم 'ar-EG' → أرقام عربية (٠٢:١٩)
- إذا كانت اللغة عبرية → يستخدم 'he-IL' → أرقام غربية (02:19)
- إذا كانت اللغة غير مدعومة → يستخدم 'en-US' → أرقام غربية (02:19)

### 2. تنسيق التاريخ والوقت
جميع استخدامات `toLocaleTimeString()` و `toLocaleDateString()` في السيرفر ستستخدم الـ locale الصحيح.

### 3. اتجاه النص (RTL/LTR)
- اللغات RTL: العربية، العبرية، الفارسية، الأوردو، اليديشية
- باقي اللغات: LTR

## الملفات المعدلة

1. `server/utils/localeHelper.js` - تحديث جميع دوال الـ locale

## الاختبار

### اختبار اللغة العربية
```
اللغة: العربية (ar)
النتيجة: התחל הפעלה חדשה - بلايستيشن 1٠٢:١٩ ✅
الأرقام: عربية (٠١٢٣٤٥٦٧٨٩)
الاتجاه: RTL
```

### اختبار اللغة العبرية
```
اللغة: עברית (he)
النتيجة: התחל הפעלה חדשה - بلايستיشن 102:19 ✅
الأرقام: غربية (0123456789)
الاتجاه: RTL
```

### اختبار اللغة الإنجليزية
```
اللغة: English (en)
النتيجة: New session started - PlayStation 102:19 ✅
الأرقام: غربية (0123456789)
الاتجاه: LTR
```

### اختبار لغة غير مدعومة
```
اللغة: Swahili (sw)
النتيجة: يستخدم en-US كقيمة افتراضية ✅
الأرقام: غربية (0123456789)
الاتجاه: LTR
```

## الفوائد

1. ✅ الأرقام تظهر بالتنسيق الصحيح لكل لغة
2. ✅ التوقيت يظهر بالتنسيق الصحيح لكل لغة
3. ✅ دعم 30+ لغة شائعة
4. ✅ قيمة افتراضية آمنة (en-US) للغات غير المدعومة
5. ✅ دعم كامل لجميع اللغات RTL
6. ✅ لا حاجة لإعادة تشغيل السيرفر (يعمل فوراً)

## ملاحظات مهمة

### 1. الأرقام في الفرونت إند
الفرونت إند يستخدم دوال `formatDecimal()` و `formatCurrency()` التي تحول الأرقام إلى عربية فقط عندما تكون اللغة 'ar':

```typescript
// في formatters.ts
export const formatDecimal = (value: number, locale: string = 'ar'): string => {
    // ...
    // تحويل الأرقام إلى العربية إذا كانت اللغة عربية
    return locale === 'ar' ? convertToArabicNumbers(trimmed) : trimmed;
};
```

هذا يعمل بشكل صحيح ولا يحتاج إلى تعديل.

### 2. الأرقام في الباك إند
الباك إند الآن يستخدم `toLocaleTimeString()` مع الـ locale الصحيح، مما يجعل JavaScript يختار التنسيق المناسب تلقائياً.

### 3. اللغات المدعومة
إذا أضفت لغة جديدة في المستقبل:
1. أضف اللغة إلى `localeMap` في `getUserLocale()`
2. أضف اللغة إلى `localeMap` في `getLocaleFromLanguage()`
3. إذا كانت RTL، أضفها إلى `rtlLanguages` في `isLanguageRTL()`

## الخلاصة

تم إصلاح مشكلة ظهور الأرقام العربية في اللغات غير العربية بتحديث دوال الـ locale في السيرفر لدعم جميع اللغات واستخدام 'en-US' كقيمة افتراضية بدلاً من 'ar-EG'.

الآن كل لغة تعرض الأرقام والتوقيت بالتنسيق الصحيح الخاص بها! 🎉
