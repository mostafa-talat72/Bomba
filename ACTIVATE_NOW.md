# ⚡ تفعيل المزامنة الثنائية - الآن!

## ✅ التعديلات جاهزة!

تم تحديث `server/.env` تلقائياً:
- ✅ `MONGODB_LOCAL_URI` → أضيف `?replicaSet=rs0`
- ✅ `BIDIRECTIONAL_SYNC_ENABLED` → تم التغيير إلى `true`

---

## 🚨 خطوات مهمة قبل تشغيل السيرفر

### يجب عليك إعداد Replica Set أولاً!

**إذا لم تقم بإعداد Replica Set بعد، السيرفر لن يعمل!**

---

## 🔧 الخطوات المطلوبة (5 دقائق)

### الطريقة 1: سكريبت تلقائي (الأسهل) ⭐

**PowerShell:**
1. انقر بزر الماوس الأيمن على `setup-replica-set.ps1`
2. اختر "Run with PowerShell"
3. اتبع التعليمات

**أو Command Prompt:**
1. انقر بزر الماوس الأيمن على `setup-replica-set.cmd`
2. اختر "Run as Administrator"
3. اتبع التعليمات

---

### الطريقة 2: يدوياً (خطوة بخطوة)

#### 1. أوقف MongoDB
```powershell
# PowerShell كـ Administrator
net stop MongoDB
```

#### 2. عدل mongod.cfg

افتح: `C:\Program Files\MongoDB\Server\{version}\bin\mongod.cfg`

أضف في النهاية:
```yaml
replication:
  replSetName: "rs0"
```

احفظ الملف.

#### 3. شغل MongoDB
```powershell
net start MongoDB
```

#### 4. هيئ Replica Set
```bash
# في terminal عادي
npm run init:replica
```

---

## ✅ التحقق من النجاح

```bash
npm run check:replica
```

**يجب أن ترى:**
```
✅ MongoDB is configured as a Replica Set!
✅ Change Streams are working!
🎉 SUCCESS! Your MongoDB is ready for bidirectional sync!
```

---

## 🚀 تشغيل السيرفر

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

## ⚠️ إذا ظهر خطأ

### الخطأ: "Server selection timed out"

**السبب:** Replica Set لم يتم إعداده بعد

**الحل:**
1. أوقف السيرفر (Ctrl+C)
2. اتبع خطوات إعداد Replica Set أعلاه
3. شغل السيرفر مرة أخرى

---

### الخطأ: "Change Streams require replica set"

**السبب:** URI لا يحتوي على `?replicaSet=rs0` أو Replica Set غير مُهيأ

**الحل:**
1. تأكد من أن `.env` يحتوي على:
   ```
   MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba?replicaSet=rs0
   ```
2. شغل `npm run check:replica` للتحقق
3. إذا لم يكن Replica Set مُهيأ، اتبع الخطوات أعلاه

---

## 🧪 اختبار المزامنة

### بعد نجاح التشغيل:

**اختبار 1: Local → Atlas**
1. أضف فاتورة في التطبيق
2. افتح MongoDB Compass → اتصل بـ Atlas
3. يجب أن ترى الفاتورة

**اختبار 2: Atlas → Local**
1. في MongoDB Compass (Atlas)
2. أضف document في `bills`
3. يجب أن يظهر في التطبيق خلال 1-5 ثواني

---

## 📞 الدعم

### الأوامر المفيدة:

```bash
# التحقق من Replica Set
npm run check:replica

# تهيئة Replica Set
npm run init:replica

# مراقبة المزامنة
curl http://localhost:5000/api/sync/bidirectional/health
```

### الأدلة:
- **SETUP_STEP_BY_STEP.md** - دليل تفصيلي
- **FINAL_SUMMARY.md** - ملخص شامل
- **QUICK_START_BIDIRECTIONAL_SYNC.md** - خطوات كاملة

---

## 🎯 الخلاصة

**التعديلات جاهزة في `.env`!**

**الآن:**
1. أعد Replica Set (5 دقائق)
2. شغل السيرفر
3. استمتع بالمزامنة الثنائية! 🎉

---

**ابدأ الآن!** شغل `setup-replica-set.ps1` أو اتبع الخطوات اليدوية أعلاه 🚀
