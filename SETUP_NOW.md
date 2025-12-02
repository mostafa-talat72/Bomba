# ⚡ إعداد سريع - ابدأ الآن!

## ✅ تم تحديث .env تلقائياً!

تم تحديث الإعدادات التالية في `server/.env`:
- ✅ `MONGODB_LOCAL_URI` → أضيف `?replicaSet=rs0`
- ✅ `BIDIRECTIONAL_SYNC_ENABLED` → تم التغيير إلى `true`

---

## 🚀 الخطوات المتبقية (5 دقائق)

### الطريقة 1: سكريبت تلقائي (موصى به) ⭐

**PowerShell (موصى به):**
1. انقر بزر الماوس الأيمن على `setup-replica-set.ps1`
2. اختر "Run with PowerShell"
3. إذا ظهرت رسالة أمان، اختر "Run anyway"
4. اتبع التعليمات على الشاشة

**أو Command Prompt:**
1. انقر بزر الماوس الأيمن على `setup-replica-set.cmd`
2. اختر "Run as Administrator"
3. اتبع التعليمات على الشاشة

---

### الطريقة 2: يدوياً (إذا لم تعمل السكريبتات)

#### 1. أوقف MongoDB
```cmd
net stop MongoDB
```

#### 2. عدل ملف mongod.cfg

افتح:
```
C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg
```
(أو 8.0 أو 6.0 حسب إصدارك)

أضف في النهاية:
```yaml
replication:
  replSetName: "rs0"
```

احفظ الملف.

#### 3. شغل MongoDB
```cmd
net start MongoDB
```

#### 4. هيئ Replica Set

افتح terminal جديد:
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

## ✅ التحقق من النجاح

```bash
npm run check:replica
```

يجب أن ترى:
```
✅ SUCCESS! Your MongoDB is ready for bidirectional sync!
```

---

## 🎯 تشغيل السيرفر

```bash
npm run server:dev
```

ابحث في الـ logs عن:
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
1. افتح التطبيق
2. أضف فاتورة جديدة
3. افتح MongoDB Compass → اتصل بـ Atlas
4. يجب أن ترى الفاتورة في Atlas

### اختبار 2: Atlas → Local
1. في MongoDB Compass (متصل بـ Atlas)
2. أضف document جديد في collection `bills`
3. في التطبيق، يجب أن يظهر خلال 1-5 ثواني

---

## ❓ مشاكل شائعة

### المشكلة: "Access Denied" عند تعديل mongod.cfg
**الحل:** افتح Notepad كـ Administrator أولاً، ثم افتح الملف

### المشكلة: "Service not found"
**الحل:** جرب `net stop "MongoDB Server"` بدلاً من `net stop MongoDB`

### المشكلة: mongosh لا يعمل
**الحل:** تأكد من تثبيت MongoDB Shell من: https://www.mongodb.com/try/download/shell

---

## 📞 الدعم

إذا واجهت أي مشكلة:
1. شغل `npm run check:replica` للتشخيص
2. راجع الـ logs
3. راجع **QUICK_START_BIDIRECTIONAL_SYNC.md** للتفاصيل

---

## 🎉 بعد النجاح

ستحصل على:
- ✅ مزامنة تلقائية ثنائية الاتجاه (Local ⇄ Atlas)
- ✅ حل تلقائي للتعارضات
- ✅ دعم أجهزة متعددة
- ✅ نسخ احتياطي تلقائي
- ✅ مراقبة كاملة

**ابدأ الآن!** 🚀
