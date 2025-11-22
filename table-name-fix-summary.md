# إصلاح مشكلة حفظ أسماء الطاولات النصية

## المشكلة
كان النظام يقبل فقط أرقام للطاولات ولا يحفظ الأسماء النصية (مثل "VIP"، "شرفة 1"، "A1") في قاعدة البيانات.

## السبب
1. **Backend Controller**: كان يستخدم `parseInt(number)` لتحويل القيمة إلى رقم، مما يجعل النصوص تتحول إلى `NaN`
2. **Frontend Validation**: كان يتحقق من `parseInt(tableFormData.number) < 1` مما يفشل مع النصوص
3. **Frontend Submission**: كان يرسل `parseInt(tableFormData.number)` بدلاً من القيمة الأصلية
4. **TypeScript Interfaces**: كانت تعرف `number` كـ `number` فقط بدلاً من `string | number`

## التغييرات المطبقة

### 1. Backend - Table Controller (`server/controllers/tableController.js`)

#### في `createTable`:
```javascript
// قبل:
if (!number || number < 1) {
    return res.status(400).json({
        success: false,
        message: "رقم الطاولة مطلوب ويجب أن يكون أكبر من 0",
    });
}
// ...
const tableData = {
    number: parseInt(number),
    // ...
};

// بعد:
if (!number || (typeof number === 'string' && number.trim() === '')) {
    return res.status(400).json({
        success: false,
        message: "رقم/اسم الطاولة مطلوب",
    });
}
// ...
const tableData = {
    number: typeof number === 'string' ? number.trim() : number,
    // ...
};
```

#### في `updateTable`:
```javascript
// قبل:
if (number !== undefined) {
    updateData.number = parseInt(number);
}
const finalNumber = number !== undefined ? parseInt(number) : table.number;

// بعد:
if (number !== undefined) {
    updateData.number = typeof number === 'string' ? number.trim() : number;
}
const finalNumber = number !== undefined ? (typeof number === 'string' ? number.trim() : number) : table.number;
```

### 2. Frontend - Cafe Page (`src/pages/Cafe.tsx`)

```javascript
// قبل:
if (!tableFormData.number || parseInt(tableFormData.number) < 1) {
    showNotification('يرجى إدخال رقم طاولة صحيح', 'error');
    return;
}
await createTable({
    number: parseInt(tableFormData.number),
    section: tableFormData.section,
});

// بعد:
if (!tableFormData.number || tableFormData.number.trim() === '') {
    showNotification('يرجى إدخال رقم/اسم الطاولة', 'error');
    return;
}
await createTable({
    number: tableFormData.number,
    section: tableFormData.section,
});
```

### 3. TypeScript Interfaces (`src/services/api.ts`)

```typescript
// قبل:
export interface Table {
  number: number;
  // ...
}

export interface Bill {
  tableNumber?: number;
  // ...
}

// بعد:
export interface Table {
  number: string | number;
  // ...
}

export interface Bill {
  tableNumber?: string | number;
  // ...
}
```

### 4. Table Sorting - PlayStation & Billing Pages

تم تحديث الترتيب ليعمل مع النصوص والأرقام:

```javascript
// قبل:
.sort((a: any, b: any) => a.number - b.number)

// بعد:
.sort((a: any, b: any) => {
  return String(a.number).localeCompare(String(b.number), 'ar', { numeric: true });
})
```

هذا الترتيب:
- يعمل مع النصوص والأرقام
- يستخدم `localeCompare` مع خيار `numeric: true` لترتيب ذكي (مثلاً: "1" < "2" < "10" < "A1" < "VIP")
- يدعم اللغة العربية

### 5. PlayStation Page - Table Number State

```typescript
// قبل:
const [selectedTableNumber, setSelectedTableNumber] = useState<number | null>(null);
const handleLinkTableToSession = async (session: Session, tableNumber: number | null) => {

// بعد:
const [selectedTableNumber, setSelectedTableNumber] = useState<string | number | null>(null);
const handleLinkTableToSession = async (session: Session, tableNumber: string | number | null) => {
```

## الملفات المعدلة

1. ✅ `server/controllers/tableController.js` - إزالة parseInt والتحقق من النصوص
2. ✅ `server/models/Table.js` - كان صحيحاً بالفعل (Mixed type)
3. ✅ `src/pages/Cafe.tsx` - إزالة parseInt والتحقق من النصوص
4. ✅ `src/services/api.ts` - تحديث interfaces لقبول string | number
5. ✅ `src/pages/PlayStation.tsx` - تحديث الترتيب والـ state types
6. ✅ `src/pages/Billing.tsx` - تحديث الترتيب

## الاختبار

### سيناريوهات الاختبار:
1. ✅ إضافة طاولة برقم (مثل: 1، 2، 10)
2. ✅ إضافة طاولة باسم نصي (مثل: VIP، شرفة 1، A1)
3. ✅ إضافة طاولة باسم مختلط (مثل: طاولة 5، Table A)
4. ✅ تعديل رقم/اسم طاولة موجودة
5. ✅ التحقق من عدم السماح بأسماء فارغة
6. ✅ التحقق من عدم السماح بأسماء مكررة في نفس القسم
7. ✅ ترتيب الطاولات بشكل صحيح (أرقام ثم نصوص)
8. ✅ ربط جلسة بلايستيشن بطاولة نصية
9. ✅ إنشاء طلب لطاولة نصية
10. ✅ عرض الفواتير حسب الطاولة النصية

## أمثلة على أسماء الطاولات المدعومة الآن

- أرقام: `1`, `2`, `10`, `100`
- نصوص عربية: `VIP`, `شرفة`, `حديقة`
- نصوص إنجليزية: `A`, `B`, `Table A`
- مختلط: `A1`, `B2`, `VIP 1`, `شرفة 1`
- رموز: `#1`, `*VIP*`

## ملاحظات

1. **الترتيب الذكي**: استخدام `localeCompare` مع `numeric: true` يضمن ترتيب صحيح:
   - `1, 2, 10, 20` (وليس `1, 10, 2, 20`)
   - `A1, A2, A10, B1` (ترتيب طبيعي)

2. **التوافق مع الكود القديم**: الكود يدعم الآن كلاً من الأرقام والنصوص، لذلك الطاولات القديمة (أرقام) ستعمل بدون مشاكل

3. **قاعدة البيانات**: نموذج MongoDB كان يستخدم `Mixed` type بالفعل، لذلك لا حاجة لتعديل البيانات الموجودة

4. **الأمان**: تم إضافة `.trim()` لإزالة المسافات الزائدة من النصوص

## الخلاصة

تم إصلاح المشكلة بنجاح! الآن يمكن:
- ✅ إضافة طاولات بأرقام (1، 2، 3...)
- ✅ إضافة طاولات بأسماء نصية (VIP، شرفة، A1...)
- ✅ تعديل أسماء الطاولات
- ✅ ترتيب الطاولات بشكل صحيح
- ✅ استخدام الطاولات في جميع أنحاء النظام (طلبات، جلسات، فواتير)
