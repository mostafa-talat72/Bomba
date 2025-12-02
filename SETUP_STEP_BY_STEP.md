# 📋 إعداد المزامنة الثنائية - خطوة بخطوة

## ✅ الوضع الحالي
- MongoDB شغال ✅
- الكود جاهز ✅
- نحتاج فقط تهيئة Replica Set

---

## 🚀 الخطوات (10 دقائق)

### الخطوة 1: إيقاف MongoDB ⏸️

افتح **PowerShell كـ Administrator**:

```powershell
net stop MongoDB
```

**النتيجة المتوقعة:**
```
The MongoDB Server (MongoDB) service is stopping.
The MongoDB Server (MongoDB) service was stopped successfully.
```

---

### الخطوة 2: تعديل ملف mongod.cfg 📝

1. افتح File Explorer
2. اذهب إلى: `C:\Program Files\MongoDB\Server\`
3. ابحث عن المجلد (7.0 أو 8.0 أو 6.0)
4. افتح: `bin\mongod.cfg`

**كيف تفتح الملف:**
- انقر بزر الماوس الأيمن على `mongod.cfg`
- اختر "Open with" → "Notepad"
- إذا طلب صلاحيات، اختر "Yes"

**أضف هذه السطور في نهاية الملف:**

```yaml
# Replication for bidirectional sync
replication:
  replSetName: "rs0"
```

**احفظ الملف** (Ctrl+S)

---

### الخطوة 3: إعادة تشغيل MongoDB ▶️

في PowerShell (كـ Administrator):

```powershell
net start MongoDB
```

**النتيجة المتوقعة:**
```
The MongoDB Server (MongoDB) service is starting.
The MongoDB Server (MongoDB) service was started successfully.
```

---

### الخطوة 4: تهيئة Replica Set 🔧

في terminal عادي (ليس Administrator):

```bash
npm run init:replica
```

**النتيجة المتوقعة:**
```
🔧 Initializing MongoDB Replica Set...
📡 Connecting to MongoDB...
✅ Connected to MongoDB
🔧 Initializing Replica Set...
✅ Replica Set initialized successfully!
🎉 SUCCESS! Replica Set initialized!
```

---

### الخطوة 5: تحديث .env ⚙️

افتح `server/.env` وغير السطرين التاليين:

**من:**
```env
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba
BIDIRECTIONAL_SYNC_ENABLED=false
```

**إلى:**
```env
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba?replicaSet=rs0
BIDIRECTIONAL_SYNC_ENABLED=true
```

احفظ الملف.

---

### الخطوة 6: التحقق ✅

```bash
npm run check:replica
```

**النتيجة المتوقعة:**
```
✅ MongoDB is configured as a Replica Set!
✅ MONGODB_LOCAL_URI includes replicaSet parameter
✅ Change Streams are working!
🎉 SUCCESS! Your MongoDB is ready for bidirectional sync!
```

---

### الخطوة 7: تشغيل السيرفر 🚀

```bash
npm run server:dev
```

**ابحث في الـ logs عن:**
```
✅ Bidirectional sync is ENABLED
🔄 Initializing bidirectional sync...
✅ Origin Tracker initialized
✅ Conflict Resolver initialized
✅ Change Processor initialized
✅ Atlas Change Listener initialized
📊 Bidirectional Sync Status:
✅ Status: ACTIVE
🔄 Direction: Local ⇄ Atlas (bidirectional)
```

---

## 🧪 اختبار المزامنة

### اختبار 1: Local → Atlas
1. افتح التطبيق (http://localhost:3000)
2. أضف فاتورة جديدة
3. افتح MongoDB Compass
4. اتصل بـ Atlas
5. يجب أن ترى الفاتورة في Atlas

### اختبار 2: Atlas → Local
1. في MongoDB Compass (متصل بـ Atlas)
2. افتح collection `bills`
3. أضف document جديد
4. في التطبيق، يجب أن يظهر خلال 1-5 ثواني

---

## ❓ استكشاف الأخطاء

### المشكلة: "Access Denied" عند تعديل mongod.cfg

**الحل:**
1. افتح Notepad كـ Administrator أولاً
2. ثم افتح الملف من داخل Notepad

### المشكلة: "Service not found"

**الحل:**
جرب:
```powershell
net stop "MongoDB Server"
net start "MongoDB Server"
```

### المشكلة: npm run init:replica يفشل

**الحل:**
استخدم mongosh يدوياً:
```bash
mongosh
```
ثم:
```javascript
rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })
exit
```

### المشكلة: السيرفر لا يبدأ

**الحل:**
1. تأكد من أن MongoDB شغال: `Get-Service MongoDB`
2. تأكد من تحديث .env بشكل صحيح
3. شغل `npm run check:replica` للتشخيص

---

## 📊 الأوامر المفيدة

```bash
# التحقق من حالة MongoDB
Get-Service MongoDB

# التحقق من Replica Set
npm run check:replica

# تهيئة Replica Set
npm run init:replica

# تشغيل السيرفر
npm run server:dev

# مراقبة المزامنة
curl http://localhost:5000/api/sync/bidirectional/health
```

---

## 🎉 بعد النجاح

ستحصل على:
- ✅ مزامنة تلقائية ثنائية الاتجاه (Local ⇄ Atlas)
- ✅ حل تلقائي للتعارضات (Last Write Wins)
- ✅ منع الحلقات اللانهائية (Origin Tracking)
- ✅ إعادة اتصال تلقائي (Resume Tokens)
- ✅ مراقبة كاملة (Metrics & Health Checks)
- ✅ دعم أجهزة متعددة
- ✅ نسخ احتياطي تلقائي على Atlas

---

**ابدأ من الخطوة 1!** 🚀
