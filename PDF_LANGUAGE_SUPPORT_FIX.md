# ✅ إصلاح دعم اللغات في تقارير PDF

## المشكلة
التقارير المرسلة عبر البريد الإلكتروني في ملفات PDF لا تدعم لغة المستلم بشكل صحيح. التواريخ والأرقام والثوابت يجب أن تظهر باللغة المحددة لكل مستلم (عربي، إنجليزي، فرنسي).

## السبب الجذري
1. **في `scheduler.js`**: لم يتم تمرير معاملات اللغة والعملة إلى دالة `sendDailyReport`
2. **تنسيق التواريخ**: كانت التواريخ في `reportData` تستخدم 'ar-EG' بشكل ثابت بدلاً من لغة المالك
3. **خطأ في البيانات**: كان هناك مرجع خاطئ لـ `salesData` الذي لا يوجد

## الإصلاحات المطبقة

### 1. إصلاح `generateDailyReportForOrganization` في `scheduler.js`

#### قبل الإصلاح ❌
```javascript
const reportData = {
    date: startOfReport.toLocaleDateString("ar-EG"),  // ❌ ثابت على العربية
    // ...
    totalBills: salesData.totalOrders + salesData.totalSessions,  // ❌ salesData غير موجود
    totalOrders: salesData.totalOrders || 0,
    totalSessions: salesData.totalSessions || 0,
    topProducts: salesData.topProducts || [],
    // ...
    reportPeriod: `من ${startTimeStr} يوم ${startOfReport.toLocaleDateString('ar-EG', ...)}`,  // ❌ ثابت
};

// ❌ لم يتم تمرير اللغة والعملة
await sendDailyReport(reportData, reportEmails, pdfBuffer);
```

#### بعد الإصلاح ✅
```javascript
// ✅ جلب تفضيلات اللغة والعملة أولاً
const owner = await User.findById(organization.owner).select('preferences').lean();
const ownerLanguage = owner?.preferences?.language || 'ar';
const organizationCurrency = organization.currency || 'EGP';
const ownerLocale = ownerLanguage === 'ar' ? 'ar-EG' : ownerLanguage === 'fr' ? 'fr-FR' : 'en-US';

const reportData = {
    date: startOfReport.toLocaleDateString(ownerLocale),  // ✅ يستخدم لغة المالك
    // ...
    totalBills: orders.length + sessions.length,  // ✅ استخدام البيانات الفعلية
    totalOrders: orders.length || 0,
    totalSessions: sessions.length || 0,
    topProducts: topProducts || [],
    // ...
    reportPeriod: `من ${startTimeStr} يوم ${startOfReport.toLocaleDateString(ownerLocale, ...)}`,  // ✅ ديناميكي
    language: ownerLanguage,  // ✅ إضافة اللغة
    currency: organizationCurrency  // ✅ إضافة العملة
};

// ✅ تمرير null للـ pdfBuffer ليتم توليد PDF لكل مستلم بلغته
await sendDailyReport(reportData, reportEmails, null, ownerLanguage, organizationCurrency);
```

### 2. إصلاح `generateMonthlyReportForOrganization` في `scheduler.js`

#### التغييرات المطبقة:
```javascript
// ✅ جلب تفضيلات اللغة والعملة أولاً
const owner = await User.findById(organization.owner).select('preferences').lean();
const ownerLanguage = owner?.preferences?.language || 'ar';
const organizationCurrency = organization.currency || 'EGP';
const ownerLocale = ownerLanguage === 'ar' ? 'ar-EG' : ownerLanguage === 'fr' ? 'fr-FR' : 'en-US';

const reportData = {
    month: startOfReport.toLocaleDateString(ownerLocale, { month: "long", year: "numeric" }),  // ✅
    // ...
    reportPeriod: `من ${startTimeStr} يوم ${startOfReport.toLocaleDateString(ownerLocale, ...)}`,  // ✅
    language: ownerLanguage,  // ✅
    currency: organizationCurrency  // ✅
};

// ✅ تمرير اللغة والعملة (كان صحيحاً من قبل)
await sendMonthlyReport(reportData, reportEmails, ownerLanguage, organizationCurrency);
```

## كيف يعمل النظام الآن

### 1. توليد PDF لكل مستلم بلغته
في `email.js`، الدالة `sendDailyReport` تقوم بـ:

```javascript
// تطبيع قائمة الإيميلات (دعم الصيغة القديمة والجديدة)
const normalizedEmails = adminEmails.map(item => {
    if (typeof item === 'string') {
        return { email: item, language: defaultLanguage };
    } else if (item && typeof item === 'object' && item.email) {
        return { email: item.email, language: item.language || defaultLanguage };
    }
});

// توليد PDF منفصل لكل مستلم بلغته
for (const { email, language } of normalizedEmails) {
    const recipientPdfBuffer = await generateDailyReportPDF(reportData, language, currency);
    // إرسال الإيميل مع PDF بلغة المستلم
    await sendEmail({ to: email, attachments: [recipientPdfBuffer] });
}
```

### 2. تنسيق التواريخ والأرقام في PDF
في `pdfGenerator.js`:

