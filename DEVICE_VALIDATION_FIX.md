# إصلاح مشكلة التحقق من صحة بيانات الأجهزة

## المشكلة
```
[ChangeProcessor] Document validation failed for replace in devices:693fda9dc8e74cbdbca3d797:
- Type mismatch for field "playstationRates": expected Map, got Object
- Required field missing: "hourlyRate"
```

## سبب المشكلة

### 1. مشكلة نوع البيانات
- حقل `playstationRates` يجب أن يكون من نوع `Map` وليس `Object`
- MongoDB يتوقع `Map` لكن البيانات المحفوظة من نوع `Object`

### 2. مشكلة الحقول المطلوبة
- أجهزة الكمبيوتر تحتاج حقل `hourlyRate`
- أجهزة البلايستيشن تحتاج حقل `playstationRates`
- بعض الأجهزة تحتوي على حقول خاطئة لنوعها

## الحل المطبق

### 1. تحديث نموذج Device
تم تغيير نوع حقل `playstationRates` من `Map` إلى `Object` في `server/models/Device.js`:

```javascript
// قبل الإصلاح
playstationRates: {
    type: Map,
    of: Number,
    // ...
}

// بعد الإصلاح  
playstationRates: {
    type: Object,
    required: function () {
        return this.type === "playstation";
    },
    validate: {
        validator: function(value) {
            if (this.type === "playstation" && value) {
                return Object.values(value).every(rate => 
                    typeof rate === 'number' && rate > 0
                );
            }
            return true;
        },
        message: 'أسعار البلايستيشن يجب أن تكون أرقام موجبة'
    }
}
```

### 2. سكريبت الفحص (`server/check-devices-simple.js`)
```bash
cd server
node check-devices-simple.js
```

### 3. سكريبت الاختبار (`server/test-device-model.js`)
```bash
cd server  
node test-device-model.js
```

## هيكل البيانات الصحيح

### أجهزة الكمبيوتر
```javascript
{
  name: "كمبيوتر 1",
  number: "pc1",
  type: "computer",
  hourlyRate: 15,
  // لا يحتوي على playstationRates
}
```

### أجهزة البلايستيشن
```javascript
{
  name: "بلايستيشن 1",
  number: "ps1", 
  type: "playstation",
  controllers: 2,
  playstationRates: {
    '1': 20,
    '2': 20, 
    '3': 25,
    '4': 30
  },
  // لا يحتوي على hourlyRate
}
```

## الأسعار الافتراضية

### البلايستيشن (حسب عدد الدراعات)
- 1-2 دراعات: 20 جنيه/ساعة
- 3 دراعات: 25 جنيه/ساعة  
- 4 دراعات: 30 جنيه/ساعة

### الكمبيوتر
- سعر ثابت: 15 جنيه/ساعة

## خطوات الإصلاح المطبقة

1. **فحص المشكلة:**
   ```bash
   cd server
   node check-devices-simple.js
   ```

2. **تحديث نموذج Device:**
   - تغيير `playstationRates` من `Map` إلى `Object`
   - إضافة validation للتحقق من صحة الأسعار

3. **اختبار النموذج المحدث:**
   ```bash
   cd server
   node test-device-model.js
   ```

4. **النتيجة:**
   - ✅ تم حل مشكلة التحقق من صحة البيانات
   - ✅ النموذج يقبل الآن `Object` بدلاً من `Map`
   - ✅ جميع الأجهزة الموجودة تعمل بشكل صحيح

## الوقاية من المشاكل المستقبلية

### 1. في نموذج Device
- استخدام `Map` بدلاً من `Object` لـ `playstationRates`
- تطبيق التحقق الشرطي للحقول المطلوبة
- استخدام middleware للتحقق من صحة البيانات

### 2. في واجهة المستخدم
- التأكد من إرسال البيانات بالتنسيق الصحيح
- التحقق من نوع الجهاز قبل إرسال البيانات
- عرض الحقول المناسبة لكل نوع جهاز

### 3. في API
- التحقق من صحة البيانات قبل الحفظ
- تحويل البيانات للتنسيق الصحيح إذا لزم الأمر
- إرجاع رسائل خطأ واضحة

## الملفات المتأثرة

### الملفات المُصلحة
- ✅ `server/models/Device.js` - تغيير نوع `playstationRates` من `Map` إلى `Object`
- ✅ `server/models/Session.js` - إصلاح استخدام `playstationRates` (3 مواضع)

### سكريبتات الاختبار والفحص
- `server/check-devices-simple.js` - فحص الأجهزة
- `server/test-device-model.js` - اختبار نموذج الجهاز
- `server/test-session-calculation.js` - اختبار حساب تكلفة الجلسات
- `DEVICE_VALIDATION_FIX.md` - هذا التوثيق

## الإصلاحات المطبقة

### 1. في `server/models/Device.js`
```javascript
// تغيير من Map إلى Object
playstationRates: {
    type: Object, // بدلاً من Map
    required: function () {
        return this.type === "playstation";
    },
    validate: {
        validator: function(value) {
            if (this.type === "playstation" && value) {
                return Object.values(value).every(rate => 
                    typeof rate === 'number' && rate > 0
                );
            }
            return true;
        },
        message: 'أسعار البلايستيشن يجب أن تكون أرقام موجبة'
    }
}
```

### 2. في `server/models/Session.js` (3 مواضع)
```javascript
// قبل الإصلاح
return device.playstationRates.get(String(controllers)) || 0;

// بعد الإصلاح
return device.playstationRates[String(controllers)] || 0;
```

## النتائج

### ✅ المشاكل المُحلة
- إصلاح خطأ `Type mismatch for field "playstationRates": expected Map, got Object`
- إصلاح خطأ `device.playstationRates.get is not a function`
- جميع حسابات تكلفة الجلسات تعمل بشكل صحيح

### ✅ الاختبارات المُجتازة
- إنشاء وتحديث الأجهزة ✅
- حساب تكلفة الجلسات الحالية ✅
- الوصول لأسعار البلايستيشن حسب عدد الدراعات ✅
- التحقق من صحة البيانات ✅