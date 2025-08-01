# نظام الإعدادات المتقدم

## نظرة عامة

تم تطوير نظام إعدادات متقدم ومتكامل مع نظام إدارة الصلاحيات والتحقق التلقائي من الأخطاء. النظام يدعم إنشاء الإعدادات تلقائياً عند الحاجة ويوفر واجهة مستخدم محسنة.

## الميزات الرئيسية

### 🔐 نظام الصلاحيات
- **صاحب المنشأة**: صلاحيات كاملة على جميع الإعدادات
- **مدير**: إدارة كاملة للنظام مع صلاحيات محدودة للإعدادات الحساسة
- **مشرف**: إدارة العمليات اليومية والإعدادات الأساسية
- **كاشير**: إدارة المبيعات والمدفوعات
- **مطبخ**: إدارة الطلبات والقائمة
- **موظف**: إدارة الجلسات والأجهزة

### ⚡ الإعدادات التلقائية
- إنشاء الإعدادات الافتراضية تلقائياً عند الحاجة
- التحقق من صحة الإعدادات في الوقت الفعلي
- عرض التحذيرات والأخطاء بشكل واضح
- دعم الإعدادات المخصصة والإعدادات الافتراضية

### 🔍 التحقق من الأخطاء
- التحقق من صحة البيانات المدخلة
- عرض رسائل خطأ واضحة ومفيدة
- دعم التحذيرات والإشعارات
- التحقق من الصلاحيات قبل التعديل

### 📊 ملخص الإعدادات
- عرض إحصائيات شاملة للإعدادات
- تتبع الإعدادات المخصصة والافتراضية
- عرض الأخطاء والتحذيرات
- تاريخ آخر تحديث

## هيكل النظام

### النماذج (Models)

#### Settings Model
```javascript
{
  category: String, // فئة الإعدادات
  settings: Mixed, // بيانات الإعدادات
  organization: ObjectId, // المنظمة
  updatedBy: ObjectId, // المستخدم الذي حدث الإعدادات
  isDefault: Boolean, // هل هي إعدادات افتراضية
  version: Number, // إصدار الإعدادات
  lastValidated: Date, // تاريخ آخر تحقق
  validationErrors: Array // أخطاء التحقق
}
```

### المتحكمات (Controllers)

#### getSettings
- جلب إعدادات فئة معينة
- التحقق من الصلاحيات
- إنشاء الإعدادات تلقائياً إذا لم تكن موجودة
- التحقق من صحة الإعدادات

#### updateSettings
- تحديث الإعدادات مع دمج البيانات
- التحقق من الصلاحيات
- التحقق من صحة البيانات
- تسجيل التغييرات

#### getAllSettings
- جلب جميع فئات الإعدادات
- إنشاء الإعدادات المفقودة تلقائياً
- التحقق من صحة جميع الإعدادات

#### resetSettings
- إعادة تعيين الإعدادات للقيم الافتراضية
- التحقق من الصلاحيات
- تسجيل العملية

#### validateSettings
- التحقق من صحة الإعدادات
- إرجاع قائمة الأخطاء والتحذيرات
- دعم التحقق المخصص

#### exportSettings/importSettings
- تصدير واستيراد الإعدادات
- التحقق من صحة البيانات المستوردة
- دعم النسخ الاحتياطي

#### getSettingsSummary
- ملخص شامل للإعدادات
- إحصائيات الإعدادات المخصصة والافتراضية
- تتبع الأخطاء والتحذيرات

### المسارات (Routes)

```javascript
GET    /api/settings/summary          // ملخص الإعدادات
GET    /api/settings                  // جميع الإعدادات
GET    /api/settings/export           // تصدير الإعدادات
POST   /api/settings/import           // استيراد الإعدادات
GET    /api/settings/:category        // إعدادات فئة معينة
PUT    /api/settings/:category        // تحديث إعدادات فئة
POST   /api/settings/:category/reset  // إعادة تعيين إعدادات فئة
POST   /api/settings/:category/validate // التحقق من إعدادات فئة
```

## فئات الإعدادات

### 1. الإعدادات العامة (General)
```javascript
{
  cafeName: String,        // اسم المقهى
  currency: String,        // العملة
  timezone: String,        // المنطقة الزمنية
  language: String,        // اللغة
  address: String,         // العنوان
  phone: String,          // رقم الهاتف
  email: String,          // البريد الإلكتروني
  taxRate: Number,        // نسبة الضريبة
  taxInclusive: Boolean,  // الضريبة شاملة
  logo: String,           // الشعار
  website: String,        // الموقع الإلكتروني
  socialMedia: {          // وسائل التواصل الاجتماعي
    facebook: String,
    instagram: String,
    twitter: String
  }
}
```

