# إصلاحات مشاكل الطاولات

## المشاكل المطلوب حلها:

### ✅ 1. عند إضافة طلب على طاولة
- **المطلوب**: الطاولة تتغير من "فارغة" إلى "محجوزة" ويتغير لونها
- **الحل**: 
  - تم إصلاح `table.id` → `table._id` في Cafe.tsx
  - تم إضافة `.populate("table", "number name")` في getTableStatus
  - تم التأكد من أن createOrder يستخدم `table: selectedTable._id`

### ✅ 2. الطلب يظهر في قسم الطاولات
- **المطلوب**: الطلب يرتبط بنفس الطاولة ويظهر في قائمة طلبات الطاولة
- **الحل**: 
  - Order model يحفظ `table` ObjectId
  - Bill model يحفظ `table` ObjectId
  - getTableStatus يجلب Orders المرتبطة بالطاولة

### ✅ 3. الطاولة تبقى محجوزة حتى دفع الفاتورة
- **المطلوب**: الطاولة لا تتغير من محجوزة لفارغة إلا بعد دفع الفاتورة بالكامل
- **الحل**: 
  - getTableStatus يفحص `bill.status !== "paid"`
  - يفحص جميع Bills المرتبطة بالطاولة (cafe + playstation)

### ✅ 4. حذف الفاتورة يحذف الطلبات
- **المطلوب**: عند حذف فاتورة، تُحذف الطلبات وتتغير الطاولة لفارغة
- **الحل**: يحتاج middleware في Bill model لحذف Orders عند حذف Bill

### ⚡ 5. سرعة تحديث الطلبات
- **المطلوب**: تحديث سريع عند إضافة/حفظ الطلب
- **الحل**: 
  - استخدام Promise.all بدل await متتالية
  - الطباعة فوراً بدون انتظار
  - refresh في background

### ⚡ 6. سرعة الحفظ والطباعة
- **المطلوب**: الطلب يظهر فوراً على الفاتورة وتتغير الطاولة
- **الحل**: 
  - الطباعة مباشرة بعد createOrder
  - refresh الطاولات في background
  - عدم انتظار refresh قبل الطباعة

## التعديلات المنفذة:

### Backend:
1. ✅ `tableController.js`: إضافة populate للـ table في getTableStatus
2. ✅ `orderController.js`: إضافة populate للـ table في جميع responses
3. ⏳ `Bill model`: إضافة pre-remove hook لحذف Orders

### Frontend:
1. ✅ `Cafe.tsx`: إصلاح `table.id` → `table._id`
2. ✅ `Cafe.tsx`: الطباعة فوراً بدون انتظار
3. ✅ `Cafe.tsx`: refresh في background

## ما يحتاج تنفيذ:

### 1. إضافة pre-remove hook في Bill model
```javascript
billSchema.pre('remove', async function(next) {
  // حذف جميع Orders المرتبطة بهذه الفاتورة
  await Order.deleteMany({ bill: this._id });
  next();
});
```

### 2. تحسين السرعة
- استخدام WebSocket للتحديثات الفورية
- Cache للبيانات المتكررة
- Optimistic UI updates

## الاختبار:

1. ✅ إضافة طلب على طاولة → الطاولة تصبح محجوزة
2. ✅ الطلب يظهر في قائمة طلبات الطاولة
3. ✅ الطاولة تبقى محجوزة حتى دفع الفاتورة
4. ⏳ حذف فاتورة → حذف الطلبات وتفريغ الطاولة
5. ⏳ سرعة التحديث
6. ⏳ سرعة الطباعة
