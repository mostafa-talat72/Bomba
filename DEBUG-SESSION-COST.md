# تشخيص مشكلة تكلفة الجلسة

## ⚠️ تحديث مهم: تم إضافة markModified

تم إضافة `markModified` للتأكد من حفظ القيم في قاعدة البيانات.

## تم إضافة Logging للتشخيص

تم إضافة رسائل تشخيصية مفصلة في الكود لمعرفة ما يحدث بالضبط عند إنهاء الجلسة.

## الخطوات:

### 1. أعد تشغيل السيرفر
```bash
# أوقف السيرفر (Ctrl+C)
cd server
npm run dev
```

### 2. أنهِ جلسة بلايستيشن جديدة

### 3. راقب الـ Console/Terminal

ستظهر رسائل مثل:

```
🔍 Before endSession: {
  sessionId: '674abc...',
  totalCost: 0,
  finalCost: 0
}

🔍 calculateCost STARTED for session: 674abc...

✅ Device found: {
  deviceId: '673xyz...',
  type: 'playstation',
  playstationRates: Map { '1' => 20, '2' => 20, '3' => 25, '4' => 30 },
  hourlyRate: 0
}

🔍 calculateCost result: {
  sessionId: '674abc...',
  rawTotal: 28.333333,
  totalCost: 28,
  discount: 0,
  finalCost: 28,
  deviceId: '673xyz...',
  deviceType: 'playstation',
  controllers: 2,
  startTime: '2025-01-19T22:30:00.000Z',
  endTime: '2025-01-19T23:54:00.000Z',
  isModified_totalCost: true,
  isModified_finalCost: true
}

🔍 endSession - After calculateCost: {
  sessionId: '674abc...',
  totalCost: 28,
  finalCost: 28,
  discount: 0
}

🔍 After endSession: {
  sessionId: '674abc...',
  totalCost: 28,
  finalCost: 28
}

🔍 After save: {
  sessionId: '674abc...',
  totalCost: 28,
  finalCost: 28
}
```

## ما الذي نبحث عنه؟

### ✅ السيناريو الصحيح:
- `calculateCost result` يظهر `totalCost` و `finalCost` بقيم صحيحة (مثل 28)
- `After save` يظهر نفس القيم

### ❌ السيناريو الخاطئ:
- `calculateCost result` يظهر `totalCost = 0` أو `rawTotal = 0`
- أو `deviceId` يكون `null` أو `undefined`
- أو لا تظهر رسالة `calculateCost result` أصلاً

## الأسباب المحتملة:

### 1. deviceId غير موجود
```
deviceId: null
```
**الحل:** تأكد من أن الجلسة مرتبطة بجهاز صحيح

### 2. الجهاز ليس له أسعار
```
rawTotal: 0
totalCost: 0
```
**الحل:** تأكد من أن الجهاز له `playstationRates` أو `hourlyRate`

### 3. controllersHistory فارغ أو خاطئ
```
controllers: undefined
```
**الحل:** تأكد من أن `controllers` محدد عند بدء الجلسة

### 4. التواريخ خاطئة
```
startTime: null
endTime: null
```
**الحل:** تأكد من أن التواريخ محفوظة بشكل صحيح

## بعد التشخيص

أرسل لي الرسائل التي ظهرت في الـ console وسأساعدك في تحديد المشكلة بالضبط!

## إزالة الـ Logging (بعد الإصلاح)

بعد حل المشكلة، يمكن إزالة رسائل الـ console.log من:
- `server/models/Session.js` (السطر ~233 و ~278)
- `server/controllers/sessionController.js` (السطر ~434-450)