### 2. إعدادات الأعمال (Business)
```javascript
{
  billNumberFormat: String,           // تنسيق رقم الفاتورة
  autoGenerateBillNumber: Boolean,    // توليد رقم الفاتورة تلقائياً
  defaultPaymentMethod: String,       // طريقة الدفع الافتراضية
  allowPartialPayments: Boolean,      // السماح بالمدفوعات الجزئية
  maxDiscountPercentage: Number,      // نسبة الخصم القصوى
  sessionTimeout: Number,             // مهلة الجلسة
  tableNumbering: String,            // ترقيم الطاولات
  maxTables: Number,                 // عدد الطاولات الأقصى
  workingHours: {                    // ساعات العمل
    start: String,
    end: String,
    daysOff: Array
  },
  deliverySettings: {                 // إعدادات التوصيل
    enabled: Boolean,
    radius: Number,
    fee: Number
  },
  loyaltyProgram: {                   // برنامج الولاء
    enabled: Boolean,
    pointsPerCurrency: Number,
    redemptionRate: Number
  }
}
```

### 3. إعدادات المخزون (Inventory)
```javascript
{
  lowStockThreshold: Number,          // حد المخزون المنخفض
  criticalStockThreshold: Number,     // حد المخزون الحرج
  autoReorderEnabled: Boolean,        // إعادة الطلب التلقائي
  reorderThreshold: Number,           // حد إعادة الطلب
  defaultSupplier: String,            // المورد الافتراضي
  unitConversions: Object,            // تحويلات الوحدات
  expiryWarningDays: Number,          // أيام تحذير انتهاء الصلاحية
  barcodeEnabled: Boolean,            // تفعيل الباركود
  autoDeductStock: Boolean,          // خصم المخزون تلقائياً
  allowNegativeStock: Boolean,        // السماح بالمخزون السالب
  stockMovementLogging: Boolean,      // تسجيل حركة المخزون
  suppliers: Array                    // الموردين
}
```

### 4. إعدادات الإشعارات (Notifications)
```javascript
{
  sessions: {                         // إشعارات الجلسات
    sessionEnd: Boolean,
    sessionStart: Boolean,
    sessionPause: Boolean
  },
  orders: {                           // إشعارات الطلبات
    newOrder: Boolean,
    orderReady: Boolean,
    orderCancelled: Boolean,
    orderDelivered: Boolean
  },
  inventory: {                        // إشعارات المخزون
    lowStock: Boolean,
    outOfStock: Boolean,
    expiryWarning: Boolean,
    reorderReminder: Boolean
  },
  billing: {                          // إشعارات الفواتير
    newBill: Boolean,
    paymentReceived: Boolean,
    partialPayment: Boolean,
    overduePayment: Boolean
  },
  sound: {                            // إعدادات الصوت
    enabled: Boolean,
    volume: Number,
    defaultTone: String,
    priorityTones: Boolean,
    customTones: Object
  },
  display: {                          // إعدادات العرض
    showCount: Boolean,
    autoMarkRead: Boolean,
    displayDuration: Number,
    position: String
  },
  email: {                            // إعدادات البريد الإلكتروني
    enabled: Boolean,
    smtpSettings: Object,
    templates: Object
  }
}
```

### 5. إعدادات المظهر (Appearance)
```javascript
{
  theme: String,                      // المظهر
  primaryColor: String,               // اللون الأساسي
  secondaryColor: String,             // اللون الثانوي
  fontSize: String,                   // حجم الخط
  fontFamily: String,                 // نوع الخط
  sidebarVisible: Boolean,            // إظهار الشريط الجانبي
  userInfoVisible: Boolean,           // إظهار معلومات المستخدم
  fullscreenMode: Boolean,            // الوضع ملء الشاشة
  rtlEnabled: Boolean,                // تفعيل RTL
  animations: {                       // الرسوم المتحركة
    enabled: Boolean,
    duration: Number
  },
  customCSS: String                   // CSS مخصص
}
```

