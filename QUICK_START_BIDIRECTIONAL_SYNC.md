# دليل سريع: تفعيل المزامنة الثنائية (Local ⇄ Atlas)

## ✅ الوضع الحالي
- الكود جاهز بالكامل ومُختبر
- جميع المكونات مُنفذة
- فقط نحتاج إعداد Replica Set

---

## 🚀 الخطوات السريعة

### 1️⃣ تحقق من الوضع الحالي

شغل هذا الأمر للتحقق من إعداد MongoDB:

```bash
npm run check:replica
```

إذا رأيت "✅ SUCCESS! Your MongoDB is ready for bidirectional sync!" - تخطى للخطوة 6

إذا رأيت "❌ MongoDB is NOT configured as a Replica Set" - تابع الخطوات التالية

---

### 2️⃣ إيقاف MongoDB

افتح **Command Prompt كـ Administrator**:

```cmd
net stop MongoDB
```

---

### 3️⃣ تعديل ملف MongoDB Configuration

1. افتح File Explorer واذهب إلى:
   ```
   C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg
   ```

2. افتح الملف بـ **Notepad كـ Administrator**

3. أضف في نهاية الملف:
   ```yaml
   replication:
     replSetName: "rs0"
   ```

4. احفظ الملف

---

### 4️⃣ إعادة تشغيل MongoDB

```cmd
net start MongoDB
```

---

### 5️⃣ تهيئة Replica Set

افتح MongoDB Shell:

```cmd
mongosh
```

شغل:

```javascript
rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })
```

يجب أن ترى: `{ "ok": 1 }`

اخرج:

```javascript
exit
```

---

### 6️⃣ تحديث ملف .env

افتح `server/.env` وعدل:

```env
# غير هذا السطر:
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba

# إلى:
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba?replicaSet=rs0

# وغير هذا:
BIDIRECTIONAL_SYNC_ENABLED=false

# إلى:
BIDIRECTIONAL_SYNC_ENABLED=true
```

---

### 7️⃣ تحقق من الإعداد

```bash
npm run check:replica
```

يجب أن ترى:
```
✅ SUCCESS! Your MongoDB is ready for bidirectional sync!
```

---

### 8️⃣ شغل السيرفر

```bash
npm run server:dev
```

يجب أن ترى في الـ logs:

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
1. افتح التطبيق وأضف فاتورة جديدة
2. افتح MongoDB Compass واتصل بـ Atlas
3. يجب أن ترى الفاتورة في Atlas

### اختبار 2: Atlas → Local
1. في MongoDB Compass (متصل بـ Atlas)
2. أضف document جديد في أي collection
3. في التطبيق، يجب أن يظهر خلال 1-5 ثواني

---

## 📊 مراقبة المزامنة

### API Endpoints

```bash
# حالة المزامنة
curl http://localhost:5000/api/sync/bidirectional/health

# إحصائيات المزامنة
curl http://localhost:5000/api/sync/bidirectional/metrics

# التعارضات
curl http://localhost:5000/api/sync/bidirectional/conflicts
```

---

## ❓ استكشاف الأخطاء

### المشكلة: "Change Streams require replica set"

**الحل:**
1. تأكد من إضافة `?replicaSet=rs0` في MONGODB_LOCAL_URI
2. شغل `npm run check:replica` للتحقق

### المشكلة: "Atlas connection not available"

**الحل:**
1. تحقق من MONGODB_ATLAS_URI في .env
2. تأكد من الاتصال بالإنترنت
3. تحقق من صلاحيات Atlas

### المشكلة: السيرفر يبدأ لكن لا توجد مزامنة

**الحل:**
1. تحقق من الـ logs - ابحث عن "Bidirectional Sync Status"
2. شغل: `curl http://localhost:5000/api/sync/bidirectional/health`
3. تحقق من أن BIDIRECTIONAL_SYNC_ENABLED=true

---

## 🔄 الرجوع للوضع السابق

إذا أردت تعطيل المزامنة الثنائية:

في `server/.env`:
```env
BIDIRECTIONAL_SYNC_ENABLED=false
```

أعد تشغيل السيرفر - سيعود للمزامنة أحادية الاتجاه (Local → Atlas فقط)

---

## 📚 مستندات إضافية

- **دليل تفصيلي:** `ENABLE_BIDIRECTIONAL_SYNC.md`
- **إعداد Replica Set:** `SETUP_REPLICA_SET.md`
- **وثائق المزامنة:** `server/docs/BIDIRECTIONAL_SYNC_DOCUMENTATION.md`
- **دليل الترحيل:** `server/docs/BIDIRECTIONAL_SYNC_MIGRATION_GUIDE.md`

---

## ✨ المميزات

بعد التفعيل، ستحصل على:

- ✅ مزامنة تلقائية ثنائية الاتجاه
- ✅ حل تلقائي للتعارضات (Last Write Wins)
- ✅ منع الحلقات اللانهائية (Origin Tracking)
- ✅ إعادة اتصال تلقائي (Resume Tokens)
- ✅ مراقبة كاملة (Metrics & Health Checks)
- ✅ دعم أجهزة متعددة
- ✅ نسخ احتياطي تلقائي على Atlas

---

## 🎯 الخلاصة

```bash
# 1. تحقق من الوضع
npm run check:replica

# 2. إذا لم يكن Replica Set، اتبع الخطوات 2-5 أعلاه

# 3. حدث .env
# MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba?replicaSet=rs0
# BIDIRECTIONAL_SYNC_ENABLED=true

# 4. تحقق مرة أخرى
npm run check:replica

# 5. شغل السيرفر
npm run server:dev

# 6. استمتع بالمزامنة الثنائية! 🎉
```
