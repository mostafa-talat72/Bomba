# تفعيل المزامنة الثنائية (Local ⇄ Atlas)

## المتطلبات
- MongoDB يجب أن يكون Replica Set (ليس standalone)
- الكود جاهز بالكامل ✅
- فقط نحتاج إعداد Replica Set

---

## الخطوات التفصيلية

### الخطوة 1: إيقاف MongoDB

افتح **Command Prompt كـ Administrator** (اضغط Windows + X واختر "Terminal (Admin)"):

```cmd
net stop MongoDB
```

إذا ظهرت رسالة خطأ، جرب:
```cmd
sc stop MongoDB
```

---

### الخطوة 2: تعديل ملف MongoDB Configuration

1. افتح File Explorer واذهب إلى:
   ```
   C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg
   ```
   (أو أي إصدار عندك - قد يكون 6.0 أو 8.0)

2. افتح الملف بـ **Notepad كـ Administrator**

3. أضف هذه السطور في نهاية الملف:
   ```yaml
   replication:
     replSetName: "rs0"
   ```

4. احفظ الملف

**مثال على الملف بعد التعديل:**
```yaml
# mongod.conf

# for documentation of all options, see:
#   http://docs.mongodb.org/manual/reference/configuration-options/

# Where and how to store data.
storage:
  dbPath: C:\Program Files\MongoDB\Server\7.0\data
  journal:
    enabled: true

# where to write logging data.
systemLog:
  destination: file
  logAppend: true
  path: C:\Program Files\MongoDB\Server\7.0\log\mongod.log

# network interfaces
net:
  port: 27017
  bindIp: 127.0.0.1

# إضافة هذا القسم الجديد
replication:
  replSetName: "rs0"
```

---

### الخطوة 3: إعادة تشغيل MongoDB

في Command Prompt (كـ Administrator):

```cmd
net start MongoDB
```

---

### الخطوة 4: تهيئة Replica Set

1. افتح MongoDB Shell:
   ```cmd
   mongosh
   ```

2. شغل هذا الأمر:
   ```javascript
   rs.initiate({
     _id: "rs0",
     members: [{ _id: 0, host: "localhost:27017" }]
   })
   ```

3. يجب أن ترى رسالة نجاح:
   ```json
   { "ok": 1 }
   ```

4. تحقق من الحالة:
   ```javascript
   rs.status()
   ```

   يجب أن ترى:
   - `"ok": 1`
   - `"stateStr": "PRIMARY"`

5. اخرج من mongosh:
   ```javascript
   exit
   ```

---

### الخطوة 5: تحديث URI في .env

في ملف `server/.env`، غير:

```env
# من:
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba

# إلى:
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba?replicaSet=rs0
```

---

### الخطوة 6: تفعيل Bidirectional Sync

في ملف `server/.env`، غير:

```env
# من:
BIDIRECTIONAL_SYNC_ENABLED=false

# إلى:
BIDIRECTIONAL_SYNC_ENABLED=true
```

---

### الخطوة 7: إعادة تشغيل السيرفر

```bash
npm run server:dev
```

---

## التحقق من النجاح

عند تشغيل السيرفر، يجب أن ترى في الـ logs:

```
✅ Sync configuration validated successfully
🔄 Bidirectional sync is ENABLED
🔄 Initializing sync system...
🔄 Initializing bidirectional sync...
✅ Origin Tracker initialized (Instance ID: ...)
✅ Conflict Resolver initialized (Strategy: last-write-wins)
✅ Change Processor initialized
✅ Atlas Change Listener initialized
✅ Atlas Change Stream is available
📊 Bidirectional Sync Status:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Status: ACTIVE
🔄 Direction: Local ⇄ Atlas (bidirectional)
```

---

## اختبار المزامنة

### اختبار 1: Local → Atlas
1. أضف بيانات في Local (من التطبيق)
2. تحقق من ظهورها في Atlas (MongoDB Compass أو Atlas UI)

### اختبار 2: Atlas → Local
1. أضف بيانات مباشرة في Atlas
2. يجب أن تظهر تلقائياً في Local خلال 1-5 ثواني

---

## استكشاف الأخطاء

### خطأ: "Change Streams require replica set"
- تأكد من إضافة `?replicaSet=rs0` في MONGODB_LOCAL_URI
- تأكد من تشغيل `rs.initiate()` بنجاح

### خطأ: "Atlas connection not available"
- تحقق من MONGODB_ATLAS_URI
- تأكد من الاتصال بالإنترنت

### خطأ: "Failed to initialize bidirectional sync"
- شغل `rs.status()` في mongosh وتأكد من `"stateStr": "PRIMARY"`
- تأكد من إعادة تشغيل MongoDB بعد تعديل mongod.cfg

---

## الرجوع للوضع السابق (إذا حدثت مشاكل)

1. في `server/.env`:
   ```env
   BIDIRECTIONAL_SYNC_ENABLED=false
   ```

2. أعد تشغيل السيرفر

سيعود النظام للمزامنة أحادية الاتجاه (Local → Atlas فقط).

---

## ملاحظات مهمة

- ✅ الكود جاهز بالكامل ومُختبر
- ✅ جميع المكونات مُنفذة (Atlas Listener, Change Processor, Origin Tracker, Conflict Resolver)
- ✅ يدعم حل التعارضات (Last Write Wins)
- ✅ يمنع الحلقات اللانهائية (Origin Tracking)
- ✅ يدعم إعادة الاتصال التلقائي (Resume Tokens)
- ✅ مُراقب بالكامل (Metrics & Health Checks)

---

## الدعم

إذا واجهت أي مشكلة:
1. تحقق من الـ logs في الـ console
2. شغل `rs.status()` في mongosh
3. تحقق من الـ API endpoint: `http://localhost:5000/api/sync/bidirectional/health`
