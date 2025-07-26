# نظام الدفع الجزئي للتكاليف - النسخة المحسنة

## نظرة عامة
تم تطوير نظام دفع جزئي ذكي للتكاليف يتكيف مع اختيارات المستخدم ويوفر تجربة مستخدم محسنة.

## الميزات الجديدة

### 1. واجهة مستخدم ذكية
- **إظهار/إخفاء الحقول حسب الحالة**: تظهر حقول الدفع فقط عندما تكون الحالة ليست "مدفوع"
- **تحديث تلقائي للحالة**: تتغير حالة الدفع تلقائياً بناءً على المبلغ المدفوع
- **ملخص التكلفة المباشر**: عرض فوري لإجمالي التكلفة والمبلغ المدفوع والمتبقي
- **تحقق من المدخلات**: منع إدخال مبالغ أكبر من إجمالي التكلفة

### 2. تحسينات في صفحة المخزون (`src/pages/Inventory.tsx`)

#### الوظائف الجديدة:
```typescript
// حساب المبلغ المتبقي
const calculateRemainingAmount = () => {
  const totalAmount = parseFloat(addForm.price || '0') * parseFloat(addForm.quantity || '0');
  const paidAmount = parseFloat(addForm.paidAmount || '0');
  return Math.max(0, totalAmount - paidAmount);
};

// تحديث حالة الدفع تلقائياً
const updatePaymentStatus = () => {
  const totalAmount = parseFloat(addForm.price || '0') * parseFloat(addForm.quantity || '0');
  const paidAmount = parseFloat(addForm.paidAmount || '0');

  if (paidAmount >= totalAmount && totalAmount > 0) {
    setAddForm(prev => ({ ...prev, costStatus: 'paid' }));
  } else if (paidAmount > 0 && paidAmount < totalAmount) {
    setAddForm(prev => ({ ...prev, costStatus: 'partially_paid' }));
  } else {
    setAddForm(prev => ({ ...prev, costStatus: 'pending' }));
  }
};
```

#### التحسينات في الواجهة:
- **حقول دفع ذكية**: تظهر فقط عندما تكون الحالة ليست "مدفوع"
- **ملخص التكلفة**: عرض مباشر لإجمالي التكلفة والمبالغ
- **تحقق من المدخلات**: منع إدخال مبالغ أكبر من إجمالي التكلفة

### 3. تحسينات في صفحة التكاليف (`src/pages/Costs.tsx`)

#### الوظائف الجديدة:
```typescript
// حساب المبلغ المتبقي
const calculateRemainingAmount = () => {
  const totalAmount = parseFloat(formData.amount || '0');
  const paidAmount = parseFloat(formData.paidAmount || '0');
  return Math.max(0, totalAmount - paidAmount);
};

// تحديث حالة الدفع تلقائياً
const updatePaymentStatus = () => {
  const totalAmount = parseFloat(formData.amount || '0');
  const paidAmount = parseFloat(formData.paidAmount || '0');

  if (paidAmount >= totalAmount && totalAmount > 0) {
    setFormData(prev => ({ ...prev, status: 'paid' }));
  } else if (paidAmount > 0 && paidAmount < totalAmount) {
    setFormData(prev => ({ ...prev, status: 'partially_paid' }));
  } else {
    setFormData(prev => ({ ...prev, status: 'pending' }));
  }
};
```

#### التحسينات في الواجهة:
- **حقول دفع ذكية**: تظهر فقط عندما تكون الحالة ليست "مدفوع"
- **ملخص التكلفة**: عرض مباشر لإجمالي التكلفة والمبالغ
- **تحقق من المدخلات**: منع إدخال مبالغ أكبر من إجمالي التكلفة
- **حالة جديدة**: إضافة "مدفوع جزئياً" مع لون مميز

## التحديثات في النماذج

### نموذج Cost (`server/models/Cost.js`)
- ✅ إضافة `paidAmount` (Number, default 0)
- ✅ إضافة `remainingAmount` (Number, default 0)
- ✅ تحديث `status` enum ليشمل `"partially_paid"`
- ✅ تحديث `pre('save')` hook لحساب `remainingAmount` تلقائياً
- ✅ إضافة `addPayment` method للدفع الجزئي

### نموذج InventoryItem (`server/models/InventoryItem.js`)
- ✅ لا تغييرات مطلوبة (النموذج يدعم التكاليف التلقائية)

## التحديثات في Controllers

### Inventory Controller (`server/controllers/inventoryController.js`)
- ✅ تحديث `createInventoryItem` لقبول `costStatus` و `paidAmount`
- ✅ تحديث `updateStock` لقبول `costStatus` و `paidAmount`
- ✅ إنشاء تكاليف تلقائية مع الحالة والمبلغ المدفوع

### Cost Controller (`server/controllers/costController.js`)
- ✅ إضافة `addCostPayment` function للدفع الجزئي
- ✅ التحقق من صحة المبلغ المدفوع
- ✅ تحديث حالة التكلفة تلقائياً

## التحديثات في Routes

### Cost Routes (`server/routes/costRoutes.js`)
- ✅ إضافة `POST /api/costs/:id/payment` للدفع الجزئي

## التحديثات في Frontend

### API Client (`src/services/api.ts`)
- ✅ تحديث `InventoryItem` interface ليشمل `costStatus` و `paidAmount`
- ✅ تحديث `Cost` interface ليشمل `paidAmount` و `remainingAmount`
- ✅ إضافة `addCostPayment` method

