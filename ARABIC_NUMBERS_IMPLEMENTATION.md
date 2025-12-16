# تطبيق الأرقام العربية في نافذة الطلبات

## المطلوب
تحويل جميع الأرقام في نافذة إضافة وتعديل الطلبات إلى الأرقام العربية (٠١٢٣٤٥٦٧٨٩) بما في ذلك:
- الأسعار (٥ ج.م)
- الكميات (× ٢)
- المجاميع (= ١٠ ج.م)
- رقم العداد

## التطبيق

### 1. إضافة دوال التحويل
```typescript
// دالة تحويل الأرقام الإنجليزية إلى العربية
const convertToArabicNumbers = (str: string | number): string => {
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.toString().replace(/[0-9]/g, (match) => arabicNumbers[parseInt(match)]);
};

// دالة تنسيق العملة بالأرقام العربية
const formatCurrencyArabic = (amount: number): string => {
  const formatted = formatCurrency(amount);
  return convertToArabicNumbers(formatted);
};
```

### 2. الأماكن المُحدثة

#### أ) عرض السعر والكمية والمجموع لكل عنصر
```typescript
// قبل التحديث
{formatCurrency(item.price)} × {item.quantity} = {formatCurrency(item.price * item.quantity)}

// بعد التحديث
{formatCurrencyArabic(item.price)} × {convertToArabicNumbers(item.quantity)} = {formatCurrencyArabic(item.price * item.quantity)}
```

**النتيجة:** `٥ ج.م × ٢ = ١٠ ج.م`

#### ب) رقم العداد (الكمية)
```typescript
// قبل التحديث
<span className="font-bold text-lg text-blue-800 dark:text-white text-center block">{item.quantity}</span>

// بعد التحديث
<span className="font-bold text-lg text-blue-800 dark:text-white text-center block">{convertToArabicNumbers(item.quantity)}</span>
```

**النتيجة:** العداد يظهر `٢` بدلاً من `2`

#### ج) المجموع الإجمالي
```typescript
// قبل التحديث
{formatCurrency(calculateTotal())}

// بعد التحديث
{formatCurrencyArabic(calculateTotal())}
```

**النتيجة:** `١٥ ج.م` بدلاً من `15 ج.م`

#### د) أسعار العناصر في قائمة الطعام
```typescript
// قبل التحديث
{formatCurrency(item.price)}

// بعد التحديث
{formatCurrencyArabic(item.price)}
```

#### هـ) مجاميع الطلبات الموجودة
```typescript
// قبل التحديث
if (order.finalAmount) return formatCurrency(order.finalAmount);
if (order.totalAmount) return formatCurrency(order.totalAmount);
return formatCurrency(total);

// بعد التحديث
if (order.finalAmount) return formatCurrencyArabic(order.finalAmount);
if (order.totalAmount) return formatCurrencyArabic(order.totalAmount);
return formatCurrencyArabic(total);
```

#### و) المجموع في قائمة الطلبات الجانبية
```typescript
// قبل التحديث
{formatCurrency(calculateTotal())}

// بعد التحديث
{formatCurrencyArabic(calculateTotal())}
```

## الأماكن المُحدثة بالتفصيل

### 1. عرض تفاصيل العنصر في قسم الطلبات
- **السعر**: `٥ ج.م` بدلاً من `5 ج.م`
- **الكمية**: `× ٢` بدلاً من `× 2`
- **المجموع**: `= ١٠ ج.م` بدلاً من `= 10 ج.م`

### 2. العداد (أزرار + و -)
- **الرقم المعروض**: `٢` بدلاً من `2`
- **الأزرار**: تبقى كما هي (+ و -) لأنها رموز وليست أرقام

### 3. المجموع الإجمالي
- **النص**: `الإجمالي: ١٥ ج.م` بدلاً من `الإجمالي: 15 ج.م`

### 4. أسعار العناصر في قائمة الطعام
- **كل سعر**: `٥ ج.م` بدلاً من `5 ج.م`

### 5. مجاميع الطلبات الموجودة
- **كل مجموع**: `٢٠ ج.م` بدلاً من `20 ج.م`

### 6. عدد العناصر بجانب كلمة "الطلبات"
- **العدد**: `الطلبات ٣` بدلاً من `الطلبات 3`

### 7. أرقام الطاولات
- **رقم الطاولة**: `طاولة ٥` بدلاً من `طاولة 5`

### 8. إحصائيات الأقسام والطاولات
- **عدد الأقسام**: `٣ أقسام` بدلاً من `3 أقسام`
- **عدد الطاولات**: `١٢ طاولات` بدلاً من `12 طاولات`
- **طاولات القسم**: `٤ طاولة` بدلاً من `4 طاولة`

### 9. عدد الطلبات للطاولة المحددة
- **عدد الطلبات**: `٢ طلبات` بدلاً من `2 طلبات`

## المميزات

### 1. تجربة مستخدم محسنة
- **قراءة أسهل**: الأرقام العربية أكثر وضوحاً للمستخدمين العرب
- **اتساق**: جميع الأرقام بنفس النمط في كامل النافذة

### 2. دعم كامل للغة العربية
- **الأرقام**: ٠١٢٣٤٥٦٧٨٩
- **العملة**: ج.م (تبقى كما هي)
- **الرموز**: × و = (تبقى كما هي)

### 3. مرونة في التطبيق
- **دالة قابلة للإعادة الاستخدام**: `convertToArabicNumbers`
- **دالة مخصصة للعملة**: `formatCurrencyArabic`
- **سهولة التطبيق**: يمكن تطبيقها في أي مكان آخر

## النتيجة النهائية

### مثال على عنصر في الطلب:
```
شاي أحمر
٥ ج.م × ٢ = ١٠ ج.م
[−] [٢] [+]
```

### مثال على المجموع الإجمالي:
```
الإجمالي: ٢٥ ج.م
```

### مثال على عنوان الطلبات:
```
الطلبات ٣
```

### مثال على رقم الطاولة:
```
طاولة ٥
```

### مثال على الإحصائيات:
```
٣ أقسام • ١٢ طاولات
٤ طاولة (في القسم)
٢ طلبات (للطاولة المحددة)
```

## الملفات المُحدثة
- `src/pages/Cafe.tsx` - تطبيق الأرقام العربية في جميع الأماكن المطلوبة
- `ARABIC_NUMBERS_IMPLEMENTATION.md` - هذا التوثيق