### 6. إعدادات الأمان (Security)
```javascript
{
  passwordPolicy: {                   // سياسة كلمة المرور
    minLength: Number,
    requireUppercase: Boolean,
    requireNumbers: Boolean,
    requireSpecialChars: Boolean,
    expiryDays: Number,
    preventReuse: Number
  },
  session: {                          // إعدادات الجلسة
    timeout: Number,
    maxConcurrent: Number,
    forceLogout: Boolean,
    rememberMe: Boolean,
    ipRestriction: Boolean,
    allowedIPs: Array
  },
  audit: {                            // التدقيق
    enabled: Boolean,
    logLevel: String,
    retentionDays: Number,
    logActions: Array
  },
  permissions: {                      // الصلاحيات
    allowMultiLogin: Boolean,
    requireApproval: Boolean,
    dataEncryption: Boolean,
    twoFactorAuth: Boolean,
    loginAttempts: Number,
    lockoutDuration: Number
  },
  api: {                              // إعدادات API
    rateLimit: Number,
    apiKeyExpiry: Number,
    corsEnabled: Boolean,
    allowedOrigins: Array
  }
}
```

### 7. إعدادات النسخ الاحتياطي (Backup)
```javascript
{
  autoBackup: {                       // النسخ الاحتياطي التلقائي
    enabled: Boolean,
    frequency: String,
    keepCount: Number,
    time: String,
    compression: Boolean,
    encryption: Boolean
  },
  manualBackup: {                     // النسخ الاحتياطي اليدوي
    lastBackup: String,
    backupSize: String,
    backupLocation: String
  },
  restore: {                          // الاستعادة
    allowRestore: Boolean,
    requireConfirmation: Boolean,
    validateBackup: Boolean
  },
  cloud: {                            // التخزين السحابي
    enabled: Boolean,
    provider: String,
    credentials: Object,
    syncFrequency: Number
  }
}
```

### 8. الإعدادات المتقدمة (Advanced)
```javascript
{
  performance: {                      // الأداء
    cacheEnabled: Boolean,
    cacheDuration: Number,
    maxCacheSize: Number,
    autoRefresh: Boolean,
    refreshInterval: Number,
    compression: Boolean,
    minification: Boolean
  },
  dataRetention: {                    // الاحتفاظ بالبيانات
    logs: Number,
    backups: Number,
    tempFiles: Number,
    userSessions: Number,
    auditLogs: Number
  },
  system: {                           // النظام
    debugMode: Boolean,
    maintenanceMode: Boolean,
    autoUpdate: Boolean,
    errorReporting: Boolean,
    analytics: Boolean
  },
  integrations: {                     // التكامل
    paymentGateways: Object,
    sms: Object,
    printer: Object
  }
}
```

### 9. إعدادات التقارير (Reports)
```javascript
{
  defaultPeriod: String,              // الفترة الافتراضية
  autoGenerate: Boolean,              // التوليد التلقائي
  emailReports: Boolean,              // إرسال التقارير بالبريد
  reportFormat: String,               // تنسيق التقرير
  customReports: Array,               // التقارير المخصصة
  charts: {                           // الرسوم البيانية
    defaultType: String,
    colors: Array,
    animations: Boolean
  }
}
```

### 10. إعدادات المستخدمين (Users)
```javascript
{
  roles: Array,                       // الأدوار
  defaultPermissions: Object,          // الصلاحيات الافتراضية
  userManagement: {                   // إدارة المستخدمين
    allowRegistration: Boolean,
    requireEmailVerification: Boolean,
    requirePhoneVerification: Boolean,
    maxUsers: Number,
    inactiveUserTimeout: Number
  },
  profile: {                          // الملف الشخصي
    allowAvatar: Boolean,
    allowCustomFields: Boolean,
    requiredFields: Array
  }
}
```

## الصلاحيات

### صاحب المنشأة (Owner)
- صلاحيات كاملة على جميع الإعدادات
- إمكانية تعديل جميع الإعدادات الحساسة
- إدارة الصلاحيات والأدوار

### مدير (Admin)
- إدارة كاملة للنظام
- صلاحيات محدودة للإعدادات الحساسة
- إدارة المستخدمين والإعدادات الأساسية

### مشرف (Manager)
- إدارة العمليات اليومية
- إعدادات المخزون والطلبات
- تقارير المبيعات

### كاشير (Cashier)
- إدارة المبيعات والمدفوعات
- إعدادات الفواتير
- إدارة الجلسات

