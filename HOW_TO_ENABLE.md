# 🎯 كيف تفعل المزامنة الثنائية

## ✅ الوضع الحالي

- ✅ السيرفر يعمل الآن بشكل طبيعي
- ✅ المزامنة أحادية الاتجاه تعمل (Local → Atlas)
- ⏸️ المزامنة الثنائية معطلة (تحتاج Replica Set)

---

## 🚀 لتفعيل المزامنة الثنائية

### يجب عليك تعديل ملف واحد فقط!

**ملف `mongod.cfg`** في MongoDB

---

## 📝 الخطوات (5 دقائق)

### 1. أوقف MongoDB

افتح **PowerShell كـ Administrator**:

```powershell
net stop MongoDB
```

---

### 2. عدل mongod.cfg

**الموقع:**
```
C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg
```
(أو 8.0 أو 6.0 حسب إصدارك)

**كيف تفتحه:**
1. افتح File Explorer
2. اذهب للمسار أعلاه
3. انقر بزر الماوس الأيمن على `mongod.cfg`
4. اختر "Open with" → "Notepad"

**أضف في نهاية الملف:**
```yaml
replication:
  replSetName: "rs0"
```

**احفظ** (Ctrl+S)

---

### 3. شغل MongoDB

```powershell
net start MongoDB
```

---

### 4. هيئ Replica Set

في terminal عادي:

```bash
npm run init:replica
```

يجب أن ترى:
```
✅ Replica Set initialized successfully!
```

---

### 5. حدث .env

افتح `server/.env` وغير:

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

---

### 6. تحقق

```bash
npm run check:replica
```

يجب أن ترى:
```
✅ SUCCESS! Your MongoDB is ready for bidirectional sync!
```

---

### 7. شغل السيرفر

```bash
npm run server:dev
```

ابحث عن:
```
✅ Bidirectional sync is ENABLED
📊 Bidirectional Sync Status:
✅ Status: ACTIVE
🔄 Direction: Local ⇄ Atlas (bidirectional)
```

---

## 🎉 النتيجة

ستحصل على:
- ✅ مزامنة تلقائية ثنائية الاتجاه (Local ⇄ Atlas)
- ✅ حل تلقائي للتعارضات
- ✅ دعم أجهزة متعددة
- ✅ نسخ احتياطي تلقائي

---

## ❓ مشاكل شائعة

### المشكلة: "Access Denied" عند تعديل mongod.cfg

**الحل:**
1. افتح Notepad كـ Administrator أولاً
2. ثم افتح الملف من داخل Notepad

### المشكلة: لا أجد mongod.cfg

**الحل:**
ابحث في:
- `C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg`
- `C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg`
- `C:\Program Files\MongoDB\Server\6.0\bin\mongod.cfg`

---

**ابدأ من الخطوة 1!** 🚀
