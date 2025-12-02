# إصلاح مشكلة بقاء الطاولة "مختارة" بعد إغلاق نافذة الطلب

## المشكلة
عند الضغط على كارت الطاولة في صفحة الطلبات، تظهر كلمة "مختارة" على الطاولة. ولكن عند إغلاق نافذة الطلب، كانت الطاولة تبقى في حالة "مختارة" بدلاً من الرجوع إلى حالتها الأساسية (محجوزة أو فارغة).

## السبب
لم يكن هناك إعادة تعيين لـ `selectedTable` إلى `null` عند:
1. إغلاق نافذة الطلبات (Table Orders Modal) - **الأهم**
2. إغلاق نافذة الطلب الجديد
3. إغلاق نافذة تعديل الطلب
4. حفظ الطلب بنجاح
5. تحديث الطلب بنجاح

## الحل المطبق

### 1. إضافة `setSelectedTable(null)` في زر إغلاق نافذة الطلبات
```typescript
// قبل الإصلاح
onClick={() => setShowTableOrdersModal(false)}

// بعد الإصلاح
onClick={() => {
  setShowTableOrdersModal(false);
  setSelectedTable(null);  // ✅ إضافة
}}
```

### 2. إضافة `setSelectedTable(null)` في onClose للنافذة الجديدة
```typescript
// قبل الإصلاح
onClose={() => {
  setShowOrderModal(false);
  setCurrentOrderItems([]);
  setOrderNotes('');
}}

// بعد الإصلاح
onClose={() => {
  setShowOrderModal(false);
  setSelectedTable(null);  // ✅ إضافة
  setCurrentOrderItems([]);
  setOrderNotes('');
}}
```

### 3. إضافة `setSelectedTable(null)` في onClose لنافذة التعديل
```typescript
// قبل الإصلاح
onClose={() => {
  setShowEditOrderModal(false);
  setSelectedOrder(null);
  setCurrentOrderItems([]);
  setOrderNotes('');
}}

// بعد الإصلاح
onClose={() => {
  setShowEditOrderModal(false);
  setSelectedTable(null);  // ✅ إضافة
  setSelectedOrder(null);
  setCurrentOrderItems([]);
  setOrderNotes('');
}}
```

### 4. إضافة `setSelectedTable(null)` في handleSaveOrder
```typescript
// قبل الإصلاح
setShowOrderModal(false);
setCurrentOrderItems([]);
setOrderNotes('');

// بعد الإصلاح
setShowOrderModal(false);
setSelectedTable(null);  // ✅ إضافة
setCurrentOrderItems([]);
setOrderNotes('');
```

### 5. إضافة `setSelectedTable(null)` في handleUpdateOrder
```typescript
// قبل الإصلاح
setShowEditOrderModal(false);
setSelectedOrder(null);
setCurrentOrderItems([]);
setOrderNotes('');

// بعد الإصلاح
setShowEditOrderModal(false);
setSelectedTable(null);  // ✅ إضافة
setSelectedOrder(null);
setCurrentOrderItems([]);
setOrderNotes('');
```

## النتيجة

### السلوك الصحيح الآن:
1. ✅ عند الضغط على الطاولة → تظهر "مختارة" وتفتح نافذة الطلبات
2. ✅ عند إغلاق نافذة الطلبات بزر X → الطاولة ترجع لحالتها الأساسية (محجوزة/فارغة)
3. ✅ عند فتح نافذة طلب جديد → تظهر "مختارة"
4. ✅ عند إغلاق نافذة الطلب الجديد → الطاولة ترجع لحالتها الأساسية
5. ✅ عند حفظ الطلب → النافذة تغلق والطاولة ترجع لحالتها الأساسية
6. ✅ عند تعديل الطلب → نفس السلوك الصحيح

### الحالات المدعومة:
- **طاولة فارغة**: 
  - قبل الضغط: شارة "فارغة" خضراء
  - أثناء التحديد: شارة "مختارة" برتقالية
  - بعد الإغلاق: ترجع لـ "فارغة" خضراء
  
- **طاولة محجوزة**:
  - قبل الضغط: شارة "محجوزة" حمراء نابضة
  - أثناء التحديد: شارة "مختارة" برتقالية
  - بعد الإغلاق: ترجع لـ "محجوزة" حمراء نابضة

## الملفات المعدلة
- `src/pages/Cafe.tsx`

## الفوائد
- ✅ تجربة مستخدم أفضل وأكثر وضوحاً
- ✅ الطاولة تعود لحالتها الطبيعية بعد إغلاق النافذة
- ✅ لا يوجد التباس في حالة الطاولة
- ✅ السلوك متسق في جميع الحالات (إغلاق، حفظ، تعديل)

## ملاحظات
- الإصلاح لا يؤثر على وظائف الطلبات الأخرى
- الإصلاح يعمل مع جميع النوافذ (نافذة الطلبات، نافذة الطلب الجديد، نافذة التعديل)
- الحالة "مختارة" تظهر فقط أثناء فتح أي نافذة
- **الإصلاح الأهم**: إضافة `setSelectedTable(null)` في زر إغلاق نافذة الطلبات (Table Orders Modal)