```javascript
export const generateDailyReportPDF = async (reportData, language = 'ar', currency = 'EGP') => {
    // ✅ الحصول على الترجمات حسب اللغة
    const t = pdfTranslations[language] || pdfTranslations.ar;
    
    // ✅ الحصول على رمز العملة حسب اللغة
    const currencySymbol = getCurrencySymbol(currency, language);
    
    // ✅ الحصول على locale للتنسيق
    const locale = getLocaleFromLanguage(language);
    
    // ✅ تنسيق الأرقام حسب locale
    const formatNumber = (num) => {
        return Number(num || 0).toLocaleString(locale, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
    };
    
    // ✅ استخدام الترجمات في كل النصوص
    h(Text, null, t.dailyReport.title);
    h(Text, null, t.dailyReport.netProfit);
    // ...
    
    // ✅ تنسيق التواريخ حسب locale
    h(Text, null, `${t.dailyReport.createdAt}: ${new Date().toLocaleString(locale)}`);
};
```

### 3. الترجمات المتاحة
في `pdfTranslations.js`:

```javascript
export const pdfTranslations = {
    ar: {
        dailyReport: {
            title: 'التقرير اليومي',
            netProfit: 'صافي الربح',
            totalRevenue: 'إجمالي الإيرادات',
            // ...
        }
    },
    en: {
        dailyReport: {
            title: 'Daily Report',
            netProfit: 'Net Profit',
            totalRevenue: 'Total Revenue',
            // ...
        }
    },
    fr: {
        dailyReport: {
            title: 'Rapport Quotidien',
            netProfit: 'Bénéfice Net',
            totalRevenue: 'Revenu Total',
            // ...
        }
    }
};
```

## النتيجة المتوقعة

### للمستلمين العرب (ar):
- التواريخ: "١٠ مارس ٢٠٢٦"
- الأرقام: "١٬٢٣٤٫٥٦"
- العملة: "١٬٢٣٤٫٥٦ ج.م"
- النصوص: "التقرير اليومي"، "صافي الربح"، إلخ

### للمستلمين الإنجليز (en):
- التواريخ: "March 10, 2026"
- الأرقام: "1,234.56"
- العملة: "EGP 1,234.56"
- النصوص: "Daily Report", "Net Profit", etc.

### للمستلمين الفرنسيين (fr):
- التواريخ: "10 mars 2026"
- الأرقام: "1 234,56"
- العملة: "1 234,56 EGP"
- النصوص: "Rapport Quotidien", "Bénéfice Net", etc.

## الملفات المعدلة

1. ✅ `server/utils/scheduler.js`
   - `generateDailyReportForOrganization` (السطور ~460-520)
   - `generateMonthlyReportForOrganization` (السطور ~800-850)

## الملفات الموجودة (لم تتغير)

1. ✅ `server/utils/email.js` - يولد PDF لكل مستلم بلغته
2. ✅ `server/utils/pdfGenerator.js` - يدعم اللغات الثلاث
3. ✅ `server/utils/pdfTranslations.js` - يحتوي على الترجمات
4. ✅ `server/utils/localeHelper.js` - يوفر دوال التنسيق
5. ✅ `server/controllers/organizationController.js` - `sendReportNow` كان صحيحاً

## الاختبار

### 1. اختبار التقرير الفوري:
```bash
# اذهب إلى صفحة الإعدادات
# اضغط على "إرسال تقرير الآن"
# تحقق من الإيميلات المستلمة
```

### 2. تحقق من PDF:
- افتح PDF المرسل لمستلم عربي → يجب أن يكون بالعربية
- افتح PDF المرسل لمستلم إنجليزي → يجب أن يكون بالإنجليزية
- افتح PDF المرسل لمستلم فرنسي → يجب أن يكون بالفرنسية

### 3. تحقق من التنسيق:
- التواريخ تظهر بالصيغة الصحيحة لكل لغة
- الأرقام تظهر بالصيغة الصحيحة لكل لغة
- رموز العملة تظهر بالموضع الصحيح
- جميع النصوص مترجمة

## ملاحظات مهمة

1. **صيغة الإيميلات**: النظام يدعم صيغتين:
   ```javascript
   // الصيغة القديمة (سيستخدم اللغة الافتراضية)
   ["email1@example.com", "email2@example.com"]
   
   // الصيغة الجديدة (كل مستلم بلغته)
   [
       { email: "email1@example.com", language: "ar" },
       { email: "email2@example.com", language: "en" },
       { email: "email3@example.com", language: "fr" }
   ]
   ```

2. **اللغة الافتراضية**: إذا لم تحدد لغة للمستلم، سيستخدم النظام لغة مالك المنشأة

3. **العملة**: تستخدم عملة المنشأة المحددة في إعدادات المنشأة

4. **التوافق**: جميع التقارير (يومية، شهرية، فورية) تستخدم نفس المنطق

## تم الإصلاح بتاريخ
${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}

---

## الخلاصة

الآن جميع التقارير المرسلة عبر البريد الإلكتروني تدعم:
- ✅ لغات متعددة (عربي، إنجليزي، فرنسي)
- ✅ تنسيق التواريخ حسب اللغة
- ✅ تنسيق الأرقام حسب اللغة
- ✅ رموز العملة حسب اللغة
- ✅ ترجمة جميع النصوص والثوابت
- ✅ PDF منفصل لكل مستلم بلغته المفضلة
