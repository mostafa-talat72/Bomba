# مراجعة دعم اللغات في Backend Controllers

## ✅ Controllers التي تدعم الثلاث لغات بشكل صحيح

### 1. ✅ settingsController.js
**الحالة:** يدعم الثلاث لغات بشكل كامل

```javascript
// Validate language if provided
if (language && !['ar', 'en', 'fr'].includes(language)) {
    return res.status(400).json({
        success: false,
        message: "قيمة اللغة غير صحيحة",
    });
}
```

**الميزات:**
- ✅ يتحقق من الثلاث لغات (ar, en, fr)
- ✅ يحفظ اللغة في User.preferences.language
- ✅ يعيد اللغة المحفوظة للمستخدم

---

## ⚠️ Controllers التي تحتوي على Hardcoded Language

### 1. ⚠️ publicController.js
**المشكلة:** يستخدم hardcoded `lang="ar"` و `dir="rtl"` في HTML

**الأماكن:**
- السطر 15: `<html lang="ar" dir="rtl">`
- السطر 105: `<html lang="ar" dir="rtl">`
- السطر 210: `<html lang="ar" dir="rtl">`
- السطر 577: `toLocaleDateString('ar-EG')`

**التأثير:** 
- الصفحات العامة (Organization Public Page, Bill View) تظهر دائماً بالعربية
- لا تتغير حسب لغة المستخدم

**الحل المقترح:**
```javascript
// يجب الحصول على لغة المستخدم من:
// 1. Query parameter: ?lang=en
// 2. Cookie
// 3. Accept-Language header
// 4. Default: ar

const getUserLanguage = (req) => {
    return req.query.lang || req.cookies.language || 'ar';
};

const isRTL = (lang) => lang === 'ar';
```

---

### 2. ⚠️ sessionController.js
**المشكلة:** يستخدم hardcoded `'ar-EG'` في date formatting

**الأماكن:**
- السطر 372: `toLocaleTimeString('ar-EG')`
- السطر 416: `toLocaleTimeString('ar-EG')`
- السطر 493: `toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })`
- السطر 502: `toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })`
- السطر 3328: `toLocaleString('ar-EG')` (مرتين)

**التأثير:**
- رسائل الأخطاء والإشعارات تظهر دائماً بالعربية
- التواريخ تُنسق بالعربية فقط

**الحل المقترح:**
```javascript
// الحصول على لغة المستخدم من req.user.preferences.language
const userLocale = req.user?.preferences?.language === 'ar' ? 'ar-EG' : 
                   req.user?.preferences?.language === 'fr' ? 'fr-FR' : 'en-US';

newStartTime.toLocaleTimeString(userLocale)
```

---

### 3. ⚠️ reportController.js
**المشكلة:** يستخدم hardcoded `'ar-EG'` في date formatting

**الأماكن:**
- السطر 920: `toLocaleTimeString("ar-EG")`
- السطر 974: `toLocaleTimeString("ar-EG")`
- السطر 1018: `toLocaleTimeString("ar-EG")`

**التأثير:**
- التقارير تظهر التواريخ بالعربية فقط

**الحل المقترح:**
```javascript
const userLocale = req.user?.preferences?.language === 'ar' ? 'ar-EG' : 
                   req.user?.preferences?.language === 'fr' ? 'fr-FR' : 'en-US';

new Date(session.createdAt).toLocaleTimeString(userLocale, {
    hour: "2-digit",
    minute: "2-digit",
})
```

---

### 4. ⚠️ organizationController.js
**المشكلة:** يستخدم hardcoded `'ar-EG'` في date formatting

**الأماكن:**
- السطر 794-795: `toLocaleString('ar-EG')` (في console.log)
- السطر 928: `toLocaleDateString("ar-EG")`
- السطر 945-946: `toLocaleDateString('ar-EG', {weekday: 'long', ...})`

**التأثير:**
- التقارير اليومية المرسلة بالإيميل تظهر بالعربية فقط
- Logs تظهر بالعربية

**الحل المقترح:**
```javascript
// للتقارير المرسلة، استخدام لغة صاحب المنشأة
const owner = await User.findById(organization.owner).select('preferences');
const ownerLocale = owner?.preferences?.language === 'ar' ? 'ar-EG' : 
                    owner?.preferences?.language === 'fr' ? 'fr-FR' : 'en-US';
```

---

### 5. ⚠️ attendanceController.js
**المشكلة:** يستخدم hardcoded Arabic locale من date-fns

**الأماكن:**
- السطر 5: `import { ar } from 'date-fns/locale';`
- السطر 92: `format(a.date, 'EEEE', { locale: ar })`
- السطر 167: `format(attendanceDate, 'EEEE', { locale: ar })`

**التأثير:**
- أسماء الأيام تظهر بالعربية فقط

**الحل المقترح:**
```javascript
import { ar, enUS, fr } from 'date-fns/locale';

const getDateFnsLocale = (language) => {
    switch(language) {
        case 'ar': return ar;
        case 'en': return enUS;
        case 'fr': return fr;
        default: return ar;
    }
};

const userLocale = getDateFnsLocale(req.user?.preferences?.language);
format(a.date, 'EEEE', { locale: userLocale })
```

---

## 📊 الخلاصة

### ✅ يدعم الثلاث لغات:
1. **settingsController.js** - دعم كامل للثلاث لغات

### ⚠️ يحتاج تحديث:
1. **publicController.js** - HTML lang و date formatting
2. **sessionController.js** - date formatting في الرسائل
3. **reportController.js** - date formatting في التقارير
4. **organizationController.js** - date formatting في التقارير اليومية
5. **attendanceController.js** - date-fns locale

---

## 🔧 التوصيات

### 1. إنشاء Helper Function مركزية
```javascript
// server/utils/localeHelper.js
export const getUserLocale = (user) => {
    const language = user?.preferences?.language || 'ar';
    switch(language) {
        case 'ar': return 'ar-EG';
        case 'en': return 'en-US';
        case 'fr': return 'fr-FR';
        default: return 'ar-EG';
    }
};

export const getDateFnsLocale = (user) => {
    const language = user?.preferences?.language || 'ar';
    switch(language) {
        case 'ar': return ar;
        case 'en': return enUS;
        case 'fr': return fr;
        default: return ar;
    }
};

export const isRTL = (user) => {
    return user?.preferences?.language === 'ar';
};
```

### 2. تحديث جميع Controllers
استخدام `getUserLocale(req.user)` بدلاً من hardcoded 'ar-EG'

### 3. للصفحات العامة (publicController)
- إضافة query parameter: `?lang=en`
- حفظ اللغة في cookie
- استخدام Accept-Language header كـ fallback

---

## ⚠️ ملاحظة مهمة

**الأولوية:** 
- settingsController يعمل بشكل صحيح ✅
- باقي Controllers تحتاج تحديث لكنها لا تؤثر على تغيير اللغة في الواجهة الأمامية
- التحديثات المطلوبة تحسن تجربة المستخدم في:
  - الرسائل والإشعارات
  - التقارير المطبوعة
  - الصفحات العامة
  - الإيميلات
