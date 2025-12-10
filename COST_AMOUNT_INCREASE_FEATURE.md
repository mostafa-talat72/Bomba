# ميزة زيادة مبلغ التكلفة - Cost Amount Increase Feature

## نظرة عامة
تم إضافة نظام كامل لزيادة مبلغ التكاليف مع تسجيل تاريخي لجميع الزيادات.

## الميزات المضافة

### 1. Backend (Server)

#### Model Updates (`server/models/Cost.js`)
- ✅ إضافة حقل `amountHistory` لتسجيل جميع زيادات المبلغ
- ✅ كل زيادة تحتوي على:
  - `addedAmount`: المبلغ المضاف
  - `previousTotal`: المبلغ الإجمالي السابق
  - `newTotal`: المبلغ الإجمالي الجديد
  - `addedBy`: المستخدم الذي قام بالزيادة (ref to User)
  - `addedAt`: تاريخ ووقت الزيادة
  - `reason`: سبب الزيادة (اختياري)

#### Method: `increaseAmount()`
```javascript
cost.increaseAmount(additionalAmount, addedBy, reason)
```
- يتحقق من صحة المبلغ المضاف
- يسجل الزيادة في `amountHistory`
- يحدث المبلغ الإجمالي تلقائياً
- يعيد حساب `remainingAmount` و `status` تلقائياً عبر pre-save hook

#### Controller (`server/controllers/costController.js`)
- ✅ إضافة `increaseCostAmount` method
- ✅ Endpoint: `POST /api/costs/:id/increase`
- ✅ Validation للمبلغ المضاف
- ✅ Populate لحقول `amountHistory.addedBy` و `paymentHistory.paidBy`
- ✅ تحديث `getCosts()` و `getCost()` و `addCostPayment()` لـ populate الحقول الجديدة

#### Routes (`server/routes/costRoutes.js`)
- ✅ إضافة route: `POST /:id/increase`
- ✅ Authorization: `authorize("costs", "all")`

### 2. Frontend (Client)

#### Types & Interfaces (`src/pages/Costs.tsx`)
- ✅ إضافة `AmountHistoryItem` interface
- ✅ تحديث `Cost` interface لإضافة `amountHistory`

#### Component: `CostDetailsModal` (`src/components/CostDetailsModal.tsx`)
- ✅ عرض سجل زيادات المبلغ (`amountHistory`)
- ✅ زر "زيادة المبلغ" في footer
- ✅ Modal منفصل لإدخال المبلغ الإضافي والسبب
- ✅ عرض تفصيلي لكل زيادة:
  - المبلغ المضاف
  - التحول من المبلغ السابق إلى الجديد
  - التاريخ والوقت
  - المستخدم الذي قام بالزيادة
  - السبب (إن وجد)
- ✅ تصميم مميز بألوان برتقالية/صفراء للتمييز عن سجل الدفعات

#### Integration (`src/pages/Costs.tsx`)
- ✅ تمرير `onRefresh` prop إلى `CostDetailsModal`
- ✅ تحديث البيانات تلقائياً بعد زيادة المبلغ

## كيفية الاستخدام

### من واجهة المستخدم:
1. افتح صفحة التكاليف
2. اضغط على أي كارت تكلفة لفتح التفاصيل
3. اضغط على زر "زيادة المبلغ" في الأسفل
4. أدخل المبلغ الإضافي (مطلوب)
5. أدخل السبب (اختياري)
6. اضغط "تأكيد الزيادة"

### من API:
```javascript
POST /api/costs/:id/increase
Authorization: Bearer <token>

Body:
{
  "additionalAmount": 500,
  "reason": "شراء إضافي من نفس المورد"
}

Response:
{
  "success": true,
  "message": "تم زيادة المبلغ بنجاح",
  "data": {
    // Cost object with updated amount and amountHistory
  }
}
```

## Business Logic

### التحديثات التلقائية:
عند زيادة المبلغ، يتم تلقائياً:
1. ✅ زيادة `amount` (المبلغ الإجمالي)
2. ✅ إعادة حساب `remainingAmount` = amount - paidAmount
3. ✅ تحديث `status` إذا لزم الأمر:
   - إذا كان `paidAmount >= amount` → `paid`
   - إذا كان `paidAmount > 0` → `partially_paid`
   - إذا كان `paidAmount === 0` والتاريخ متأخر → `overdue`
   - إذا كان `paidAmount === 0` → `pending`

### مثال عملي:
```
التكلفة الأصلية:
- amount: 2000 EGP
- paidAmount: 1500 EGP
- remainingAmount: 500 EGP
- status: partially_paid

بعد زيادة 300 EGP:
- amount: 2300 EGP
- paidAmount: 1500 EGP (لا يتغير)
- remainingAmount: 800 EGP (يُحسب تلقائياً)
- status: partially_paid (يبقى كما هو)

amountHistory:
[
  {
    addedAmount: 300,
    previousTotal: 2000,
    newTotal: 2300,
    addedBy: { name: "أحمد محمد" },
    addedAt: "2024-12-09T10:30:00Z",
    reason: "شراء إضافي من نفس المورد"
  }
]
```

## UI/UX Features

### التصميم:
- ✅ سجل زيادات المبلغ يظهر قبل سجل الدفعات
- ✅ ألوان مميزة (برتقالي/أصفر) للتمييز عن الدفعات (أخضر)
- ✅ أيقونة `TrendingUp` للدلالة على الزيادة
- ✅ عرض السهم (←) للتحول من المبلغ السابق للجديد
- ✅ Badge يعرض عدد الزيادات
- ✅ Modal منفصل لإدخال الزيادة مع validation

### Validation:
- ✅ المبلغ الإضافي يجب أن يكون أكبر من صفر
- ✅ رسائل خطأ واضحة بالعربية
- ✅ تعطيل الأزرار أثناء الحفظ
- ✅ إغلاق تلقائي للـ modal بعد النجاح

## الملفات المعدلة

### Backend:
- ✅ `server/models/Cost.js`
- ✅ `server/controllers/costController.js`
- ✅ `server/routes/costRoutes.js`

### Frontend:
- ✅ `src/components/CostDetailsModal.tsx`
- ✅ `src/pages/Costs.tsx`

## الحالة
✅ **مكتمل وجاهز للاستخدام**

جميع الميزات تم تطبيقها بنجاح:
- ✅ Backend API
- ✅ Database Model
- ✅ Frontend UI
- ✅ Integration
- ✅ Validation
- ✅ Error Handling
- ✅ Auto-refresh
- ✅ Populate user data

## الخطوات التالية (اختياري)
- [ ] إضافة unit tests للـ `increaseAmount()` method
- [ ] إضافة integration tests للـ endpoint
- [ ] إضافة إمكانية تصدير سجل الزيادات
- [ ] إضافة تقرير بجميع زيادات المبالغ