### مطبخ (Kitchen)
- إدارة الطلبات
- إعدادات القائمة
- إدارة المخزون الأساسي

### موظف (Staff)
- إدارة الجلسات
- إدارة الأجهزة
- عرض التقارير الأساسية

## التحقق من الأخطاء

### التحقق من الإعدادات العامة
- اسم المقهى مطلوب وأكثر من حرفين
- نسبة الضريبة بين 0 و 100
- البريد الإلكتروني صحيح (إذا تم إدخاله)

### التحقق من إعدادات الأعمال
- نسبة الخصم القصوى بين 0 و 100
- مهلة الجلسة بين 1 و 480 دقيقة

### التحقق من إعدادات المخزون
- حدود المخزون لا يمكن أن تكون سالبة
- أيام تحذير انتهاء الصلاحية إيجابية

### التحقق من إعدادات الأمان
- الحد الأدنى لكلمة المرور 6 أحرف على الأقل
- مهلة الجلسة بين 5 و 1440 دقيقة

## الاستخدام

### في الفرونت إند
```typescript
// جلب إعدادات فئة معينة
const response = await api.getSettings('general');

// تحديث إعدادات
const response = await api.updateSettings('general', {
  cafeName: 'مقهى جديد',
  taxRate: 14
});

// إعادة تعيين الإعدادات
const response = await api.resetSettings('general');

// التحقق من الإعدادات
const response = await api.validateSettings('general', settings);

// جلب ملخص الإعدادات
const response = await api.getSettingsSummary();

// تصدير الإعدادات
const response = await api.exportSettings();

// استيراد الإعدادات
const response = await api.importSettings(importData);
```

### في الباك إند
```javascript
// جلب إعدادات
const settings = await Settings.findOne({
  category: 'general',
  organization: req.user.organization
});

// تحديث إعدادات
const updatedSettings = await Settings.findOneAndUpdate(
  { category: 'general', organization: req.user.organization },
  { settings: newSettings, updatedBy: req.user._id },
  { new: true, upsert: true }
);

// التحقق من صحة الإعدادات
const isValid = settings.validateSettings();
```

## الميزات المتقدمة

### 1. الإعدادات التلقائية
- إنشاء الإعدادات الافتراضية عند الحاجة
- دمج الإعدادات الجديدة مع الموجودة
- الحفاظ على الإعدادات المخصصة

### 2. التحقق في الوقت الفعلي
- التحقق من صحة البيانات أثناء الكتابة
- عرض الأخطاء والتحذيرات فوراً
- منع حفظ البيانات غير الصحيحة

### 3. نظام الصلاحيات المتقدم
- صلاحيات دقيقة لكل فئة إعدادات
- دعم الأدوار المتعددة
- التحقق من الصلاحيات في كل عملية

### 4. النسخ الاحتياطي والاستيراد
- تصدير واستيراد الإعدادات
- التحقق من صحة البيانات المستوردة
- دعم النسخ الاحتياطي التلقائي

### 5. المراقبة والتتبع
- تسجيل جميع التغييرات
- تتبع المستخدمين الذين قاموا بالتعديل
- إحصائيات شاملة للإعدادات

## التطوير المستقبلي

### 1. إعدادات متقدمة
- دعم الإعدادات المشروطة
- إعدادات مخصصة لكل مستخدم
- دعم الإعدادات المؤقتة

### 2. واجهة محسنة
- محرر إعدادات متقدم
- معاينة الإعدادات
- دعم السحب والإفلات

### 3. تكامل متقدم
- دعم APIs خارجية
- تكامل مع أنظمة الدفع
- دعم الأجهزة الخارجية

### 4. أمان محسن
- تشفير الإعدادات الحساسة
- دعم المصادقة الثنائية
- مراقبة الأمان المتقدمة

## الخلاصة

نظام الإعدادات الجديد يوفر:
- ✅ إدارة شاملة ومتقدمة للإعدادات
- ✅ نظام صلاحيات متطور وآمن
- ✅ تحقق تلقائي من الأخطاء
- ✅ واجهة مستخدم محسنة وسهلة الاستخدام
- ✅ دعم الإعدادات التلقائية
- ✅ نظام نسخ احتياطي متقدم
- ✅ مراقبة وتتبع شامل
- ✅ قابلية التوسع والتطوير

هذا النظام يوفر أساساً قوياً لإدارة إعدادات النظام بطريقة آمنة ومتطورة.
