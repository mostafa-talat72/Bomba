# 🔧 تعديل mongod.cfg

## ⚠️ المشكلة
MongoDB لم يتم تشغيله مع Replica Set enabled.

## ✅ الحل

### 1. أوقف MongoDB

افتح **PowerShell كـ Administrator**:

```powershell
net stop MongoDB
```

انتظر حتى ترى:
```
The MongoDB Server (MongoDB) service was stopped successfully.
```

---

### 2. افتح mongod.cfg

**الموقع:**
```
C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg
```

**كيف تفتحه بشكل صحيح:**

1. افتح **Notepad كـ Administrator**:
   - اضغط Windows
   - اكتب "Notepad"
   - انقر بزر الماوس الأيمن على Notepad
   - اختر "Run as Administrator"

2. في Notepad:
   - File → Open
   - اذهب إلى: `C:\Program Files\MongoDB\Server\7.0\bin\`
   - اختر "All Files (*.*)" من القائمة المنسدلة
   - افتح `mongod.cfg`

---

### 3. أضف Replication Section

**اذهب لنهاية الملف** واضغط Enter مرتين، ثم أضف:

```yaml
replication:
  replSetName: "rs0"
```

**⚠️ مهم جداً:**
- لا تضع مسافات قبل `replication:`
- ضع مسافتين (2 spaces) قبل `replSetName:`
- استخدم علامات التنصيص حول `"rs0"`

**مثال على الملف الكامل:**
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

# هذا القسم الجديد
replication:
  replSetName: "rs0"
```

---

### 4. احفظ الملف

اضغط **Ctrl+S** أو File → Save

---

### 5. شغل MongoDB

في PowerShell (كـ Administrator):

```powershell
net start MongoDB
```

انتظر حتى ترى:
```
The MongoDB Server (MongoDB) service was started successfully.
```

---

### 6. تحقق من النجاح

ارجع للمشروع وشغل:

```bash
npm run init:replica
```

يجب أن ترى:
```
✅ Replica Set initialized successfully!
```

---

## ❓ إذا لم يعمل

### المشكلة: "Access Denied"

**الحل:**
تأكد من فتح Notepad كـ Administrator (الخطوة 2 أعلاه)

### المشكلة: لا أجد mongod.cfg

**الحل:**
ابحث في هذه المواقع:
- `C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg`
- `C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg`
- `C:\Program Files\MongoDB\Server\6.0\bin\mongod.cfg`

### المشكلة: MongoDB لا يبدأ بعد التعديل

**الحل:**
تحقق من YAML syntax - المسافات مهمة جداً!

---

**بعد ما تخلص، قولي "خلصت" وأنا هكمل الباقي!** 🚀