### Inventory Page (`src/pages/Inventory.tsx`)
- ✅ إضافة حقول `costStatus` و `paidAmount` في النموذج
- ✅ إضافة `costStatusOptions` للقائمة المنسدلة
- ✅ إضافة منطق ذكي لإظهار/إخفاء الحقول
- ✅ إضافة ملخص التكلفة المباشر
- ✅ إضافة حساب المبلغ المتبقي

### Costs Page (`src/pages/Costs.tsx`)
- ✅ إضافة حقل `paidAmount` في النموذج
- ✅ إضافة منطق ذكي لإظهار/إخفاء الحقول
- ✅ إضافة ملخص التكلفة المباشر
- ✅ إضافة حساب المبلغ المتبقي
- ✅ تحديث `getStatusText` و `getStatusColor` للحالة الجديدة

## كيفية الاستخدام

### 1. إضافة مخزون جديد
1. اذهب إلى صفحة المخزون
2. اضغط "إضافة مخزون"
3. اختر "إضافة منتج جديد"
4. املأ البيانات الأساسية (الاسم، الفئة، الكمية، السعر)
5. اختر حالة الدفع:
   - **معلق**: لا تظهر حقول الدفع
   - **مدفوع**: لا تظهر حقول الدفع
   - **مدفوع جزئياً**: تظهر حقل المبلغ المدفوع
6. أدخل المبلغ المدفوع (اختياري)
7. ستظهر ملخص التكلفة تلقائياً

### 2. إضافة كمية لمنتج موجود
1. اذهب إلى صفحة المخزون
2. اضغط "إضافة مخزون"
3. اختر "إضافة كمية لمنتج موجود"
4. اختر المنتج وأدخل الكمية والسعر
5. اختر حالة الدفع وأدخل المبلغ المدفوع
6. ستظهر ملخص التكلفة تلقائياً

### 3. إضافة تكلفة جديدة
1. اذهب إلى صفحة التكاليف
2. اضغط "إضافة مصروف جديد"
3. املأ البيانات الأساسية (الفئة، الوصف، المبلغ)
4. اختر حالة الدفع:
   - **معلق**: لا تظهر حقول الدفع
   - **مدفوع**: لا تظهر حقول الدفع
   - **مدفوع جزئياً**: تظهر حقل المبلغ المدفوع
5. أدخل المبلغ المدفوع (اختياري)
6. ستظهر ملخص التكلفة تلقائياً

### 4. إضافة دفعة جزئية لتكلفة موجودة
1. اذهب إلى صفحة التكاليف
2. ابحث عن التكلفة المطلوبة
3. استخدم API endpoint: `POST /api/costs/:id/payment`
4. أرسل البيانات:
   ```json
   {
     "paymentAmount": 100,
     "paymentMethod": "cash",
     "reference": "دفعة جزئية"
   }
   ```

## الميزات الذكية

### 1. التحديث التلقائي للحالة
- عند إدخال مبلغ مساوي أو أكبر من إجمالي التكلفة → تصبح الحالة "مدفوع"
- عند إدخال مبلغ أقل من إجمالي التكلفة → تصبح الحالة "مدفوع جزئياً"
- عند عدم إدخال مبلغ → تصبح الحالة "معلق"

### 2. التحقق من المدخلات
- منع إدخال مبالغ أكبر من إجمالي التكلفة
- عرض المبلغ المتبقي تلقائياً
- تحديث الحد الأقصى للحقل بناءً على إجمالي التكلفة

### 3. ملخص التكلفة المباشر
- عرض إجمالي التكلفة
- عرض المبلغ المدفوع (إذا تم إدخاله)
- عرض المبلغ المتبقي (محسوب تلقائياً)

## الألوان والتصميم

### حالات الدفع:
- **معلق**: أصفر (`bg-yellow-100 text-yellow-800`)
- **مدفوع**: أخضر (`bg-green-100 text-green-800`)
- **مدفوع جزئياً**: أزرق (`bg-blue-100 text-blue-800`)
- **متأخر**: أحمر (`bg-red-100 text-red-800`)

## ملاحظات تقنية

### 1. التوافق مع النظام الحالي
- جميع التحديثات متوافقة مع النظام الحالي
- لا توجد تغييرات في قاعدة البيانات (إضافة حقول جديدة فقط)
- الحفاظ على جميع الوظائف الموجودة

### 2. الأداء
- الحسابات تتم في الواجهة الأمامية (client-side)
- لا توجد طلبات إضافية للخادم
- تحديث فوري للواجهة

### 3. الأمان
- التحقق من صحة المدخلات في الواجهة الأمامية والخلفية
- منع إدخال قيم سالبة أو غير صحيحة
- التحقق من المبالغ في الخادم

## التطوير المستقبلي

### 1. إمكانيات إضافية
- إضافة تاريخ استحقاق للدفعات
- إضافة تنبيهات للدفعات المتأخرة
- إضافة تقارير مفصلة للدفعات

### 2. تحسينات الواجهة
- إضافة رسوم بيانية للدفعات
- إضافة فلترة متقدمة
- إضافة تصدير البيانات

### 3. التكامل
- ربط مع نظام الفواتير
- ربط مع نظام المخزون
- إضافة إشعارات للدفعات
