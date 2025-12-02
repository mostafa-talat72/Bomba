# 🔧 إعادة تشغيل MongoDB وتهيئة Replica Set

## المشكلة الحالية
MongoDB شغال لكن محتاج restart بعد تعديل ملف `mongod.cfg`

---

## ✅ الحل (خطوتين فقط!)

### الخطوة 1: أعد تشغيل MongoDB

**افتح Command Prompt كـ Administrator:**
1. اضغط **Windows**
2. اكتب `cmd`
3. **انقر بزر الماوس الأيمن** على Command Prompt
4. اختر **"Run as administrator"**
5. اضغط **Yes**

**في النافذة السوداء، اكتب:**
```cmd
net stop MongoDB
```

**انتظر 3 ثواني، ثم اكتب:**
```cmd
net start MongoDB
```

**يجب أن تشوف:**
```
The MongoDB service was started successfully.
```

---

### الخطوة 2: هيئ Replica Set

**ارجع لـ PowerShell العادي** (مش Administrator) واكتب:
```bash
node server/scripts/initReplicaSet.js
```

**يجب أن تشوف:**
```
✅ Replica Set initialized successfully!
🎉 SUCCESS! Replica Set is ready!
```

---

## ✅ التحقق من النجاح

بعد ما تخلص الخطوتين، اكتب:
```bash
node server/scripts/checkReplicaSet.js
```

**يجب أن تشوف:**
```
✅ SUCCESS! Your MongoDB is ready for bidirectional sync!
```

---

## 🚀 تشغيل السيرفر

بعد النجاح، شغل السيرفر:
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

## ❓ إذا واجهت مشكلة

### المشكلة: "Access is denied" عند إيقاف MongoDB
**الحل:** تأكد إنك فتحت Command Prompt كـ Administrator

### المشكلة: "The service name is invalid"
**الحل:** جرب:
```cmd
net stop "MongoDB Server"
net start "MongoDB Server"
```

### المشكلة: لسه نفس الخطأ بعد restart
**الحل:** 
1. تأكد إن ملف `mongod.cfg` فيه:
   ```yaml
   replication:
     replSetName: "rs0"
   ```
2. تأكد إن المسافات صح (مسافتين قبل `replSetName`)
3. أعد تشغيل MongoDB مرة أخرى

---

## 🎯 الخلاصة

1. ✅ عدلنا `mongod.cfg` → تم
2. ⏳ نحتاج restart لـ MongoDB → **اعمله الآن**
3. ⏳ نحتاج initialize للـ Replica Set → **بعد الـ restart**
4. 🎉 المزامنة الثنائية هتشتغل!

**ابدأ من الخطوة 1 الآن!** 🚀
